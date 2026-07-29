/**
 * TeamAI v2 — Settings Manager
 * Compte Google partag\u00e9 + Drive export
 */
const Settings = {
  _open: false,

  open() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    this._open = true;
    this._refreshGoogleStatus();
    this._refreshDriveStatus();
  },

  close() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
    this._open = false;
  },

  async _refreshGoogleStatus() {
    const bar = document.getElementById('google-status-bar');
    if (!bar) return;
    bar.textContent = '\u23f3 V\u00e9rification...';
    try {
      const status = await teamai.getGoogleStatus();
      if (status && status.connected) {
        bar.innerHTML = `<span style="color:#4ADE80;font-weight:700;">\u2705 Connect\u00e9</span> \u2014 <span style="color:#ccc">${status.email || 'Compte Google'}</span>`;
        document.getElementById('btn-google-login').textContent = '\ud83d\udd04 Changer de compte';
        // Rafra\u00eechir le badge sidebar
        Sidebar._renderGoogleBadge();
      } else {
        bar.innerHTML = '<span style="color:#EF4444;">\u26a0\ufe0f Non connect\u00e9</span>';
        document.getElementById('btn-google-login').textContent = 'Se connecter avec Google';
      }
    } catch {
      bar.textContent = '\u26a0\ufe0f Impossible de v\u00e9rifier.';
    }
  },

  async _refreshDriveStatus() {
    const bar = document.getElementById('drive-status-bar');
    if (!bar) return;
    try {
      const status = await teamai.getGoogleStatus();
      if (status && status.connected) {
        bar.innerHTML = `<span style="color:#4ADE80;">\u2705 Drive accessible</span> \u2014 <span style="color:#888;font-size:10px;">Les rapports seront export\u00e9s dans <strong>TeamAI Reports/</strong></span>`;
        document.getElementById('btn-drive-test')?.removeAttribute('disabled');
      } else {
        bar.innerHTML = '<span style="color:#888;">Connecte-toi \u00e0 Google d\'abord</span>';
        document.getElementById('btn-drive-test')?.setAttribute('disabled', 'true');
      }
    } catch { bar.textContent = ''; }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-settings')?.addEventListener('click', () => Settings.open());
  document.getElementById('settings-close')?.addEventListener('click', () => Settings.close());
  document.getElementById('settings-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('settings-modal')) Settings.close();
  });

  document.getElementById('btn-google-login')?.addEventListener('click', async () => {
    await teamai.openGoogleAccount();
    let checks = 0;
    const iv = setInterval(() => {
      Settings._refreshGoogleStatus();
      Settings._refreshDriveStatus();
      Sidebar._renderGoogleBadge();
      if (++checks >= 24) clearInterval(iv);
    }, 5000);
  });

  // Drive test
  document.getElementById('btn-drive-test')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-drive-test');
    btn.textContent = '\u23f3 Test en cours...';
    try {
      await teamai.openUrl('https://drive.google.com/drive/my-drive');
      btn.textContent = '\ud83d\udcc2 Drive ouvert';
      setTimeout(() => { btn.textContent = '\ud83e\uddea Tester Drive'; }, 3000);
    } catch(e) { btn.textContent = '\u274c Erreur'; }
  });

  document.getElementById('settings-export')?.addEventListener('click', () => window._exportProviders?.());
  document.getElementById('settings-import')?.addEventListener('click', () => window._importProviders?.());
  document.getElementById('settings-clear-sessions')?.addEventListener('click', () => {
    if (!confirm('\u26a0\ufe0f Effacer TOUTES les sessions ?')) return;
    localStorage.removeItem('teamai_connected');
    localStorage.removeItem('teamai_session');
    localStorage.removeItem('teamai_custom_providers');
    alert('\u2705 Sessions effac\u00e9es.');
  });
  document.getElementById('settings-open-github')?.addEventListener('click', () => teamai.openUrl('https://github.com/AtmanTest/arcclone-macos'));
});
