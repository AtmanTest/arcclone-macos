/**
 * Google OAuth 2.0 + PKCE — External Browser Flow
 * Client ID: 856166874168-1phb3bnnejio3o96g45km0j2kll709gr.apps.googleusercontent.com
 */
const { shell, net } = require('electron');
const crypto = require('crypto');
const http   = require('http');
const url    = require('url');

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI         = 'http://127.0.0.1:4242/oauth/callback';
const AUTH_ENDPOINT        = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT       = 'https://oauth2.googleapis.com/token';

// ── Token persistence (disk) ──
const { app } = require('electron');
const TOKEN_FILE = require('path').join(app.getPath('userData'), 'google_tokens.json');
function _saveTokensToDisk(t) {
  try { require('fs').writeFileSync(TOKEN_FILE, JSON.stringify(t), 'utf-8'); } catch(e) {}
}
function _loadTokensFromDisk() {
  try {
    const raw = require('fs').readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}
const USERINFO_ENDPOINT    = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SCOPES               = 'openid email profile https://www.googleapis.com/auth/drive.file';

// ── PKCE helpers ──
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// ── Token store (mémoire + disque) ──
let _tokens = _loadTokensFromDisk();
exports.getStoredTokens = () => _tokens;
exports.clearTokens     = () => { _tokens = null; try { require('fs').unlinkSync(TOKEN_FILE); } catch {} };

// ── Start PKCE flow ──
exports.startGooglePKCE = function startGooglePKCE() {
  return new Promise((resolve, reject) => {
    const verifier  = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state     = generateState();

    const server = http.createServer();
    server.listen(4242, '127.0.0.1', () => {
      const authUrl = new URL(AUTH_ENDPOINT);
      authUrl.searchParams.set('client_id',             GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri',          REDIRECT_URI);
      authUrl.searchParams.set('response_type',         'code');
      authUrl.searchParams.set('scope',                 SCOPES);
      authUrl.searchParams.set('state',                 state);
      authUrl.searchParams.set('code_challenge',        challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('access_type',           'offline');
      authUrl.searchParams.set('prompt',                'consent');
      shell.openExternal(authUrl.toString());
    });

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout (5 min)'));
    }, 5 * 60 * 1000);

    server.on('request', async (req, res) => {
      const parsed = url.parse(req.url, true);
      if (!parsed.pathname.startsWith('/oauth/callback')) {
        res.end('Not found'); return;
      }
      clearTimeout(timeout);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="font-family:sans-serif;background:#0D0D0F;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh"><h2>\u2705 Connect\u00e9 \u2014 Retournez dans TeamAI</h2></body></html>');
      server.close();

      const { code, state: retState, error } = parsed.query;
      if (error) { reject(new Error(`Google OAuth error: ${error}`)); return; }
      if (retState !== state) { reject(new Error('State mismatch \u2014 possible CSRF')); return; }

      try {
        const tokens = await exchangeCode(code, verifier);
        _tokens = tokens;
        _saveTokensToDisk(tokens);
        resolve(tokens);
      } catch (e) { reject(e); }
    });

    server.on('error', reject);
  });
};

// ── Exchange code → tokens ──
async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri:  REDIRECT_URI,
    grant_type:    'authorization_code',
    code,
    code_verifier: verifier,
  });

  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'POST', url: TOKEN_ENDPOINT });
    req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
    let data = '';
    req.on('response', (res) => {
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(json.error_description || json.error));
          else resolve(json);
        } catch { reject(new Error('Token response parse error')); }
      });
    });
    req.on('error', reject);
    req.write(body.toString());
    req.end();
  });
}

// ── Fetch user info ──
exports.fetchGoogleUserInfo = async function fetchGoogleUserInfo(accessToken) {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'GET', url: USERINFO_ENDPOINT });
    req.setHeader('Authorization', `Bearer ${accessToken}`);
    let data = '';
    req.on('response', (res) => {
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('UserInfo parse error')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
};

// ── Refresh access token ──
exports.refreshAccessToken = async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
  });
  return new Promise((resolve, reject) => {
    const req = net.request({ method: 'POST', url: TOKEN_ENDPOINT });
    req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
    let data = '';
    req.on('response', (res) => {
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(json.error_description || json.error));
          else {
            if (_tokens) { _tokens.access_token = json.access_token; _saveTokensToDisk(_tokens); }
            resolve(json);
          }
        } catch { reject(new Error('Refresh parse error')); }
      });
    });
    req.on('error', reject);
    req.write(body.toString());
    req.end();
  });
};
