/**
 * PersistenceManager — Save/restore layout state
 * Auto-save modes: 'exit' | 'interval' | 'both' | 'off'
 */
const PersistenceManager = {
  KEY: 'teamai_layout_v2',
  _intervalId: null,
  _boundBeforeUnload: null,

  save() {
    try {
      const state = LayoutModel.serialize();
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

  /**
   * Start auto-save based on user preference.
   * mode: 'off' | 'exit' | 'interval' | 'both'
   * intervalMin: number of minutes between saves (used when mode includes 'interval')
   */
  startAutoSave(mode, intervalMin) {
    // Tear down any previous setup
    this._stopAutoSave();

    if (!mode || mode === 'off') return;

    const useExit     = mode === 'exit'     || mode === 'both';
    const useInterval = mode === 'interval' || mode === 'both';

    if (useExit) {
      this._boundBeforeUnload = () => this.save();
      window.addEventListener('beforeunload', this._boundBeforeUnload);
    }

    if (useInterval) {
      const ms = Math.max(1, parseInt(intervalMin, 10) || 5) * 60 * 1000;
      this._intervalId = setInterval(() => this.save(), ms);
    }
  },

  _stopAutoSave() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._boundBeforeUnload) {
      window.removeEventListener('beforeunload', this._boundBeforeUnload);
      this._boundBeforeUnload = null;
    }
  },
};
