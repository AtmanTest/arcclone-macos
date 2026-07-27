/**
 * TeamAI — Window Manager (Renderer)
 * Creates HTML toolbar overlays per BrowserView.
 * Syncs positions from main process via IPC.
 */
const WinManager = {
  frames: new Map(), // viewId -> { frame, toolbar, content, combo, entries[] }
  providers: [],
  _scrollTop: 0,

  async init() {
    this.providers = await teamai.getProviders() || [];
    teamai.onSyncBounds((bounds, zoom, total) => this._syncFrames(bounds, zoom, total));
    teamai.onViewTitle((id, title) => this._setTitle(id, title));
    teamai.onViewUrl((id, url) => this._setUrl(id, url));
  },

  _makeFrameHTML(id, idx, prov) {
    const comboOps = this.providers.map((p, i) =>
      `<option value="${p.id}" ${p.id === (prov && prov.id) ? 'selected' : ''}>${p.icon} ${p.label}</option>`
    ).join('');
    const icon = prov ? prov.icon : '🌐';
    const label = prov ? prov.label : 'IA';
    return `
      <div class="window-frame" data-id="${id}" style="position:absolute;">
        <div class="toolbar">
          <span class="num-badge">${idx + 1}</span>
          <select class="provider-combo">${comboOps}</select>
          <button class="nav-btn" data-action="back">◀</button>
          <button class="nav-btn" data-action="forward">▶</button>
          <button class="nav-btn" data-action="reload">⟳</button>
          <input class="url-bar" value="" placeholder="URL..." spellcheck="false">
          <button class="close-btn">✕</button>
        </div>
        <div class="content-area"></div>
      </div>
    `;
  },

  _syncFrames(boundsList, zoom, total) {
    const container = document.getElementById('overlay-container');
    if (!container) return;

    const currentIds = new Set(this.frames.keys());

    // Create new frames
    for (const b of boundsList) {
      if (this.frames.has(b.id)) continue;

      const prov = this.providers.find(p => p.id === b.providerId);
      const temp = document.createElement('template');
      temp.innerHTML = this._makeFrameHTML(b.id, parseInt(b.id.split('_')[1]) || 0, prov).trim();
      const frame = temp.content.firstChild;
      container.appendChild(frame);

      const toolbar = frame.querySelector('.toolbar');
      const combo = frame.querySelector('.provider-combo');
      const urlBar = frame.querySelector('.url-bar');
      const contentArea = frame.querySelector('.content-area');

      const entry = { frame, toolbar, contentArea, combo, urlBar };
      this.frames.set(b.id, entry);
      this._bindEvents(b.id, entry);
    }

    // Remove stale frames
    const activeIds = new Set(boundsList.map(b => b.id));
    for (const [id] of this.frames) {
      if (!activeIds.has(id)) {
        const entry = this.frames.get(id);
        entry.frame.remove();
        this.frames.delete(id);
      }
    }

    // Position all frames
    for (const b of boundsList) {
      const entry = this.frames.get(b.id);
      if (!entry) continue;
      const frame = entry.frame;
      // Toolbar height offset: BrowserView starts below toolbar
      const toolbarH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--toolbar-h')) || 36;
      const sv = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) || 240;

      // Frame = toolbar + content area = at the BrowserView's x,y minus toolbar height
      // But BrowserView.y already includes scroll offset. Frame.y = BrowserView.y - toolbarH
      // Actually: BrowserView is positioned at (x, y). We want the frame toolbar AT (x, y-toolbarH)
      // and the content area AT (x, y) with height = browserView height
      frame.style.left = b.x + 'px';
      frame.style.top = (b.y - toolbarH) + 'px';
      frame.style.width = b.width + 'px';
      // Frame height = toolbar + browserView height
      frame.style.height = (toolbarH + b.height) + 'px';

      // Update label if available
      const numBadge = frame.querySelector('.num-badge');
      if (numBadge) {
        const idx = boundsList.findIndex(bx => bx.id === b.id);
        numBadge.textContent = (idx >= 0 ? idx + 1 : '?');
      }

      // Update URL bar
      if (b.url && entry.urlBar) entry.urlBar.value = b.url;
    }

    // Update sidebar stats
    Sidebar.renderStats(total);
  },

  _bindEvents(id, entry) {
    const { frame, combo, urlBar } = entry;

    // Provider combo change
    combo.addEventListener('change', async () => {
      const pid = combo.value;
      // Navigate this view to the new provider URL
      const prov = this.providers.find(p => p.id === pid);
      if (prov) {
        await teamai.navigateView(id, prov.url);
      }
    });

    // Navigation buttons
    frame.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        teamai.viewAction(id, btn.dataset.action);
      });
    });

    // URL bar Enter
    urlBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let url = urlBar.value.trim();
        if (!url) return;
        if (url.includes('.') && !url.startsWith('http')) url = 'https://' + url;
        else if (!url.includes('.')) url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
        teamai.navigateView(id, url);
      }
    });

    // Close button
    frame.querySelector('.close-btn').addEventListener('click', () => {
      teamai.removeView(id);
      this.frames.delete(id);
      frame.remove();
    });
  },

  _setTitle(id, title) {
    // Update sidebar window list
    Sidebar.updateWindowTitle(id, title);
  },

  _setUrl(id, url) {
    const entry = this.frames.get(id);
    if (entry && entry.urlBar && url && url !== 'about:blank') {
      entry.urlBar.value = url;
    }
  },

  async addView(pid) {
    await teamai.addView(pid);
  },

  async removeView(id) {
    await teamai.removeView(id);
    const entry = this.frames.get(id);
    if (entry) { entry.frame.remove(); this.frames.delete(id); }
  },
};
