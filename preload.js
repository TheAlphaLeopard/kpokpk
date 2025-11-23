const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  speak: (text) => ipcRenderer.invoke('speak', text),
  platform: process.platform,
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (cfg) => ipcRenderer.invoke('set-config', cfg)
  ,testNircmd: () => ipcRenderer.invoke('test-nircmd')
});
