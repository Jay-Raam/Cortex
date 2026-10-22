const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

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
let serverProcess = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Cortex | Next-Gen AI Agent & Co-Work Platform',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#FAF9F6',
    autoHideMenuBar: true,
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

  // In development, connect to Vite dev server; in production, connect to local Express server
  const startUrl = isDev
    ? (process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000')
    : 'http://localhost:3000';

  mainWindow.loadURL(startUrl).catch((err) => {
    console.warn('[Cortex Electron] Failed to load startUrl, retrying...', err.message);
    setTimeout(() => mainWindow && mainWindow.loadURL(startUrl), 1500);
  });

  // Open external links in user's default browser instead of electron window
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

// Native Windows Folder Selector IPC
ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  return dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Project Directory for Co-Work',
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
