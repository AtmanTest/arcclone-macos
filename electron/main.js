/**
 * TeamAI v6 — Main Process
 * persist:google_shared + Drive API export + OAuth PKCE
 */
const { app, BrowserWindow, ipcMain, session, shell, net } = require('electron');
const path = require('path');
const fs   = require('fs');
const { startGooglePKCE, fetchGoogleUserInfo, refreshAccessToken, getStoredTokens, clearTokens } = require('./auth/google-pkce');

let mainWindow = null;
const authWindows  = new Map();
const loginWindows = new Map();
let zoomLevel = 0;
let googleAccountWindow = null;

const CFG = {
  PROVIDERS: path.join(__dirname, '..', 'config', 'providers.json'),
  VERSION:   path.join(__dirname, '..', 'config', 'version.json'),
  GITHUB_URL:'https://github.com/AtmanTest/arcclone-macos',
};
const GOOGLE_PARTITION = 'persist:google_shared';

function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; } }
function loadProviders() { const d = loadJSON(CFG.PROVIDERS); return Array.isArray(d) ? d : []; }

// ── Google Status (PKCE-first, cookie fallback) ──
async function getGoogleStatus() {
  // 1. Check PKCE tokens first
  const tokens = getStoredTokens();
  if (tokens && tokens.access_token) {
    try {
      const info = await fetchGoogleUserInfo(tokens.access_token);
      if (info && info.email) return { connected: true, email: info.email, method: 'pkce' };
    } catch {
      // Try refresh
      if (tokens.refresh_token) {
        try {
          await refreshAccessToken(tokens.refresh_token);
          const info2 = await fetchGoogleUserInfo(getStoredTokens().access_token);
          if (info2 && info2.email) return { connected: true, email: info2.email, method: 'pkce' };
        } catch { clearTokens(); }
      } else { clearTokens(); }
    }
  }
  // 2. Cookie session fallback
  try {
    const gs = session.fromPartition(GOOGLE_PARTITION);
    const sapisid = await gs.cookies.get({ domain: '.google.com', name: 'SAPISID' });
    if (!sapisid || sapisid.length === 0) return { connected: false };
    let email = '';
    try {
      const emailCookies = await gs.cookies.get({ domain: '.google.com', name: 'GMAIL_AT' });
      if (emailCookies.length === 0) {
        const allCookies = await gs.cookies.get({ url: 'https://accounts.google.com' });
        const accountCookie = allCookies.find(c => c.name === 'AccountChooser' || c.name.includes('email'));
        if (accountCookie) email = decodeURIComponent(accountCookie.value || '').split(':')[0] || '';
      }
    } catch {}
    if (!email) {
      try {
        const profileCookies = await gs.cookies.get({ url: 'https://myaccount.google.com' });
        const osjc = profileCookies.find(c => c.name === 'OSID' || c.name === 'LSID');
        if (osjc) email = 'Compte Google connecté';
      } catch {}
    }
    return { connected: true, email: email || 'Compte Google connecté ✅', method: 'cookie' };
  } catch { return { connected: false }; }
}

// ── Google Account Window (cookie flow) ──
function openGoogleAccount() {
  if (googleAccountWindow && !googleAccountWindow.isDestroyed()) { googleAccountWindow.focus(); return true; }
  googleAccountWindow = new BrowserWindow({
    width: 500, height: 700, parent: mainWindow,
    title: 'Connexion Google — TeamAI', backgroundColor: '#ffffff',
    webPreferences: { partition: GOOGLE_PARTITION, sandbox: false, nodeIntegration: false, contextIsolation: true, enableWebAuthn: true },
  });
  googleAccountWindow.loadURL('https://accounts.google.com/ServiceLogin?hl=fr&continue=https://myaccount.google.com/');
  googleAccountWindow.webContents.on('did-navigate', (e, url) => {
    if (url.includes('myaccount.google.com')) {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('google-status-changed', { connected: true });
    }
  });
  googleAccountWindow.on('closed', () => {
    googleAccountWindow = null;
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('google-status-changed', { connected: null });
  });
  return true;
}

// ── Drive Export ──
async function exportReportToDrive({ filename, content, mimeType }) {
  // Prefer PKCE access_token
  const tokens = getStoredTokens();
  let authHeader;
  if (tokens && tokens.access_token) {
    authHeader = `Bearer ${tokens.access_token}`;
  } else {
    // Fallback SAPISIDHASH
    const gs = session.fromPartition(GOOGLE_PARTITION);
    const cookies = await gs.cookies.get({ domain: '.google.com' });
    const sapisid = cookies.find(c => c.name === 'SAPISID');
    if (!sapisid) throw new Error('Non connecté à Google');
    const origin = 'https://www.googleapis.com';
    const now = Math.floor(Date.now() / 1000);
    const { createHash } = require('crypto');
    const hash = createHash('sha1').update(`${now} ${sapisid.value} ${origin}`).digest('hex');
    authHeader = `SAPISIDHASH ${now}_${hash}`;
  }

  const boundary = 'teamai_boundary_' + Date.now();
  const metadata = JSON.stringify({ name: filename, parents: [], mimeType });
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  return new Promise((resolve, reject) => {
    const req = net.request({
      method: 'POST',
      url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    });
    req.setHeader('Authorization', authHeader);
    req.setHeader('Content-Type', `multipart/related; boundary=${boundary}`);
    req.setHeader('X-Goog-AuthUser', '0');
    let responseData = '';
    req.on('response', (res) => {
      res.on('data', chunk => { responseData += chunk.toString(); });
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          if (json.id) resolve({ id: json.id, name: json.name });
          else reject(new Error(json.error?.message || 'Upload échoué'));
        } catch { reject(new Error('Réponse invalide Drive')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Auth Window ──
function openAuthWindow(url, _partition) {
  const isGoogle = url.includes('accounts.google.com') || url.includes('google.com/o/oauth2');
  const effectivePartition = isGoogle ? GOOGLE_PARTITION : (_partition || GOOGLE_PARTITION);
  if (authWindows.has(effectivePartition)) { try { authWindows.get(effectivePartition).close(); } catch {} }
  const authWin = new BrowserWindow({
    width: 500, height: 700, parent: mainWindow, modal: false,
    title: 'Connexion — TeamAI',
    webPreferences: { partition: effectivePartition, sandbox: false, nodeIntegration: false, contextIsolation: true },
  });
  authWin.loadURL(url);
  authWindows.set(effectivePartition, authWin);
  authWin.webContents.on('did-navigate', (e, navUrl) => {
    if (!navUrl.includes('accounts.google.com') && navUrl !== url && !navUrl.includes('oauth') && !navUrl.includes('login'))
      setTimeout(() => { try { authWin.close(); } catch {} }, 1200);
  });
  authWin.on('closed', () => authWindows.delete(effectivePartition));
}

// ── Login Windows ──
function openLoginWindow(providerId, url) {
  if (loginWindows.has(providerId)) { try { loginWindows.get(providerId).close(); } catch {} }
  const win = new BrowserWindow({
    width: 1100, height: 800, minWidth: 800, minHeight: 600,
    parent: mainWindow, title: `Connexion — ${providerId}`,
    backgroundColor: '#FFFFFF',
    webPreferences: { partition: GOOGLE_PARTITION, sandbox: false, nodeIntegration: false, contextIsolation: true, enableWebAuthn: true },
  });
  win.loadURL(url);
  loginWindows.set(providerId, win);
  win.on('closed', () => {
    loginWindows.delete(providerId);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('login-window-closed', providerId);
  });
  return true;
}
function closeLoginWindow(pid) {
  if (loginWindows.has(pid)) { try { loginWindows.get(pid).close(); } catch {} loginWindows.delete(pid); }
}

// ── IPC ──
function setupIPC() {
  const h = (ch, fn) => ipcMain.handle(ch, fn);
  h('get-providers',          () => loadProviders());
  h('dispatch-prompt',        (e, text) => { if (mainWindow) mainWindow.webContents.send('exec-js-all', text); });
  h('open-auth-window',       (e, url, p) => openAuthWindow(url, p));
  h('open-login-window',      (e, pid, url) => openLoginWindow(pid, url));
  h('close-login-window',     (e, pid) => closeLoginWindow(pid));
  h('open-google-account',    () => openGoogleAccount());
  h('get-google-status',      () => getGoogleStatus());
  h('export-report-to-drive', (e, opts) => exportReportToDrive(opts));
  h('get-version',            () => { const v = loadJSON(CFG.VERSION); return { version: v.version || '0.0.0', commit: v.commit || 'dev', url: CFG.GITHUB_URL }; });
  h('open-url',               (e, url) => { if (url) shell.openExternal(url); });
  h('set-zoom',               (e, l) => { zoomLevel = Math.max(-3, Math.min(5, l)); });
  h('get-zoom',               () => zoomLevel);
  h('load-providers',         () => { const p = loadJSON(CFG.PROVIDERS); return Array.isArray(p) ? p : []; });
  // ── PKCE OAuth ──
  h('google-signin-pkce', async () => {
    try {
      const tokens = await startGooglePKCE();
      const userInfo = await fetchGoogleUserInfo(tokens.access_token);
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('google-status-changed', { connected: true, email: userInfo.email, method: 'pkce' });
      return { success: true, email: userInfo.email, tokens };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  h('google-signout-pkce', () => {
    clearTokens();
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('google-status-changed', { connected: false });
    return { success: true };
  });
  h('google-get-tokens', () => getStoredTokens());
  h('check-update', async () => {
    const { execSync } = require('child_process');
    try {
      const cwd = __dirname.replace('/electron', '');
      execSync('git fetch origin', { cwd, timeout: 10000 });
      const behind = parseInt(execSync('git rev-list --count HEAD..origin/main', { cwd, encoding: 'utf8' }).trim()) || 0;
      let lastCommit = '', lastAuthor = '', lastMessage = '';
      if (behind > 0) {
        lastCommit  = execSync('git log origin/main -1 --format=%H',  { cwd, encoding: 'utf8' }).trim();
        lastAuthor  = execSync('git log origin/main -1 --format=%an', { cwd, encoding: 'utf8' }).trim();
        lastMessage = execSync('git log origin/main -1 --format=%s',  { cwd, encoding: 'utf8' }).trim();
      }
      return { hasUpdate: behind > 0, behind, lastCommit, lastAuthor, lastMessage };
    } catch { return { hasUpdate: false, behind: 0, error: true }; }
  });
  h('update-app', async () => {
    const { execSync } = require('child_process');
    try {
      execSync('git pull', { cwd: __dirname.replace('/electron', ''), timeout: 30000 });
      execSync('npm install --no-audit --no-fund', { cwd: __dirname.replace('/electron', ''), timeout: 120000 });
    } catch(e) { return `❌ ${e.message}`; }
    app.relaunch(); app.exit(0); return 'OK';
  });
}

// ── App ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    title: 'TeamAI', backgroundColor: '#0D0D0F',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, webviewTag: true },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => { setupIPC(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
