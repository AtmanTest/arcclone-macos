const GOOGLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22" height="22">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  <path fill="none" d="M0 0h48v48H0z"/>
</svg>`;

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
    document.getElementById('btn-report')?.addEventListener('click', () => {
      const modal = document.getElementById('report-modal');
      if (modal) {
        modal.classList.add('open');
        modal.style.display = 'flex';
      }
      ReportManager.open();
    });
    document.getElementById('btn-save-session')?.addEventListener('click', () => this._saveSession());

    // Bug 2 fix — Zoom listeners
    const zoomOut   = document.getElementById('zoom-out');
    const zoomIn    = document.getElementById('zoom-in');
    const zoomReset = document.getElementById('zoom-reset');
    const zoomResetLayout = document.getElementById('btn-reset-layout');
    const zoomLabel = document.getElementById('zoom-level');
    function _applyZoom(level) {
      const pct = 100 + level * 10;
      if (zoomLabel) zoomLabel.textContent = pct + '%';
      document.querySelectorAll('webview').forEach(wv => { try { wv.setZoomLevel(level); } catch(e){} });
      teamai.send && teamai.send('set-zoom', level);
    }
    let _zoomLevel = 0;
    zoomOut   && zoomOut.addEventListener('click',   () => { _zoomLevel = Math.max(-3, _zoomLevel - 1); _applyZoom(_zoomLevel); });
    zoomIn    && zoomIn.addEventListener('click',    () => { _zoomLevel = Math.min(5,  _zoomLevel + 1); _applyZoom(_zoomLevel); });
    zoomReset && zoomReset.addEventListener('click', () => { _zoomLevel = 0; _applyZoom(0); });
    zoomResetLayout && zoomResetLayout.addEventListener('click', () => WinManager._resetLayout && WinManager._resetLayout());
    teamai.onGoogleStatusChanged(() => this.refreshGoogleCard());
  },

  renderAll() {
    const total = WinManager.count;
    document.getElementById('stats').textContent = `\uD83E\uDDEB ${total} fen\u00eatres actives`;
    this._renderWindowList();
    this._updateProviderStatuses();
    Bookmarks.render();
  },

  _renderVersion() {
    teamai.getVersion().then(v => {
      // #version-number — version en vert gras centré
      const vEl = document.getElementById('version-number');
      if (vEl && v) {
        vEl.textContent = `v${v.version}`;
        vEl.title = `v${v.version} \u2014 cliquer pour le changelog`;
        vEl.addEventListener('click', () => Changelog.open());
      }
      // Rétrocompat: ancien id #version-badge si présent
      const legacyEl = document.getElementById('version-badge');
      if (legacyEl && v) legacyEl.textContent = `v${v.version}`;

      // #branch-link — nom de branche dynamique avec href compare
      const bEl = document.getElementById('branch-link');
      if (bEl && v && v.branch) {
        bEl.textContent = v.branch;
        const escaped = encodeURIComponent(v.branch);
        bEl.href = `https://github.com/AtmanTest/arcclone-macos/compare/main...${escaped}`;
        bEl.title = `Voir les commits de ${v.branch}`;
      }
    }).catch(() => {});
    this.refreshGoogleCard();
  },

  async refreshGoogleCard() {
    let card = document.getElementById('google-profile-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'google-profile-card';
      card.addEventListener('click', () => Settings.open());
      const versionBadge = document.getElementById('version-number') || document.getElementById('version-badge');
      if (versionBadge && versionBadge.parentNode)
        versionBadge.parentNode.insertBefore(card, versionBadge.nextSibling);
    }

    try {
      const s = await teamai.getGoogleStatus();
      if (s && s.connected && s.email && s.email.includes('@')) {
        card.innerHTML = `
          <div class="g-avatar g-logo">${GOOGLE_SVG}</div>
          <div class="g-info">
            <div class="g-email" style="font-weight:600;color:#ddd;">${s.email}</div>
          </div>
          <div class="g-status-dot online"></div>
        `;
        card.title = `${s.email} \u2014 R\u00e9glages`;
      } else if (s && s.connected) {
        card.innerHTML = `
          <div class="g-avatar g-logo">${GOOGLE_SVG}</div>
          <div class="g-info">
            <div class="g-email" style="color:#aaa;">Connect\u00e9</div>
          </div>
          <div class="g-status-dot online"></div>
        `;
        card.title = 'Compte Google connect\u00e9 \u2014 R\u00e9glages';
      } else {
        card.innerHTML = `
          <div class="g-avatar g-logo g-logo-dim">${GOOGLE_SVG}</div>
          <div class="g-info">
            <div class="g-email" style="color:#666;">Non connect\u00e9 \u2014 cliquer</div>
          </div>
          <div class="g-status-dot offline"></div>
        `;
        card.title = 'Se connecter \u00e0 Google';
      }
    } catch {}
  },

  _renderWindowList() {
    const el = document.getElementById('window-list');
    if (!el) return;
    el.innerHTML = '';
    WinManager.frames.forEach((entry, id) => {
      const div = document.createElement('div');
      div.className = 'win-item';
      div.dataset.id = id;
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
        <div class="icon">${(()=>{
          const logos={
            'chatgpt':'https://cdn.simpleicons.org/openai/ffffff',
            'openai':'https://cdn.simpleicons.org/openai/ffffff',
            'gemini':'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',
            'claude':'https://cdn.simpleicons.org/anthropic/d97706',
            'anthropic':'https://cdn.simpleicons.org/anthropic/d97706',
            'grok':'https://cdn.simpleicons.org/x/ffffff',
            'kimi':'https://cdn.simpleicons.org/moonrepo/6366f1',
            'glm':'https://cdn.simpleicons.org/zhihu/1772f6',
            'mistral':'https://cdn.simpleicons.org/mistral/ff7000',
            'perplexity':'https://cdn.simpleicons.org/perplexity/20b2aa',
            'deepseek':'https://cdn.simpleicons.org/deepseek/4d6bfe',
            'copilot':'https://cdn.simpleicons.org/microsoftcopilot/0078d4',
            'meta':'https://cdn.simpleicons.org/meta/0082fb',
            'llama':'https://cdn.simpleicons.org/meta/0082fb',
          };
          const id=(p.id||'').toLowerCase();
          const key=Object.keys(logos).find(k=>id.includes(k));
          if(key) return '<img src="'+logos[key]+'" alt="'+p.label+'" onerror="this.style.display=\'none\';this.parentNode.innerHTML=\''+encodeURIComponent(p.icon||'🌐')+'\'">';
          return p.icon||'🌐';
        })()}</div>
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
        const cm = document.createElement('div');
        cm.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
        cm.innerHTML = `
          <div style="background:#1a1a2e;border:1px solid #EF4444;border-radius:12px;padding:24px;width:320px;text-align:center;">
            <div style="font-size:28px;margin-bottom:10px;">\u26a0\ufe0f</div>
            <div style="color:#fff;font-size:13px;font-weight:700;margin-bottom:8px;">Supprimer ${prov.icon} ${prov.label} ?</div>
            <div style="color:#888;font-size:11px;margin-bottom:18px;">Cette IA sera retir\u00e9e de ta liste.</div>
            <div style="display:flex;gap:8px;">
              <button id="del-confirm" style="flex:1;background:#EF4444;color:#fff;border:none;border-radius:6px;padding:9px;font-weight:700;cursor:pointer;">Supprimer</button>
              <button id="del-cancel" style="flex:1;background:#222;color:#aaa;border:none;border-radius:6px;padding:9px;cursor:pointer;">Annuler</button>
            </div>
          </div>`;
        document.body.appendChild(cm);
        cm.querySelector('#del-cancel').addEventListener('click', () => cm.remove());
        cm.querySelector('#del-confirm').addEventListener('click', () => {
          const idx = WinManager.providers.findIndex(p => p.id === pid);
          if (idx !== -1) WinManager.providers.splice(idx, 1);
          this._providers = this._providers.filter(p => p.id !== pid);
          localStorage.setItem('teamai_custom_providers', JSON.stringify(WinManager.providers));
          cm.remove();
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

  _saveSession() {
    const list = WinManager.list;
    localStorage.setItem('teamai_session', JSON.stringify({ views: list, saved: new Date().toISOString() }));
    const btn = document.getElementById('btn-save-session');
    if (btn) { const old = btn.textContent; btn.textContent = '\u2705 Sauvegard\u00e9'; setTimeout(() => btn.textContent = old, 1500); }
  },
};
