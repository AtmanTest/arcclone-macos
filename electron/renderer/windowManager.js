/**
 * TeamAI v4 — Window Manager (webview-based)
 * Chaque fenêtre = toolbar HTML visible + <webview> en dessous.
 * Google OAuth interceptions, navigation, prompt dispatch.
 */
const WinManager = {
  frames: new Map(), // id → { frame, webview, combo, urlBar }
  providers: [],
  _zoom: 0,
  _idCounter: 0,

  async init() {
    this.providers = await teamai.getProviders() || [];
    this._zoom = await teamai.getZoom() || 0;

    // Listen for global prompt dispatch
    teamai.onExecJsAll((text) => this._dispatchToAll(text));

    this._renderZoomLabel();
    this._setupZoomButtons();
    this._restoreOrCreateDefault();
  },

  async _restoreOrCreateDefault() {
    const saved = localStorage.getItem('teamai_session');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.views?.length > 0 && confirm('Restaurer la session précédente ?')) {
          for (const v of data.views) {
            this._createWebView(v.providerId || 'default', v.url);
          }
          return;
        }
      } catch {}
    }
    // Default: open all providers
    for (const pid of ['gpt5_terra','gpt5_sol','gemini','raisonnement','claude','zglm','kimi','grok','nemotron','venice']) {
      this._createWebView(pid);
    }
  },

  _createWebView(providerId, initialUrl = null) {
    const prov = this.providers.find(p => p.id === providerId)
      || { id: providerId, label: providerId, url: 'about:blank', icon: '🌐' };

    this._idCounter++;
    const id = `wv_${this._idCounter}`;
    const partition = `persist:teamai_${providerId}_${this._idCounter}`;
    const container = document.getElementById('grid-container');
    if (!container) return id;

    // Create frame
    const frame = document.createElement('div');
    frame.className = 'window-frame';
    frame.dataset.id = id;
    frame.id = id;

    // Toolbar HTML — visible ABOVE the webview
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
        <input class="url-bar" placeholder="URL..." spellcheck="false" value="${initialUrl || prov.url || ''}">
        <button class="close-btn">✕</button>
      </div>
      <div class="webview-area"></div>
    `;

    container.appendChild(frame);

    // Create webview element
    const webview = document.createElement('webview');
    webview.src = initialUrl || prov.url || 'about:blank';
    webview.setAttribute('partition', partition);
    webview.setAttribute('allowpopups', '');
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.style.border = 'none';

    const webviewArea = frame.querySelector('.webview-area');
    webviewArea.appendChild(webview);

    // Wire up toolbar
    const combo = frame.querySelector('.provider-combo');
    const urlBar = frame.querySelector('.url-bar');
    const entry = { frame, webview, combo, urlBar, providerId: prov.id };
    this.frames.set(id, entry);

    // Events
    this._bindToolbar(id, entry);
    this._bindWebView(id, entry);

    // Size
    this._sizeAll();

    return id;
  },

  _bindToolbar(id, entry) {
    const { frame, combo, urlBar, webview } = entry;

    combo.addEventListener('change', () => {
      const prov = this.providers.find(p => p.id === combo.value);
      if (prov) {
        entry.providerId = prov.id;
        webview.src = prov.url;
        urlBar.value = prov.url;
      }
    });

    frame.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          if (btn.dataset.action === 'back') webview.goBack();
          else if (btn.dataset.action === 'forward') webview.goForward();
          else if (btn.dataset.action === 'reload') webview.reload();
        } catch {}
      });
    });

    urlBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let url = urlBar.value.trim();
        if (!url) return;
        if (!url.startsWith('http') && url.includes('.')) url = 'https://' + url;
        else if (!url.includes('.')) url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
        webview.src = url;
      }
    });

    frame.querySelector('.close-btn').addEventListener('click', () => {
      this._removeView(id);
    });
  },

  _bindWebView(id, entry) {
    const { webview, urlBar, combo } = entry;

    // Update URL bar on navigation
    webview.addEventListener('did-navigate', (e) => {
      if (e.url && e.url !== 'about:blank') urlBar.value = e.url;
    });
    webview.addEventListener('did-navigate-in-page', (e) => {
      if (e.url && e.url !== 'about:blank') urlBar.value = e.url;
    });

    // Update page title in sidebar
    webview.addEventListener('page-title-updated', (e) => {
      Sidebar.updateWindowTitle(id, e.title);
    });

    // Google OAuth: intercept popups → open in Electron window
    webview.addEventListener('new-window', (e) => {
      const needsAuth = e.url.includes('accounts.google.com') || e.url.includes('oauth')
        || e.url.includes('login.google') || e.url.includes('googleapis.com');
      if (needsAuth) {
        e.preventDefault();
        const partition = webview.getAttribute('partition') || '';
        teamai.openAuthWindow(e.url, partition);
      }
      // else: allow default (opens in system browser)
    });
  },

  _removeView(id) {
    const entry = this.frames.get(id);
    if (!entry) return;
    entry.frame.remove();
    this.frames.delete(id);
    this._sizeAll();
    Sidebar.renderStats();
  },

  _dispatchToAll(text) {
    const safe = JSON.stringify(text);
    const js = `
      (function() {
        const sels = ['#prompt-textarea','[contenteditable="true"]','textarea','.ProseMirror','[role="textbox"]'];
        for (const s of sels) {
          const el = document.querySelector(s);
          if (!el) continue;
          el.focus();
          if (el.isContentEditable || el.tagName === 'DIV') {
            el.textContent = ''; document.execCommand('insertText', false, ${safe});
          } else { el.value = ${safe}; }
          el.dispatchEvent(new Event('input', {bubbles:true}));
          el.dispatchEvent(new Event('change', {bubbles:true}));
          setTimeout(() => {
            const ev = new KeyboardEvent('keydown', {key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true});
            el.dispatchEvent(ev);
            const sendBtns = document.querySelectorAll('button[data-testid="send-button"],button[type="submit"],button:has(svg)');
            for (const b of sendBtns) { if (b.offsetParent !== null) { b.click(); break; } }
          }, 600);
          return 'ok';
        }
        return 'not_found';
      })();
    `;
    for (const [, entry] of this.frames) {
      try { entry.webview.executeJavaScript(js).catch(() => {}); } catch {}
    }
  },

  _sizeAll() {
    const container = document.getElementById('grid-container');
    if (!container) return;
    const total = this.frames.size;
    if (total === 0) return;

    const viewport = document.getElementById('viewport');
    if (!viewport) return;
    const vpW = viewport.clientWidth - 8;
    const vpH = viewport.clientHeight - 8;
    const zoom = 1 + this._zoom * 0.15;

    // Grid: 2 cols for <5, 3 cols for 5-9, 4 cols for 10+
    const cols = total <= 4 ? 2 : total <= 9 ? 3 : 4;
    const gap = 4;
    const totalGapW = (cols - 1) * gap;
    const cellW = Math.floor((vpW - totalGapW) / cols);
    const rows = Math.ceil(total / cols);
    const toolbarH = 34;
    const totalGapH = (rows - 1) * gap;
    const cellH = Math.floor((vpH - totalGapH) / rows);

    // Each frame: width = cellW, height = toolbarH + cellH
    const fw = Math.floor(cellW * zoom);
    const fh = Math.floor((toolbarH + cellH) * zoom);

    let idx = 0;
    for (const [, entry] of this.frames) {
      entry.frame.style.width = fw + 'px';
      entry.frame.style.height = fh + 'px';
      idx++;
    }

    // Update number badges
    idx = 0;
    for (const [id, entry] of this.frames) {
      const badge = entry.frame.querySelector('.num-badge');
      if (badge) badge.textContent = (idx + 1);
      idx++;
    }

    Sidebar.renderStats();
  },

  _renderZoomLabel() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = `${100 + this._zoom * 15}%`;
  },

  _setupZoomButtons() {
    document.getElementById('zoom-in')?.addEventListener('click', async () => {
      this._zoom = Math.min(5, this._zoom + 1);
      await teamai.setZoom(this._zoom);
      this._renderZoomLabel();
      this._sizeAll();
    });
    document.getElementById('zoom-out')?.addEventListener('click', async () => {
      this._zoom = Math.max(-3, this._zoom - 1);
      await teamai.setZoom(this._zoom);
      this._renderZoomLabel();
      this._sizeAll();
    });
    document.getElementById('zoom-reset')?.addEventListener('click', async () => {
      this._zoom = 0;
      await teamai.setZoom(0);
      this._renderZoomLabel();
      this._sizeAll();
    });
  },

  // Public API
  addView(pid) { this._createWebView(pid); },
  getFrames() { return this.frames; },
  get count() { return this.frames.size; },
  get list() {
    return Array.from(this.frames.entries()).map(([id, e]) => ({
      id, providerId: e.providerId, url: e.webview?.src || '',
      combo: e.combo?.options[e.combo.selectedIndex]?.text || e.providerId,
    }));
  },
};
