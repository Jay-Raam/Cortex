const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('isDesktopApp', true);
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  arch: process.arch,
  version: process.versions.electron,
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  executeShellCommand: (command) => ipcRenderer.invoke('shell:execute', command),
  getSystemMetrics: () => ipcRenderer.invoke('system:metrics'),
});
