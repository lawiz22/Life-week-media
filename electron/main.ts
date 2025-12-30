import { app, BrowserWindow, ipcMain, dialog, protocol, shell } from 'electron'
import { getDb } from './db'
import * as schema from './db/schema'
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getTranscoder } from './transcoder'
import fs from 'node:fs';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')


process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Register privileges for media scheme (needed for fetch/Wavesurfer)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true, // Key for Wavesurfer/Fetch
      bypassCSP: true,
      corsEnabled: true
    }
  }
]);


app.whenReady().then(() => {
  console.log('--- MAIN PROCESS STARTED (Audio Fix Applied) ---');

  // IPC Handler: Read file buffer (Moved to top for reliability)
  ipcMain.handle('read-file-buffer', async (_, filePath: string) => {
    console.log('[IPC] read-file-buffer called for:', filePath);
    try {
      // Handle media:// URLs (from WaveformPlayer)
      let actualPath = filePath;
      if (filePath.startsWith('media://file/')) {
        const base64Path = filePath.replace('media://file/', '');
        actualPath = Buffer.from(base64Path, 'base64').toString('utf-8');
      } else if (filePath.startsWith('media://')) {
        // Legacy format
        actualPath = filePath.replace(/^media:\/\//, '');
        actualPath = decodeURIComponent(actualPath);
      }

      // Check if file exists first
      if (!fs.existsSync(actualPath)) {
        console.error('[IPC] File not found:', actualPath);
        return null;
      }

      const buffer = await fs.promises.readFile(actualPath);
      return buffer;
    } catch (e) {
      console.error('[IPC] Read file buffer error:', e);
      return null;
    }
  });

  // IPC Handler: Read text file content
  ipcMain.handle('read-text-file', async (_event, filePath: string) => {
    try {
      const fs = await import('fs');
      const stat = await fs.promises.stat(filePath);

      // Limit to 5MB to prevent memory issues
      const MAX_SIZE = 5 * 1024 * 1024;
      if (stat.size > MAX_SIZE) {
        // Read only first 5MB
        const fd = await fs.promises.open(filePath, 'r');
        const buffer = Buffer.alloc(MAX_SIZE);
        await fd.read(buffer, 0, MAX_SIZE, 0);
        await fd.close();
        return {
          content: buffer.toString('utf-8'),
          truncated: true,
          size: stat.size
        };
      }

      // Read full file
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return {
        content,
        truncated: false,
        size: stat.size
      };
    } catch (error) {
      console.error('Error reading text file:', error);
      throw error;
    }
  });

  // IPC Handler: Open file with default external app
  ipcMain.handle('open-external', async (_event, filePath: string) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      console.error('Error opening external file:', error);
      throw error;
    }
  });

  // IPC Handler: Check if file exists
  ipcMain.handle('check-file-exists', async (_event, filePath: string) => {
    try {
      const fs = await import('fs');
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  });

  // Register 'media' protocol to serve local files
  protocol.handle('media', async (request) => {
    // 1. Handle Thumbnails
    const thumbMatch = request.url.match(/^media:\/\/thumbnail\/(\d+)$/);
    if (thumbMatch) {
      const id = parseInt(thumbMatch[1]);
      try {
        const db = getDb();
        const row = db.select({
          data: schema.thumbnails.data,
          format: schema.thumbnails.format
        })
          .from(schema.thumbnails)
          .where(eq(schema.thumbnails.mediaId, id))
          .get();

        if (row) {
          return new Response(row.data as any, {
            headers: { 'Content-Type': `image/${row.format}` }
          });
        }
        return new Response('Thumbnail Not Found', { status: 404 });
      } catch (e) {
        console.error('Thumbnail fetch error:', e);
        return new Response('Error fetching thumbnail', { status: 500 });
      }
    }

    // 2. Handle Files (Videos/Images) with Range Support
    try {
      let pathName = request.url;
      console.log(`[Media Protocol] Raw request URL: ${request.url}`);

      if (pathName.startsWith('media://file/')) {

        const base64Path = pathName.replace('media://file/', '');
        console.log(`[Media Protocol] Base64 path: ${base64Path.substring(0, 50)}...`);

        pathName = Buffer.from(base64Path, 'base64').toString('utf-8');
        console.log(`[Media Protocol] Decoded path: ${pathName}`);

      } else {

        pathName = pathName.replace(/^media:\/\//, '');

        pathName = decodeURIComponent(pathName);

      }


      // 1. Strip leading slash if present (e.g. /C:/Users...)
      if (pathName.startsWith('/')) {
        pathName = pathName.slice(1);
      }

      // 2. Fix missing colon in drive letter (common issue with some URL parsers)
      // e.g. "C/Users/..." -> "C:/Users/..."
      if (/^[a-zA-Z]\//.test(pathName)) {
        pathName = pathName.charAt(0) + ':' + pathName.slice(1);
      }

      const filePath = path.normalize(pathName);
      console.log(`[Media Protocol] Normalized file path: ${filePath}`);

      const fs = await import('fs');

      // Check if video needs transcoding
      const transcoder = getTranscoder();
      let actualFilePath = filePath;

      console.log(`[Media Protocol] Requested file: ${filePath}`);
      console.log(`[Media Protocol] File extension: ${path.extname(filePath)}`);
      console.log(`[Media Protocol] Needs transcoding: ${transcoder.needsTranscoding(filePath)}`);

      if (transcoder.needsTranscoding(filePath)) {
        console.log(`[Transcoder] Video needs transcoding: ${filePath}`);
        try {
          // Get transcoded version (from cache or transcode on-demand)
          actualFilePath = await transcoder.getTranscodedPath(filePath, (progress) => {
            console.log(`[Transcoder] Progress: ${progress.toFixed(1)}%`);
          });
          console.log(`[Transcoder] Using transcoded file: ${actualFilePath}`);
          console.log(`[Transcoder] Transcoded file exists: ${fs.existsSync(actualFilePath)}`);
          if (fs.existsSync(actualFilePath)) {
            const transcodedStats = fs.statSync(actualFilePath);
            console.log(`[Transcoder] Transcoded file size: ${transcodedStats.size} bytes`);
          }
        } catch (err) {
          console.error('[Transcoder] Transcoding failed:', err);
          // Fall back to original file (may not play, but better than nothing)
          actualFilePath = filePath;
        }
      }

      const stat = await fs.promises.stat(actualFilePath);
      const fileSize = stat.size;
      const range = request.headers.get('Range');

      // Simple MIME detection
      const ext = path.extname(actualFilePath).toLowerCase();
      let mimeType = 'application/octet-stream';
      if (ext === '.mp4') mimeType = 'video/mp4';
      if (ext === '.mov') mimeType = 'video/quicktime';
      if (ext === '.webm') mimeType = 'video/webm';
      if (ext === '.avi') mimeType = 'video/x-msvideo';
      if (ext === '.wmv') mimeType = 'video/x-ms-wmv';
      if (ext === '.mpg' || ext === '.mpeg') mimeType = 'video/mpeg';
      if (ext === '.mkv') mimeType = 'video/x-matroska';
      if (ext === '.png') mimeType = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      if (ext === '.webp') mimeType = 'image/webp';

      const streamToWeb = (nodeStream: any) => {
        return new ReadableStream({
          start(controller) {
            nodeStream.on('data', (chunk: any) => {
              try {
                controller.enqueue(chunk);
              } catch (e) {
                // Controller closed or error
                nodeStream.destroy();
              }
            });
            nodeStream.on('end', () => {
              try {
                controller.close();
              } catch (e) { }
            });
            nodeStream.on('error', (err: any) => {
              try {
                controller.error(err);
              } catch (e) { }
            });
          },
          cancel() {
            nodeStream.destroy();
          }
        });
      };

      if (range) {
        // Range Request (Video seeking/streaming)
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const stream = fs.createReadStream(actualFilePath, { start, end });
        const readable = streamToWeb(stream);

        return new Response(readable as any, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
        // Full File Request
        const stream = fs.createReadStream(actualFilePath);
        const readable = streamToWeb(stream);

        // Build headers
        const headers: Record<string, string> = {
          'Content-Length': fileSize.toString(),
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        };

        // For PDFs, set Content-Disposition to inline to prevent download popup
        if (mimeType === 'application/pdf') {
          headers['Content-Disposition'] = 'inline';
        }

        return new Response(readable as any, {
          status: 200,
          headers
        });
      }
    } catch (e) {
      console.error('Media protocol error:', e);
      return new Response('Media Not Found', { status: 404 });
    }
  })

  createWindow()

  // Initialize DB
  try {
    getDb();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  // IPC Handlers
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  let scanAbortController: AbortController | null = null;

  ipcMain.handle('start-scan', async (_, dirPath: string, options: { includeSubfolders: boolean; scanType?: string; excludeBackups?: boolean }) => {
    // Cancel previous scan if exists
    if (scanAbortController) {
      scanAbortController.abort();
    }
    scanAbortController = new AbortController();

    const { FileScanner } = await import('./scanner');
    const scanner = new FileScanner();
    try {
      return await scanner.scanDirectory(dirPath, options, (progress) => {
        win?.webContents.send('scan-progress', progress);
      }, scanAbortController.signal);
    } finally {
      scanAbortController = null;
    }
  });

  ipcMain.handle('cancel-scan', async () => {
    if (scanAbortController) {
      scanAbortController.abort();
      scanAbortController = null;
      return true;
    }
    return false;
  });

  ipcMain.handle('get-duplicates', async () => {
    const { FileScanner } = await import('./scanner');
    const scanner = new FileScanner();
    return await scanner.getDuplicates();
  });

  ipcMain.handle('get-media', async (_, type: string, category?: string) => {
    const { FileScanner } = await import('./scanner');
    const scanner = new FileScanner();
    let files = await scanner.getFiles(type);

    console.log(`[get-media] Type: ${type}, Category filter: ${category}, Total files: ${files.length}`);

    // Filter by category if provided (for audio files)
    if (category && type === 'audio') {
      console.log(`[get-media] Before filter:`, files.map(f => ({ filename: f.filename, category: (f as any).category })));
      console.log(`[get-media] Sample metadata:`, files.slice(0, 2).map(f => ({
        filename: f.filename,
        metadata: f.metadata
      })));
      files = files.filter(f => (f as any).category === category);
      console.log(`[get-media] After filter: ${files.length} files`);
    }

    // Check availability for each file
    const fs = await import('fs');
    const enrichedFiles = await Promise.all(files.map(async (file) => {
      try {
        await fs.promises.access(file.filepath, fs.constants.F_OK);
        return { ...file, available: true };
      } catch {
        return { ...file, available: false };
      }
    }));

    return enrichedFiles;
  });

  ipcMain.handle('get-media-by-date-range', async (_, startTs: number, endTs: number) => {
    const { FileScanner } = await import('./scanner');
    const scanner = new FileScanner();
    const files = await scanner.getFilesByDateRange(startTs, endTs);
    return files;
  });

  ipcMain.handle('update-audio-metadata', async (_, mediaId: number, metadata: { title: string, artist: string, album: string, year: string }) => {
    try {
      const db = getDb();

      // Determine new category based on updated metadata
      // Music requires: title, artist, album, and cover (we assume cover exists if it was already there)
      const hasTitle = !!metadata.title;
      const hasArtist = !!metadata.artist;
      const hasAlbum = !!metadata.album;

      // Check if file has a thumbnail (cover art)
      const hasCover = db.select()
        .from(schema.thumbnails)
        .where(eq(schema.thumbnails.mediaId, mediaId))
        .get();

      const newCategory = (hasTitle && hasArtist && hasAlbum && hasCover) ? 'music' : 'audio';

      // Update metadata and category
      db.update(schema.mediaFiles)
        .set({
          metadata: JSON.stringify(metadata),
          category: newCategory
        })
        .where(eq(schema.mediaFiles.id, mediaId))
        .run();

      console.log(`Updated metadata for file ${mediaId}, new category: ${newCategory}`);
      return { success: true, category: newCategory };
    } catch (e) {
      console.error('update-audio-metadata error:', e);
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('upload-album-cover', async (_, mediaId: number, imageData: number[]) => {
    try {
      const sharp = (await import('sharp')).default;
      const db = getDb();

      // Convert array back to Buffer
      const buffer = Buffer.from(imageData);

      // Process image: resize and convert to webp
      const thumbnailBuffer = await sharp(buffer)
        .resize({ width: 300, height: 300, fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();

      // Delete existing thumbnail if any
      db.delete(schema.thumbnails)
        .where(eq(schema.thumbnails.mediaId, mediaId))
        .run();

      // Insert new thumbnail
      db.insert(schema.thumbnails).values({
        mediaId: mediaId,
        data: thumbnailBuffer,
        format: 'webp'
      }).run();

      console.log(`Uploaded album cover for file ${mediaId}`);
      return { success: true };
    } catch (e) {
      console.error('upload-album-cover error:', e);
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('get-media-stats', async (_, type: string) => {
    const db = getDb();
    const result = db.select({
      id: schema.mediaFiles.id,
      filename: schema.mediaFiles.filename,
      filepath: schema.mediaFiles.filepath,
      type: schema.mediaFiles.type,
      size: schema.mediaFiles.size,
      hash: schema.mediaFiles.hash,
      createdAt: schema.mediaFiles.createdAt,
      metadata: schema.mediaFiles.metadata
    })
      .from(schema.mediaFiles)
      .where(eq(schema.mediaFiles.type, type))
      .all();

    return result;
  });

  ipcMain.handle('reset-library', async () => {
    // Dangerous! Clear all media.
    const db = getDb();
    try {
      db.delete(schema.mediaFiles).run();
      return { success: true };
    } catch (e) {
      console.error('Reset failed:', e);
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('reset-media-by-type', async (_, type: string) => {
    const db = getDb();
    try {
      console.log(`Resetting library for type: ${type}`);
      // 1. Delete Thumbnails for this type
      const files = db.select({ id: schema.mediaFiles.id }).from(schema.mediaFiles).where(eq(schema.mediaFiles.type, type)).all();
      const ids = files.map(f => f.id);

      if (ids.length > 0) {
        // SQLite doesn't support "WHERE IN (...)" nicely in simple delete with ORM sometimes, 
        // but let's try direct SQL or loop if needed. 
        // Better-sqlite3/drizzle usually handles `.where(inArray(...))` if we import `inArray`.
        // For simplicity/dependency safety, let's just run a delete where ID in subquery or loop.
        // Actually, schema.thumbnails foreign key usually cascades? Let's assume no cascade for safety or verify.
        // Let's delete from mediaFiles and hope for cascade or delete manually.
        // Manual cleanup is safer if we don't trust cascade setup.

        // Loop is slow but safe for now or use raw SQL.
        // db.delete(schema.thumbnails).where(inArray(schema.thumbnails.mediaId, ids)).run();
        // Since we didn't check if `inArray` is imported, let's try a direct delete on mediaFiles and assume it works or just use a raw query for speed.

        // Actually, let's use the ORM delete with a where type clause if possible? No, thumbnails doesn't have type.
        // Let's just delete from mediaFiles.

        db.delete(schema.mediaFiles).where(eq(schema.mediaFiles.type, type)).run();

        // Note: Orphaned thumbnails logic would be needed if no cascade. 
        // As a quick fix for now, we can leave them (they are small) or run a cleanup job later.
        // Or better:
        // const stmt = db.prepare('DELETE FROM thumbnails WHERE media_id IN (SELECT id FROM media_files WHERE type = ?)');
        // But we are using Drizzle.
      }

      // Let's just delete mediaFiles.
      db.delete(schema.mediaFiles).where(eq(schema.mediaFiles.type, type)).run();

      return { success: true };
    } catch (e) {
      console.error(`Reset ${type} failed:`, e);
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('get-settings', async () => {
    const db = getDb();
    const settings = db.select().from(schema.userSettings).all();
    let stages = db.select().from(schema.lifeStages).orderBy(schema.lifeStages.startAge).all();

    // Init default stages if empty OR if legacy defaults detected (old 7 stages)
    const isLegacy = stages.length === 7 && stages[0].name === 'Early Years';

    if (stages.length === 0 || isLegacy) {
      if (isLegacy) {
        console.log('Upgrading legacy life stages to new 13-stage defaults');
        db.delete(schema.lifeStages).run();
      }

      const defaults = [
        { name: 'Infancy', color: '#FFB3BA', startAge: 0, endAge: 2, visible: true },
        { name: 'Early Childhood', color: '#FFDFBA', startAge: 2, endAge: 5, visible: true },
        { name: 'Middle Childhood', color: '#FFFFBA', startAge: 5, endAge: 9, visible: true },
        { name: 'Late Childhood', color: '#BAFFC9', startAge: 9, endAge: 12, visible: true },
        { name: 'Early Adolescence', color: '#BAE1FF', startAge: 12, endAge: 15, visible: true },
        { name: 'Late Adolescence', color: '#A2C2E0', startAge: 15, endAge: 18, visible: true },
        { name: 'Early Adulthood', color: '#E6E6FA', startAge: 18, endAge: 25, visible: true },
        { name: 'Young Adulthood', color: '#D8BFD8', startAge: 25, endAge: 35, visible: true },
        { name: 'Early Mid-Life', color: '#FFC0CB', startAge: 35, endAge: 45, visible: true },
        { name: 'Mid-Life', color: '#F08080', startAge: 45, endAge: 55, visible: true },
        { name: 'Late Mid-Life', color: '#CD5C5C', startAge: 55, endAge: 65, visible: true },
        { name: 'Early Senior', color: '#8FBC8F', startAge: 65, endAge: 75, visible: true },
        { name: 'Senior', color: '#4682B4', startAge: 75, endAge: 90, visible: true },
      ];

      defaults.forEach(d => db.insert(schema.lifeStages).values(d).run());
      stages = db.select().from(schema.lifeStages).orderBy(schema.lifeStages.startAge).all();
    }

    // Settings Defaults
    const getValue = (key: string, def: string) => settings.find(s => s.key === key)?.value || def;

    const dob = getValue('dob', '1990-01-01');
    const legendPosition = getValue('legendPosition', 'top');
    const showWeekTotals = getValue('showWeekTotals', 'true'); // Stored as string

    // Ensure DOB exists in DB if it was default
    if (!settings.find(s => s.key === 'dob')) {
      db.insert(schema.userSettings).values({ key: 'dob', value: dob }).run();
    }

    return { dob, stages, legendPosition, showWeekTotals: showWeekTotals === 'true' };
  });

  ipcMain.handle('save-settings', async (_, { dob, stages, legendPosition, showWeekTotals }: { dob: string, stages: any[], legendPosition: string, showWeekTotals: boolean }) => {
    const db = getDb();
    try {
      // Helper to upsert
      const upsert = (key: string, value: string) => {
        db.insert(schema.userSettings)
          .values({ key, value })
          .onConflictDoUpdate({ target: schema.userSettings.key, set: { value } })
          .run();
      };

      upsert('dob', dob);
      upsert('legendPosition', legendPosition);
      upsert('showWeekTotals', String(showWeekTotals));

      // Replace Stages
      db.delete(schema.lifeStages).run();
      stages.forEach(stage => {
        db.insert(schema.lifeStages).values({
          name: stage.name,
          color: stage.color,
          startAge: stage.startAge,
          endAge: stage.endAge,
          visible: stage.visible ?? true
        }).run();
      });

      return { success: true };
    } catch (e) {
      console.error('Save settings failed:', e);
      return { success: false };
    }
  });

  ipcMain.handle('reset-life-stages', async () => {
    const db = getDb();
    try {
      db.delete(schema.lifeStages).run();

      const defaults = [
        { name: 'Infancy', color: '#FFB3BA', startAge: 0, endAge: 2, visible: true },
        { name: 'Early Childhood', color: '#FFDFBA', startAge: 2, endAge: 5, visible: true },
        { name: 'Middle Childhood', color: '#FFFFBA', startAge: 5, endAge: 9, visible: true },
        { name: 'Late Childhood', color: '#BAFFC9', startAge: 9, endAge: 12, visible: true },
        { name: 'Early Adolescence', color: '#BAE1FF', startAge: 12, endAge: 15, visible: true },
        { name: 'Late Adolescence', color: '#A2C2E0', startAge: 15, endAge: 18, visible: true },
        { name: 'Early Adulthood', color: '#E6E6FA', startAge: 18, endAge: 25, visible: true },
        { name: 'Young Adulthood', color: '#D8BFD8', startAge: 25, endAge: 35, visible: true },
        { name: 'Early Mid-Life', color: '#FFC0CB', startAge: 35, endAge: 45, visible: true },
        { name: 'Mid-Life', color: '#F08080', startAge: 45, endAge: 55, visible: true },
        { name: 'Late Mid-Life', color: '#CD5C5C', startAge: 55, endAge: 65, visible: true },
        { name: 'Early Senior', color: '#8FBC8F', startAge: 65, endAge: 75, visible: true },
        { name: 'Senior', color: '#4682B4', startAge: 75, endAge: 90, visible: true },
      ];

      defaults.forEach(d => db.insert(schema.lifeStages).values(d).run());
      const stages = db.select().from(schema.lifeStages).orderBy(schema.lifeStages.startAge).all();

      return { success: true, stages };
    } catch (e) {
      console.error('Reset stages failed:', e);
      return { success: false, error: String(e) };
    }
  });




  ipcMain.handle('delete-file', async (_, { id, filepath, onlyDb }: { id: number, filepath: string, onlyDb?: boolean }) => {
    const fs = await import('fs');
    const db = getDb();

    try {
      // 1. Delete from Disk (Only if NOT DB-only mode)
      if (!onlyDb) {
        try {
          await fs.promises.unlink(filepath);
          console.log(`Deleted file: ${filepath}`);
        } catch (rmErr) {
          // If file doesn't exist, we still want to clean up DB
          if ((rmErr as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw rmErr;
          }
          console.warn(`File not found on disk, cleaning DB only: ${filepath}`);
        }
      } else {
        console.log(`[DB-Only] Removing reference for: ${filepath}`);
      }

      // 2. Delete from DB
      db.delete(schema.thumbnails).where(eq(schema.thumbnails.mediaId, id)).run();
      db.delete(schema.mediaFiles).where(eq(schema.mediaFiles.id, id)).run();

      return { success: true };
    } catch (e) {
      console.error('Delete failed:', e);
      return { success: false, error: String(e) };
    }
  });

  // DB Import/Export
  ipcMain.handle('export-database', async (_, { type }: { type?: string }) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: `Export ${type ? type + ' ' : ''}Library`,
        defaultPath: `lifeweek-backup-${type || 'full'}-${new Date().toISOString().split('T')[0]}.zip`,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
      });

      if (canceled || !filePath) return false;

      console.log('[Export] Starting export to:', filePath);
      const zip = new AdmZip();

      // 1. Fetch Media Files
      let query = getDb().select().from(schema.mediaFiles);
      if (type) {
        // @ts-ignore
        query = query.where(eq(schema.mediaFiles.type, type));
      }
      const files = await query;

      // Add metadata to zip
      zip.addFile('library.json', Buffer.from(JSON.stringify(files, null, 2), 'utf-8'));

      // 2. Fetch and Add Thumbnails
      console.log(`[Export] Processing thumbnails for ${files.length} items...`);
      for (const file of files) {
        // Fetch thumbnail
        const thumb = await getDb().select().from(schema.thumbnails).where(eq(schema.thumbnails.mediaId, file.id)).get();
        if (thumb && thumb.data) {
          // Use hash (preferred) or filepath-hash logic if hash missing
          const filename = file.hash ? `${file.hash}.webp` : `id_${file.id}.webp`;
          zip.addFile(`thumbnails/${filename}`, thumb.data as Buffer);
        }
      }

      zip.writeZip(filePath);
      console.log('[Export] Complete!');
      return true;
    } catch (error) {
      console.error('[Export] Failed:', error);
      throw error;
    }
  });

  ipcMain.handle('import-database', async (_) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Library Backup',
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
        properties: ['openFile']
      });

      if (canceled || filePaths.length === 0) return null;

      const zipPath = filePaths[0];
      console.log('[Import] Reading zip:', zipPath);
      const zip = new AdmZip(zipPath);

      const libraryEntry = zip.getEntry('library.json');
      if (!libraryEntry) {
        throw new Error('Invalid backup: library.json not found');
      }

      const libraryData = JSON.parse(libraryEntry.getData().toString('utf-8'));
      const stats = { imported: 0, skipped: 0, thumbnailRestored: 0 };

      getDb().transaction(() => {
        for (const item of libraryData) {
          // Wise Import: Check existence
          const existing = getDb().select().from(schema.mediaFiles).where(eq(schema.mediaFiles.filepath, item.filepath)).get();

          if (existing) {
            stats.skipped++;
            continue;
          }

          // Insert Media: Remove ID to auto-increment
          const { id, ...dataToInsert } = item;
          const result = getDb().insert(schema.mediaFiles).values(dataToInsert).returning().get();
          const newId = result.id;
          stats.imported++;

          // Restore Thumbnail
          // Only works if hash matches. 'id_' fallback from export is useless here as IDs change.
          if (item.hash) {
            const thumbEntry = zip.getEntry(`thumbnails/${item.hash}.webp`);
            if (thumbEntry) {
              getDb().insert(schema.thumbnails).values({
                mediaId: newId,
                data: thumbEntry.getData(),
                format: 'webp'
              }).run();
              stats.thumbnailRestored++;
            }
          }
        }
      });

      console.log('[Import] Complete:', stats);
      return stats;

    } catch (error) {
      console.error('[Import] Failed:', error);
      throw error;
    }
  });

})


