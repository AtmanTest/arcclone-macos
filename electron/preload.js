const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('teamai', {
  getProviders: () => ipcRenderer.invoke('get-providers'),
  dispatchPrompt: (t) => ipcRenderer.invoke('dispatch-prompt', t),
  openAuthWindow: (url, partition) => ipcRenderer.invoke('open-auth-window', url, partition),
  openLoginWindow: (pid, url, partition) => ipcRenderer.invoke('open-login-window', pid, url, partition),
  closeLoginWindow: (pid) => ipcRenderer.invoke('close-login-window', pid),
  getVersion: () => ipcRenderer.invoke('get-version'),
  loadProviders: () => ipcRenderer.invoke('load-providers'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  updateApp: () => ipcRenderer.invoke('update-app'),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  setZoom: (l) => ipcRenderer.invoke('set-zoom', l),
  getZoom: () => ipcRenderer.invoke('get-zoom'),

  // Events from main
  onExecJsAll: (cb) => ipcRenderer.on('exec-js-all', (e, text) => cb(text)),
  onLoginWindowClosed: (cb) => ipcRenderer.on('login-window-closed', (e, pid) => cb(pid)),
});
