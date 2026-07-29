/**
 * TeamAI v5 — Main Process
 * Partition partagée Google : persist:google_shared
 * Tous les webviews Google OAuth utilisent cette même partition.
 */
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const authWindows = new Map();
const loginWindows = new Map();
let zoomLevel = 0;

const CFG = {
  PROVIDERS: path.join(__dirname, '..', 'config', 'providers.json'),
  VERSION:   path.join(__dirname, '..', 'config', 'version.json'),
  GITHUB_URL:'https://github.com/AtmanTest/arcclone-macos',
};

// Partition Google partagée — une seule pour TOUTES les IA
const GOOGLE_PARTITION = 'persist:google_shared';

function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; } }
function loadProviders() { const d = loadJSON(CFG.PROVIDERS); return Array.isArray(d) ? d : []; }

// ── Google Account Window ──────────────────────────────────────────────────
let googleAccountWindow = null;

function openGoogleAccount() {
  if (googleAccountWindow && !googleAccountWindow.isDestroyed()) {
    googleAccountWindow.focus();
    return true;
  }
  googleAccountWindow = new BrowserWindow({
    width: 500, height: 700,
    parent: mainWindow,
    title: 'Connexion Google — TeamAI',
    backgroundColor: '#ffffff',
    webPreferences: {
      partition: GOOGLE_PARTITION,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      enableWebAuthn: true,
    },
  });
  // Charger le choix de compte Google directement
  googleAccountWindow.loadURL('https://accounts.google.com/ServiceLogin?hl=fr&continue=https://myaccount.google.com/');

  // Détecter la connexion réussie
  googleAccountWindow.webContents.on('did-navigate', (e, url) => {
    if (url.includes('myaccount.google.com') || url.includes('accounts.google.com/o/oauth2') && url.includes('code=')) {
      // Envoyer événement au renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('google-status-changed', { connected: true });
      }
    }
  });

  googleAccountWindow.on('closed', () => {
    googleAccountWindow = null;
    // Vérifier le statut après fermeture
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('google-status-changed', { connected: null /* will be checked */ });
    }
  });
  return true;
}

async function getGoogleStatus() {
  try {
    const googleSession = session.fromPartition(GOOGLE_PARTITION);
    const cookies = await googleSession.cookies.get({ domain: '.google.com', name: 'SAPISID' });
    if (cookies && cookies.length > 0) {
      // Essayer de récupérer l'email depuis le cookie accounts
      const sidCookies = await googleSession.cookies.get({ domain: '.google.com', name: 'SID' });
      return { connected: true, email: sidCookies.length > 0 ? 'Compte Google connecté \u2705' : 'Connecté' };
    }
    return { connected: false };
  } catch { return { connected: false }; }
}

// ── Google OAuth Popup ─────────────────────────────────────────────────────
function openAuthWindow(url, partition) {
  // Toujours utiliser la partition Google partagée pour les URLs Google
  const isGoogle = url.includes('accounts.google.com') || url.includes('google.com/o/oauth2');
  const effectivePartition = isGoogle ? GOOGLE_PARTITION : (partition || GOOGLE_PARTITION);

  if (authWindows.has(effectivePartition)) {
    try { authWindows.get(effectivePartition).close(); } catch {}
  }
  const authWin = new BrowserWindow({
    width: 500, height: 700,
    parent: mainWindow, modal: false,
    title: 'Connexion — TeamAI',
    webPreferences: { partition: effectivePartition, sandbox: false, nodeIntegration: false, contextIsolation: true },
  });
  authWin.loadURL(url);
  authWindows.set(effectivePartition, authWin);
  authWin.webContents.on('did-navigate', (e, navUrl) => {
    if (!navUrl.includes('accounts.google.com') && navUrl !== url && !navUrl.includes('oauth') && !navUrl.includes('login')) {
      setTimeout(() => { try { authWin.close(); } catch {} }, 1200);
    }
  });
  authWin.on('closed', () => authWindows.delete(effectivePartition));
}

// ── Login Windows ──────────────────────────────────────────────────────────
function openLoginWindow(providerId, url, _partition) {
  // Utiliser la partition Google partagée pour TOUS les login windows
  // Ainsi Google OAuth dans chaque IA trouve les cookies existants
  const partition = GOOGLE_PARTITION;

  if (loginWindows.has(providerId)) {
    try { loginWindows.get(providerId).close(); } catch {}
  }
  const win = new BrowserWindow({
    width: 1100, height: 800, minWidth: 800, minHeight: 600,
    parent: mainWindow,
    title: `Connexion — ${providerId}`,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      partition,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      enableWebAuthn: true,
    },
  });
  win.loadURL(url);
  loginWindows.set(providerId, win);
  win.on('closed', () => {
    loginWindows.delete(providerId);
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('login-window-closed', providerId);
  });
  return true;
}

function closeLoginWindow(providerId) {
  if (loginWindows.has(providerId)) {
    try { loginWindows.get(providerId).close(); } catch {}
    loginWindows.delete(providerId);
  }
}

// ── IPC ────────────────────────────────────────────────────────────────────
function setupIPC() {
  const h = (ch, fn) => ipcMain.handle(ch, fn);
  h('get-providers',       () => loadProviders());
  h('dispatch-prompt',     (e, text) => { if (mainWindow) mainWindow.webContents.send('exec-js-all', text); });
  h('open-auth-window',    (e, url, partition) => openAuthWindow(url, partition));
  h('open-login-window',   (e, pid, url, partition) => openLoginWindow(pid, url, partition));
  h('close-login-window',  (e, pid) => closeLoginWindow(pid));
  h('open-google-account', () => openGoogleAccount());
  h('get-google-status',   () => getGoogleStatus());
  h('get-version',         () => { const v = loadJSON(CFG.VERSION); return { version: v.version || '0.4.0', commit: v.commit || 'dev', url: CFG.GITHUB_URL }; });
  h('open-url',            (e, url) => { if (url) shell.openExternal(url); });
  h('set-zoom',            (e, l) => { zoomLevel = Math.max(-3, Math.min(5, l)); });
  h('get-zoom',            () => zoomLevel);
  h('load-providers',      () => { const p = loadJSON(CFG.PROVIDERS); return Array.isArray(p) ? p : []; });
  h('check-update', async () => {
    const { execSync } = require('child_process');
    try {
      const cwd = __dirname.replace('/electron', '');
      execSync('git fetch origin', { cwd, timeout: 10000 });
      const behind = parseInt(execSync('git rev-list --count HEAD..origin/main', { cwd, encoding: 'utf8' }).trim());
      let lastCommit = '', lastAuthor = '', lastMessage = '';
      if (behind > 0) {
        try {
          lastCommit  = execSync('git log origin/main -1 --format=%H',  { cwd, encoding: 'utf8' }).trim();
          lastAuthor  = execSync('git log origin/main -1 --format=%an', { cwd, encoding: 'utf8' }).trim();
          lastMessage = execSync('git log origin/main -1 --format=%s',  { cwd, encoding: 'utf8' }).trim();
        } catch {}
      }
      return { hasUpdate: behind > 0, behind, lastCommit, lastAuthor, lastMessage };
    } catch { return { hasUpdate: false, behind: 0, error: true }; }
  });
  h('update-app', async () => {
    const { execSync } = require('child_process');
    try {
      execSync('git pull', { cwd: __dirname.replace('/electron', ''), timeout: 30000 });
      execSync('npm install --no-audit --no-fund', { cwd: __dirname.replace('/electron', ''), timeout: 120000 });
    } catch (e) { return `\u274c Erreur: ${e.message}`; }
    app.relaunch(); app.exit(0);
    return 'OK';
  });
}

// ── App ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    title: 'TeamAI',
    backgroundColor: '#0D0D0F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
      webviewTag: true,
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
