import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { getDb } from './db'
import * as schema from './db/schema'
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
import { pathToFileURL } from 'node:url';

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
    // win.loadFile('dist/index.html')
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
      let pathName = request.url.replace(/^media:\/\//, '');
      pathName = decodeURIComponent(pathName);

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

      const fs = await import('fs');
      const { Readable } = await import('stream');

      const stat = await fs.promises.stat(filePath);
      const fileSize = stat.size;
      const range = request.headers.get('Range');

      // Simple MIME detection
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'application/octet-stream';
      if (ext === '.mp4') mimeType = 'video/mp4';
      if (ext === '.mov') mimeType = 'video/quicktime';
      if (ext === '.webm') mimeType = 'video/webm';
      if (ext === '.avi') mimeType = 'video/x-msvideo';
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

        const stream = fs.createReadStream(filePath, { start, end });
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
        const stream = fs.createReadStream(filePath);
        const readable = streamToWeb(stream);

        return new Response(readable as any, {
          status: 200,
          headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*'
          }
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

  ipcMain.handle('get-media', async (_, type: string) => {
    const { FileScanner } = await import('./scanner');
    const scanner = new FileScanner();
    const files = await scanner.getFiles(type);

    // Check availability for each file
    // Using fs.promises.access to check if file exists
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

  ipcMain.handle('get-media-stats', async (_, type: string) => {
    const db = getDb();
    const result = db.select({
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

    // Init DOB if empty
    let dob = settings.find(s => s.key === 'dob')?.value;
    if (!dob) {
      dob = '1990-01-01'; // Default
      db.insert(schema.userSettings).values({ key: 'dob', value: dob }).run();
    }

    return { dob, stages };
  });

  ipcMain.handle('save-settings', async (_, { dob, stages }: { dob: string, stages: any[] }) => {
    const db = getDb();
    try {
      // Update DOB
      db.insert(schema.userSettings)
        .values({ key: 'dob', value: dob })
        .onConflictDoUpdate({ target: schema.userSettings.key, set: { value: dob } })
        .run();

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

  ipcMain.handle('check-file-exists', async (_, filePath: string) => {
    const fs = await import('fs');
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle('read-file-buffer', async (_, filePath: string) => {
    const fs = await import('fs');
    try {
      const buffer = await fs.promises.readFile(filePath);
      return buffer; // Electron automatically handles Buffer serialization
    } catch (e) {
      console.error('Read file buffer error:', e);
      return null;
    }
  });

  ipcMain.handle('delete-file', async (_, { id, filepath }: { id: number, filepath: string }) => {
    const fs = await import('fs');
    const db = getDb();

    try {
      // 1. Delete from Disk
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

      // 2. Delete from DB
      db.delete(schema.thumbnails).where(eq(schema.thumbnails.mediaId, id)).run();
      db.delete(schema.mediaFiles).where(eq(schema.mediaFiles.id, id)).run();

      return { success: true };
    } catch (e) {
      console.error('Delete failed:', e);
      return { success: false, error: String(e) };
    }
  });
})

