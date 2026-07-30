require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
/**
 * TeamAI v6 — Main Process
 * OAuth PKCE (external browser) + Drive Bearer token
 */
const { app, BrowserWindow, ipcMain, session, shell, net } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { startGooglePKCE, fetchGoogleUserInfo, refreshAccessToken, getStoredTokens, clearTokens } = require('./auth/google-pkce');

let mainWindow = null;
const authWindows  = new Map();
const loginWindows = new Map();
let zoomLevel = 0;

const CFG = {
  PROVIDERS: path.join(__dirname, '..', 'config', 'providers.json'),
  VERSION:   path.join(__dirname, '..', 'config', 'version.json'),
  GITHUB_URL:'https://github.com/AtmanTest/arcclone-macos',
};
const GOOGLE_PARTITION = 'persist:google_shared';


// Bug 3 fix — Sauvegarde session Google avant mise a jour
function backupGooglePartition() {
  try {
    const { app } = require('electron');
    const src  = path.join(app.getPath('userData'), 'Partitions', 'persist_google_shared');
    const dest = path.join(app.getPath('userData'), 'google_session_backup');
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
    }
  } catch(e) { console.warn('backupGooglePartition:', e.message); }
}
function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; } }
function loadProviders() { const d = loadJSON(CFG.PROVIDERS); return Array.isArray(d) ? d : []; }

// ── Google Status — PKCE only ──
async function getGoogleStatus() {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) return { connected: false };
  try {
    const info = await fetchGoogleUserInfo(tokens.access_token);
    if (info && info.email) return { connected: true, email: info.email };
  } catch {
    // try refresh
    if (tokens.refresh_token) {
      try {
        const refreshed = await refreshAccessToken(tokens.refresh_token);
        const info2 = await fetchGoogleUserInfo(refreshed.access_token || tokens.access_token);
        if (info2 && info2.email) return { connected: true, email: info2.email };
      } catch { clearTokens(); }
    } else { clearTokens(); }
  }
  return { connected: false };
}

// ── Google Profile (name + email + photo) ──
async function getGoogleProfile() {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) return null;
  try {
    const info = await fetchGoogleUserInfo(tokens.access_token);
    if (info && info.email) return { name: info.name || '', email: info.email, photo: info.picture || '' };
  } catch {
    if (tokens.refresh_token) {
      try {
        const refreshed = await refreshAccessToken(tokens.refresh_token);
        const info2 = await fetchGoogleUserInfo(refreshed.access_token || tokens.access_token);
        if (info2 && info2.email) return { name: info2.name || '', email: info2.email, photo: info2.picture || '' };
      } catch { clearTokens(); }
    } else { clearTokens(); }
  }
  return null;
}

// ── Drive Status ──
async function getDriveStatus() {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) return { connected: false };
  try {
    const info = await fetchGoogleUserInfo(tokens.access_token);
    if (info && info.email) return { connected: true, email: info.email };
  } catch {
    if (tokens.refresh_token) {
      try {
        const refreshed = await refreshAccessToken(tokens.refresh_token);
        const info2 = await fetchGoogleUserInfo(refreshed.access_token || tokens.access_token);
        if (info2 && info2.email) return { connected: true, email: info2.email };
      } catch { clearTokens(); }
    } else { clearTokens(); }
  }
  return { connected: false };
}

// ── Drive Test — vérifie l'accès Drive ──
async function testDrive() {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) return false;
  return new Promise((resolve) => {
    const req = net.request({ method: 'GET', url: 'https://www.googleapis.com/drive/v3/about?fields=user' });
    req.setHeader('Authorization', `Bearer ${tokens.access_token}`);
    let data = '';
    req.on('response', (res) => {
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { const j = JSON.parse(data); resolve(!!(j.user && j.user.emailAddress)); }
        catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// ── Drive Export — Bearer token only ──
async function exportReportToDrive({ filename, content, mimeType }) {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) throw new Error('Non connecté à Google. Connecte-toi via Réglages d\'abord.');

  const boundary = 'teamai_boundary_' + Date.now();
  const metadata = JSON.stringify({ name: filename, parents: [], mimeType });
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', metadata,
    `--${boundary}`, `Content-Type: ${mimeType}`, '', content, `--${boundary}--`,
  ].join('\r\n');

  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'POST', url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart' });
    req.setHeader('Authorization', `Bearer ${tokens.access_token}`);
    req.setHeader('Content-Type', `multipart/related; boundary=${boundary}`);
    let data = '';
    req.on('response', (res) => {
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.id) resolve({ id: json.id, name: json.name });
          else if (json.error?.status === 'UNAUTHENTICATED' || res.statusCode === 401) {
            // Token expired, try refresh once
            if (tokens.refresh_token) {
              refreshAccessToken(tokens.refresh_token)
                .then(r => exportReportToDrive({ filename, content, mimeType }))
                .then(resolve).catch(reject);
            } else {
              clearTokens();
              reject(new Error('Session expirée. Reconnecte-toi via Réglages.'));
            }
          } else {
            reject(new Error(json.error?.message || 'Upload échoué'));
          }
        } catch { reject(new Error('Réponse invalide Drive')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Drive folder helpers ──────────────────────────────────────────────
async function ensureDriveFolder(name, parentId) {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) throw new Error('Google non connecté');
  const query = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const qs = parentId ? `q=${encodeURIComponent(query)}&spaces=drive` : `q=${encodeURIComponent(query)}&spaces=drive`;

  // Try to find existing
  const findRes = await new Promise((resolve, reject) => {
    const r2 = net.request({ method: 'GET', url: `https://www.googleapis.com/drive/v3/files?${qs}` });
    r2.setHeader('Authorization', `Bearer ${tokens.access_token}`);
    let d = '';
    r2.on('response', res => { res.on('data', c => { d += c; }); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
    r2.on('error', reject);
    r2.end();
  });

  if (findRes.files && findRes.files.length > 0) return findRes.files[0].id;

  // Create folder
  const meta = JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] });
  return new Promise((resolve, reject) => {
    const r3 = net.request({ method: 'POST', url: 'https://www.googleapis.com/drive/v3/files' });
    r3.setHeader('Authorization', `Bearer ${tokens.access_token}`);
    r3.setHeader('Content-Type', 'application/json');
    let d = '';
    r3.on('response', res => { res.on('data', c => { d += c; }); res.on('end', () => { try { const j = JSON.parse(d); if (j.id) resolve(j.id); else reject(new Error(j.error?.message || 'Création dossier échouée')); } catch { reject(new Error('Réponse invalide')); } }); });
    r3.on('error', reject);
    r3.write(meta);
    r3.end();
  });
}

async function exportLogToDrive({ filename, content, version, branch, commit }) {
  const rootId = await ensureDriveFolder('TeamAI');
  const branchId = await ensureDriveFolder(branch || 'main', rootId);
  const verLabel = `${version || '0.0.0'}-${(commit || 'dev').slice(0, 12)}`;
  const verId = await ensureDriveFolder(verLabel, branchId);
  // Upload file into version folder
  const tokens = getStoredTokens();
  const boundary = 'teamai_log_' + Date.now();
  const metadata = JSON.stringify({ name: filename, parents: [verId], mimeType: 'text/markdown' });
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', metadata,
    `--${boundary}`, 'Content-Type: text/markdown', '', content, `--${boundary}--`,
  ].join('\r\n');

  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'POST', url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink' });
    req.setHeader('Authorization', `Bearer ${tokens.access_token}`);
    req.setHeader('Content-Type', `multipart/related; boundary=${boundary}`);
    let data = '';
    req.on('response', (res) => {
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.id) resolve({ id: json.id, name: json.name, link: json.webViewLink, path: `${verLabel}/${filename}` });
          else if (json.error?.status === 'UNAUTHENTICATED' || res.statusCode === 401) {
            if (tokens.refresh_token) {
              refreshAccessToken(tokens.refresh_token)
                .then(r => exportLogToDrive({ filename, content, version, branch, commit }))
                .then(resolve).catch(reject);
            } else {
              clearTokens();
              reject(new Error('Session expirée. Reconnecte-toi.'));
            }
          } else {
            reject(new Error(json.error?.message || 'Upload échoué'));
          }
        } catch { reject(new Error('Réponse invalide Drive')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Auth Window (for non-Google providers) ──
function openAuthWindow(url, _partition) {
  const effectivePartition = _partition || GOOGLE_PARTITION;
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
  h('get-google-status',      () => getGoogleStatus());
  h('get-google-profile',     () => getGoogleProfile());
  h('get-drive-status',       () => getDriveStatus());
  h('test-drive',             () => testDrive());
  h('export-report-to-drive', (e, opts) => exportReportToDrive(opts));
  h('export-log-to-drive',    (e, opts) => exportLogToDrive(opts));
  h('get-version',            () => { 
    const v = loadJSON(CFG.VERSION);
    let branch = 'main';
    try {
      const head = fs.readFileSync(path.join(__dirname, '..', '.git', 'HEAD'), 'utf8').trim();
      const m = head.match(/^ref:\s*refs\/heads\/(.+)$/);
      if (m) branch = m[1];
    } catch {}
    return { version: v.version || '0.0.0', commit: v.commit || 'dev', branch, url: CFG.GITHUB_URL }; 
  });
  h('get-sysinfo',            () => {
    const mem = process.memoryUsage();
    return { ram: Math.round(mem.rss / 1024 / 1024), cpu: 0 };
  });
  h('open-url',               (e, url) => { if (url) shell.openExternal(url); });
  h('set-zoom',               (e, l) => { zoomLevel = Math.max(-3, Math.min(5, l)); });

  ipcMain.on('do-update-backup', () => backupGooglePartition());
  h('get-zoom',               () => zoomLevel);
  h('load-providers',         () => { const p = loadJSON(CFG.PROVIDERS); return Array.isArray(p) ? p : []; });
  // ── PKCE OAuth ──
  h('google-signin-pkce', async () => {
    try {
      const tokens = await startGooglePKCE();
      const userInfo = await fetchGoogleUserInfo(tokens.access_token);
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('google-status-changed', { connected: true, email: userInfo.email });
      return { success: true, email: userInfo.email, tokens };
    } catch (e) { return { success: false, error: e.message }; }
  });
  h('google-signout-pkce', () => {
    clearTokens();
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('google-status-changed', { connected: false });
    return { success: true };
  });
  h('google-get-tokens', () => getStoredTokens());
  // ── Update ──
  h('check-update', async () => {
    const { execSync } = require('child_process');
    try {
      const cwd = __dirname.replace('/electron', '');
      // Resolve current branch dynamically — avoids false positives when on a feature branch
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
      const remoteBranch  = `origin/${currentBranch}`;
      execSync(`git fetch origin ${currentBranch}`, { cwd, timeout: 10000 });
      const behind = parseInt(execSync(`git rev-list --count HEAD..${remoteBranch}`, { cwd, encoding: 'utf8' }).trim()) || 0;
      let lastCommit = '', lastAuthor = '', lastMessage = '';
      if (behind > 0) {
        lastCommit  = execSync(`git log ${remoteBranch} -1 --format=%H`,  { cwd, encoding: 'utf8' }).trim();
        lastAuthor  = execSync(`git log ${remoteBranch} -1 --format=%an`, { cwd, encoding: 'utf8' }).trim();
        lastMessage = execSync(`git log ${remoteBranch} -1 --format=%s`,  { cwd, encoding: 'utf8' }).trim();
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('set-focus-on-relaunch');
      await new Promise(r => setTimeout(r, 300));
    }
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
