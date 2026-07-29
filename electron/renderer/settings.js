/**
 * Settings v2 — ajout toggle barre de dispatch
 */
document.addEventListener('DOMContentLoaded', () => {

  // ── Ouvrir / fermer le modal ──────────────────────────────────────────
  const modal  = document.getElementById('settings-modal');
  const btnOpen  = document.getElementById('btn-settings');
  const btnClose = document.getElementById('settings-close');
  if (btnOpen)  btnOpen.addEventListener('click',  () => { modal.style.display = 'flex'; loadSettings(); });
  if (btnClose) btnClose.addEventListener('click', () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  // ── Google Profile ──────────────────────────────────────────────────
  function loadSettings() {
    const container = document.getElementById('settings-google-profile');
    if (!container) return;
    if (typeof teamai === 'undefined' || !teamai.getGoogleProfile) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#555;font-size:10px;">🔌 Google non connecté</div>';
      return;
    }
    teamai.getGoogleProfile().then(p => {
      if (!p || !p.email) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#555;font-size:10px;">Non connecté</div>';
        return;
      }
      container.innerHTML = `
        <div style="border-radius:10px;overflow:hidden;border:1px solid #1e1e2e;">
          <div class="sg-banner"></div>
          <div style="position:relative;">
            <div class="sg-avatar-wrap">
              ${p.photo
                ? `<img src="${p.photo}" style="width:34px;height:34px;border-radius:50%;" onerror="this.outerHTML='<svg viewBox=\'0 0 24 24\' width=\'34\' height=\'34\' fill=\'none\'><circle cx=\'12\' cy=\'8\' r=\'4\' fill=\'#4285F4\'/><path d=\'M4 20c0-4 3.6-7 8-7s8 3 8 7\' fill=\'#4285F4\'/></svg>'"`
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
        </div>`;
    }).catch(() => {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#555;font-size:10px;">Erreur profil</div>';
    });
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
      // Si on désactive, ferme la barre si elle est ouverte
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

  // Sauvegarder à la fermeture si mode 'exit' ou 'both'
  window.addEventListener('beforeunload', () => {
    const m = localStorage.getItem('teamai_autosave_mode') || 'exit';
    if ((m === 'exit' || m === 'both') && typeof PersistenceManager !== 'undefined') PersistenceManager.save();
  });

  // ── Drive ───────────────────────────────────────────────────────────
  const driveStatus   = document.getElementById('drive-status-bar');
  const driveAuto     = document.getElementById('drive-auto-export');
  const driveTestBtn  = document.getElementById('btn-drive-test');

  function checkDriveStatus() {
    if (!driveStatus) return;
    if (typeof teamai === 'undefined' || !teamai.getDriveStatus) {
      driveStatus.textContent = '🔌 Drive non disponible';
      return;
    }
    teamai.getDriveStatus().then(s => {
      if (s.connected) {
        driveStatus.innerHTML = '🟢 <strong style="color:#4ADE80">Connecté</strong> — ' + (s.email || '');
        if (driveTestBtn) driveTestBtn.disabled = false;
      } else {
        driveStatus.textContent = '🔴 Non connecté';
        if (driveTestBtn) driveTestBtn.disabled = true;
      }
    });
  }
  checkDriveStatus();

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
    if (typeof teamai !== 'undefined' && teamai.openExternal) teamai.openExternal('https://github.com/AtmanTest/arcclone-macos');
  });
});
