/**
 * LayoutModel v3 — Single source of truth for all view positions, sizes, mode.
 * No DOM queries for geometry. All layout state here.
 */
const LayoutModel = {
  mode: 'grid',       // grid | split-v | split-h | focus | manual
  views: [],          // [{id, providerId, label, icon, url, x, y, w, h, minW, minH}]
  viewportW: 0,       // available width (minus sidebar)
  viewportH: 0,       // available height (minus toolbar)
  cols: 2,
  rows: 2,
  _snapThreshold: 20, // px from edge for snap
  _snapTargets: [0.25, 0.333, 0.5, 0.666, 0.75],

  init(viewportW, viewportH) {
    this.viewportW = viewportW;
    this.viewportH = viewportH;
  },

  // ── View Management ────────────────────────────────────────────────────
  addView(id, providerId, label, icon, url) {
    this.views.push({ id, providerId, label, icon, url, x: 0, y: 0, w: 400, h: 300, minW: 200, minH: 150 });
  },

  removeView(id) {
    this.views = this.views.filter(v => v.id !== id);
  },

  // ── Layout Computation ─────────────────────────────────────────────────
  compute() {
    const n = this.views.length;
    if (n === 0) return [];

    switch (this.mode) {
      case 'grid': return this._computeGrid();
      case 'split-v': return this._computeSplitV();
      case 'split-h': return this._computeSplitH();
      case 'focus': return this._computeFocus();
      case 'manual': return this._computeManual();
      default: return this._computeGrid();
    }
  },

  _computeGrid() {
    const n = this.views.length;
    this.cols = n <= 2 ? n : n <= 4 ? 2 : n <= 6 ? 3 : n <= 9 ? 3 : 4;
    this.rows = Math.ceil(n / this.cols);

    const gap = 3;
    const cw = Math.floor((this.viewportW - (this.cols - 1) * gap) / this.cols);
    const ch = Math.floor((this.viewportH - (this.rows - 1) * gap) / this.rows);

    return this.views.map((v, i) => ({
      ...v,
      x: (i % this.cols) * (cw + gap),
      y: Math.floor(i / this.cols) * (ch + gap),
      w: cw,
      h: ch,
    }));
  },

  _computeSplitV() {
    const n = this.views.length;
    const cw = Math.floor((this.viewportW - (n - 1) * 3) / n);
    return this.views.map((v, i) => ({ ...v, x: i * (cw + 3), y: 0, w: cw, h: this.viewportH }));
  },

  _computeSplitH() {
    const n = this.views.length;
    const ch = Math.floor((this.viewportH - (n - 1) * 3) / n);
    return this.views.map((v, i) => ({ ...v, x: 0, y: i * (ch + 3), w: this.viewportW, h: ch }));
  },

  _computeFocus(activeIdx = 0) {
    if (this.views.length <= 1) return this._computeGrid();
    // Focus = active view at 70%, others in sidebar strip on the right
    const focusW = Math.floor(this.viewportW * 0.7);
    const stripW = this.viewportW - focusW - 3;
    const results = [];
    this.views.forEach((v, i) => {
      if (i === activeIdx) {
        results.push({ ...v, x: 0, y: 0, w: focusW, h: this.viewportH });
      } else {
        const stripH = Math.floor((this.viewportH - (this.views.length - 2) * 3) / (this.views.length - 1));
        const stripIdx = i < activeIdx ? i : i - 1;
        results.push({ ...v, x: focusW + 3, y: stripIdx * (stripH + 3), w: stripW, h: stripH });
      }
    });
    return results;
  },

  _computeManual() {
    // Return current positions as-is
    return this.views.map(v => ({ ...v }));
  },

  // ── Snap ────────────────────────────────────────────────────────────────
  snap(x, y, w, h) {
    // Snap width to ratio targets
    for (const r of this._snapTargets) {
      const target = Math.floor(this.viewportW * r);
      if (Math.abs(w - target) < this._snapThreshold) {
        w = target;
        // Also snap x to match
        const targets = this._snapTargets.map(t => Math.floor(this.viewportW * t));
        for (const tx of targets) {
          if (Math.abs(x - tx) < this._snapThreshold) { x = tx; break; }
          if (Math.abs(x + w - tx) < this._snapThreshold) { x = tx - w; break; }
        }
        break;
      }
    }
    // Snap height
    for (const r of this._snapTargets) {
      const target = Math.floor(this.viewportH * r);
      if (Math.abs(h - target) < this._snapThreshold) { h = target; break; }
    }
    return { x, y, w, h };
  },

  // ── Mode switching ──────────────────────────────────────────────────────
  setMode(mode) { this.mode = mode; },

  // ── Serialize ───────────────────────────────────────────────────────────
  serialize() {
    return {
      mode: this.mode,
      views: this.views.map(v => ({ id: v.id, providerId: v.providerId, label: v.label, url: v.url })),
      cols: this.cols,
      rows: this.rows,
    };
  },

  deserialize(data) {
    if (!data) return;
    this.mode = data.mode || 'grid';
    this.cols = data.cols || 2;
    this.rows = data.rows || 2;
  },
};
