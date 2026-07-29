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

  _avatarStyle(email) {
    const initial = (email || 'G').charAt(0).toUpperCase();
    const colors = [
      ['#4285F4','#fff'],['#EA4335','#fff'],['#34A853','#fff'],
      ['#7C3AED','#fff'],['#06B6D4','#fff'],['#F59E0B','#000'],
      ['#EC4899','#fff'],['#10B981','#fff'],
    ];
    const [bg, fg] = colors[initial.charCodeAt(0) % colors.length];
    return { initial, bg, fg };
  },

  async _refreshProfile() {
    const profileEl = document.getElementById('settings-google-profile');
    if (!profileEl) return;
    try {
      const s = await teamai.getGoogleStatus();
      if (s && s.connected) {
        const email = s.email || 'Compte Google';
        const { initial, bg, fg } = this._avatarStyle(email);
        const namePart = email.includes('@') ? email.split('@')[0] : email;
        const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        const domain = email.includes('@') ? email.split('@')[1] : '';

        profileEl.innerHTML = `
          <div class="sg-banner"></div>
          <div class="sg-avatar-wrap" style="background:${bg};color:${fg};">${initial}</div>
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
        // pill Drive
        setTimeout(async () => {
          const pill = document.getElementById('sg-drive-pill');
          if (pill) pill.innerHTML = '<div class="dot green"></div> Drive accessible';
        }, 300);
      } else {
        profileEl.innerHTML = `
          <div class="sg-banner" style="background:linear-gradient(135deg,#1a1a2e,#2a2a3a);"></div>
          <div class="sg-avatar-wrap" style="background:#1a1a2e;color:#555;border:1.5px dashed #333;">G</div>
          <div class="sg-body">
            <div class="sg-displayname" style="color:#888;">Non connecté</div>
            <div class="sg-email">Connecte-toi pour activer toutes les IA Google</div>
            <button id="btn-google-login" style="margin-top:12px;width:100%;background:#fff;color:#222;border:none;border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;">
              <span style="color:#4285F4">G</span><span style="color:#EA4335">o</span><span style="color:#F59E0B">o</span><span style="color:#4285F4">g</span><span style="color:#34A853">l</span><span style="color:#EA4335">e</span>&nbsp; Se connecter
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
