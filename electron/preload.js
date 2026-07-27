/**
 * TeamAI — Preload script
 * Exposes safe IPC API to renderer via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('teamai', {
  getProviders: () => ipcRenderer.invoke('get-providers'),
  getVersion: () => ipcRenderer.invoke('get-version'),

  addView: (providerId) => ipcRenderer.invoke('add-view', providerId),
  removeView: (viewId) => ipcRenderer.invoke('remove-view', viewId),
  clearAllViews: () => ipcRenderer.invoke('clear-all-views'),
  addDefaultViews: () => ipcRenderer.invoke('add-default-views'),
  dispatchPrompt: (text) => ipcRenderer.invoke('dispatch-prompt', text),
  getViewCount: () => ipcRenderer.invoke('get-view-count'),
  getViewIds: () => ipcRenderer.invoke('get-view-ids'),
  navigateView: (viewId, url) => ipcRenderer.invoke('navigate-view', viewId, url),

  // Events from main
  onViewsUpdated: (cb) => ipcRenderer.on('views-updated', (e, ids) => cb(ids)),
  onViewTitleUpdated: (cb) => ipcRenderer.on('view-title-updated', (e, id, title) => cb(id, title)),
  onViewUrlChanged: (cb) => ipcRenderer.on('view-url-changed', (e, id, url) => cb(id, url)),
});
