import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from './db';
import { mediaFiles, thumbnails } from './db/schema';
import sharp from 'sharp';
import { eq, sql, inArray } from 'drizzle-orm';
import exifr from 'exifr'; // Fast native parser

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
        onProgress?: (progress: ScanProgress) => void
    ): Promise<ScanResult> {
        const result: ScanResult = { added: 0, skipped: 0, errors: 0 };

        try {
            await this.walk(dirPath, result, options, onProgress);
        } catch (err) {
            console.error(`Error scanning ${dirPath}:`, err);
        }

        return result;
    }

    // Recursive walker
    async walk(
        dir: string,
        result: ScanResult,
        options: { includeSubfolders: boolean; scanProjects?: boolean },
        onProgress?: (progress: ScanProgress) => void
    ) {
        try {
            if (onProgress) onProgress({ status: 'scanning', file: dir, description: 'Scanning folder...' });

            const list = await fs.promises.readdir(dir);
            for (const file of list) {
                const filePath = path.join(dir, file);
                try {
                    // Use lstat to avoid following symlinks which cause infinite loops
                    const stat = await fs.promises.lstat(filePath);
                    if (stat.isDirectory()) {
                        if (options.includeSubfolders) {
                            console.log(`Scanning subdir: ${filePath}`);
                            await this.walk(filePath, result, options, onProgress);
                        }
                    } else {
                        console.log(`Processing file: ${filePath}`);
                        await this.processFile(filePath, result, options, onProgress);
                    }
                } catch (e) {
                    console.error(`Failed to stat ${filePath}`, e);
                    result.errors++;
                }
            }
        } catch (e) {
            console.error(`Failed to read dir ${dir}`, e);
            result.errors++;
        }
    }

    private async processFile(
        filePath: string,
        result: ScanResult,
        options: { scanProjects?: boolean },
        onProgress?: (progress: ScanProgress) => void
    ) {
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
                metadata: null
            }).returning({ id: mediaFiles.id }).get();

            const mediaId = insertResult.id;

            // 2. Generate Thumbnail (Priority for UI)
            if (type === 'image') {
                if (onProgress) onProgress({ status: 'generating_thumbnail', file: filePath, description: 'Generating thumbnail...' });
                try {
                    console.log(`[Thumbnail] Start generation: ${filePath}`);
                    const thumbnailBuffer = await sharp(filePath)
                        .resize({ width: 300, height: 300, fit: 'cover' })
                        .webp({ quality: 80 })
                        .toBuffer();

                    this.db.insert(thumbnails).values({
                        mediaId: mediaId,
                        data: thumbnailBuffer,
                        format: 'webp'
                    }).run();
                    console.log(`[Thumbnail] Finished generation: ${filePath}`);
                } catch (thumbErr) {
                    console.error(`Failed to generate thumbnail for ${filePath}: ${(thumbErr as Error).message}`);
                }
            }

            // 3. Extract Metadata via exifr (Fast Native)
            if (type === 'image') {
                try {
                    if (onProgress) onProgress({ status: 'processing', file: filePath, description: 'Extracting metadata...' });
                    console.log(`[Exif] Start reading (exifr): ${filePath}`);

                    // Parse: get everything available efficiently
                    metadata = await exifr.parse(filePath, {
                        tiff: true,
                        xmp: true,
                        icc: false, // ICC often invalid UTF8, skip for safety
                        // ifd0/ifd1 are handled under tiff or specific blocks, explicit boolean types cause TS issues
                        exif: true,
                        gps: true,
                        interop: true,
                    });

                    console.log(`[Exif] Finished reading: ${filePath}`);
                } catch (e) {
                    console.error(`Metadata parsing failed for ${filePath}`, e);
                    console.log(`[Exif] Fallback: Using file modification time.`);
                    // Fallback to minimal metadata from stat so date is correct in UI
                    metadata = {
                        modify_date: stat.mtime,
                        ModifyDate: stat.mtime,
                        fallback: true,
                        error: (e as Error).message
                    };
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
            }

            result.added++;
        } catch (err) {
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
