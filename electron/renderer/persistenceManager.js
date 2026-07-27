/**
 * PersistenceManager — Save/restore layout state
 */
const PersistenceManager = {
  KEY: 'teamai_layout_v2',

  save() {
    try {
      const state = LayoutModel.serialize();
      // Add custom sizes from DOM
      state.customSizes = [];
      WinManager.frames.forEach((entry, id) => {
        if (entry.frame.classList.contains('resized')) {
          state.customSizes.push({
            id,
            w: entry.frame.style.width,
            h: entry.frame.style.height,
          });
        }
      });
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch {}
  },

  restore() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      LayoutModel.deserialize(data);
      return true;
    } catch { return false; }
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },
};
