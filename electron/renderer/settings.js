/**
 * Settings v2 — ajout toggle barre de dispatch
 */

// Objet Settings exposé globalement pour sidebar.js
const Settings = {
  open() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    loadSettings();
  },
  close() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', () => {

  // ── Ouvrir / fermer le modal ──────────────────────────────────────────
  const modal    = document.getElementById('settings-modal');
  const btnOpen  = document.getElementById('btn-settings');
  const btnClose = document.getElementById('settings-close');
  if (btnOpen)  btnOpen.addEventListener('click',  () => { modal.style.display = 'flex'; loadSettings(); });
  if (btnClose) btnClose.addEventListener('click', () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  // ── Google Profile ──────────────────────────────────────────────────
  function loadSettings() {
    renderGoogleSection();
    checkDriveStatus();
  }

  async function renderGoogleSection() {
    const container = document.getElementById('settings-google-profile');
    if (!container) return;

    if (typeof teamai === 'undefined') {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#555;font-size:10px;">🔌 Google non connecté</div>';
      return;
    }

    // Affiche spinner pendant le chargement
    container.innerHTML = '<div style="padding:16px;text-align:center;color:#555;font-size:10px;">⏳ Chargement…</div>';

    try {
      const p = teamai.getGoogleProfile ? await teamai.getGoogleProfile() : null;

      if (p && p.email) {
        container.innerHTML = `
          <div style="border-radius:10px;overflow:hidden;border:1px solid #1e1e2e;">
            <div class="sg-banner"></div>
            <div style="position:relative;">
              <div class="sg-avatar-wrap">
                ${p.photo
                  ? `<img src="${p.photo}" style="width:34px;height:34px;border-radius:50%;" onerror="this.outerHTML='<svg viewBox=\'0 0 24 24\' width=\'34\' height=\'34\' fill=\'none\'><circle cx=\'12\' cy=\'8\' r=\'4\' fill=\'#4285F4\'/><path d=\'M4 20c0-4 3.6-7 8-7s8 3 8 7\' fill=\'#4285F4\'/></svg>'">`
                  : `<svg viewBox="0 0 24 24" width="34" height="34" fill="none"><circle cx="12" cy="8" r="4" fill="#4285F4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#4285F4"/></svg>`
                }
              </div>
            </div>
            <div class="sg-body">
              <div class="sg-displayname">${p.name || '—'}</div>
              <div class="sg-email">${p.email}</div>
              <div class="sg-pills">
                <div class="sg-pill"><span class="dot green"></span>Connecté</div>
                <div class="sg-pill"><span class="dot blue"></span>Drive</div>
              </div>
            </div>
            <div style="padding:0 12px 12px;">
              <button id="btn-google-signout" style="width:100%;background:#1a1a2e;color:#EF4444;border:1px solid #3a1a1a;border-radius:7px;padding:8px;font-size:10px;cursor:pointer;">🔓 Se déconnecter</button>
            </div>
          </div>`;

        document.getElementById('btn-google-signout')?.addEventListener('click', async () => {
          await teamai.googleSignOutPKCE();
          renderGoogleSection();
          checkDriveStatus();
          if (typeof Sidebar !== 'undefined') Sidebar.refreshGoogleCard();
        });

      } else {
        container.innerHTML = `
          <div style="padding:16px;text-align:center;">
            <div style="color:#aaa;font-size:11px;margin-bottom:12px;">Non connecté à Google</div>
            <button id="btn-google-signin" style="width:100%;background:#4285F4;color:#fff;border:none;border-radius:8px;padding:10px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="16" height="16"><path fill="#fff" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#fff" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#fff" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#fff" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Se connecter avec Google
            </button>
          </div>`;

        document.getElementById('btn-google-signin')?.addEventListener('click', async () => {
          const btn = document.getElementById('btn-google-signin');
          if (btn) { btn.textContent = '⏳ Ouverture du navigateur…'; btn.disabled = true; }
          try {
            const result = await teamai.googleSignInPKCE();
            if (result && result.success) {
              renderGoogleSection();
              checkDriveStatus();
              if (typeof Sidebar !== 'undefined') Sidebar.refreshGoogleCard();
            } else {
              container.innerHTML = `<div style="padding:16px;text-align:center;color:#EF4444;font-size:10px;">❌ ${result?.error || 'Erreur de connexion'}</div>`;
              setTimeout(renderGoogleSection, 3000);
            }
          } catch(e) {
            container.innerHTML = `<div style="padding:16px;text-align:center;color:#EF4444;font-size:10px;">❌ ${e.message}</div>`;
            setTimeout(renderGoogleSection, 3000);
          }
        });
      }
    } catch(e) {
      container.innerHTML = `<div style="padding:16px;text-align:center;color:#555;font-size:10px;">❌ Erreur profil</div>`;
    }
  }

  // ── Mode au démarrage ────────────────────────────────────────────────
  const modeSelect = document.getElementById('settings-default-mode');
  if (modeSelect) {
    modeSelect.value = localStorage.getItem('teamai_default_mode') || 'focus';
    modeSelect.addEventListener('change', () => {
      localStorage.setItem('teamai_default_mode', modeSelect.value);
    });
  }

  // ── Barre de progression dispatch ──────────────────────────────────
  const dispatchToggle = document.getElementById('settings-dispatch-bar');
  if (dispatchToggle) {
    dispatchToggle.checked = localStorage.getItem('teamai_dispatch_bar_enabled') !== 'false';
    dispatchToggle.addEventListener('change', () => {
      localStorage.setItem('teamai_dispatch_bar_enabled', dispatchToggle.checked ? 'true' : 'false');
      if (!dispatchToggle.checked && typeof DispatchProgress !== 'undefined') DispatchProgress.dismiss();
    });
  }

  // ── Sauvegarde automatique ───────────────────────────────────────────
  const autosaveMode     = document.getElementById('settings-autosave-mode');
  const autosaveInterval = document.getElementById('settings-autosave-interval');
  const autosaveRow      = document.getElementById('autosave-interval-row');
  const autosaveStatus   = document.getElementById('autosave-status');
  let _autosaveTimer = null;

  function applyAutosave(mode, interval) {
    if (_autosaveTimer) { clearInterval(_autosaveTimer); _autosaveTimer = null; }
    if (mode === 'interval' || mode === 'both') {
      const ms = Math.max(1, parseInt(interval) || 5) * 60000;
      _autosaveTimer = setInterval(() => {
        if (typeof PersistenceManager !== 'undefined') PersistenceManager.save();
        if (autosaveStatus) autosaveStatus.textContent = '💾 Sauvegardé à ' + new Date().toLocaleTimeString();
      }, ms);
    }
    if (autosaveRow) autosaveRow.style.display = (mode === 'interval' || mode === 'both') ? 'flex' : 'none';
  }

  if (autosaveMode) {
    const savedMode = localStorage.getItem('teamai_autosave_mode') || 'exit';
    autosaveMode.value = savedMode;
    applyAutosave(savedMode, localStorage.getItem('teamai_autosave_interval') || '5');
    autosaveMode.addEventListener('change', () => {
      const m = autosaveMode.value;
      localStorage.setItem('teamai_autosave_mode', m);
      applyAutosave(m, autosaveInterval?.value || '5');
    });
  }
  if (autosaveInterval) {
    autosaveInterval.value = localStorage.getItem('teamai_autosave_interval') || '5';
    autosaveInterval.addEventListener('change', () => {
      localStorage.setItem('teamai_autosave_interval', autosaveInterval.value);
      applyAutosave(autosaveMode?.value || 'exit', autosaveInterval.value);
    });
  }

  window.addEventListener('beforeunload', () => {
    const m = localStorage.getItem('teamai_autosave_mode') || 'exit';
    if ((m === 'exit' || m === 'both') && typeof PersistenceManager !== 'undefined') PersistenceManager.save();
  });

  // ── Drive ───────────────────────────────────────────────────────────
  const driveStatus   = document.getElementById('drive-status-bar');
  const driveAuto     = document.getElementById('drive-auto-export');
  const driveTestBtn  = document.getElementById('btn-drive-test');

  async function checkDriveStatus() {
    if (!driveStatus) return;
    if (typeof teamai === 'undefined' || !teamai.getDriveStatus) {
      driveStatus.textContent = '🔌 Drive non disponible';
      return;
    }
    try {
      const s = await teamai.getDriveStatus();
      if (s && s.connected) {
        driveStatus.innerHTML = '🟢 <strong style="color:#4ADE80">Connecté</strong> — ' + (s.email || '');
        if (driveTestBtn) driveTestBtn.disabled = false;
      } else {
        driveStatus.textContent = '🔴 Non connecté';
        if (driveTestBtn) driveTestBtn.disabled = true;
      }
    } catch {
      driveStatus.textContent = '🔴 Erreur Drive';
    }
  }

  if (driveAuto) {
    driveAuto.checked = localStorage.getItem('teamai_drive_auto') === 'true';
    driveAuto.addEventListener('change', () => localStorage.setItem('teamai_drive_auto', driveAuto.checked));
  }
  if (driveTestBtn) {
    driveTestBtn.addEventListener('click', () => {
      if (typeof teamai === 'undefined' || !teamai.testDrive) return;
      driveTestBtn.textContent = '⏳ Test...';
      teamai.testDrive().then(ok => { driveTestBtn.textContent = ok ? '✅ OK' : '❌ Erreur'; });
    });
  }

  // ── Export / Import providers ────────────────────────────────────────
  document.getElementById('settings-export')?.addEventListener('click', () => {
    const providers = JSON.parse(localStorage.getItem('teamai_providers') || '[]');
    const blob = new Blob([JSON.stringify(providers, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'teamai-providers.json'; a.click();
  });
  document.getElementById('settings-import')?.addEventListener('click', () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          localStorage.setItem('teamai_providers', JSON.stringify(data));
          alert('✅ Providers importés — rechargement…');
          location.reload();
        } catch { alert('❌ Fichier JSON invalide'); }
      };
      reader.readAsText(f);
    };
    input.click();
  });

  // ── Clear sessions ───────────────────────────────────────────────────
  document.getElementById('settings-clear-sessions')?.addEventListener('click', () => {
    if (confirm('Effacer toutes les sessions sauvegardées ?')) {
      localStorage.removeItem('teamai_session');
      localStorage.removeItem('teamai_bookmarks');
      alert('Sessions effacées.');
    }
  });

  // ── GitHub ───────────────────────────────────────────────────────────
  document.getElementById('settings-open-github')?.addEventListener('click', () => {
    if (typeof teamai !== 'undefined' && teamai.openUrl) teamai.openUrl('https://github.com/AtmanTest/arcclone-macos');
  });
});
