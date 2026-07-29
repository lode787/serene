const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('serene', {
  getVersion: () => ipcRenderer.invoke('serene:version'),
  notify: (title, body) => ipcRenderer.invoke('serene:notify', { title, body }),
  openExternal: (url) => ipcRenderer.invoke('serene:open-external', url),
  setTray: (enabled) => ipcRenderer.invoke('serene:set-tray', enabled),
  quit: () => ipcRenderer.invoke('serene:quit'),
  nowPlaying: () => ipcRenderer.invoke('serene:nowplaying'),
});
