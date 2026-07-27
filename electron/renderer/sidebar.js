/**
 * TeamAI v3 — Sidebar
 * Stats, window list, providers, version badge → GitHub.
 */
const Sidebar = {
  _versionData: null,

  async init() {
    const providers = await teamai.getProviders() || [];
    this._renderProviders(providers);
    this._renderVersion();

    document.getElementById('btn-new-tab')?.addEventListener('click', () => {
      if (providers.length > 0) WinManager.addView(providers[0].id);
    });
    document.getElementById('btn-report')?.addEventListener('click', () => ReportManager.open());
  },

  renderStats(total) {
    const stats = document.getElementById('stats');
    if (!stats) return;
    stats.textContent = `Fenêtres: ${total} | IA: ${total}`;
    this._renderWindowList();
  },

  _renderWindowList() {
    const el = document.getElementById('window-list');
    if (!el) return;
    el.innerHTML = '';
    WinManager.frames.forEach((entry, id) => {
      const div = document.createElement('div');
      div.className = 'win-item';
      div.dataset.id = id;
      const idx = Array.from(WinManager.frames.keys()).indexOf(id) + 1;
      const combo = entry.frame?.querySelector('.provider-combo');
      const lbl = combo?.options[combo.selectedIndex]?.text || 'IA';
      div.innerHTML = `
        <span class="num">${idx}</span>
        <span class="label">${lbl}</span>
        <span class="close-btn">✕</span>
      `;
      div.querySelector('.close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        WinManager.removeView(id);
      });
      div.addEventListener('click', () => {
        const frame = entry.frame;
        if (frame) {
          const viewport = document.getElementById('viewport');
          const frameTop = parseInt(frame.style.top) || 0;
          if (viewport) viewport.scrollTo({ top: Math.max(0, frameTop), behavior: 'smooth' });
        }
      });
      el.appendChild(div);
    });
  },

  _renderProviders(providers) {
    const el = document.getElementById('providers-list');
    if (!el) return;
    el.innerHTML = providers.map(p =>
      `<button class="prov-btn" data-id="${p.id}">${p.icon} ${p.label}</button>`
    ).join('');
    el.querySelectorAll('.prov-btn').forEach(btn => {
      btn.addEventListener('click', () => WinManager.addView(btn.dataset.id));
    });
  },

  async _renderVersion() {
    const el = document.getElementById('version-badge');
    if (!el) return;
    try {
      this._versionData = await teamai.getVersion();
      if (this._versionData) {
        el.textContent = `v${this._versionData.version} — ${(this._versionData.commit || 'dev').slice(0,7)}`;
        el.title = `Cliquer pour voir les commits → ${this._versionData.url || 'GitHub'}`;
        el.addEventListener('click', () => {
          const baseUrl = this._versionData.url || 'https://github.com/AtmanTest/arcclone-macos';
          teamai.openUrl(baseUrl + '/commits/main');
        });
      }
    } catch {
      el.textContent = 'v0.3.0-dev';
    }
  },

  updateWindowTitle(id, title) {
    const item = document.querySelector(`.win-item[data-id="${id}"] .label`);
    if (item) item.textContent = title || 'IA';
  },
};
