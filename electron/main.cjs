const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

// ============================================================================
// LOW-MEMORY & HARDWARE COMPATIBILITY OPTIMIZATIONS (Windows 10 & 11)
// Tested for 4GB low-end laptops up to high-end workstations
// ============================================================================
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Enforce single instance to prevent accidental memory hogging
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let embeddedServerInstance = null;
const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL));

/**
 * Initialize persistent directories and local database in user's AppData
 */
function setupUserDataStorage() {
  const userDataPath = app.getPath('userData');
  const appPath = app.getAppPath();

  const dataDir = path.join(userDataPath, 'data');
  const uploadsDir = path.join(userDataPath, 'uploads');
  const workspacesDir = path.join(userDataPath, 'workspaces');
  const distDir = path.join(appPath, 'dist');

  [dataDir, uploadsDir, workspacesDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error(`[Cortex Electron] Failed to create dir ${dir}:`, err);
      }
    }
  });

  // Seed default database if not exists
  const targetDb = path.join(dataDir, 'cortex_db.json');
  const sourceDb = path.join(appPath, 'data', 'cortex_db.json');
  if (!fs.existsSync(targetDb) && fs.existsSync(sourceDb)) {
    try {
      fs.copyFileSync(sourceDb, targetDb);
      console.log('[Cortex Electron] Seeded initial cortex_db.json from app package');
    } catch (err) {
      console.warn('[Cortex Electron] Could not seed database:', err.message);
    }
  }

  process.env.NODE_ENV = 'production';
  process.env.CORTEX_DATA_DIR = dataDir;
  process.env.CORTEX_UPLOADS_DIR = uploadsDir;
  process.env.CORTEX_WORKSPACES_DIR = workspacesDir;
  process.env.CORTEX_DIST_DIR = distDir;

  return { dataDir, uploadsDir, workspacesDir, distDir };
}

/**
 * Start the internal embedded Express backend server
 */
async function startInternalServer(storage) {
  const embeddedServerPath = path.join(__dirname, 'embedded-server.cjs');
  if (!fs.existsSync(embeddedServerPath)) {
    console.warn('[Cortex Electron] embedded-server.cjs not found at', embeddedServerPath);
    return null;
  }

  try {
    const { startDesktopServer } = require(embeddedServerPath);
    if (typeof startDesktopServer === 'function') {
      const serverInfo = await startDesktopServer({
        distPath: storage.distDir,
        uploadsDir: storage.uploadsDir,
        dataDir: storage.dataDir,
        workspacesDir: storage.workspacesDir,
      });
      console.log(`[Cortex Electron] Embedded backend running at ${serverInfo.url}`);
      return serverInfo;
    }
  } catch (err) {
    console.error('[Cortex Electron] Error starting embedded server:', err);
  }
  return null;
}

function createWindow(initialUrl) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Cortex | Next-Gen AI Agent & Co-Work Platform',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#FAF9F6',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  // Custom UserAgent so frontend detects native desktop execution
  const customUserAgent = `${mainWindow.webContents.userAgent} CortexDesktop/1.0.0 (${os.platform()}; ${os.arch()})`;
  mainWindow.webContents.setUserAgent(customUserAgent);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const loadTarget = (targetUrl) => {
    mainWindow.loadURL(targetUrl).catch((err) => {
      console.warn(`[Cortex Electron] Failed to load ${targetUrl}, retrying...`, err.message);
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.loadURL(targetUrl).catch(() => {
            renderFallbackScreen(targetUrl, err.message);
          });
        }
      }, 1500);
    });
  };

  loadTarget(initialUrl);

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function renderFallbackScreen(targetUrl, errorMsg) {
  if (!mainWindow) return;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Cortex Desktop</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; max-width: 480px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h2 { margin-top: 0; color: #38bdf8; font-size: 20px; }
          p { color: #a1a1aa; font-size: 14px; line-height: 1.5; }
          .error { background: #27272a; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #f87171; word-break: break-all; margin: 16px 0; }
          button { background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
          button:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Starting Cortex Engine...</h2>
          <p>Connecting to internal background services. If this takes longer than expected, click retry.</p>
          <div class="error">${errorMsg || 'Connection waiting'}</div>
          <button onclick="window.location.href='${targetUrl}'">Retry Connection</button>
        </div>
      </body>
    </html>
  `;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

// Native Windows Folder Selector IPC
ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  return dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Project Directory for Co-Work',
  });
});

// Safe Shell Command Execution IPC for Desktop Terminal
ipcMain.handle('shell:execute', async (_event, command) => {
  return new Promise((resolve) => {
    if (!command || typeof command !== 'string') {
      return resolve({ stdout: '', stderr: 'Invalid command string', exitCode: 1 });
    }
    // Protect against destructive host wipes
    const disallowed = [/rmdir\s+\/s\s+\/q\s+[c-z]:\\/i, /format\s+[c-z]:/i, /diskpart/i];
    if (disallowed.some((regex) => regex.test(command))) {
      return resolve({ stdout: '', stderr: 'Command blocked by security policy.', exitCode: 1 });
    }

    exec(command, { timeout: 30000, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || (error ? error.message : ''),
        exitCode: error ? (error.code ?? 1) : 0,
      });
    });
  });
});

// Native System Metrics for Diagnostics
ipcMain.handle('system:metrics', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
    freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
    cpus: os.cpus().length,
  };
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  const storage = setupUserDataStorage();

  let targetUrl = 'http://localhost:3000';

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    targetUrl = process.env.VITE_DEV_SERVER_URL;
  } else {
    // Start embedded server
    try {
      embeddedServerInstance = await startInternalServer(storage);
      if (embeddedServerInstance && embeddedServerInstance.url) {
        targetUrl = embeddedServerInstance.url;
      }
    } catch (err) {
      console.error('[Cortex Electron] Failed to launch embedded server:', err);
    }
  }

  createWindow(targetUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(targetUrl);
    }
  });
});

app.on('window-all-closed', () => {
  if (embeddedServerInstance && embeddedServerInstance.server) {
    try {
      embeddedServerInstance.server.close();
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
