const GOOGLE_SVG_LG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="32" height="32">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  <path fill="none" d="M0 0h48v48H0z"/>
</svg>`;

const Settings = {
  _open: false,

  open() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    this._open = true;
    this._refreshProfile();
    this._refreshDriveStatus();
  },

  close() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
    this._open = false;
  },

  async _refreshProfile() {
    const profileEl = document.getElementById('settings-google-profile');
    if (!profileEl) return;
    try {
      const s = await teamai.getGoogleStatus();
      if (s && s.connected && s.email && s.email.includes('@')) {
        profileEl.innerHTML = `
          <div class="sg-banner"></div>
          <div class="sg-avatar-wrap">${GOOGLE_SVG_LG}</div>
          <div class="sg-body">
            <div class="sg-email" style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;">${s.email}</div>
            <div class="sg-pills">
              <div class="sg-pill"><div class="dot green"></div> Session active</div>
              <div class="sg-pill" id="sg-drive-pill"><div class="dot orange"></div> Drive\u2026</div>
            </div>
            <button id="btn-google-signout" style="margin-top:12px;width:100%;background:#1a1a2e;color:#EF4444;border:1px solid #3a1a1a;border-radius:8px;padding:8px;font-size:10px;cursor:pointer;">\uD83D\uDEAA D\u00e9connexion</button>
            <button id="btn-google-login" style="margin-top:6px;width:100%;background:#1a1a2e;color:#aaa;border:1px solid #2a2a3a;border-radius:8px;padding:8px;font-size:10px;cursor:pointer;">\uD83D\uDD04 Changer de compte</button>
          </div>
        `;
        setTimeout(() => {
          const pill = document.getElementById('sg-drive-pill');
          if (pill) pill.innerHTML = '<div class="dot green"></div> Drive accessible';
        }, 300);
        document.getElementById('btn-google-signout')?.addEventListener('click', async () => {
          await teamai.googleSignOutPKCE();
          this._refreshProfile();
          this._refreshDriveStatus();
          Sidebar.refreshGoogleCard();
        });
        document.getElementById('btn-google-login')?.addEventListener('click', () => this._startPKCELogin());
      } else {
        profileEl.innerHTML = `
          <div class="sg-banner" style="background:linear-gradient(135deg,#1a1a2e,#2a2a3a);"></div>
          <div class="sg-avatar-wrap" style="background:#1a1a2e;opacity:0.4;">${GOOGLE_SVG_LG}</div>
          <div class="sg-body">
            <div style="color:#888;font-size:12px;font-weight:600;margin-bottom:6px;">Non connect\u00e9</div>
            <div style="color:#555;font-size:10px;margin-bottom:12px;">Connecte-toi pour activer Drive et les IA Google</div>
            <button id="btn-google-login" style="width:100%;background:#fff;color:#222;border:none;border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
              ${GOOGLE_SVG_LG} <span>Se connecter avec Google</span>
            </button>
          </div>
        `;
        document.getElementById('btn-google-login')?.addEventListener('click', () => this._startPKCELogin());
      }
    } catch(e) {
      if (profileEl) profileEl.innerHTML = '<div style="padding:12px;color:#EF4444;font-size:10px;">\u274c Erreur</div>';
    }
  },

  async _startPKCELogin() {
    const profileEl = document.getElementById('settings-google-profile');
    if (profileEl) profileEl.innerHTML = `<div style="padding:20px;text-align:center;color:#aaa;font-size:11px;">\uD83D\uDD10 Ouverture du navigateur...<br><span style="font-size:9px;color:#555;">Connecte-toi dans ton navigateur, l\'app se mettra \u00e0 jour automatiquement.</span></div>`;
    try {
      const result = await teamai.googleSignInPKCE();
      if (result && result.success) {
        Sidebar.refreshGoogleCard();
        this._refreshProfile();
        this._refreshDriveStatus();
      } else {
        if (profileEl) profileEl.innerHTML = `<div style="padding:12px;color:#EF4444;font-size:10px;">\u274c ${result?.error || 'Erreur inconnue'}<br><button onclick="Settings._refreshProfile()" style="margin-top:8px;background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:10px;">R\u00e9essayer</button></div>`;
      }
    } catch(e) {
      if (profileEl) profileEl.innerHTML = `<div style="padding:12px;color:#EF4444;font-size:10px;">\u274c ${e.message}<br><button onclick="Settings._refreshProfile()" style="margin-top:8px;background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:10px;">R\u00e9essayer</button></div>`;
    }
  },

  async _refreshDriveStatus() {
    const bar = document.getElementById('drive-status-bar');
    if (!bar) return;
    try {
      const s = await teamai.getGoogleStatus();
      if (s && s.connected && s.email && s.email.includes('@')) {
        bar.innerHTML = '<span style="color:#4ADE80;">\u2705 Drive accessible</span> <span style="color:#555;font-size:9px;">\u2014 export dans <code style="color:#06B6D4;">TeamAI Reports/</code></span>';
        document.getElementById('btn-drive-test')?.removeAttribute('disabled');
      } else {
        bar.textContent = "Connecte-toi \u00e0 Google d'abord";
        document.getElementById('btn-drive-test')?.setAttribute('disabled', 'true');
      }
    } catch { bar.textContent = ''; }
  },

  /** Apply and persist auto-save settings */
  _applyAutoSave() {
    const mode        = localStorage.getItem('teamai_autosave_mode')     || 'exit';
    const intervalMin = localStorage.getItem('teamai_autosave_interval') || '5';
    PersistenceManager.startAutoSave(mode, parseInt(intervalMin, 10));
  },
};

document.addEventListener('DOMContentLoaded', () => {
  // ── Existing bindings ────────────────────────────────────────────────────
  document.getElementById('btn-settings')?.addEventListener('click', () => Settings.open());
  document.getElementById('settings-close')?.addEventListener('click', () => Settings.close());
  document.getElementById('settings-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('settings-modal')) Settings.close();
  });
  document.getElementById('btn-drive-test')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-drive-test');
    btn.textContent = '\u23f3 Ouverture...';
    try {
      await teamai.openUrl('https://drive.google.com/drive/my-drive');
      btn.textContent = '\uD83D\uDCC2 Drive ouvert';
      setTimeout(() => { btn.textContent = '\uD83E\uDDEA Tester Drive'; }, 3000);
    } catch { btn.textContent = '\u274c Erreur'; }
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

  // ── Default startup mode ─────────────────────────────────────────────────
  const modeSelect = document.getElementById('settings-default-mode');
  if (modeSelect) {
    modeSelect.value = localStorage.getItem('teamai_default_mode') || 'focus';
    modeSelect.addEventListener('change', () => {
      localStorage.setItem('teamai_default_mode', modeSelect.value);
    });
  }

  // ── Auto-save ────────────────────────────────────────────────────────────
  const autoSaveModeSelect     = document.getElementById('settings-autosave-mode');
  const autoSaveIntervalInput  = document.getElementById('settings-autosave-interval');
  const autoSaveIntervalRow    = document.getElementById('autosave-interval-row');
  const autoSaveStatus         = document.getElementById('autosave-status');

  function updateAutoSaveUI(mode) {
    const showInterval = mode === 'interval' || mode === 'both';
    if (autoSaveIntervalRow) autoSaveIntervalRow.style.display = showInterval ? 'flex' : 'none';
    if (autoSaveStatus) {
      const labels = {
        off:      '🚫 Sauvegarde automatique désactivée',
        exit:     '🚪 Sauvegarde à chaque fermeture de l\'app',
        interval: `⏱ Sauvegarde toutes les ${autoSaveIntervalInput?.value || 5} min`,
        both:     `✅ Fermeture + toutes les ${autoSaveIntervalInput?.value || 5} min`,
      };
      autoSaveStatus.textContent = labels[mode] || '';
    }
  }

  if (autoSaveModeSelect) {
    const savedMode = localStorage.getItem('teamai_autosave_mode') || 'exit';
    autoSaveModeSelect.value = savedMode;
    updateAutoSaveUI(savedMode);

    autoSaveModeSelect.addEventListener('change', () => {
      const mode = autoSaveModeSelect.value;
      localStorage.setItem('teamai_autosave_mode', mode);
      updateAutoSaveUI(mode);
      Settings._applyAutoSave();
    });
  }

  if (autoSaveIntervalInput) {
    autoSaveIntervalInput.value = localStorage.getItem('teamai_autosave_interval') || '5';
    autoSaveIntervalInput.addEventListener('change', () => {
      const v = Math.max(1, Math.min(60, parseInt(autoSaveIntervalInput.value, 10) || 5));
      autoSaveIntervalInput.value = v;
      localStorage.setItem('teamai_autosave_interval', String(v));
      updateAutoSaveUI(autoSaveModeSelect?.value || 'exit');
      Settings._applyAutoSave();
    });
  }

  // Kick off auto-save on app start with persisted prefs
  Settings._applyAutoSave();
});
