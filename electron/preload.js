const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('teamai', {
  getProviders: () => ipcRenderer.invoke('get-providers'),
  dispatchPrompt: (t) => ipcRenderer.invoke('dispatch-prompt', t),
  openAuthWindow: (url, partition) => ipcRenderer.invoke('open-auth-window', url, partition),
  getVersion: () => ipcRenderer.invoke('get-version'),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  setZoom: (l) => ipcRenderer.invoke('set-zoom', l),
  getZoom: () => ipcRenderer.invoke('get-zoom'),

  // Events from main
  onExecJsAll: (cb) => ipcRenderer.on('exec-js-all', (e, text) => cb(text)),
});
