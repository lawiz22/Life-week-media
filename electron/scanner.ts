import fs from 'fs';
import { parseFile } from 'music-metadata';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { getDb } from './db';
import { mediaFiles, thumbnails } from './db/schema';
import sharp from 'sharp';
import { eq, sql, inArray } from 'drizzle-orm';
import exifr from 'exifr'; // Fast native parser
import { createRequire } from 'module';
import { spawn } from 'child_process';

// Fix for ESM/Electron "ReferenceError: __dirname is not defined" with legacy libs
const require = createRequire(import.meta.url);
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

// Disable sharp cache to prevent EPERM file locking on Windows
sharp.cache(false);

export interface ScanResult {
    added: number;
    skipped: number;
    errors: number;
}

export type ScanStatus = 'scanning' | 'processing' | 'generating_thumbnail';

export interface ScanProgress {
    status: ScanStatus;
    file?: string;
    description?: string;
}

export class FileScanner {
    private db = getDb();

    async scanDirectory(
        dirPath: string,
        options: { includeSubfolders: boolean; scanProjects?: boolean } = { includeSubfolders: false, scanProjects: false },
        onProgress?: (progress: ScanProgress) => void,
        signal?: AbortSignal
    ): Promise<ScanResult> {
        const result: ScanResult = { added: 0, skipped: 0, errors: 0 };

        try {
            await this.walk(dirPath, result, options, onProgress, signal);
        } catch (err) {
            if ((err as Error).message === 'Scan cancelled') {
                console.log('Scan cancelled by user');
            } else {
                console.error(`Error scanning ${dirPath}:`, err);
            }
        }

        return result;
    }

    // Recursive walker
    async walk(
        dir: string,
        result: ScanResult,
        options: { includeSubfolders: boolean; scanProjects?: boolean },
        onProgress?: (progress: ScanProgress) => void,
        signal?: AbortSignal
    ) {
        if (signal?.aborted) throw new Error('Scan cancelled');

        try {
            if (onProgress) onProgress({ status: 'scanning', file: dir, description: 'Scanning folder...' });

            const list = await fs.promises.readdir(dir);
            for (const file of list) {
                if (signal?.aborted) throw new Error('Scan cancelled');

                const filePath = path.join(dir, file);
                try {
                    // Use lstat to avoid following symlinks which cause infinite loops
                    const stat = await fs.promises.lstat(filePath);
                    if (stat.isDirectory()) {
                        if (options.includeSubfolders) {
                            console.log(`Scanning subdir: ${filePath}`);
                            await this.walk(filePath, result, options, onProgress, signal);
                        }
                    } else {
                        console.log(`Processing file: ${filePath}`);
                        await this.processFile(filePath, result, options, onProgress, signal);
                    }
                } catch (e) {
                    if ((e as Error).message === 'Scan cancelled') throw e;
                    console.error(`Failed to stat ${filePath}`, e);
                    result.errors++;
                }
            }
        } catch (e) {
            if ((e as Error).message === 'Scan cancelled') throw e;
            console.error(`Failed to read dir ${dir}`, e);
            result.errors++;
        }
    }

    private async processFile(
        filePath: string,
        result: ScanResult,
        options: { scanProjects?: boolean },
        onProgress?: (progress: ScanProgress) => void,
        signal?: AbortSignal
    ) {
        if (signal?.aborted) throw new Error('Scan cancelled');

        try {
            if (onProgress) onProgress({ status: 'processing', file: filePath });

            // Check if already in DB
            const existing = this.db.select().from(mediaFiles).where(eq(mediaFiles.filepath, filePath)).get();
            if (existing) {
                result.skipped++;
                return;
            }

            const stat = await fs.promises.stat(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const type = this.getFileType(ext);

            // Only import relevant types
            if (type === 'unknown') return;
            if (type === 'project' && !options.scanProjects) return;

            // Filter Small Images (Junk/Thumbnails)
            if (type === 'image') {
                try {
                    const meta = await sharp(filePath).metadata();
                    if ((meta.width || 0) < 400 && (meta.height || 0) < 400) {
                        console.log(`[Skipped] Small image: ${path.basename(filePath)} (${meta.width}x${meta.height})`);
                        result.skipped++;
                        return;
                    }
                } catch (e) {
                    console.warn(`[Warning] Could not read image dims for ${filePath}, skipping filter.`);
                }
            }

            const hash = await this.calculateHash(filePath);
            let metadata = null;

            // 1. Insert Media File (Initial - Metadata placeholder)
            const insertResult = this.db.insert(mediaFiles).values({
                filepath: filePath,
                filename: path.basename(filePath),
                type,
                size: stat.size,
                createdAt: Math.floor(stat.birthtimeMs),
                hash,
                metadata: '{}' // Temp placeholder
            }).returning({ id: mediaFiles.id }).get();

            const mediaId = insertResult.id;

            if (signal?.aborted) throw new Error('Scan cancelled');

            // 2. Generate Thumbnail (Priority for UI)
            if (type === 'image') {
                if (onProgress) onProgress({ status: 'generating_thumbnail', file: filePath, description: 'Generating thumbnail...' });
                try {
                    console.log(`[Thumbnail] Start generation (Image): ${filePath}`);
                    const thumbnailBuffer = await sharp(filePath)
                        .resize({ width: 300, height: 300, fit: 'cover' })
                        .webp({ quality: 80 })
                        .toBuffer();

                    this.db.insert(thumbnails).values({
                        mediaId: mediaId,
                        data: thumbnailBuffer,
                        format: 'webp'
                    }).run();
                } catch (thumbErr) {
                    console.error(`Failed to generate thumbnail for ${filePath}: ${(thumbErr as Error).message}`);
                }
            } else if (type === 'video') {
                if (onProgress) onProgress({ status: 'generating_thumbnail', file: filePath, description: 'Generating video thumbnail...' });
                try {
                    const t0 = performance.now();
                    const isBigVideo = stat.size > 500 * 1024 * 1024; // 500MB
                    const timestamp = isBigVideo ? '00:00:22.000' : '00:00:10.000';

                    console.log(`[Thumbnail] Video: ${path.basename(filePath)} | Size: ${(stat.size / 1024 / 1024).toFixed(2)}MB | Seek: ${timestamp}`);

                    const tempThumb = path.join(os.tmpdir(), `thumb_${mediaId}_${Date.now()}.jpg`); // Use jpg for speed

                    await Promise.race([
                        new Promise((resolve, reject) => {
                            // Raw spawn to guarantee "-ss" is before "-i" (Input Seeking)
                            const args = [
                                '-y',              // Overwrite
                                '-ss', timestamp,  // Seek BEFORE input (Fast)
                                '-i', filePath,    // Input
                                '-vframes', '1',   // 1 frame
                                '-f', 'image2',    // Format
                                tempThumb
                            ];

                            const proc = spawn(ffmpegPath, args);

                            proc.on('close', (code) => {
                                if (code === 0) resolve(null);
                                else reject(new Error(`FFmpeg exited with code ${code}`));
                            });

                            proc.on('error', (err) => reject(err));
                        }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
                    ]);

                    const t1 = performance.now();
                    console.log(`[Thumbnail] FFmpeg took ${(t1 - t0).toFixed(2)}ms for ${path.basename(filePath)}`);

                    if (signal?.aborted) {
                        try { await fs.promises.unlink(tempThumb); } catch { }
                        throw new Error('Scan cancelled');
                    }

                    // Convert to webp
                    const thumbnailBuffer = await sharp(tempThumb)
                        .resize({ width: 300, height: 300, fit: 'cover' })
                        .webp({ quality: 80 })
                        .toBuffer();

                    this.db.insert(thumbnails).values({
                        mediaId: mediaId,
                        data: thumbnailBuffer,
                        format: 'webp'
                    }).run();

                    // Cleanup: Safe unlink (ignore EPERM if file is locked)
                    try {
                        await fs.promises.unlink(tempThumb);
                    } catch (e) {
                        // warning only, don't fail the scan
                        console.warn(`[Cleanup] Could not delete temp file ${tempThumb}: ${(e as Error).message}`);
                    }
                    console.log(`[Thumbnail] Finished video thumbnail: ${filePath}`);
                } catch (vidErr) {
                    if ((vidErr as Error).message === 'Scan cancelled') throw vidErr;
                    console.error(`Failed to generate video thumbnail for ${filePath}`, vidErr);
                }

            } else if (type === 'audio') {
                // Audio Metadata & Thumbnail (Cover Art or Waveform)
                if (onProgress) onProgress({ status: 'generating_thumbnail', file: filePath, description: 'Processing audio metadata...' });
                try {
                    let coverBuffer: Buffer | null = null;
                    let audioMeta: any = {};

                    // 1. Try to extract metadata and cover art
                    try {
                        const metadata = await parseFile(filePath);
                        const common = metadata.common;

                        audioMeta = {
                            title: common.title,
                            artist: common.artist,
                            album: common.album,
                            genre: common.genre,
                            year: common.year
                        };

                        if (common.picture && common.picture.length > 0) {
                            const pic = common.picture[0];
                            console.log(`[Audio] Found embedded cover art for ${path.basename(filePath)}`);
                            coverBuffer = await sharp(pic.data)
                                .resize({ width: 300, height: 300, fit: 'cover' })
                                .webp({ quality: 80 })
                                .toBuffer();
                        }
                    } catch (metaErr) {
                        console.warn(`[Audio] Failed to parse tags for ${filePath}: ${(metaErr as Error).message}`);
                    }

                    // Update DB with rich metadata
                    this.db.update(mediaFiles)
                        .set({ metadata: JSON.stringify(audioMeta) })
                        .where(eq(mediaFiles.id, mediaId))
                        .run();


                    // 2. Save Thumbnail (Cover Art OR Waveform)
                    if (coverBuffer) {
                        // Use extracted cover art
                        this.db.insert(thumbnails).values({
                            mediaId: mediaId,
                            data: coverBuffer,
                            format: 'webp'
                        }).run();
                    } else {
                        // Fallback: Generate Waveform (with Generic Fallback on Error)
                        const tempThumb = path.join(os.tmpdir(), `wave_${mediaId}_${Date.now()}.png`);

                        try {
                            await Promise.race([
                                new Promise((resolve, reject) => {
                                    const args = [
                                        '-y',
                                        '-t', '60',        // Optimization: Read max 60s of audio for waveform
                                        '-i', filePath,
                                        '-filter_complex', 'showwavespic=s=300x300:colors=#4299e1',
                                        '-frames:v', '1',
                                        tempThumb
                                    ];
                                    const proc = spawn(ffmpegPath, args);
                                    proc.on('close', (code) => {
                                        if (code === 0) resolve(null);
                                        else reject(new Error(`FFmpeg waveform exited with code ${code}`));
                                    });
                                    proc.on('error', (err) => reject(err));
                                }),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000)) // Increased to 30s
                            ]);

                            if (signal?.aborted) {
                                try { await fs.promises.unlink(tempThumb); } catch { }
                                throw new Error('Scan cancelled');
                            }

                            const thumbnailBuffer = await sharp(tempThumb)
                                .resize({ width: 300, height: 300, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                                .webp({ quality: 80 })
                                .toBuffer();

                            this.db.insert(thumbnails).values({
                                mediaId: mediaId,
                                data: thumbnailBuffer,
                                format: 'webp'
                            }).run();

                            try { await fs.promises.unlink(tempThumb); } catch (e) { }

                        } catch (waveformErr) {
                            if ((waveformErr as Error).message === 'Scan cancelled') throw waveformErr;

                            console.warn(`[Audio] Waveform generation failed/timed out for ${path.basename(filePath)}, using generic icon. Error: ${(waveformErr as Error).message}`);

                            // Fallback: Create Generic Music Icon (Blue Square)
                            try {
                                const genericBuffer = await sharp({
                                    create: {
                                        width: 300,
                                        height: 300,
                                        channels: 4,
                                        background: { r: 30, g: 41, b: 59, alpha: 1 } // slate-800
                                    }
                                })
                                    .composite([{
                                        input: Buffer.from('<svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'),
                                        gravity: 'center'
                                    }])
                                    .webp({ quality: 80 })
                                    .toBuffer();

                                this.db.insert(thumbnails).values({
                                    mediaId: mediaId,
                                    data: genericBuffer,
                                    format: 'webp'
                                }).run();
                            } catch (genErr) {
                                console.error('Failed to create generic thumbnail', genErr);
                            }
                        }
                    }

                } catch (audioErr) {
                    console.error(`Failed to process audio ${filePath}: ${(audioErr as Error).message}`);
                }
            }

            if (signal?.aborted) throw new Error('Scan cancelled');

            // 3. Extract Metadata via exifr (Fast Native) - OPTIMIZED: Skip videos
            if (type === 'image') {
                try {
                    if (onProgress) onProgress({ status: 'processing', file: filePath, description: 'Extracting metadata...' });

                    // Parse: get everything available efficiently
                    metadata = await exifr.parse(filePath, {
                        tiff: true,
                        xmp: true,
                        icc: false,
                        exif: true,
                        gps: true,
                        interop: true,
                    });

                    // Sanitize Dates: Filter out any individual date that is pre-1970
                    const dateKeys = ['ModifyDate', 'DateTimeOriginal', 'CreateDate', 'modify_date', 'date_time_original', 'create_date'];
                    let hasValidDate = false;

                    for (const key of dateKeys) {
                        const val = metadata?.[key];
                        let isValidField = false;

                        if (val) {
                            const d = new Date(val);
                            if (!isNaN(d.getTime()) && d.getFullYear() >= 1970) {
                                isValidField = true;
                                hasValidDate = true;
                            }
                        }

                        if (metadata && val && !isValidField) {
                            console.log(`[Exif] Invalid date for ${key}: ${val}. Removing.`);
                            delete metadata[key];
                        }
                    }

                    // Ensure object exists
                    if (!metadata) metadata = {};

                    if (!hasValidDate) {
                        console.log(`[Exif] Warning: No valid >1970 date found for ${filePath}. Injecting mtime.`);

                        metadata.ModifyDate = stat.mtime;
                        metadata.modify_date = stat.mtime;

                        if (stat.birthtime.getFullYear() >= 1970) {
                            metadata.CreateDate = stat.birthtime;
                            metadata.create_date = stat.birthtime;
                        } else {
                            metadata.CreateDate = stat.mtime;
                            metadata.create_date = stat.mtime;
                        }

                        metadata.fallback = true;
                    }

                    console.log(`[Exif] Finished reading: ${filePath}`);
                } catch (e) {
                    console.log(`[Exif] Fallback: Using file modification time (Exifr failed or not supported).`);
                    metadata = {
                        modify_date: stat.mtime,
                        ModifyDate: stat.mtime,
                        fallback: true,
                        error: (e as Error).message
                    };

                    if (stat.birthtime.getFullYear() >= 1970) {
                        metadata.CreateDate = stat.birthtime;
                        metadata.create_date = stat.birthtime;
                    } else {
                        metadata.CreateDate = stat.mtime;
                        metadata.create_date = stat.mtime;
                    }
                }

                if (metadata) {
                    try {
                        this.db.update(mediaFiles)
                            .set({ metadata })
                            .where(eq(mediaFiles.id, mediaId))
                            .run();
                    } catch (updateErr) {
                        console.error('Failed to update metadata in DB', updateErr);
                    }
                }
            } else if (type === 'video') {
                // For videos, skip expensive parsing and just use file stats immediately
                const metadata: any = {
                    ModifyDate: stat.mtime,
                    modify_date: stat.mtime,
                    fallback: true
                };

                if (stat.birthtime.getFullYear() >= 1970) {
                    metadata.CreateDate = stat.birthtime;
                    metadata.create_date = stat.birthtime;
                } else {
                    metadata.CreateDate = stat.mtime;
                    metadata.create_date = stat.mtime;
                }

                this.db.update(mediaFiles).set({ metadata }).where(eq(mediaFiles.id, mediaId)).run();
            }

            result.added++;
        } catch (err) {
            if ((err as Error).message === 'Scan cancelled') throw err;
            console.error(`Failed to process ${filePath}`, err);
            result.errors++;
        }
    }

    private getFileType(ext: string): string {
        const images = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        const videos = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
        const audio = ['.mp3', '.wav', '.flac', '.aac', '.m4a'];
        const docs = ['.pdf', '.doc', '.docx', '.txt'];
        const projects = ['.als', '.uproject', '.unity', '.logicx', '.flp', '.prproj', '.drp'];

        if (images.includes(ext)) return 'image';
        if (videos.includes(ext)) return 'video';
        if (audio.includes(ext)) return 'audio';
        if (docs.includes(ext)) return 'document';
        if (projects.includes(ext)) return 'project';
        return 'unknown';
    }

    private async calculateHash(filePath: string): Promise<string> {
        const stat = await fs.promises.stat(filePath);
        const FILE_SIZE_THRESHOLD = 50 * 1024 * 1024; // 50MB

        // Fast path for large files: Hash size + mtime + first 16KB
        if (stat.size > FILE_SIZE_THRESHOLD) {
            const fd = await fs.promises.open(filePath, 'r');
            try {
                const buffer = Buffer.alloc(16 * 1024); // 16KB
                await fd.read(buffer, 0, 16 * 1024, 0);

                const hash = crypto.createHash('md5');
                hash.update(stat.size.toString());
                hash.update(stat.mtimeMs.toString());
                hash.update(buffer);
                return hash.digest('hex');
            } finally {
                await fd.close();
            }
        }

        // Full hash for small files
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('md5');
            const stream = fs.createReadStream(filePath);
            stream.on('error', err => reject(err));
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    async getDuplicates() {
        const duplicatedHashes = await this.db
            .select({ hash: mediaFiles.hash })
            .from(mediaFiles)
            .groupBy(mediaFiles.hash)
            .having(sql`count(*) > 1`)
            .all();

        const hashes = duplicatedHashes
            .map(d => d.hash)
            .filter((h): h is string => h !== null);

        if (hashes.length === 0) return [];

        return this.db
            .select()
            .from(mediaFiles)
            .where(inArray(mediaFiles.hash, hashes))
            .orderBy(mediaFiles.hash)
            .all();
    }

    async getFiles(type: string) {
        return this.db
            .select()
            .from(mediaFiles)
            .where(eq(mediaFiles.type, type))
            .orderBy(mediaFiles.createdAt) // or desc
            .all();
    }
}
