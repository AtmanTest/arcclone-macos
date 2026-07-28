/**
 * TeamAI v16 — Window Manager
 * Crée, gère et dispose les fenêtres webview. Layout, toolbar, focus, cards.
 */
const WinManager = {
  frames: new Map(),
  providers: [],
  _idCounter: 0,
  _initDone: false,

  get count() { return this.frames.size; },
  get list() { return LayoutModel.views.map(v => ({ providerId: v.providerId, url: v.url })); },

  async init(providersList) {
    this.providers = providersList || [];
    document.getElementById('grid-container').innerHTML = '';
    this.frames.clear();
    LayoutModel.views = [];
    this._idCounter = 0;

    // Restore session or create defaults
    const saved = localStorage.getItem('teamai_session');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.views?.length > 0) {
          for (const v of data.views) this._createView(v.providerId || 'default', v.url);
        }
      } catch { /* ignore */ }
    }
    if (this.frames.size === 0) {
      for (const p of this.providers) this._createView(p.id);
    }

    this._applyLayout();
    PersistenceManager.restore();
    PresetLayouts.init();
    this._initDone = true;
  },

  addView(providerId, url) {
    this._createView(providerId, url);
    this._applyLayout();
  },

  _createView(providerId, initialUrl) {
    const urlOverrides = { zglm: 'https://chatglm.cn/?lang=en' };
    const prov = this.providers.find(p => p.id === providerId)
      || { id: providerId, label: providerId, url: urlOverrides[providerId] || 'about:blank', icon: '🌐' };

    const colors = {
      gpt5_terra: '#00A67E', gpt5_sol: '#E05E2E', gemini: '#4285F4',
      raisonnement: '#7C3AED', claude: '#D97757', zglm: '#06B6D4',
      kimi: '#EC4899', grok: '#1DA1F2', nemotron: '#F59E0B', venice: '#A855F7',
    };
    const providerColor = colors[providerId] || '#555';

    this._idCounter++;
    const id = `wv_${this._idCounter}`;
    const container = document.getElementById('grid-container');
    const frame = document.createElement('div');
    frame.className = 'window-frame';
    frame.dataset.id = id;

    const comboOps = this.providers.map(p =>
      `<option value="${p.id}" ${p.id === prov.id ? 'selected' : ''}>${p.icon} ${p.label}</option>`
    ).join('');

    frame.innerHTML = `
      <div class="card-header" style="background:${providerColor}">
        <span class="card-header-icon">${prov.icon}</span>
        <span class="card-header-name">${prov.label}</span>
      </div>
      <div class="toolbar">
        <span class="num-badge">${this._idCounter}</span>
        <select class="provider-combo">${comboOps}</select>
        <button class="nav-btn" title="Précédent" data-action="back">◀</button>
        <button class="nav-btn" title="Suivant" data-action="forward">▶</button>
        <button class="nav-btn" title="Actualiser" data-action="reload">⟳</button>
        <button class="nav-btn" title="Focus plein écran" data-action="focus">👁</button>
        <button class="nav-btn" title="Favoris" data-action="bookmark">★</button>
        <input class="url-bar" placeholder="URL..." spellcheck="false" value="${initialUrl || prov.url || ''}">
        <button class="close-btn" title="Fermer">✕</button>
      </div>
      <div class="webview-area">
        <div class="card-overlay"></div>
      </div>
      <div class="resize-handle"></div>
    `;

    container.appendChild(frame);
    const entry = { id, frame, combo: frame.querySelector('.provider-combo'), urlBar: frame.querySelector('.url-bar') };
    this.frames.set(id, entry);
    LayoutModel.addView(id, prov.id, prov.label, prov.icon, initialUrl || prov.url || 'about:blank');

    // Webview
    const partition = `persist:teamai_${prov.id}`;
    const webview = document.createElement('webview');
    webview.src = initialUrl || prov.url || 'about:blank';
    webview.setAttribute('partition', partition);
    webview.setAttribute('allowpopups', '');
    webview.setAttribute('useragent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.style.border = 'none';
    frame.querySelector('.webview-area').appendChild(webview);
    webview.addEventListener('new-window', (e) => {
      if (e.url.includes('accounts.google.com') || e.url.includes('oauth')) {
        e.preventDefault();
        teamai.openAuthWindow(e.url, webview.getAttribute('partition') || '');
      }
    });
    webview.addEventListener('did-fail-load', (e) => {
      if (e.errorCode !== -3) {
        ErrorBar.show(`❌ ${prov.label}: ${e.errorDescription || 'Erreur de chargement'}`);
      }
    });
    webview.addEventListener('crashed', () => {
      ErrorBar.show(`💥 ${prov.label}: WebView a crashé`);
    });
    webview.addEventListener('did-get-redirect-request', (e) => {
      if (e.isMainFrame && e.newURL) entry.urlBar.value = e.newURL;
    });

    this._bindToolbar(id, entry);
    this._bindCardClick(id, entry);
    this._bindResize(id, entry);
    return id;
  },

  _bindToolbar(id, entry) {
    const frame = entry.frame;
    // Combo → switch provider in same frame
    entry.combo?.addEventListener('change', () => {
      const newProvId = entry.combo.value;
      const wv = frame.querySelector('webview');
      const prov = this.providers.find(p => p.id === newProvId);
      const newUrl = prov?.url || 'about:blank';
      if (wv) {
        wv.src = newUrl;
        wv.setAttribute('partition', `persist:teamai_${newProvId}`);
      }
      const view = LayoutModel.views.find(v => v.id === id);
      if (view) { view.providerId = newProvId; view.label = prov?.label || newProvId; view.url = newUrl; }
      entry.urlBar.value = newUrl;
    });
    // Nav buttons
    frame.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wv = frame.querySelector('webview');
        if (!wv) return;
        if (btn.dataset.action === 'back') { try { wv.goBack(); } catch {} }
        else if (btn.dataset.action === 'forward') { try { wv.goForward(); } catch {} }
        else if (btn.dataset.action === 'reload') { try { wv.reload(); } catch {} }
        else if (btn.dataset.action === 'bookmark') {
          Bookmarks.add(id, entry.combo?.options[entry.combo.selectedIndex]?.text || 'IA', wv.getURL())
            .then(() => Bookmarks.render());
        } else if (btn.dataset.action === 'focus') {
          if (frame.classList.contains('focused')) {
            frame.classList.remove('focused');
            frame.style.position = ''; frame.style.width = ''; frame.style.height = '';
            frame.style.top = ''; frame.style.left = ''; frame.style.zIndex = '';
            this._applyLayout();
          } else {
            // Full viewport focus
            const vp = document.getElementById('viewport');
            frame.classList.add('focused');
            frame.style.position = 'fixed';
            frame.style.top = '0'; frame.style.left = '0';
            frame.style.width = '100vw'; frame.style.height = '100vh';
            frame.style.zIndex = '100';
          }
        }
      });
    });
    // URL bar: Enter → navigate + Google search fallback
    entry.urlBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        let val = entry.urlBar.value.trim();
        if (!val) return;
        const wv = frame.querySelector('webview');
        if (!wv) return;
        if (val.match(/^https?:\/\//) || val.match(/^[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i)) {
          if (!val.startsWith('http')) val = 'https://' + val;
        } else {
          val = 'https://www.google.com/search?q=' + encodeURIComponent(val);
        }
        wv.src = val;
      }
    });
    // Close button
    frame.querySelector('.close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this._remove(id);
    });
  },

  _bindResize(id, entry) {
    const handle = entry.frame.querySelector('.resize-handle');
    if (!handle) return;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      ResizeController.start(e, id, entry.frame, entry.frame.offsetWidth, entry.frame.offsetHeight);
    });
  },

  _bindCardClick(id, entry) {
    const handler = (e) => {
      e.stopPropagation();
      const idx = Array.from(this.frames.keys()).indexOf(id);
      if (idx < 0) return;
      if (LayoutModel.mode === 'cards') {
        LayoutModel.setActiveCard(idx);
        this._syncFrames();
      } else if (LayoutModel.mode === 'focus') {
        const views = LayoutModel.views;
        if (idx > 0 && views.length > 1) {
          [views[0], views[idx]] = [views[idx], views[0]];
          LayoutModel.applyViewOrder(views);
          this._syncFrames();
        }
      }
    };
    const overlay = entry.frame.querySelector('.card-overlay');
    if (overlay) overlay.addEventListener('click', handler);
    const header = entry.frame.querySelector('.card-header');
    if (header) header.addEventListener('click', handler);
  },

  _remove(id) {
    const entry = this.frames.get(id); if (!entry) return;
    entry.frame.remove(); this.frames.delete(id);
    LayoutModel.removeView(id);
    this._applyLayout();
    PersistenceManager.save();
  },

  _resetLayout() {
    for (const [, e] of this.frames) {
      e.frame.classList.remove('resized', 'focused');
      e.frame.style.width = ''; e.frame.style.height = ''; e.frame.style.position = '';
      e.frame.style.top = ''; e.frame.style.left = ''; e.frame.style.zIndex = '';
      const wv = e.frame.querySelector('webview');
      if (wv) wv.style.opacity = '1';
    }
    LayoutModel.setMode('grid');
    this._applyLayout();
  },

  _toggleFocus(id) {
    const entry = this.frames.get(id);
    if (!entry) return;
    const frame = entry.frame;
    if (frame.classList.contains('focused')) {
      frame.classList.remove('focused');
      frame.style.position = ''; frame.style.width = ''; frame.style.height = '';
      frame.style.top = ''; frame.style.left = ''; frame.style.zIndex = '';
      this._applyLayout();
    } else {
      const vp = document.getElementById('viewport');
      frame.classList.add('focused');
      frame.style.position = 'fixed';
      frame.style.top = '0'; frame.style.left = '0';
      frame.style.width = '100vw'; frame.style.height = '100vh';
      frame.style.zIndex = '100';
    }
  },

  _applyLayout() {
    const viewport = document.getElementById('viewport');
    if (viewport) LayoutModel.init(viewport.clientWidth, viewport.clientHeight);
    this._syncFrames();
    // Scroll carousel Cards → désactivé (plantait)
    // this._bindCardsScroll();
  },

  _bindCardsScroll() {
    const container = document.getElementById('grid-container');
    if (!container) return;
    if (LayoutModel.mode === 'cards') {
      if (!container._cardsScrollBound) {
        container.addEventListener('wheel', (e) => {
          if (LayoutModel.mode !== 'cards') return;
          const n = LayoutModel.views.length;
          if (n <= 1) return;
          let next = LayoutModel._activeCard + (e.deltaY > 0 ? 1 : -1);
          if (next < 0) next = n - 1;
          if (next >= n) next = 0;
          if (next !== LayoutModel._activeCard) {
            LayoutModel.setActiveCard(next);
            this._syncFrames();
          }
          e.preventDefault();
        }, { passive: false });
        container._cardsScrollBound = true;
      }
    }
  },

  _syncFrames() {
    const computed = LayoutModel.compute();
    if (computed.length === 0) return;
    const order = LayoutModel.views.map(v => v.id);
    const sorted = computed.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

    this.frames.forEach((entry, id) => {
      const pos = sorted.find(s => s.id === id);
      if (!pos) return;
      entry.frame.style.width = pos.w + 'px';
      entry.frame.style.height = pos.h + 'px';
      if (LayoutModel.mode !== 'grid' && LayoutModel.mode !== 'manual') {
        entry.frame.style.position = 'absolute';
        entry.frame.style.left = pos.x + 'px';
        entry.frame.style.top = pos.y + 'px';
      } else {
        entry.frame.style.position = '';
        entry.frame.style.left = '';
        entry.frame.style.top = '';
      }
      // Cards/Focus overlay + dimming
      const overlay = entry.frame.querySelector('.card-overlay');
      if (LayoutModel.mode === 'cards' || LayoutModel.mode === 'focus') {
        const idx = Array.from(this.frames.keys()).indexOf(id);
        const isActive = idx === LayoutModel._activeCard || idx === 0;
        entry.frame.style.opacity = isActive ? '1' : '0.6';
        entry.frame.style.border = isActive ? '2px solid rgba(255,255,255,0.8)' : '1px solid var(--border)';
        if (overlay) overlay.style.display = isActive ? 'none' : 'block';
      } else {
        entry.frame.style.opacity = '1';
        entry.frame.style.border = '1px solid var(--border)';
        if (overlay) overlay.style.display = 'none';
      }
    });
    this._layout();
  },

  _layout() {
    const grid = document.getElementById('grid-container');
    if (!grid) return;
    if (LayoutModel.mode === 'grid') {
      grid.style.display = 'flex'; grid.style.flexWrap = 'wrap';
      grid.style.alignContent = 'flex-start'; grid.style.gap = '3px';
    } else {
      grid.style.display = 'block'; grid.style.position = 'relative';
    }
  },

  _dispatchToAll(text) {
    this.frames.forEach((entry) => {
      const wv = entry.frame.querySelector('webview');
      if (!wv) return;
      wv.executeJavaScript(`
        (function() {
          const ed = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea, input[type="text"]');
          if (ed) {
            ed.focus();
            if (ed.isContentEditable) {
              ed.textContent = '';
              ed.innerHTML = '';
              const p = document.createElement('p'); p.textContent = ${JSON.stringify(text)};
              ed.appendChild(p);
            } else {
              ed.value = ${JSON.stringify(text)};
            }
            ed.dispatchEvent(new Event('input', { bubbles: true }));
            ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            setTimeout(() => {
              const btn = document.querySelector('button[type="submit"], button:has(svg), [aria-label*="send" i], [aria-label*="envoyer" i]');
              if (btn) btn.click();
            }, 100);
          }
        })();
      `).catch(() => {});
    });
  },
};
