const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('isDesktopApp', true);
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  arch: process.arch,
  version: process.versions.electron,
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  executeShellCommand: (command) => ipcRenderer.invoke('shell:execute', command),
  getSystemMetrics: () => ipcRenderer.invoke('system:metrics'),
  toggleMinimizeToTray: (enabled) => ipcRenderer.invoke('app:toggleMinimizeToTray', enabled),
  getMinimizeToTray: () => ipcRenderer.invoke('app:getMinimizeToTray'),
  toggleWindow: () => ipcRenderer.invoke('app:toggleWindow'),
  onNavigate: (callback) => {
    const handler = (_event, view) => callback(view);
    ipcRenderer.on('cortex:navigate', handler);
    return () => ipcRenderer.removeListener('cortex:navigate', handler);
  },
});

