/**
 * TeamAI v6 — Main Process
 * persist:google_shared + Drive API export
 */
const { app, BrowserWindow, ipcMain, session, shell, net } = require('electron');
const path = require('path');
const fs   = require('fs');

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

// ── Google Status ──
async function getGoogleStatus() {
  try {
    const gs = session.fromPartition(GOOGLE_PARTITION);
    // SAPISID = cookie de session Google actif
    const sapisid = await gs.cookies.get({ domain: '.google.com', name: 'SAPISID' });
    if (!sapisid || sapisid.length === 0) return { connected: false };
    // R\u00e9cup\u00e9rer l'email via le cookie GMAIL_AT ou depuis les headers de profil
    // M\u00e9thode la plus fiable : chercher dans les cookies account-related
    let email = '';
    try {
      // Le cookie "email" existe sur certains flows Google
      const emailCookies = await gs.cookies.get({ domain: '.google.com', name: 'GMAIL_AT' });
      if (emailCookies.length === 0) {
        // Fallback: chercher dans les cookies accounts.google.com
        const allCookies = await gs.cookies.get({ url: 'https://accounts.google.com' });
        const accountCookie = allCookies.find(c => c.name === 'AccountChooser' || c.name.includes('email'));
        if (accountCookie) email = decodeURIComponent(accountCookie.value || '').split(':')[0] || '';
      }
    } catch { /* email reste vide, on indique juste "connect\u00e9" */ }
    // Si on a une session active, on peut lire le profil via une requ\u00eate interne
    if (!email) {
      try {
        const profileCookies = await gs.cookies.get({ url: 'https://myaccount.google.com' });
        const osjc = profileCookies.find(c => c.name === 'OSID' || c.name === 'LSID');
        if (osjc) email = 'Compte Google connect\u00e9';
      } catch {}
    }
    return { connected: true, email: email || 'Compte Google connect\u00e9 \u2705' };
  } catch { return { connected: false }; }
}

// ── Google Account Window ──
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
  const gs = session.fromPartition(GOOGLE_PARTITION);
  // R\u00e9cup\u00e9rer le token OAuth depuis les cookies de la session
  const cookies = await gs.cookies.get({ domain: '.google.com' });
  const sapisid = cookies.find(c => c.name === 'SAPISID');
  if (!sapisid) throw new Error('Non connect\u00e9 \u00e0 Google');

  // Construire le token SAPISIDHASH pour l'auth
  const origin = 'https://www.googleapis.com';
  const now = Math.floor(Date.now() / 1000);
  const { createHash } = require('crypto');
  const hash = createHash('sha1').update(`${now} ${sapisid.value} ${origin}`).digest('hex');
  const authToken = `SAPISIDHASH ${now}_${hash}`;

  // Cr\u00e9er le fichier sur Drive via multipart upload
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
      partition: GOOGLE_PARTITION,
      session: gs,
    });
    req.setHeader('Authorization', authToken);
    req.setHeader('Content-Type', `multipart/related; boundary=${boundary}`);
    req.setHeader('X-Goog-AuthUser', '0');
    req.setHeader('Origin', origin);
    let responseData = '';
    req.on('response', (res) => {
      res.on('data', chunk => { responseData += chunk.toString(); });
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          if (json.id) resolve({ id: json.id, name: json.name });
          else reject(new Error(json.error?.message || 'Upload \u00e9chou\u00e9'));
        } catch { reject(new Error('R\u00e9ponse invalide Drive')); }
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
    } catch(e) { return `\u274c ${e.message}`; }
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
