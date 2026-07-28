/**
 * TeamAI v7 — Window Manager
 * Partition partagée par provider (cookies persistants).
 * Nav buttons plus grands, favoris, resize optimisé.
 */
const WinManager = {
  frames: new Map(),
  providers: [],
  _zoom: 0,
  _idCounter: 0,

  async init() {
    this.providers = await teamai.getProviders() || [];
    this._zoom = await teamai.getZoom() || 0;
    teamai.onExecJsAll((text) => this._dispatchToAll(text));
    this._setupZoomButtons();
    this._setupLayout();

    // Listen for resize on viewport
    const viewport = document.getElementById('viewport');
    if (viewport) {
      let t; const ro = new ResizeObserver(() => {
        clearTimeout(t); t = setTimeout(() => {
          LayoutModel.init(viewport.clientWidth, viewport.clientHeight);
          this._syncFrames();
        }, 100);
      });
      ro.observe(viewport);
    }

    this._restoreOrCreateDefault();
    document.getElementById('btn-reset-layout')?.addEventListener('click', () => this._resetLayout());
  },

  _setupLayout() {
    const viewport = document.getElementById('viewport');
    if (viewport) LayoutModel.init(viewport.clientWidth, viewport.clientHeight);
    PersistenceManager.restore();
    PresetLayouts.init();
  },

  _applyLayout() {
    const viewport = document.getElementById('viewport');
    if (viewport) LayoutModel.init(viewport.clientWidth, viewport.clientHeight);
    this._syncFrames();
  },

  _syncFrames() {
    const computed = LayoutModel.compute();
    if (computed.length === 0) return;

    // Sort computed by view order in LayoutModel
    const order = LayoutModel.views.map(v => v.id);
    const sorted = computed.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

    this.frames.forEach((entry, id) => {
      const pos = sorted.find(s => s.id === id);
      if (!pos) return;
      entry.frame.style.width = pos.w + 'px';
      entry.frame.style.height = pos.h + 'px';
      // For split/focus modes, position absolutely
      if (LayoutModel.mode !== 'grid' && LayoutModel.mode !== 'manual') {
        entry.frame.style.position = 'absolute';
        entry.frame.style.left = pos.x + 'px';
        entry.frame.style.top = pos.y + 'px';
      } else if (LayoutModel.mode !== 'manual') {
        entry.frame.style.position = '';
        entry.frame.style.left = '';
        entry.frame.style.top = '';
      }
      // Cards mode: dim non-active + show overlay
      const overlay = entry.frame.querySelector('.card-overlay');
      if (LayoutModel.mode === 'cards') {
        const idx = Array.from(this.frames.keys()).indexOf(id);
        const isActive = idx === LayoutModel._activeCard;
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

  async _restoreOrCreateDefault() {
    const saved = localStorage.getItem('teamai_session');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.views?.length > 0 && confirm('Restaurer la session précédente ?')) {
          for (const v of data.views) this._createView(v.providerId || 'default', v.url);
          return;
        }
      } catch {}
    }
    for (const pid of ['gpt5_terra','gpt5_sol','gemini','raisonnement','claude','zglm','kimi','grok','nemotron','venice']) {
      this._createView(pid);
    }
  },

  _createView(providerId, initialUrl = null) {
    const urlOverrides = { zglm: 'https://chatglm.cn/?lang=en' };
    const prov = this.providers.find(p => p.id === providerId)
      || { id: providerId, label: providerId, url: urlOverrides[providerId] || 'about:blank', icon: '🌐' };

    this._idCounter++;
    const id = `wv_${this._idCounter}`;
    // ⭐ MÊME PARTITION PAR PROVIDER = cookies persistés entre vues
    const partition = `persist:teamai_${providerId}`;
    const container = document.getElementById('grid-container');
    if (!container) return id;

    const frame = document.createElement('div');
    frame.className = 'window-frame';
    frame.dataset.id = id;

    const comboOps = this.providers.map(p =>
      `<option value="${p.id}" ${p.id === prov.id ? 'selected' : ''}>${p.icon} ${p.label}</option>`
    ).join('');

    frame.innerHTML = `
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

    const webview = document.createElement('webview');
    webview.src = initialUrl || prov.url || 'about:blank';
    webview.setAttribute('partition', partition);
    webview.setAttribute('allowpopups', '');
    webview.setAttribute('useragent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.style.border = 'none';
    frame.querySelector('.webview-area').appendChild(webview);

    const combo = frame.querySelector('.provider-combo');
    const urlBar = frame.querySelector('.url-bar');
    const entry = { frame, webview, combo, urlBar, providerId: prov.id, favori: false };
    this.frames.set(id, entry);
    this._bindToolbar(id, entry);
    this._bindWebView(id, entry);
    this._bindResize(id, entry);
    this._bindCardClick(id, entry);

    // Add to LayoutModel
    LayoutModel.addView(id, prov.id, prov.label, prov.icon, initialUrl || prov.url);

    this._syncFrames();
    return id;
  },

  _bindToolbar(id, entry) {
    const { frame, combo, urlBar, webview } = entry;
    combo.addEventListener('change', () => {
      const prov = this.providers.find(p => p.id === combo.value);
      if (prov) { entry.providerId = prov.id; webview.src = prov.url; urlBar.value = prov.url; }
    });
    frame.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'bookmark') {
          Bookmarks.add(entry.providerId, entry.combo?.options[entry.combo.selectedIndex]?.text || 'IA', webview.src);
          return;
        }
        if (btn.dataset.action === 'focus') {
          this._toggleFocus(id);
          return;
        }
        try {
          if (btn.dataset.action === 'back') webview.goBack();
          else if (btn.dataset.action === 'forward') webview.goForward();
          else if (btn.dataset.action === 'reload') webview.reload();
        } catch {}
      });
    });
    urlBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let url = urlBar.value.trim(); if (!url) return;
        webview.src = !url.startsWith('http') && url.includes('.') ? 'https://' + url
          : !url.includes('.') ? 'https://www.google.com/search?q=' + encodeURIComponent(url) : url;
      }
    });
    frame.querySelector('.close-btn').addEventListener('click', () => this._remove(id));
  },

  _bindWebView(id, entry) {
    const { webview, urlBar } = entry;
    webview.addEventListener('did-navigate', (e) => { if (e.url && e.url !== 'about:blank') urlBar.value = e.url; });
    webview.addEventListener('did-navigate-in-page', (e) => { if (e.url && e.url !== 'about:blank') urlBar.value = e.url; });
    webview.addEventListener('page-title-updated', (e) => Sidebar.updateWindowTitle(id, e.title));
    webview.addEventListener('new-window', (e) => {
      if (e.url.includes('accounts.google.com') || e.url.includes('oauth')) {
        e.preventDefault();
        teamai.openAuthWindow(e.url, webview.getAttribute('partition') || '');
      }
    });
    webview.addEventListener('did-fail-load', (e) => {
      if (e.errorCode !== -3) { // -3 = aborted (user navigation)
        ErrorBar.show(`❌ ${entry.combo?.options[entry.combo.selectedIndex]?.text || 'IA'}: ${e.errorDescription || 'Erreur de chargement'}`);
      }
    });
    webview.addEventListener('crashed', () => {
      ErrorBar.show(`💥 ${entry.combo?.options[entry.combo.selectedIndex]?.text || 'IA'}: WebView a crashé`);
    });
    webview.addEventListener('did-get-redirect-request', (e) => {
      if (e.isMainFrame && e.newURL) urlBar.value = e.newURL;
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
    const overlay = entry.frame.querySelector('.card-overlay');
    if (!overlay) return;
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      if (LayoutModel.mode !== 'cards') return;
      const idx = Array.from(this.frames.keys()).indexOf(id);
      if (idx >= 0) {
        LayoutModel.setActiveCard(idx);
        this._applyLayout();
      }
    });
  },

  _remove(id) {
    const entry = this.frames.get(id); if (!entry) return;
    entry.frame.remove(); this.frames.delete(id);
    LayoutModel.removeView(id);
    this._syncFrames(); Sidebar.renderAll();
  },

  _resetLayout() {
    for (const [, e] of this.frames) {
      e.frame.classList.remove('resized', 'focused');
      e.frame.style.width = ''; e.frame.style.height = ''; e.frame.style.position = '';
      e.frame.style.left = ''; e.frame.style.top = ''; e.frame.style.zIndex = '';
      // Restore webview
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
      // Unfocus — restore
      frame.classList.remove('focused');
      frame.style.width = frame._focusPrevW || ''; frame.style.height = frame._focusPrevH || '';
      frame.style.position = frame._focusPrevPos || '';
      frame.style.left = frame._focusPrevL || ''; frame.style.top = frame._focusPrevT || '';
      frame.style.zIndex = '';
      const wv = frame.querySelector('webview');
      if (wv) wv.style.opacity = '1';
      // Reset layout for all frames
      this.frames.forEach((e) => {
        const w = e.frame.querySelector('webview');
        if (w) w.style.opacity = '1';
      });
    } else {
      // Focus this frame — fill viewport, hide others
      const vp = document.getElementById('viewport');
      if (!vp) return;
      // Save current
      frame._focusPrevW = frame.style.width; frame._focusPrevH = frame.style.height;
      frame._focusPrevL = frame.style.left; frame._focusPrevT = frame.style.top;
      frame._focusPrevPos = frame.style.position;
      // Hide all webviews, show only focused
      this.frames.forEach((e, fid) => {
        const w = e.frame.querySelector('webview');
        if (w) w.style.opacity = fid === id ? '1' : '0';
      });
      frame.classList.add('focused');
      frame.style.position = 'absolute';
      frame.style.left = '0'; frame.style.top = '0';
      frame.style.width = vp.clientWidth + 'px';
      frame.style.height = vp.clientHeight + 'px';
      frame.style.zIndex = '100';
    }
  },

  _dispatchToAll(text) {
    const safe = JSON.stringify(text);
    const js = `(function(){
      const sels=['#prompt-textarea','[contenteditable="true"]','textarea','.ProseMirror','[role="textbox"]'];
      for(const s of sels){const el=document.querySelector(s);if(!el)continue;
        el.focus();
        if(el.isContentEditable||el.tagName==='DIV'){el.textContent='';document.execCommand('insertText',false,${safe});}
        else{el.value=${safe};}
        el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
        setTimeout(()=>{
          const ev=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true});
          el.dispatchEvent(ev);
          const btns=document.querySelectorAll('button[data-testid="send-button"],button[type="submit"],button:has(svg)');
          for(const b of btns){if(b.offsetParent!==null){b.click();break;}}
        },600);return 'ok';
      }return 'not_found';
    })();`;
    for (const [, e] of this.frames) { try { e.webview.executeJavaScript(js).catch(() => {}); } catch {} }
  },

  _layout() {
    const viewport = document.getElementById('viewport');
    if (!viewport) return;
    let idx = 0;
    for (const [id, e] of this.frames) {
      const badge = e.frame.querySelector('.num-badge');
      if (badge) badge.textContent = idx + 1;
      idx++;
    }
    Sidebar.renderAll();
  },

  _renderZoomLabel() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = `${100 + this._zoom * 15}%`;
  },

  _setupZoomButtons() {
    document.getElementById('zoom-in')?.addEventListener('click', () => this._zoomChange(1));
    document.getElementById('zoom-out')?.addEventListener('click', () => this._zoomChange(-1));
    document.getElementById('zoom-reset')?.addEventListener('click', () => this._zoomChange(0, true));
  },

  async _zoomChange(delta, reset = false) {
    this._zoom = reset ? 0 : Math.max(-3, Math.min(5, this._zoom + delta));
    await teamai.setZoom(this._zoom);
    this._renderZoomLabel();
    this._layout();
  },

  addView(pid) { this._createView(pid); },
  get count() { return this.frames.size; },
  get list() {
    return Array.from(this.frames.entries()).map(([id, e]) => ({
      id, providerId: e.providerId, url: e.webview?.src || '',
      label: e.combo?.options[e.combo.selectedIndex]?.text || e.providerId,
    }));
  },
  get providersList() { return this.providers; },
};
