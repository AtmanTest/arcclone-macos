/**
 * TeamAI v3 — Window Manager (Renderer)
 * Crée les overlays toolbar + content area par BrowserView.
 * Gère scroll, zoom, version.
 */
const WinManager = {
  frames: new Map(),
  providers: [],
  _zoom: 0,

  async init() {
    this.providers = await teamai.getProviders() || [];
    this._zoom = await teamai.getZoom() || 0;

    teamai.onSyncBounds((bounds, zoom, total, totalH) => this._sync(bounds, zoom, total, totalH));
    teamai.onViewTitle((id, title) => this._setTitle(id, title));
    teamai.onViewUrl((id, url) => this._setUrl(id, url));

    // Zoom buttons
    document.getElementById('zoom-in')?.addEventListener('click', () => this._zoomChange(1));
    document.getElementById('zoom-out')?.addEventListener('click', () => this._zoomChange(-1));
    document.getElementById('zoom-reset')?.addEventListener('click', () => this._zoomChange(0, true));
  },

  async _zoomChange(delta, reset = false) {
    this._zoom = reset ? 0 : Math.max(-3, Math.min(5, this._zoom + delta));
    await teamai.setZoom(this._zoom);
    document.getElementById('zoom-level').textContent = `${100 + this._zoom * 15}%`;
  },

  _sync(boundsList, zoom, total, totalH) {
    const container = document.getElementById('overlay-container');
    if (!container) return;

    // Set container height for scroll
    container.style.height = Math.max(totalH, window.innerHeight) + 'px';

    const activeIds = new Set(boundsList.map(b => b.id));

    // Remove stale frames
    for (const [id] of this.frames) {
      if (!activeIds.has(id)) {
        this.frames.get(id).frame.remove();
        this.frames.delete(id);
      }
    }

    // Create/update frames
    for (const b of boundsList) {
      let entry = this.frames.get(b.id);
      if (!entry) {
        const prov = this.providers.find(p => p.id === b.providerId);
        const idx = boundsList.findIndex(bx => bx.id === b.id);
        const frame = this._createFrame(b.id, idx + 1, prov);
        container.appendChild(frame);
        entry = { frame, combo: frame.querySelector('.provider-combo'), urlBar: frame.querySelector('.url-bar') };
        this.frames.set(b.id, entry);
        this._bindEvents(b.id, entry);
      }

      const toolbarH = 36;
      entry.frame.style.left = b.x + 'px';
      entry.frame.style.top = (b.y - toolbarH) + 'px';
      entry.frame.style.width = b.width + 'px';
      entry.frame.style.height = (toolbarH + b.height) + 'px';

      // Update number badge
      const idx = boundsList.findIndex(bx => bx.id === b.id);
      const badge = entry.frame.querySelector('.num-badge');
      if (badge) badge.textContent = (idx >= 0 ? idx + 1 : '?');

      // Update URL bar
      if (b.url && entry.urlBar && b.url !== 'about:blank') entry.urlBar.value = b.url;
    }

    Sidebar.renderStats(total);
    this._updateZoomLabel();
  },

  _createFrame(id, idx, prov) {
    const frame = document.createElement('div');
    frame.className = 'window-frame';
    frame.dataset.id = id;

    const comboOps = this.providers.map(p =>
      `<option value="${p.id}" ${p.id === (prov && prov.id) ? 'selected' : ''}>${p.icon} ${p.label}</option>`
    ).join('');

    frame.innerHTML = `
      <div class="toolbar">
        <span class="num-badge">${idx}</span>
        <select class="provider-combo">${comboOps}</select>
        <button class="nav-btn" data-action="back">◀</button>
        <button class="nav-btn" data-action="forward">▶</button>
        <button class="nav-btn" data-action="reload">⟳</button>
        <input class="url-bar" placeholder="URL..." spellcheck="false" value="">
        <button class="close-btn">✕</button>
      </div>
      <div class="content-area"></div>
    `;
    return frame;
  },

  _bindEvents(id, entry) {
    const { frame, combo, urlBar } = entry;

    combo.addEventListener('change', () => {
      const prov = this.providers.find(p => p.id === combo.value);
      if (prov) teamai.navigateView(id, prov.url);
    });

    frame.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => teamai.viewAction(id, btn.dataset.action));
    });

    urlBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let url = urlBar.value.trim();
        if (!url) return;
        if (url.includes('.') && !url.startsWith('http')) url = 'https://' + url;
        else if (!url.includes('.')) url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
        teamai.navigateView(id, url);
      }
    });

    frame.querySelector('.close-btn').addEventListener('click', () => {
      teamai.removeView(id);
      this.frames.delete(id);
      frame.remove();
    });
  },

  _setTitle(id, title) {
    const item = document.querySelector(`.win-item[data-id="${id}"] .label`);
    if (item) item.textContent = title;
  },

  _setUrl(id, url) {
    const entry = this.frames.get(id);
    if (entry && entry.urlBar && url && url !== 'about:blank') entry.urlBar.value = url;
  },

  _updateZoomLabel() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = `${100 + this._zoom * 15}%`;
  },

  async addView(pid) { return teamai.addView(pid); },
  async removeView(id) {
    await teamai.removeView(id);
    const entry = this.frames.get(id);
    if (entry) { entry.frame.remove(); this.frames.delete(id); }
  },
};
