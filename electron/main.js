/**
 * TeamAI v3 — Main Process
 * BrowserWindow + N BrowserViews.
 * Google OAuth → popup BrowserWindow (même partition).
 * Zoom, scroll, history, rapport collect.
 */
const { app, BrowserWindow, BrowserView, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const views = new Map(); // id → { view, providerId, label, icon, url, title, history[] }
const authWindows = new Map();
let viewCounter = 0;
let zoomLevel = 0; // 0=100%, chaque pas = 15% de taille en plus/moins

// ── Config ──────────────────────────────────────────────────────────────────
const CFG = {
  PROVIDERS: path.join(__dirname, '..', 'config', 'providers.json'),
  VERSION: path.join(__dirname, '..', 'config', 'version.json'),
  SIDEBAR_W: 240,
  TOOLBAR_H: 36,
  PROMPT_H: 44,
  GITHUB_URL: 'https://github.com/AtmanTest/arcclone-macos',
};

function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; } }
function loadProviders() { const d = loadJSON(CFG.PROVIDERS); return Array.isArray(d) ? d : []; }

const DEFAULT_PRESET = ['gpt5_terra','gpt5_sol','gemini','raisonnement','claude','zglm','kimi','grok','nemotron','venice'];

// ── View Bounds (avec zoom) ─────────────────────────────────────────────────
function getViewBounds(idx, total, scrollTop = 0) {
  const [winW, winH] = mainWindow ? mainWindow.getSize() : [1400, 900];
  const availW = winW - CFG.SIDEBAR_W;
  const availH = winH - CFG.PROMPT_H;
  const zoomFactor = 1 + zoomLevel * 0.15;

  if (total <= 1) {
    const w = Math.floor(availW * zoomFactor);
    const h = Math.floor((availH - CFG.TOOLBAR_H) * zoomFactor);
    return { x: CFG.SIDEBAR_W, y: -scrollTop, width: w, height: h };
  }

  // Grille adaptative: jusqu'à 4 = 2×2, 5-9 = 3×3, 10+ = 4×N
  const cols = total <= 4 ? 2 : total <= 9 ? 3 : 4;
  const rows = Math.ceil(total / cols);

  const cellW = Math.floor(availW / cols);
  const cellH = Math.floor((availH - CFG.TOOLBAR_H) / Math.min(rows, Math.max(1, Math.floor(1 / zoomFactor))));

  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const x = CFG.SIDEBAR_W + col * cellW;
  const y = row * (cellH + CFG.TOOLBAR_H) - scrollTop;

  return {
    x: x + 2, y: y + 2,
    width: Math.floor((cellW - 4) * zoomFactor),
    height: Math.floor(Math.max(80, (cellH - 4) * zoomFactor)),
  };
}

function getTotalContentHeight(total) {
  const [winW, winH] = mainWindow ? mainWindow.getSize() : [1400, 900];
  const availW = winW - CFG.SIDEBAR_W;
  const availH = winH - CFG.PROMPT_H;
  const cols = total <= 4 ? 2 : total <= 9 ? 3 : 4;
  const rows = Math.ceil(total / cols);
  const cellW = Math.floor(availW / cols);
  const cellH = Math.floor((availH - CFG.TOOLBAR_H) / Math.min(rows, 2));
  return rows * (cellH + CFG.TOOLBAR_H) + 40;
}

function layoutAllViews(scrollTop = 0) {
  const entries = Array.from(views.entries());
  const bounds = entries.map(([id, v], idx) => {
    const b = getViewBounds(idx, entries.length, scrollTop);
    try { v.view.setBounds(b); } catch {}
    return { id, ...b, providerId: v.providerId, label: v.label, icon: v.icon, url: v.url || '' };
  });
  const totalH = getTotalContentHeight(entries.length);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-bounds', bounds, zoomLevel, entries.length, totalH);
  }
}

// ── Google OAuth ────────────────────────────────────────────────────────────
function openAuthWindow(parentWebContents, url, partition) {
  // Ferme les anciennes fenêtres d'auth pour cette partition
  if (authWindows.has(partition)) {
    try { authWindows.get(partition).close(); } catch {}
  }

  const authWin = new BrowserWindow({
    width: 900, height: 700,
    parent: mainWindow,
    modal: false,
    title: 'Connexion Google — TeamAI',
    webPreferences: { partition, sandbox: false, nodeIntegration: false, contextIsolation: true },
  });

  authWin.loadURL(url);
  authWindows.set(partition, authWin);

  // Détecter la fin de l'auth
  authWin.webContents.on('did-navigate', (e, navUrl) => {
    if (navUrl.includes('google.com/_/oauth') || navUrl.includes('consent')) {
      // Still in auth flow, keep open
    } else if (!navUrl.includes('accounts.google.com') && navUrl !== url) {
      // Auth done (redirected away from Google) → fermer
      setTimeout(() => { try { authWin.close(); } catch {} }, 1500);
    }
  });

  authWin.on('closed', () => authWindows.delete(partition));
}

// ── View Management ─────────────────────────────────────────────────────────
function addView(providerId) {
  if (!mainWindow) return null;
  const providers = loadProviders();
  const prov = providers.find(p => p.id === providerId)
    || { id: providerId, label: providerId, url: 'about:blank', icon: '🌐' };

  viewCounter++;
  const id = `v_${viewCounter}`;
  const partition = `persist:teamai_${providerId}_${viewCounter}`;

  const view = new BrowserView({
    webPreferences: { partition, sandbox: false, nodeIntegration: false, contextIsolation: true,
      nativeWindowOpen: true,
    }
  });

  // Google OAuth: intercepter et ouvrir dans popup Electron
  view.webContents.setWindowOpenHandler(({ url }) => {
    const needsAuth = url.includes('accounts.google.com') || url.includes('oauth')
      || url.includes('login.google') || url.includes('googleapis.com');
    if (needsAuth) {
      openAuthWindow(view.webContents, url, partition);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  view.webContents.on('will-navigate', (e, url) => {
    if (url.includes('accounts.google.com') || url.includes('oauth')) {
      e.preventDefault();
      openAuthWindow(view.webContents, url, partition);
    }
  });

  // History tracking
  view.webContents.on('did-navigate', (e, url) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('view-url', id, url);
    }
  });

  view.webContents.on('page-title-updated', (e, title) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('view-title', id, title);
  });

  view.setAutoResize({ width: false, height: false });
  mainWindow.addBrowserView(view);

  const entry = {
    view, providerId: prov.id, label: prov.label, icon: prov.icon,
    url: prov.url, title: '', history: [prov.url],
  };
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
  try {
    e.view.webContents.loadURL(url);
    if (url && url !== 'about:blank') e.history.push(url);
  } catch {}
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
          const sendBtns = document.querySelectorAll('button[data-testid="send-button"],button[type="submit"],button:has(svg)');
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

async function collectResponses() {
  const results = [];
  let pending = 0;
  return new Promise((resolve) => {
    for (const [id, v] of views) {
      pending++;
      const js = `(function(){const sels=['.markdown','[data-message-author-role="assistant"]','.prose','.message-content','main','article'];const body=document.body;let text=body?body.innerText.substring(0,5000):'';for(const s of sels){const el=document.querySelector(s);if(el&&el.innerText.length>100){text=el.innerText.substring(0,5000);break}}return text;})();`;
      try {
        v.view.webContents.executeJavaScript(js).then(t => {
          results.push({ id, label: v.label, icon: v.icon, url: v.url, title: v.title, response: t || '(vide)' });
          if (--pending <= 0) resolve(results);
        }).catch(() => {
          results.push({ id, label: v.label, icon: v.icon, url: v.url, title: v.title, response: '(erreur collecte)' });
          if (--pending <= 0) resolve(results);
        });
      } catch {
        results.push({ id, label: v.label, icon: v.icon, url: v.url, title: v.title, response: '(erreur)' });
        if (--pending <= 0) resolve(results);
      }
    }
    if (pending === 0) resolve(results);
  });
}

// ── IPC ─────────────────────────────────────────────────────────────────────
function setupIPC() {
  const handle = (channel, fn) => ipcMain.handle(channel, fn);
  handle('get-providers', () => loadProviders());
  handle('add-view', (e, pid) => addView(pid));
  handle('remove-view', (e, id) => removeView(id));
  handle('clear-all', () => clearAll());
  handle('add-default-views', () => { clearAll(); DEFAULT_PRESET.forEach(p => addView(p)); return Array.from(views.keys()); });
  handle('dispatch-prompt', (e, t) => dispatchPrompt(t));
  handle('view-action', (e, id, a) => viewAction(id, a));
  handle('navigate-view', (e, id, u) => navigateView(id, u));
  handle('scroll-viewport', (e, st) => layoutAllViews(st));
  handle('collect-responses', async () => collectResponses());
  handle('get-views', () => Array.from(views.entries()).map(([id, v]) => ({ id, providerId: v.providerId, label: v.label, icon: v.icon, url: v.url, title: v.title, history: v.history.slice(-50) })));
  handle('get-version', () => {
    const v = loadJSON(CFG.VERSION);
    return { version: v.version || '0.3.0', commit: v.commit || 'dev', url: CFG.GITHUB_URL };
  });
  handle('set-zoom', (e, level) => {
    zoomLevel = Math.max(-3, Math.min(5, level));
    layoutAllViews();
  });
  handle('get-zoom', () => zoomLevel);
  handle('open-url', (e, url) => { if (url) shell.openExternal(url); });
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
