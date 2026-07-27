/**
 * ResizeController v3
 * rAF-throttled resize. Ghost overlay during drag. Zero webview interaction.
 */
const ResizeController = {
  _active: false,
  _id: null,
  _startX: 0, _startY: 0,
  _startW: 0, _startH: 0,
  _ghost: null, // ghost overlay element
  _rafId: null,
  _lastFrame: 0,

  start(e, id, frameEl, curW, curH) {
    if (this._active) return;
    this._active = true;
    this._id = id;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._startW = curW;
    this._startH = curH;

    // Create ghost overlay (semi-transparent, no webview)
    this._ghost = document.createElement('div');
    this._ghost.style.cssText = `
      position: fixed; z-index: 9999;
      pointer-events: none;
      background: rgba(124, 58, 237, 0.08);
      border: 2px solid rgba(124, 58, 237, 0.4);
      border-radius: 8px;
      transition: none;
    `;
    this._updateGhost(curW, curH, frameEl.getBoundingClientRect());
    document.body.appendChild(this._ghost);

    // Hide the actual frame's webview temporarily
    const webview = frameEl.querySelector('webview');
    if (webview) webview.style.opacity = '0';

    frameEl.classList.add('resized');

    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('mouseup', this._onUp);
  },

  _onMove: (e) => {
    if (!ResizeController._active) return;
    // Throttle via requestAnimationFrame
    if (ResizeController._rafId) return;
    ResizeController._rafId = requestAnimationFrame(() => {
      ResizeController._rafId = null;
      if (!ResizeController._active) return;
      const dx = e.clientX - ResizeController._startX;
      const dy = e.clientY - ResizeController._startY;
      let w = Math.max(200, ResizeController._startW + dx);
      let h = Math.max(150, ResizeController._startH + dy);
      // Snap
      const snapped = LayoutModel.snap(0, 0, w, h);
      w = snapped.w; h = snapped.h;
      ResizeController._updateGhost(w, h);
    });
  },

  _onUp: (e) => {
    document.removeEventListener('mousemove', ResizeController._onMove);
    document.removeEventListener('mouseup', ResizeController._onUp);
    if (!ResizeController._active) return;
    ResizeController._active = false;
    if (ResizeController._rafId) { cancelAnimationFrame(ResizeController._rafId); ResizeController._rafId = null; }

    // Apply final size
    const dx = e.clientX - ResizeController._startX;
    const dy = e.clientY - ResizeController._startY;
    let w = Math.max(200, ResizeController._startW + dx);
    let h = Math.max(150, ResizeController._startH + dy);
    const snapped = LayoutModel.snap(0, 0, w, h);
    w = snapped.w; h = snapped.h;

    const frame = document.querySelector(`.window-frame[data-id="${ResizeController._id}"]`);
    if (frame) {
      // Restore webview visibility
      const webview = frame.querySelector('webview');
      if (webview) webview.style.opacity = '1';
      frame.style.width = w + 'px';
      frame.style.height = h + 'px';
    }

    // Remove ghost
    if (ResizeController._ghost) {
      ResizeController._ghost.remove();
      ResizeController._ghost = null;
    }

    // Save layout
    PersistenceManager.save();
  },

  _updateGhost(w, h, rect) {
    if (!this._ghost) return;
    if (rect) {
      this._ghost.style.left = rect.left + 'px';
      this._ghost.style.top = rect.top + 'px';
    }
    this._ghost.style.width = w + 'px';
    this._ghost.style.height = h + 'px';
  },
};
