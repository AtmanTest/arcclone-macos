/**
 * TeamAI v5 — Window Manager (webview)
 * Grid with resize handles, multi-line prompt, provider cards.
 */
const WinManager = {
  frames: new Map(),
  providers: [],
  _zoom: 0,
  _idCounter: 0,
  _resizing: null, // { id, startX, startY, startW, startH, startRect }

  async init() {
    this.providers = await teamai.getProviders() || [];
    this._zoom = await teamai.getZoom() || 0;

    teamai.onExecJsAll((text) => this._dispatchToAll(text));

    this._setupZoomButtons();
    this._restoreOrCreateDefault();
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
    const prov = this.providers.find(p => p.id === providerId)
      || { id: providerId, label: providerId, url: 'about:blank', icon: '🌐' };
    this._idCounter++;
    const id = `wv_${this._idCounter}`;
    const partition = `persist:teamai_${providerId}_${this._idCounter}`;
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
        <button class="nav-btn" data-action="back">◀</button>
        <button class="nav-btn" data-action="forward">▶</button>
        <button class="nav-btn" data-action="reload">⟳</button>
        <input class="url-bar" placeholder="URL..." spellcheck="false" value="${initialUrl || prov.url}">
        <button class="close-btn">✕</button>
      </div>
      <div class="webview-area"></div>
      <div class="resize-handle"></div>
    `;
    container.appendChild(frame);

    const webview = document.createElement('webview');
    webview.src = initialUrl || prov.url;
    webview.setAttribute('partition', partition);
    webview.setAttribute('allowpopups', '');
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.style.border = 'none';
    frame.querySelector('.webview-area').appendChild(webview);

    // Wire up
    const combo = frame.querySelector('.provider-combo');
    const urlBar = frame.querySelector('.url-bar');
    const entry = { frame, webview, combo, urlBar, providerId: prov.id };
    this.frames.set(id, entry);

    this._bindToolbar(id, entry);
    this._bindWebView(id, entry);
    this._bindResize(id, entry);
    this._layout();

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
        try { if (btn.dataset.action === 'back') webview.goBack();
          else if (btn.dataset.action === 'forward') webview.goForward();
          else if (btn.dataset.action === 'reload') webview.reload(); } catch {}
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
  },

  _bindResize(id, entry) {
    const handle = entry.frame.querySelector('.resize-handle');
    if (!handle) return;
    let startX, startY, startW, startH;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      startX = e.clientX; startY = e.clientY;
      startW = entry.frame.offsetWidth; startH = entry.frame.offsetHeight;
      const onMove = (ev) => {
        const dw = ev.clientX - startX; const dh = ev.clientY - startY;
        entry.frame.style.width = Math.max(150, startW + dw) + 'px';
        entry.frame.style.height = Math.max(120, startH + dh) + 'px';
        entry.frame.style.flexGrow = '0';
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  },

  _remove(id) {
    const entry = this.frames.get(id);
    if (!entry) return;
    entry.frame.remove();
    this.frames.delete(id);
    this._layout();
    Sidebar.renderAll();
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
    const container = document.getElementById('grid-container');
    if (!container) return;
    const viewport = document.getElementById('viewport');
    if (!viewport) return;
    const vpW = viewport.clientWidth - 6;
    const zoom = 1 + this._zoom * 0.15;
    const total = this.frames.size;
    if (total === 0) return;

    let idx = 0;
    for (const [, e] of this.frames) {
      const badge = e.frame.querySelector('.num-badge');
      if (badge) badge.textContent = idx + 1;
      if (!e.frame.style.width || e.frame.style.flexGrow !== '0') {
        // auto-size based on grid
        e.frame.style.flexGrow = '1';
        e.frame.style.maxWidth = 'none';
      }
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

  // Public API
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
