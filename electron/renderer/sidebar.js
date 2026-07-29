/**
 * TeamAI v10 — Sidebar
 */
const Sidebar = {
  _providers: [],
  async init(providers) {
    this._providers = providers || [];
    this._renderProviders();
    this.renderAll();
    this._renderVersion();
    document.getElementById('btn-new-tab')?.addEventListener('click', () => {
      if (this._providers.length > 0) WinManager.addView(this._providers[0].id);
    });
    document.getElementById('btn-login-assistant')?.addEventListener('click', () => LoginAssistant.start());
    document.getElementById('btn-report')?.addEventListener('click', () => ReportManager.open());
    document.getElementById('btn-save-session')?.addEventListener('click', () => this._saveSession());
    document.getElementById('btn-export-providers')?.addEventListener('click', () => window._exportProviders?.());
    document.getElementById('btn-import-providers')?.addEventListener('click', () => window._importProviders?.());
  },

  renderAll() {
    const total = WinManager.count;
    document.getElementById('stats').textContent = `\ud83e\uddfb ${total} fen\u00eatres actives`;
    this._renderWindowList();
    this._updateProviderStatuses();
    Bookmarks.render();
  },

  _renderVersion() {
    teamai.getVersion().then(v => {
      const el = document.getElementById('version-badge');
      if (el && v) {
        el.textContent = `\u2736 v${v.version} \u2736`;
        el.title = `${v.version} \u2014 ${(v.commit||'').slice(0,7)}`;
        el.style.cssText = 'color:#4ADE80;font-weight:700;font-size:11px;letter-spacing:0.5px;cursor:pointer;display:block;text-align:center;margin-bottom:2px;';
        el.addEventListener('click', () => Changelog.open());
      }
    }).catch(() => {});

    // Badge Google sous la version
    this._renderGoogleBadge();
  },

  async _renderGoogleBadge() {
    let badge = document.getElementById('google-account-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'google-account-badge';
      badge.style.cssText = 'text-align:center;font-size:9px;color:#888;padding:2px 4px;cursor:pointer;';
      const versionBadge = document.getElementById('version-badge');
      if (versionBadge && versionBadge.parentNode) {
        versionBadge.parentNode.insertBefore(badge, versionBadge.nextSibling);
      }
      badge.addEventListener('click', () => Settings.open());
    }
    try {
      const status = await teamai.getGoogleStatus();
      if (status && status.connected && status.email) {
        badge.innerHTML = `<span style="color:#4ADE80;">\u2022</span> ${status.email}`;
        badge.title = 'Compte Google connect\u00e9 \u2014 Cliquer pour les r\u00e9glages';
      } else if (status && status.connected) {
        badge.innerHTML = `<span style="color:#4ADE80;">\u2022</span> Google connect\u00e9`;
      } else {
        badge.innerHTML = `<span style="color:#EF4444;">\u2022</span> Google non connect\u00e9`;
        badge.title = 'Cliquer pour se connecter';
      }
    } catch {
      badge.innerHTML = '';
    }
  },

  _renderWindowList() {
    const el = document.getElementById('window-list');
    if (!el) return;
    el.innerHTML = '';
    WinManager.frames.forEach((entry, id) => {
      const div = document.createElement('div'); div.className = 'win-item'; div.dataset.id = id;
      const combo = entry.combo;
      const lbl = combo?.options[combo.selectedIndex]?.text || 'IA';
      const idx = Array.from(WinManager.frames.keys()).indexOf(id) + 1;
      div.innerHTML = `<span class="num">${idx}</span><span class="label">${lbl}</span><span class="close-btn">\u2715</span>`;
      div.querySelector('.close-btn').addEventListener('click', (e) => { e.stopPropagation(); WinManager._remove(id); });
      div.addEventListener('click', () => entry.frame.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      el.appendChild(div);
    });
  },

  _renderProviders() {
    const el = document.getElementById('providers-list');
    if (!el) return;
    const providers = this._providers.length > 0 ? this._providers : (WinManager.providers || []);
    const connected = JSON.parse(localStorage.getItem('teamai_connected') || '{}');
    el.innerHTML = providers.map(p => `
      <div class="prov-card" data-id="${p.id}">
        <div class="icon">${p.icon || '\ud83c\udf10'}</div>
        <div class="name">${p.label || p.id}</div>
        <div class="prov-actions">
          <div class="status ${connected[p.id] ? 'connected' : ''}">${connected[p.id] ? '\u2713' : '\u00b7\u00b7\u00b7'}</div>
          <div class="prov-delete" data-id="${p.id}" title="Supprimer">\u2715</div>
        </div>
      </div>
    `).join('');
    el.querySelectorAll('.prov-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('prov-delete')) return;
        WinManager.addView(card.dataset.id);
      });
    });
    el.querySelectorAll('.prov-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.dataset.id;
        const prov = providers.find(p => p.id === pid);
        if (!prov) return;
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
        confirmModal.innerHTML = `
          <div style="background:#1a1a2e;border:1px solid #EF4444;border-radius:12px;padding:24px;width:320px;text-align:center;">
            <div style="font-size:28px;margin-bottom:10px;">\u26a0\ufe0f</div>
            <div style="color:#fff;font-size:13px;font-weight:700;margin-bottom:8px;">Supprimer ${prov.icon} ${prov.label} ?</div>
            <div style="color:#888;font-size:11px;margin-bottom:18px;">Cette IA sera retir\u00e9e de ta liste.</div>
            <div style="display:flex;gap:8px;">
              <button id="del-confirm" style="flex:1;background:#EF4444;color:#fff;border:none;border-radius:6px;padding:9px;font-weight:700;cursor:pointer;">Supprimer</button>
              <button id="del-cancel" style="flex:1;background:#222;color:#aaa;border:none;border-radius:6px;padding:9px;cursor:pointer;">Annuler</button>
            </div>
          </div>
        `;
        document.body.appendChild(confirmModal);
        confirmModal.querySelector('#del-cancel').addEventListener('click', () => confirmModal.remove());
        confirmModal.querySelector('#del-confirm').addEventListener('click', () => {
          const idx = WinManager.providers.findIndex(p => p.id === pid);
          if (idx !== -1) WinManager.providers.splice(idx, 1);
          this._providers = this._providers.filter(p => p.id !== pid);
          localStorage.setItem('teamai_custom_providers', JSON.stringify(WinManager.providers));
          confirmModal.remove();
          this._renderProviders();
        });
      });
    });
  },

  _updateProviderStatuses() {
    const connected = JSON.parse(localStorage.getItem('teamai_connected') || '{}');
    document.querySelectorAll('.prov-card').forEach(card => {
      const s = card.querySelector('.status');
      if (!s) return;
      s.textContent = connected[card.dataset.id] ? '\u2713' : '\u00b7\u00b7\u00b7';
      s.className = 'status' + (connected[card.dataset.id] ? ' connected' : '');
    });
  },

  updateWindowTitle(id, title) {
    const entry = WinManager.frames.get(id);
    if (entry) entry._lastTitle = title;
  },

  _saveSession() {
    const list = WinManager.list;
    localStorage.setItem('teamai_session', JSON.stringify({ views: list, saved: new Date().toISOString() }));
    const btn = document.getElementById('btn-save-session');
    if (btn) { const old = btn.textContent; btn.textContent = '\u2705 Sauvegard\u00e9'; setTimeout(() => btn.textContent = old, 1500); }
  },
};
