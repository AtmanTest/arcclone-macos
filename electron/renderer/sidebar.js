/**
 * TeamAI v4 — Sidebar
 */
const Sidebar = {
  async init() {
    const providers = await teamai.getProviders() || [];
    this._renderProviders(providers);

    document.getElementById('btn-new-tab')?.addEventListener('click', () => {
      if (providers.length > 0) WinManager.addView(providers[0].id);
    });
    document.getElementById('btn-report')?.addEventListener('click', () => ReportManager.open());

    // Version
    try {
      const v = await teamai.getVersion();
      const el = document.getElementById('version-badge');
      if (el && v) {
        el.textContent = `v${v.version} — ${(v.commit || 'dev').slice(0,7)}`;
        el.addEventListener('click', () => {
          teamai.openUrl((v.url || 'https://github.com/AtmanTest/arcclone-macos') + '/commits/main');
        });
      }
    } catch {}
  },

  renderStats() {
    const total = WinManager.count;
    const stats = document.getElementById('stats');
    if (stats) stats.textContent = `Fenêtres: ${total} | IA: ${total}`;
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
      const combo = entry.combo;
      const lbl = combo?.options[combo.selectedIndex]?.text || 'IA';
      const idx = Array.from(WinManager.frames.keys()).indexOf(id) + 1;
      div.innerHTML = `
        <span class="num">${idx}</span>
        <span class="label">${lbl}</span>
        <span class="close-btn">✕</span>
      `;
      div.querySelector('.close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        WinManager._removeView(id);
      });
      div.addEventListener('click', () => {
        entry.frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  updateWindowTitle(id, title) {
    const item = document.querySelector(`.win-item[data-id="${id}"] .label`);
    if (item) item.textContent = title || 'IA';
  },
};
