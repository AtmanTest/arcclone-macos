/**
 * TeamAI v4 — Main Process
 * Utilise webviewTag (plus BrowserView) pour que les toolbars HTML soient VISIBLES.
 * Google OAuth → popup BrowserWindow avec même partition.
 */
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const authWindows = new Map();
let zoomLevel = 0;

// ── Config ──────────────────────────────────────────────────────────────────
const CFG = {
  PROVIDERS: path.join(__dirname, '..', 'config', 'providers.json'),
  VERSION: path.join(__dirname, '..', 'config', 'version.json'),
  GITHUB_URL: 'https://github.com/AtmanTest/arcclone-macos',
};

function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; } }
function loadProviders() { const d = loadJSON(CFG.PROVIDERS); return Array.isArray(d) ? d : []; }

const DEFAULT_PRESET = ['gpt5_terra','gpt5_sol','gemini','raisonnement','claude','zglm','kimi','grok','nemotron','venice'];

// ── Google OAuth ────────────────────────────────────────────────────────────
function openAuthWindow(url, partition) {
  if (authWindows.has(partition)) {
    try { authWindows.get(partition).close(); } catch {}
  }
  const authWin = new BrowserWindow({
    width: 900, height: 700, parent: mainWindow, modal: false,
    title: 'Connexion — TeamAI',
    webPreferences: { partition, sandbox: false, nodeIntegration: false, contextIsolation: true },
  });
  authWin.loadURL(url);
  authWindows.set(partition, authWin);

  authWin.webContents.on('did-navigate', (e, navUrl) => {
    if (!navUrl.includes('accounts.google.com') && navUrl !== url && !navUrl.includes('oauth') && !navUrl.includes('login')) {
      setTimeout(() => { try { authWin.close(); } catch {} }, 1200);
    }
  });
  authWin.on('closed', () => authWindows.delete(partition));
}

// ── Login Windows (provider connection wizard) ────────────────────────────
const loginWindows = new Map(); // providerId → BrowserWindow

function openLoginWindow(providerId, url, partition) {
  // Close existing login window for this provider
  if (loginWindows.has(providerId)) {
    try { loginWindows.get(providerId).close(); } catch {}
  }

  const win = new BrowserWindow({
    width: 1100, height: 800,
    minWidth: 800, minHeight: 600,
    parent: mainWindow,
    title: `Connexion — ${providerId}`,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      partition,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      enableWebAuthn: true,
      enableCredentialsService: true,
    },
  });

  win.loadURL(url);
  loginWindows.set(providerId, win);

  // Passkey / credential support — Electron Chromium handles this natively
  // when the WebContents has a real window with proper Chromium features.

  win.on('closed', () => {
    loginWindows.delete(providerId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('login-window-closed', providerId);
    }
  });

  return true;
}

function closeLoginWindow(providerId) {
  if (loginWindows.has(providerId)) {
    try { loginWindows.get(providerId).close(); } catch {}
    loginWindows.delete(providerId);
  }
}

// ── IPC ─────────────────────────────────────────────────────────────────────
function setupIPC() {
  const h = (ch, fn) => ipcMain.handle(ch, fn);
  h('get-providers', () => loadProviders());
  h('dispatch-prompt', (e, text) => {
    if (!mainWindow) return;
    mainWindow.webContents.send('exec-js-all', text);
  });
  h('open-auth-window', (e, url, partition) => openAuthWindow(url, partition));
  h('open-login-window', (e, pid, url, partition) => openLoginWindow(pid, url, partition));
  h('close-login-window', (e, pid) => closeLoginWindow(pid));
  h('get-version', () => {
    const v = loadJSON(CFG.VERSION);
    return { version: v.version || '0.4.0', commit: v.commit || 'dev', url: CFG.GITHUB_URL };
  });
  h('open-url', (e, url) => { if (url) shell.openExternal(url); });
  h('set-zoom', (e, l) => { zoomLevel = Math.max(-3, Math.min(5, l)); });
  h('get-zoom', () => zoomLevel);
  h('load-providers', () => {
    const p = loadJSON(CFG.PROVIDERS);
    return Array.isArray(p) ? p : [];
  });
  h('check-update', async () => {
    const { execSync } = require('child_process');
    try {
      const cwd = __dirname.replace('/electron', '');
      execSync('git fetch origin', { cwd, timeout: 10000 });
      const behind = execSync('git rev-list --count HEAD..origin/main', { cwd, encoding: 'utf8' }).toString().trim();
      const hasUpdate = parseInt(behind) > 0;
      return { hasUpdate, behind: parseInt(behind) || 0 };
    } catch { return { hasUpdate: false, behind: 0, error: true }; }
  });
  h('update-app', async () => {
    const { execSync } = require('child_process');
    let result = '';
    try {
      result += '📦 git pull...\n';
      execSync('git pull', { cwd: __dirname.replace('/electron', ''), timeout: 30000 });
      result += '✅ Pull OK\n📦 npm install...\n';
      execSync('npm install --no-audit --no-fund', { cwd: __dirname.replace('/electron', ''), timeout: 120000 });
      result += '✅ npm install OK\n🔄 Relance...';
    } catch (e) {
      result += `❌ Erreur: ${e.message}`;
    }
    // Relaunch
    app.relaunch();
    app.exit(0);
    return result;
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
      webviewTag: true, // ← ACTIVATES <webview> TAG
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
