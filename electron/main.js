/**
 * TeamAI — Main Process
 * BrowserWindow + multiple BrowserViews (one per AI provider).
 * IPC bridge for renderer ↔ main communication.
 */
const { app, BrowserWindow, BrowserView, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const views = new Map(); // viewId -> { view, provider, partition, bounds }
let viewCounter = 0;

// ── Config ──────────────────────────────────────────────────────────────────
const PROVIDERS_FILE = path.join(__dirname, '..', 'config', 'providers.json');
const VERSION_FILE = path.join(__dirname, '..', 'config', 'version.json');

function loadProviders() {
  try {
    return JSON.parse(fs.readFileSync(PROVIDERS_FILE, 'utf-8'));
  } catch { return []; }
}

function loadVersion() {
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'));
  } catch { return { version: '0.0.0', commit: 'unknown' }; }
}

const DEFAULT_PRESET = [
  'gpt5_terra', 'gpt5_sol', 'gemini', 'raisonnement',
  'claude', 'zglm', 'kimi', 'grok', 'nemotron'
];

// ── BrowserView Management ───────────────────────────────────────────────────
function getViewBounds(index, total) {
  const sidebarWidth = 240;
  const [winW, winH] = mainWindow ? mainWindow.getSize() : [1400, 900];
  const availW = winW - sidebarWidth;
  const availH = winH;

  if (total <= 1) return { x: sidebarWidth, y: 0, width: availW, height: availH };
  if (total <= 2) {
    const w = availW / total;
    return { x: sidebarWidth + index * w, y: 0, width: w - 2, height: availH };
  }
  if (total <= 4) {
    const cols = 2, rows = 2;
    const w = availW / cols, h = availH / rows;
    const r = Math.floor(index / cols), c = index % cols;
    return { x: sidebarWidth + c * w, y: r * h, width: w - 2, height: h - 2 };
  }
  // 9 views: 3x3
  const cols = 3, rows = 3;
  const w = availW / cols, h = availH / rows;
  const r = Math.floor(index / cols), c = index % cols;
  return { x: sidebarWidth + c * w, y: r * h, width: w - 2, height: h - 2 };
}

function layoutAllViews() {
  const entries = Array.from(views.entries());
  const total = entries.length;
  entries.forEach(([id, v], idx) => {
    const bounds = getViewBounds(idx, total);
    v.view.setBounds(bounds);
  });
  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('views-updated', Array.from(views.keys()));
  }
}

function addView(providerId) {
  if (!mainWindow) return null;

  const providers = loadProviders();
  const provider = providers.find(p => p.id === providerId)
    || { id: providerId, label: providerId, url: 'about:blank', icon: '🌐' };

  viewCounter++;
  const id = `view_${viewCounter}`;
  const partition = `persist:teamai_${providerId}_${viewCounter}`;
  const ses = session.fromPartition(partition);

  const view = new BrowserView({ webPreferences: { partition, sandbox: false, nodeIntegration: false, contextIsolation: true } });

  // Intercept Google OAuth popups
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('oauth')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle navigation to Google auth
  view.webContents.on('will-navigate', (event, url) => {
    if (url.includes('accounts.google.com') || url.includes('oauth')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  view.webContents.on('page-title-updated', (event, title) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('view-title-updated', id, title);
    }
  });

  view.webContents.on('did-navigate', (event, url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('view-url-changed', id, url);
    }
  });

  view.setAutoResize({ width: true, height: true, horizontal: false, vertical: false });
  mainWindow.addBrowserView(view);

  const entry = { view, provider, partition, bounds: {}, id };
  views.set(id, entry);
  layoutAllViews();

  view.webContents.loadURL(provider.url);

  return id;
}

function removeView(viewId) {
  const entry = views.get(viewId);
  if (!entry) return;
  try {
    mainWindow.removeBrowserView(entry.view);
    entry.view.webContents.destroy();
  } catch {}
  views.delete(viewId);
  layoutAllViews();
}

function clearAllViews() {
  for (const [id] of views) {
    try {
      mainWindow.removeBrowserView(views.get(id).view);
      views.get(id).view.webContents.destroy();
    } catch {}
  }
  views.clear();
  viewCounter = 0;
  layoutAllViews();
}

function dispatchPrompt(text) {
  const safe = JSON.stringify(text);
  const js = `
    (function() {
      const sels = ['#prompt-textarea', '[contenteditable="true"]', 'textarea',
                    '.ProseMirror', '[role="textbox"]', 'input[type="text"]'];
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) continue;
        el.focus();
        if (el.isContentEditable || el.tagName === 'DIV') {
          el.textContent = '';
          document.execCommand('insertText', false, ${safe});
        } else {
          el.value = ${safe};
        }
        el.dispatchEvent(new Event('input', {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
        setTimeout(() => {
          const ev = new KeyboardEvent('keydown', {
            key:'Enter', code:'Enter', keyCode:13, which:13,
            bubbles:true, cancelable:true
          });
          el.dispatchEvent(ev);
          // Fallback: click send button
          const btns = document.querySelectorAll('button[data-testid="send-button"], button[type="submit"], button:has(svg)');
          for (const btn of btns) {
            if (btn.offsetParent !== null) { btn.click(); break; }
          }
        }, 600);
        return 'ok';
      }
      return 'not_found';
    })();
  `;
  for (const [, v] of views) {
    try {
      v.view.webContents.executeJavaScript(js).catch(() => {});
    } catch {}
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.handle('get-providers', () => loadProviders());
  ipcMain.handle('get-version', () => loadVersion());

  ipcMain.handle('add-view', (event, providerId) => {
    const id = addView(providerId);
    return id;
  });

  ipcMain.handle('remove-view', (event, viewId) => {
    removeView(viewId);
  });

  ipcMain.handle('clear-all-views', () => {
    clearAllViews();
  });

  ipcMain.handle('add-default-views', () => {
    clearAllViews();
    for (const pid of DEFAULT_PRESET) {
      addView(pid);
    }
    return Array.from(views.keys());
  });

  ipcMain.handle('dispatch-prompt', (event, text) => {
    dispatchPrompt(text);
  });

  ipcMain.handle('get-view-count', () => views.size);

  ipcMain.handle('get-view-ids', () => Array.from(views.keys()));

  ipcMain.handle('navigate-view', (event, viewId, url) => {
    const entry = views.get(viewId);
    if (entry) {
      entry.view.webContents.loadURL(url);
    }
  });
}

// ── App Lifecycle ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    title: 'TeamAI',
    backgroundColor: '#0D0D0F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('resize', () => {
    layoutAllViews();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
