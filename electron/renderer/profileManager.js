/**
 * TeamAI — ProfileManager
 * Profils indépendants avec providers + layouts parallélisables
 */
const ProfileManager = {
  STORAGE_KEY: 'teamai_profiles',
  ACTIVE_KEY:  'teamai_active_profile',

  _profiles: [],
  _activeId: null,

  // ── Init ──
  init() {
    this._load();
    if (this._profiles.length === 0) {
      // Default profile = all providers from WinManager
      const allIds = (WinManager.providers || []).map(p => p.id);
      this._profiles.push({ id: this._genId(), name: 'Profil 1', providers: allIds });
    }
    if (!this._activeId || !this._profiles.find(p => p.id === this._activeId))
      this._activeId = this._profiles[0].id;
    this._save();
    return this.active;
  },

  get active() { return this._profiles.find(p => p.id === this._activeId) || this._profiles[0]; },
  get all()    { return this._profiles; },

  // ── CRUD ──
  create(name) {
    const src = this.active;
    const p = { id: this._genId(), name: name || `Profil ${this._profiles.length + 1}`, providers: src ? [...src.providers] : [] };
    this._profiles.push(p);
    this._save();
    return p;
  },

  rename(id, name) {
    const p = this._profiles.find(x => x.id === id);
    if (p) { p.name = name; this._save(); }
  },

  delete(id) {
    if (this._profiles.length <= 1) return; // keep at least 1
    this._profiles = this._profiles.filter(p => p.id !== id);
    if (this._activeId === id) this._activeId = this._profiles[0].id;
    this._save();
  },

  // ── Toggle provider in active profile ──
  toggleProvider(providerId) {
    const p = this.active;
    if (!p) return;
    const idx = p.providers.indexOf(providerId);
    if (idx >= 0) p.providers.splice(idx, 1);
    else p.providers.push(providerId);
    this._save();
  },

  isProviderActive(providerId) {
    return this.active?.providers?.includes(providerId) ?? true;
  },

  // ── Switch profile ──
  async switch(id) {
    if (id === this._activeId || !this._profiles.find(p => p.id === id)) return;
    // Save current profile's layout state
    const old = this.active;
    if (old) {
      old.layout = { mode: LayoutModel.mode, views: LayoutModel.views.map(v => ({ providerId: v.providerId, url: v.url })) };
    }

    // Hide current profile's webviews
    WinManager._hideProfileFrames(this._activeId);

    // Switch
    this._activeId = id;
    this._save();

    // Show new profile's webviews (or create if first time)
    const np = this.active;
    WinManager._showProfileFrames(id, np.providers, np.layout);

    // Refresh sidebar
    if (typeof Sidebar !== 'undefined') {
      Sidebar._renderProfileTabs();
      Sidebar._renderProviders();
      Sidebar.renderAll();
    }
  },

  // ── Persistence ──
  _save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._profiles));
    localStorage.setItem(this.ACTIVE_KEY, this._activeId);
  },

  _load() {
    try {
      this._profiles = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch { this._profiles = []; }
    this._activeId = localStorage.getItem(this.ACTIVE_KEY);
  },

  _genId() { return 'prof_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
};
