/**
 * TeamAI v5 — Sidebar
 * Provider cards, stats, new tab button at top.
 */
const Sidebar = {
  async init() {
    this._renderProviders();
    this.renderAll();

    document.getElementById('btn-new-tab')?.addEventListener('click', () => {
      const p = WinManager.providersList;
      if (p.length > 0) WinManager.addView(p[0].id);
    });
    document.getElementById('btn-login-assistant')?.addEventListener('click', () => LoginAssistant.start());
    document.getElementById('btn-report')?.addEventListener('click', () => ReportManager.open());
    document.getElementById('btn-save-session')?.addEventListener('click', () => this._saveSession());

    // Version
    try {
      const v = await teamai.getVersion();
      const el = document.getElementById('version-badge');
      if (el && v) {
        el.textContent = `v${v.version} — ${(v.commit || 'dev').slice(0,7)}`;
        el.addEventListener('click', () => teamai.openUrl((v.url || '') + '/commits/main'));
      }
    } catch {}
  },

  renderAll() {
    const total = WinManager.count;
    document.getElementById('stats').textContent = `🪟 ${total} fenêtres actives`;
    this._renderWindowList();
    this._updateProviderStatuses();
  },

  _renderWindowList() {
    const el = document.getElementById('window-list');
    if (!el) return;
    el.innerHTML = '';
    WinManager.frames.forEach((entry, id) => {
      const div = document.createElement('div'); div.className = 'win-item'; div.dataset.id = id;
      const combo = entry.combo; const lbl = combo?.options[combo.selectedIndex]?.text || 'IA';
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
    const providers = WinManager.providersList;
    // Check stored connection statuses
    const connected = JSON.parse(localStorage.getItem('teamai_connected') || '{}');
    el.innerHTML = providers.map(p => `
      <div class="prov-card" data-id="${p.id}">
        <div class="icon">${p.icon}</div>
        <div class="name">${p.label}</div>
        <div class="status ${connected[p.id] ? 'connected' : ''}">${connected[p.id] ? '✅ Connecté' : '🔓 Non connecté'}</div>
      </div>
    `).join('');
    el.querySelectorAll('.prov-card').forEach(card => {
      card.addEventListener('click', () => WinManager.addView(card.dataset.id));
    });
  },

  _updateProviderStatuses() {
    const connected = JSON.parse(localStorage.getItem('teamai_connected') || '{}');
    document.querySelectorAll('.prov-card').forEach(card => {
      const id = card.dataset.id;
      const status = card.querySelector('.status');
      if (status) {
        if (connected[id]) { status.textContent = '✅ Connecté'; status.className = 'status connected'; }
        else { status.textContent = '🔓 Non connecté'; status.className = 'status'; }
      }
    });
  },

  updateWindowTitle(id, title) {
    const item = document.querySelector(`.win-item[data-id="${id}"] .label`);
    if (item) item.textContent = title || 'IA';
  },

  _saveSession() {
    if (WinManager.count > 0) {
      const views = WinManager.list;
      localStorage.setItem('teamai_session', JSON.stringify({ views }));
      alert('✅ Session sauvegardée — ' + views.length + ' fenêtres');
    }
  },
};
