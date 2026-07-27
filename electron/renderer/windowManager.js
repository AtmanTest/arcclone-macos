/**
 * TeamAI — Window Manager
 * Manages the list of open BrowserViews in the main process via IPC.
 * Renderer-side state mirror.
 */
const WindowManager = {
  views: new Map(), // viewId -> { providerId, label, icon, url, title }
  providers: [],

  async init() {
    this.providers = await teamai.getProviders() || [];
    const ids = await teamai.addDefaultViews();
    // Listen for updates
    teamai.onViewsUpdated((ids) => {
      this._sync(ids);
    });
    teamai.onViewTitleUpdated((id, title) => {
      if (this.views.has(id)) this.views.get(id).title = title;
      Sidebar.render();
    });
    teamai.onViewUrlChanged((id, url) => {
      if (this.views.has(id)) this.views.get(id).url = url;
    });
    await this._sync(ids);
    Sidebar.render();
  },

  async _sync(ids) {
    const current = new Set(this.views.keys());
    const incoming = new Set(ids);
    // Remove stale
    for (const id of current) {
      if (!incoming.has(id)) this.views.delete(id);
    }
    // Add new
    for (const id of ids) {
      if (!this.views.has(id)) {
        this.views.set(id, { id, providerId: 'unknown', label: 'Chargement...', icon: '🌐', url: '', title: '' });
      }
    }
    // Try to match providers by order
    const providerOrder = this.providers.map(p => p.id);
    ids.forEach((id, idx) => {
      const entry = this.views.get(id);
      if (idx < providerOrder.length) {
        const p = this.providers.find(pr => pr.id === providerOrder[idx]);
        if (p) { entry.providerId = p.id; entry.label = p.label; entry.icon = p.icon; }
      }
    });
    Sidebar.render();
  },

  async add(providerId) {
    const id = await teamai.addView(providerId);
    if (id) {
      const p = this.providers.find(pr => pr.id === providerId);
      this.views.set(id, { id, providerId, label: p ? p.label : providerId, icon: p ? p.icon : '🌐', url: '', title: '' });
      Sidebar.render();
    }
  },

  async remove(viewId) {
    await teamai.removeView(viewId);
    this.views.delete(viewId);
    Sidebar.render();
  },

  async clearAll() {
    await teamai.clearAllViews();
    this.views.clear();
    Sidebar.render();
  },

  async restoreDefault() {
    await teamai.addDefaultViews();
    const ids = await teamai.getViewIds();
    await this._sync(ids);
  },

  get count() { return this.views.size; },
  get list() { return Array.from(this.views.values()); },
};
