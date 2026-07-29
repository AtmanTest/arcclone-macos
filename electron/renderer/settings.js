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
      if (s && s.connected) {
        const email = s.email || 'Compte Google';
        const namePart = email.includes('@') ? email.split('@')[0] : email;
        const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        const domain = email.includes('@') ? email.split('@')[1] : '';
        profileEl.innerHTML = `
          <div class="sg-banner"></div>
          <div class="sg-avatar-wrap">${GOOGLE_SVG_LG}</div>
          <div class="sg-body">
            <div class="sg-displayname">${displayName}</div>
            <div class="sg-email">${email}</div>
            <div class="sg-pills">
              <div class="sg-pill"><div class="dot green"></div> Session active</div>
              ${domain ? `<div class="sg-pill"><div class="dot blue"></div> ${domain}</div>` : ''}
              <div class="sg-pill" id="sg-drive-pill"><div class="dot orange"></div> Drive…</div>
            </div>
            <button id="btn-google-login" style="margin-top:12px;width:100%;background:#1a1a2e;color:#aaa;border:1px solid #2a2a3a;border-radius:8px;padding:8px;font-size:10px;cursor:pointer;">🔄 Changer de compte</button>
          </div>
        `;
        setTimeout(() => {
          const pill = document.getElementById('sg-drive-pill');
          if (pill) pill.innerHTML = '<div class="dot green"></div> Drive accessible';
        }, 400);
      } else {
        profileEl.innerHTML = `
          <div class="sg-banner" style="background:linear-gradient(135deg,#1a1a2e,#2a2a3a);"></div>
          <div class="sg-avatar-wrap" style="background:#1a1a2e;opacity:0.4;">${GOOGLE_SVG_LG}</div>
          <div class="sg-body">
            <div class="sg-displayname" style="color:#888;">Non connecté</div>
            <div class="sg-email">Connecte-toi pour activer toutes les IA Google</div>
            <button id="btn-google-login" style="margin-top:12px;width:100%;background:#fff;color:#222;border:none;border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
              ${GOOGLE_SVG_LG} Se connecter avec Google
            </button>
          </div>
        `;
      }
      document.getElementById('btn-google-login')?.addEventListener('click', async () => {
        await teamai.openGoogleAccount();
        let checks = 0;
        const iv = setInterval(async () => {
          await this._refreshProfile();
          await this._refreshDriveStatus();
          Sidebar.refreshGoogleCard();
          if (++checks >= 24) clearInterval(iv);
        }, 5000);
      });
    } catch(e) {
      if (profileEl) profileEl.innerHTML = '<div style="padding:12px;color:#EF4444;font-size:10px;">❌ Erreur</div>';
    }
  },

  async _refreshDriveStatus() {
    const bar = document.getElementById('drive-status-bar');
    if (!bar) return;
    try {
      const s = await teamai.getGoogleStatus();
      if (s && s.connected) {
        bar.innerHTML = '<span style="color:#4ADE80;">✅ Drive accessible</span> <span style="color:#555;font-size:9px;">— export dans <code>TeamAI Reports/</code></span>';
        document.getElementById('btn-drive-test')?.removeAttribute('disabled');
      } else {
        bar.textContent = "Connecte-toi à Google d'abord";
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
  document.getElementById('btn-drive-test')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-drive-test');
    btn.textContent = '⏳ Ouverture...';
    try {
      await teamai.openUrl('https://drive.google.com/drive/my-drive');
      btn.textContent = '📂 Drive ouvert';
      setTimeout(() => { btn.textContent = '🧪 Tester Drive'; }, 3000);
    } catch { btn.textContent = '❌ Erreur'; }
  });
  document.getElementById('settings-export')?.addEventListener('click', () => window._exportProviders?.());
  document.getElementById('settings-import')?.addEventListener('click', () => window._importProviders?.());
  document.getElementById('settings-clear-sessions')?.addEventListener('click', () => {
    if (!confirm('⚠️ Effacer TOUTES les sessions ?')) return;
    localStorage.removeItem('teamai_connected');
    localStorage.removeItem('teamai_session');
    localStorage.removeItem('teamai_custom_providers');
    alert('✅ Sessions effacées.');
  });
  document.getElementById('settings-open-github')?.addEventListener('click', () => teamai.openUrl('https://github.com/AtmanTest/arcclone-macos'));
});
