const ErrorBar = {
  _timeout: null,
  show(msg) {
    const bar = document.getElementById('error-bar');
    if (!bar) return;
    bar.textContent = '\u26a0 ' + msg;
    bar.classList.add('show');
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => bar.classList.remove('show'), 8000);
  },
  clear() {
    const bar = document.getElementById('error-bar');
    if (bar) bar.classList.remove('show');
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const providers = await teamai.loadProviders();
    if (!providers || providers.length === 0) throw new Error('Aucun provider charg\u00e9');
    PromptDispatcher.init();
    await WinManager.init(providers);
    await Sidebar.init(providers);

    const viewport = document.getElementById('viewport');
    if (viewport) {
      let t;
      const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => WinManager._layout(), 100); });
      ro.observe(viewport);
    }

    // File attachment
    document.getElementById('btn-attach')?.addEventListener('click', async () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file'; fileInput.multiple = false;
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const input = document.getElementById('prompt-input');
        if (!input) return;
        const isText = file.type.startsWith('text/') || ['.txt','.md','.js','.py','.json','.csv','.html','.css','.xml','.yaml','.yml','.log','.sh'].some(e => file.name.endsWith(e));
        const isImage = file.type.startsWith('image/');
        if (isText) {
          const text = await file.text();
          input.value += `\n\n[Fichier: ${file.name}]\n${text.substring(0, 10000)}`;
        } else if (isImage) {
          input.value += `\n\n\ud83d\udcf7 [Image: ${file.name}]`;
        } else {
          input.value += `\n\n\ud83d\udcce [Fichier: ${file.name} (${(file.size/1024).toFixed(1)} KB)]`;
        }
      });
      fileInput.click();
    });

    // ── Update button ──
    const updateBtn = document.getElementById('btn-update');
    async function checkUpdate() {
      if (!updateBtn) return;
      try {
        const info = await teamai.checkUpdate();
        if (info && info.hasUpdate) {
          updateBtn.textContent = `\ud83d\udd04 Mise \u00e0 jour (${info.behind} commits)`;
          updateBtn.style.color = '#EF4444';
          updateBtn.style.fontWeight = '700';
          updateBtn.disabled = false;
          updateBtn._updateInfo = info;
        } else {
          updateBtn.textContent = '\u2713 \u00c0 jour';
          updateBtn.style.color = '#555';
          updateBtn.style.fontWeight = '400';
          updateBtn.disabled = true;
          updateBtn._updateInfo = null;
        }
      } catch {
        updateBtn.textContent = '\ud83d\udd04 Mettre \u00e0 jour';
        updateBtn.style.color = '#666';
        updateBtn.disabled = false;
      }
    }
    checkUpdate();
    document.getElementById('btn-check-update')?.addEventListener('click', checkUpdate);
    setInterval(checkUpdate, 300000);

    updateBtn?.addEventListener('click', async () => {
      // Re-fetch info fraiche
      let info = updateBtn._updateInfo;
      if (!info || !info.hasUpdate) {
        try { info = await teamai.checkUpdate(); } catch { info = null; }
      }
      if (!info || !info.hasUpdate) return;

      const sha   = (info.lastCommit  || '').slice(0, 7) || 'inconnu';
      const fullSha = info.lastCommit || '';
      const author  = info.lastAuthor  || 'inconnu';
      const msg     = info.lastMessage || '(pas de message)';
      const ghBase  = 'https://github.com/AtmanTest/arcclone-macos/commit/';

      UpdatePopup.show({
        sha, fullSha, author, msg, behind: info.behind || 0, ghBase,
        onConfirm: async () => {
          updateBtn.textContent = '\u23f3 Mise \u00e0 jour...'; updateBtn.disabled = true;
          try { await teamai.updateApp(); }
          catch (e) { alert('\u274c ' + e.message); checkUpdate(); }
        },
      });
    });

    // ── Ajouter IA ──
    document.getElementById('btn-add-ia')?.addEventListener('click', () => _openAddIAModal());

    function _openAddIAModal() {
      let modal = document.getElementById('add-ia-modal');
      if (modal) { modal.querySelector('#add-ia-name').value = ''; modal.querySelector('#add-ia-url').value = ''; document.body.appendChild(modal); return; }
      modal = document.createElement('div');
      modal.id = 'add-ia-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
      modal.innerHTML = `
        <div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:24px;width:380px;">
          <h3 style="color:#fff;margin:0 0 16px;font-size:14px;">\u2795 Ajouter une IA</h3>
          <div style="margin-bottom:10px;"><label style="color:#aaa;font-size:11px;">Nom</label><input id="add-ia-name" placeholder="ex: Mistral" style="width:100%;box-sizing:border-box;background:#111;border:1px solid #333;border-radius:6px;color:#fff;padding:7px 10px;font-size:12px;margin-top:4px;"></div>
          <div style="margin-bottom:10px;"><label style="color:#aaa;font-size:11px;">URL</label><input id="add-ia-url" placeholder="https://..." style="width:100%;box-sizing:border-box;background:#111;border:1px solid #333;border-radius:6px;color:#fff;padding:7px 10px;font-size:12px;margin-top:4px;"></div>
          <div style="margin-bottom:16px;"><label style="color:#aaa;font-size:11px;">Ic\u00f4ne (emoji)</label><input id="add-ia-icon" placeholder="\ud83e\udd16" value="\ud83e\udd16" style="width:100%;box-sizing:border-box;background:#111;border:1px solid #333;border-radius:6px;color:#fff;padding:7px 10px;font-size:12px;margin-top:4px;"></div>
          <p style="color:#888;font-size:10px;margin:0 0 14px;">Apr\u00e8s ajout, l'assistant de connexion s'ouvrira.</p>
          <div style="display:flex;gap:8px;">
            <button id="add-ia-confirm" style="flex:1;background:#7C3AED;color:#fff;border:none;border-radius:6px;padding:9px;font-weight:700;cursor:pointer;font-size:12px;">Ajouter \u2192 Se connecter</button>
            <button id="add-ia-cancel" style="flex:1;background:#222;color:#aaa;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:12px;">Annuler</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#add-ia-cancel').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      modal.querySelector('#add-ia-confirm').addEventListener('click', () => {
        const name = modal.querySelector('#add-ia-name').value.trim();
        const url  = modal.querySelector('#add-ia-url').value.trim();
        const icon = modal.querySelector('#add-ia-icon').value.trim() || '\ud83e\udd16';
        if (!name || !url) { alert('Nom et URL requis'); return; }
        const id = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const newProv = { id, label: name, url, icon };
        WinManager.providers.push(newProv);
        WinManager.addView(id);
        const custom = JSON.parse(localStorage.getItem('teamai_custom_providers') || '[]');
        custom.push(newProv);
        localStorage.setItem('teamai_custom_providers', JSON.stringify(custom));
        modal.remove();
        setTimeout(() => LoginAssistant.startSingle(newProv), 300);
      });
    }

    // Export / Import
    window._exportProviders = function() {
      const blob = new Blob([JSON.stringify(WinManager.providers, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'teamai_providers.json'; a.click();
    };
    window._importProviders = function() {
      const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.json';
      fi.addEventListener('change', async () => {
        const file = fi.files?.[0]; if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          if (!Array.isArray(data)) throw new Error('Format invalide');
          const existing = new Set(WinManager.providers.map(p => p.id));
          let added = 0;
          for (const p of data) { if (!existing.has(p.id) && p.id && p.url) { WinManager.providers.push(p); added++; } }
          localStorage.setItem('teamai_custom_providers', JSON.stringify(WinManager.providers));
          alert(`\u2705 ${added} provider(s) import\u00e9(s). Rechargement...`);
          location.reload();
        } catch(e) { alert('\u274c ' + e.message); }
      });
      fi.click();
    };

    window.addEventListener('beforeunload', () => {
      if (WinManager.count > 0) localStorage.setItem('teamai_session', JSON.stringify({ views: WinManager.list }));
    });

  } catch (e) {
    console.error('FATAL:', e);
    document.getElementById('app').innerHTML = `<div style="color:red;padding:40px;font-size:18px">\u274c ${e.message}<br><small>${e.stack||''}</small></div>`;
  }
});
