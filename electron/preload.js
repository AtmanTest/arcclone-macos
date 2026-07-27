const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('teamai', {
  getProviders: () => ipcRenderer.invoke('get-providers'),
  addView: (pid) => ipcRenderer.invoke('add-view', pid),
  removeView: (id) => ipcRenderer.invoke('remove-view', id),
  clearAll: () => ipcRenderer.invoke('clear-all'),
  addDefaultViews: () => ipcRenderer.invoke('add-default-views'),
  dispatchPrompt: (t) => ipcRenderer.invoke('dispatch-prompt', t),
  viewAction: (id, a) => ipcRenderer.invoke('view-action', id, a),
  navigateView: (id, u) => ipcRenderer.invoke('navigate-view', id, u),
  scrollViewport: (st) => ipcRenderer.invoke('scroll-viewport', st),
  collectResponses: () => ipcRenderer.invoke('collect-responses'),
  getViews: () => ipcRenderer.invoke('get-views'),
  zoomIn: () => ipcRenderer.invoke('zoom-in'),
  zoomOut: () => ipcRenderer.invoke('zoom-out'),
  zoomReset: () => ipcRenderer.invoke('zoom-reset'),

  onSyncBounds: (cb) => ipcRenderer.on('sync-bounds', (e, bounds, zoom, total) => cb(bounds, zoom, total)),
  onViewTitle: (cb) => ipcRenderer.on('view-title', (e, id, t) => cb(id, t)),
  onViewUrl: (cb) => ipcRenderer.on('view-url', (e, id, u) => cb(id, u)),
});
