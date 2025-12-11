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
  protocol.handle('media', (request) => {
    // URL format: media://path/to/file OR media://thumbnail/<id>

    // Check if it's a thumbnail request
    const thumbMatch = request.url.match(/^media:\/\/thumbnail\/(\d+)$/);
    if (thumbMatch) {
      const id = parseInt(thumbMatch[1]);
      try {
        // We need to import the DB here, or reuse getDb.
        // Ideally we shouldn't import DB inside the handler to avoid race conditions or overhead, 
        // but `getDb()` is cached.
        const db = getDb();
        // We need to use valid SQL or Drizzle. 
        // Since we are in main process and schema is available:
        const row = db.select({
          data: schema.thumbnails.data,
          format: schema.thumbnails.format
        })
          .from(schema.thumbnails)
          .where(eq(schema.thumbnails.mediaId, id))
          .get();

        if (row) {
          // row.data is a Buffer (blob). Net.fetch expects body.
          // We can return a Response with the buffer.
          return new Response(row.data as any, {
            headers: { 'Content-Type': `image/${row.format}` }
          });
        } else {
          return new Response('Thumbnail Not Found', { status: 404 });
        }

      } catch (e) {
        console.error('Thumbnail fetch error:', e);
        return new Response('Error fetching thumbnail', { status: 500 });
      }
    }

    try {
      let pathName = request.url.replace(/^media:\/\//, '');

      // Handle potential "media://C:/" becoming "/C:/" due to extra slash
      if (process.platform === 'win32' && pathName.startsWith('/') && /^[a-zA-Z]:/.test(pathName.slice(1))) {
        pathName = pathName.slice(1);
      }

      // Decode spaces and special characters
      pathName = decodeURIComponent(pathName);

      // Normalize to OS specific path (C:\Users\... on Windows)
      // this fixes slash direction issues
      const osPath = path.normalize(pathName);

      // Convert back to a safe file:// URL
      const safeUrl = pathToFileURL(osPath).toString();

      return net.fetch(safeUrl);
    } catch (e) {
      console.error('Media protocol error:', e);
      // Returning 404 is correct for missing files, but useful to know if it's a code error
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

  ipcMain.handle('start-scan', async (_, dirPath: string, options: { includeSubfolders: boolean }) => {
    const { FileScanner } = await import('./scanner');
    const scanner = new FileScanner();
    return await scanner.scanDirectory(dirPath, options, (progress) => {
      win?.webContents.send('scan-progress', progress);
    });
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
      createdAt: schema.mediaFiles.createdAt
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
})
