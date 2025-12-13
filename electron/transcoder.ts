import type Ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

// Lazy-loaded FFmpeg modules
let ffmpeg: typeof Ffmpeg | null = null;
let ffmpegPath: string | null = null;

async function initFfmpeg() {
    if (!ffmpeg) {
        const ffmpegModule = await import('fluent-ffmpeg');
        const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
        ffmpeg = ffmpegModule.default;
        ffmpegPath = ffmpegInstaller.default.path;
        ffmpeg.setFfmpegPath(ffmpegPath);
    }
    return ffmpeg;
}

interface TranscodeOptions {
    inputPath: string;
    outputPath: string;
    onProgress?: (progress: number) => void;
}

export class VideoTranscoder {
    private cacheDir: string;

    constructor() {
        // Create cache directory in temp folder
        this.cacheDir = path.join(os.tmpdir(), 'lifeweek-media-transcoded');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    /**
     * Check if a video format needs transcoding
     */
    needsTranscoding(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        const unsupportedFormats = ['.avi', '.mpg', '.mpeg', '.wmv', '.m2v', '.vob', '.flv', '.f4v'];

        // Also check for .mov files (some older MOV files with legacy codecs need transcoding)
        // We'll transcode all MOV files to be safe, as codec detection is complex
        if (ext === '.mov') {
            return true;
        }

        return unsupportedFormats.includes(ext);
    }

    /**
     * Get cached transcoded file path if it exists
     */
    getCachedPath(inputPath: string): string | null {
        const hash = crypto.createHash('md5').update(inputPath).digest('hex');
        const cachedPath = path.join(this.cacheDir, `${hash}.mp4`);

        if (fs.existsSync(cachedPath)) {
            // Check if source file is newer than cached file
            const sourceStats = fs.statSync(inputPath);
            const cachedStats = fs.statSync(cachedPath);

            if (sourceStats.mtime <= cachedStats.mtime) {
                return cachedPath;
            } else {
                // Source file was modified, delete old cache
                fs.unlinkSync(cachedPath);
            }
        }

        return null;
    }

    /**
     * Transcode video to MP4/H.264
     */
    async transcode(options: TranscodeOptions): Promise<void> {
        const { inputPath, outputPath, onProgress } = options;

        // Initialize FFmpeg
        const ffmpegInstance = await initFfmpeg();

        return new Promise((resolve, reject) => {
            let duration = 0;

            const command = ffmpegInstance(inputPath)
                .outputOptions([
                    '-c:v libx264',           // H.264 video codec
                    '-preset fast',            // Fast encoding preset
                    '-crf 23',                 // Constant Rate Factor (quality: 0-51, lower is better)
                    '-c:a aac',                // AAC audio codec
                    '-b:a 128k',               // Audio bitrate
                    '-movflags +faststart',    // Enable streaming
                    '-max_muxing_queue_size 1024' // Prevent muxing errors
                ])
                .output(outputPath)
                .on('codecData', (data) => {
                    // Get video duration for progress calculation
                    if (data.duration) {
                        const parts = data.duration.split(':');
                        duration = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
                    }
                })
                .on('progress', (progress) => {
                    if (onProgress && duration > 0 && progress.timemark) {
                        const parts = progress.timemark.split(':');
                        const currentTime = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
                        const percent = (currentTime / duration) * 100;
                        onProgress(Math.min(percent, 100));
                    }
                })
                .on('end', () => {
                    console.log(`Transcoding completed: ${outputPath}`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`Transcoding error: ${err.message}`);
                    // Clean up partial output file
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }
                    reject(err);
                });

            command.run();
        });
    }

    /**
     * Get transcoded video path (from cache or transcode on-demand)
     */
    async getTranscodedPath(inputPath: string, onProgress?: (progress: number) => void): Promise<string> {
        // Check cache first
        const cachedPath = this.getCachedPath(inputPath);
        if (cachedPath) {
            console.log(`Using cached transcoded file: ${cachedPath}`);
            return cachedPath;
        }

        // Transcode to cache
        const hash = crypto.createHash('md5').update(inputPath).digest('hex');
        const outputPath = path.join(this.cacheDir, `${hash}.mp4`);

        console.log(`Transcoding ${inputPath} to ${outputPath}...`);
        await this.transcode({ inputPath, outputPath, onProgress });

        return outputPath;
    }

    /**
     * Clear cache directory
     */
    clearCache(): void {
        if (fs.existsSync(this.cacheDir)) {
            const files = fs.readdirSync(this.cacheDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(this.cacheDir, file));
            });
            console.log('Transcoding cache cleared');
        }
    }

    /**
     * Get cache size in bytes
     */
    getCacheSize(): number {
        if (!fs.existsSync(this.cacheDir)) {
            return 0;
        }

        let totalSize = 0;
        const files = fs.readdirSync(this.cacheDir);
        files.forEach(file => {
            const stats = fs.statSync(path.join(this.cacheDir, file));
            totalSize += stats.size;
        });

        return totalSize;
    }
}

// Singleton instance
let transcoderInstance: VideoTranscoder | null = null;

export function getTranscoder(): VideoTranscoder {
    if (!transcoderInstance) {
        transcoderInstance = new VideoTranscoder();
    }
    return transcoderInstance;
}
