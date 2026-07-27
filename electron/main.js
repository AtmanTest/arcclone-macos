/**
 * TeamAI — Main Process
 * BrowserWindow + N BrowserViews with overlay toolbar sync via IPC.
 * Each BrowserView = isolated session partition.
 */
const { app, BrowserWindow, BrowserView, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const views = new Map();
let viewCounter = 0;
let zoomLevel = 0; // 0 = 100%, -1 = 90%, +1 = 110%, etc.

// ── Config ──────────────────────────────────────────────────────────────────
const CFG = {
  PROVIDERS: path.join(__dirname, '..', 'config', 'providers.json'),
  VERSION: path.join(__dirname, '..', 'config', 'version.json'),
  SIDEBAR_W: 240,
  TOOLBAR_H: 38,
};

function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; } }
function loadProviders() { const d = loadJSON(CFG.PROVIDERS); return Array.isArray(d) ? d : []; }

const DEFAULT_PRESET = ['gpt5_terra','gpt5_sol','gemini','raisonnement','claude','zglm','kimi','grok','nemotron'];

// ── View Management ─────────────────────────────────────────────────────────
function getViewBounds(idx, total, scrollTop = 0) {
  const sidebarW = CFG.SIDEBAR_W;
  const [winW, winH] = mainWindow ? mainWindow.getSize() : [1400, 900];
  const availW = winW - sidebarW;
  const promptH = 46;
  const availH = winH - promptH;

  if (total <= 1) {
    return { x: sidebarW, y: -scrollTop, width: availW, height: availH - CFG.TOOLBAR_H };
  }

  // 2 columns, dynamic rows
  const cols = 2;
  const rows = Math.ceil(total / cols);
  const cellW = Math.floor(availW / cols);
  const cellH = Math.floor((availH - CFG.TOOLBAR_H) / Math.min(rows, 2));

  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const x = sidebarW + col * cellW;
  const y = row * (cellH + CFG.TOOLBAR_H) - scrollTop;
  return { x, y, width: cellW - 4, height: cellH - 4 };
}

function layoutAllViews(scrollTop = 0) {
  const entries = Array.from(views.entries());
  const bounds = entries.map(([id, v], idx) => {
    const b = getViewBounds(idx, entries.length, scrollTop);
    try { v.view.setBounds(b); } catch {}
    return { id, ...b, providerId: v.providerId, label: v.label, icon: v.icon, url: v.url || '' };
  });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-bounds', bounds, zoomLevel, entries.length);
  }
}

function addView(providerId) {
  if (!mainWindow) return null;
  const providers = loadProviders();
  const prov = providers.find(p => p.id === providerId)
    || { id: providerId, label: providerId, url: 'about:blank', icon: '🌐' };

  viewCounter++;
  const id = `v_${viewCounter}`;
  const partition = `persist:teamai_${providerId}_${viewCounter}`;
  const ses = session.fromPartition(partition);

  const view = new BrowserView({
    webPreferences: {
      partition,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Google OAuth popup handler
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('oauth') || url.includes('login')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  view.webContents.on('will-navigate', (e, url) => {
    if (url.includes('accounts.google.com') || url.includes('oauth')) {
      e.preventDefault(); shell.openExternal(url);
    }
  });

  view.webContents.on('page-title-updated', (e, title) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('view-title', id, title);
  });
  view.webContents.on('did-navigate', (e, url) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('view-url', id, url);
  });

  view.setAutoResize({ width: false, height: false });
  mainWindow.addBrowserView(view);

  const entry = { view, providerId, partition, bounds: {}, label: prov.label, icon: prov.icon, url: prov.url, title: '' };
  views.set(id, entry);
  layoutAllViews();
  view.webContents.loadURL(prov.url);
  return id;
}

function removeView(id) {
  const e = views.get(id);
  if (!e) return;
  try { mainWindow.removeBrowserView(e.view); e.view.webContents.destroy(); } catch {}
  views.delete(id);
  layoutAllViews();
}

function clearAll() {
  for (const [id] of views) {
    try { mainWindow.removeBrowserView(views.get(id).view); views.get(id).view.webContents.destroy(); } catch {}
  }
  views.clear(); viewCounter = 0;
  layoutAllViews();
}

function viewAction(id, action) {
  const e = views.get(id);
  if (!e) return;
  try {
    if (action === 'back') e.view.webContents.goBack();
    else if (action === 'forward') e.view.webContents.goForward();
    else if (action === 'reload') e.view.webContents.reload();
    else if (action === 'stop') e.view.webContents.stop();
  } catch {}
}

function navigateView(id, url) {
  const e = views.get(id);
  if (!e) return;
  try { e.view.webContents.loadURL(url); } catch {}
}

function dispatchPrompt(text) {
  const safe = JSON.stringify(text);
  const js = `
    (function() {
      const sels = ['#prompt-textarea','[contenteditable="true"]','textarea','.ProseMirror','[role="textbox"]'];
      for (const s of sels) {
        const el = document.querySelector(s);
        if (!el) continue;
        el.focus();
        if (el.isContentEditable || el.tagName === 'DIV') {
          el.textContent = ''; document.execCommand('insertText', false, ${safe});
        } else { el.value = ${safe}; }
        el.dispatchEvent(new Event('input', {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
        setTimeout(() => {
          const ev = new KeyboardEvent('keydown', {key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true});
          el.dispatchEvent(ev);
          const sendBtns = document.querySelectorAll('button[data-testid="send-button"],button[type="submit"]');
          for (const b of sendBtns) { if (b.offsetParent !== null) { b.click(); break; } }
        }, 600);
        return 'ok';
      }
      return 'not_found';
    })();
  `;
  for (const [, v] of views) {
    try { v.view.webContents.executeJavaScript(js).catch(() => {}); } catch {}
  }
}

function collectResponses() {
  const results = [];
  let pending = 0;
  return new Promise((resolve) => {
    for (const [id, v] of views) {
      pending++;
      const js = `
        (function() {
          const sels = ['.markdown','[data-message-author-role="assistant"]','.prose','.message-content','main'];
          const body = document.body;
          let text = body ? body.innerText.substring(0, 5000) : '';
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.innerText.length > 100) { text = el.innerText.substring(0, 5000); break; }
          }
          return text;
        })();
      `;
      try {
        v.view.webContents.executeJavaScript(js).then(t => {
          results.push({ id, label: v.label, icon: v.icon, url: v.url, response: t || '(vide)' });
          if (--pending <= 0) resolve(results);
        }).catch(() => {
          results.push({ id, label: v.label, icon: v.icon, url: v.url, response: '(erreur collecte)' });
          if (--pending <= 0) resolve(results);
        });
      } catch {
        results.push({ id, label: v.label, icon: v.icon, url: v.url, response: '(erreur)' });
        if (--pending <= 0) resolve(results);
      }
    }
    if (pending === 0) resolve(results);
  });
}

// ── IPC ─────────────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.handle('get-providers', () => loadProviders());

  ipcMain.handle('add-view', (e, pid) => addView(pid));
  ipcMain.handle('remove-view', (e, id) => removeView(id));
  ipcMain.handle('clear-all', () => clearAll());
  ipcMain.handle('add-default-views', () => { clearAll(); DEFAULT_PRESET.forEach(p => addView(p)); return Array.from(views.keys()); });
  ipcMain.handle('dispatch-prompt', (e, t) => dispatchPrompt(t));
  ipcMain.handle('view-action', (e, id, action) => viewAction(id, action));
  ipcMain.handle('navigate-view', (e, id, url) => navigateView(id, url));
  ipcMain.handle('scroll-viewport', (e, scrollTop) => layoutAllViews(scrollTop));
  ipcMain.handle('collect-responses', async () => collectResponses());
  ipcMain.handle('get-views', () => Array.from(views.entries()).map(([id, v]) => ({ id, providerId: v.providerId, label: v.label, icon: v.icon, url: v.url, title: v.title })));

  ipcMain.handle('zoom-in', () => {
    zoomLevel = Math.min(zoomLevel + 1, 5);
    layoutAllViews();
  });
  ipcMain.handle('zoom-out', () => {
    zoomLevel = Math.max(zoomLevel - 1, -3);
    layoutAllViews();
  });
  ipcMain.handle('zoom-reset', () => {
    zoomLevel = 0;
    layoutAllViews();
  });
}

// ── App ─────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    title: 'TeamAI',
    backgroundColor: '#0D0D0F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('resize', () => layoutAllViews());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
