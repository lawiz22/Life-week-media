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

app.whenReady().then(() => {
  // Register 'media' protocol to serve local files
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
      if (process.platform === 'win32' && pathName.startsWith('/') && /^[a-zA-Z]:/.test(pathName.slice(1))) {
        pathName = pathName.slice(1);
      }
      pathName = decodeURIComponent(pathName);
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

      if (range) {
        // Range Request (Video seeking/streaming)
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const stream = fs.createReadStream(filePath, { start, end });
        // @ts-ignore
        const readable = Readable.toWeb(stream);

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
        // @ts-ignore
        const readable = Readable.toWeb(stream);

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

  ipcMain.handle('start-scan', async (_, dirPath: string, options: { includeSubfolders: boolean }) => {
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

    // Init default stages if empty
    if (stages.length === 0) {
      const defaults = [
        { name: 'Early Years', color: '#60a5fa', startAge: 0, endAge: 5 }, // Blue
        { name: 'Elementary School', color: '#34d399', startAge: 5, endAge: 11 }, // Green
        { name: 'Middle School', color: '#a3e635', startAge: 11, endAge: 14 }, // Lime
        { name: 'High School', color: '#facc15', startAge: 14, endAge: 18 }, // Yellow
        { name: 'College', color: '#fb923c', startAge: 18, endAge: 22 }, // Orange
        { name: 'Career / Life', color: '#f87171', startAge: 22, endAge: 65 }, // Red
        { name: 'Retirement', color: '#a78bfa', startAge: 65, endAge: 90 }, // Purple
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
          endAge: stage.endAge
        }).run();
      });

      return { success: true };
    } catch (e) {
      console.error('Save settings failed:', e);
      return { success: false };
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
})

