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
  },

  renderAll() {
    const total = WinManager.count;
    document.getElementById('stats').textContent = `🧫 ${total} fenêtres actives`;
    this._renderWindowList();
    this._updateProviderStatuses();
    Bookmarks.render();
  },

  _renderVersion() {
    teamai.getVersion().then(v => {
      const el = document.getElementById('version-badge');
      if (el && v) {
        el.textContent = `v${v.version}`;
        el.title = `v${v.version} — cliquer pour le changelog`;
        el.addEventListener('click', () => Changelog.open());
      }
    }).catch(() => {});
    this.refreshGoogleCard();
  },

  async refreshGoogleCard() {
    let card = document.getElementById('google-profile-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'google-profile-card';
      card.innerHTML = `
        <div class="g-avatar not-connected">G</div>
        <div class="g-info">
          <div class="g-name">Google</div>
          <div class="g-email">Non connecté</div>
        </div>
        <div class="g-status-dot offline"></div>
      `;
      card.addEventListener('click', () => Settings.open());
      const versionBadge = document.getElementById('version-badge');
      if (versionBadge && versionBadge.parentNode)
        versionBadge.parentNode.insertBefore(card, versionBadge.nextSibling);
    }
    try {
      const s = await teamai.getGoogleStatus();
      const avatar = card.querySelector('.g-avatar');
      const gName  = card.querySelector('.g-name');
      const gEmail = card.querySelector('.g-email');
      const dot    = card.querySelector('.g-status-dot');
      if (s && s.connected) {
        const email   = s.email || 'Compte Google';
        const initial = email.charAt(0).toUpperCase();
        const colors  = [
          ['#4285F4','#fff'],['#EA4335','#fff'],['#34A853','#fff'],
          ['#7C3AED','#fff'],['#06B6D4','#fff'],['#F59E0B','#000'],
          ['#EC4899','#fff'],['#10B981','#fff'],
        ];
        const [bg, fg] = colors[initial.charCodeAt(0) % colors.length];
        avatar.className = 'g-avatar';
        avatar.style.cssText = `background:${bg};color:${fg};`;
        avatar.textContent = initial;
        const namePart = email.includes('@') ? email.split('@')[0] : email;
        gName.textContent  = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        gEmail.textContent = email.includes('@') ? email : '';
        dot.className = 'g-status-dot online';
        card.title = `Connecté : ${email} — Cliquer pour les Réglages`;
      } else {
        avatar.className = 'g-avatar not-connected';
        avatar.style.cssText = '';
        avatar.textContent = 'G';
        gName.textContent  = 'Google';
        gEmail.textContent = 'Non connecté — cliquer';
        dot.className = 'g-status-dot offline';
        card.title = 'Se connecter à Google';
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
      div.innerHTML = `<span class="num">${idx}</span><span class="label">${lbl}</span><span class="close-btn">✕</span>`;
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
        <div class="icon">${p.icon || '🌐'}</div>
        <div class="name">${p.label || p.id}</div>
        <div class="prov-actions">
          <div class="status ${connected[p.id] ? 'connected' : ''}">${connected[p.id] ? '✓' : '···'}</div>
          <div class="prov-delete" data-id="${p.id}" title="Supprimer">✕</div>
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
            <div style="font-size:28px;margin-bottom:10px;">⚠️</div>
            <div style="color:#fff;font-size:13px;font-weight:700;margin-bottom:8px;">Supprimer ${prov.icon} ${prov.label} ?</div>
            <div style="color:#888;font-size:11px;margin-bottom:18px;">Cette IA sera retirée de ta liste.</div>
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
      s.textContent = connected[card.dataset.id] ? '✓' : '···';
      s.className = 'status' + (connected[card.dataset.id] ? ' connected' : '');
    });
  },

  _saveSession() {
    const list = WinManager.list;
    localStorage.setItem('teamai_session', JSON.stringify({ views: list, saved: new Date().toISOString() }));
    const btn = document.getElementById('btn-save-session');
    if (btn) { const old = btn.textContent; btn.textContent = '✅ Sauvegardé'; setTimeout(() => btn.textContent = old, 1500); }
  },
};
