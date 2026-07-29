/**
 * TeamAI v18 — Window Manager
 * 25 providers — fingerprints complets
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
      // Par défaut: afficher 6 premiers providers
      for (const p of this.providers.slice(0, 6)) this._createView(p.id);
    }

    this._applyLayout();
    PersistenceManager.restore();
    PresetLayouts.init();
    this._initDone = true;
  },

  addView(providerId, url) {
    this._createView(providerId, url);
    this._applyLayout();
    if (typeof Sidebar !== 'undefined') Sidebar.renderAll();
  },

  _createView(providerId, initialUrl) {
    const urlOverrides = { zglm: 'https://chatglm.cn/?lang=en' };
    const prov = this.providers.find(p => p.id === providerId)
      || { id: providerId, label: providerId, url: urlOverrides[providerId] || 'about:blank', icon: '\ud83c\udf10' };

    const colors = {
      raisonnement: '#7C3AED', gemini: '#4285F4', claude: '#D97757',
      grok: '#1DA1F2', kimi: '#EC4899', zglm: '#06B6D4',
      copilot: '#0078D4', perplexity: '#20B2AA', mistral: '#FF6B35',
      deepseek: '#00CED1', meta: '#0866FF', qwen: '#FF4500',
      huggingchat: '#FF9D00', phind: '#6366F1', you: '#00D4AA',
      poe: '#8B5CF6', groq: '#F97316', cohere: '#39D353',
      pi: '#E91E8C', venice: '#A855F7', nemotron: '#F59E0B',
      aisdk: '#000000', together: '#FF6B6B', openrouter: '#6366F1', lmsys: '#EF4444',
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
      if (e.errorCode !== -3) ErrorBar.show(`❌ ${prov.label}: ${e.errorDescription || 'Erreur de chargement'}`);
    });
    webview.addEventListener('crashed', () => ErrorBar.show(`💥 ${prov.label}: WebView a crashé`));
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
    entry.combo?.addEventListener('change', () => {
      const newProvId = entry.combo.value;
      const wv = frame.querySelector('webview');
      const prov = this.providers.find(p => p.id === newProvId);
      const newUrl = prov?.url || 'about:blank';
      if (wv) { wv.src = newUrl; wv.setAttribute('partition', `persist:teamai_${newProvId}`); }
      const view = LayoutModel.views.find(v => v.id === id);
      if (view) { view.providerId = newProvId; view.label = prov?.label || newProvId; view.url = newUrl; }
      entry.urlBar.value = newUrl;
    });
    frame.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wv = frame.querySelector('webview');
        if (!wv) return;
        if (btn.dataset.action === 'back') { try { wv.goBack(); } catch {} }
        else if (btn.dataset.action === 'forward') { try { wv.goForward(); } catch {} }
        else if (btn.dataset.action === 'reload') { try { wv.reload(); } catch {} }
        else if (btn.dataset.action === 'bookmark') {
          Bookmarks.add(id, entry.combo?.options[entry.combo.selectedIndex]?.text || 'IA', wv.getURL()).then(() => Bookmarks.render());
        } else if (btn.dataset.action === 'focus') {
          if (frame.classList.contains('focused')) {
            frame.classList.remove('focused');
            frame.style.position = ''; frame.style.width = ''; frame.style.height = '';
            frame.style.top = ''; frame.style.left = ''; frame.style.zIndex = '';
            this._applyLayout();
          } else {
            frame.classList.add('focused');
            frame.style.cssText += ';position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:100;';
          }
        }
      });
    });
    entry.urlBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        let val = entry.urlBar.value.trim(); if (!val) return;
        const wv = frame.querySelector('webview'); if (!wv) return;
        if (!val.match(/^https?:\/\//) && !val.match(/^[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i))
          val = 'https://www.google.com/search?q=' + encodeURIComponent(val);
        else if (!val.startsWith('http')) val = 'https://' + val;
        wv.src = val;
      }
    });
    frame.querySelector('.close-btn').addEventListener('click', (e) => { e.stopPropagation(); this._remove(id); });
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
      if (LayoutModel.mode === 'cards' || LayoutModel.mode === 'focus') {
        LayoutModel.setActiveCard(idx); this._syncFrames();
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
    if (typeof Sidebar !== 'undefined') Sidebar.renderAll();
  },

  _resetLayout() {
    for (const [, e] of this.frames) {
      e.frame.classList.remove('resized', 'focused');
      e.frame.style.cssText = '';
      const wv = e.frame.querySelector('webview');
      if (wv) wv.style.opacity = '1';
    }
    LayoutModel.setMode('grid');
    this._applyLayout();
  },

  _applyLayout() {
    const viewport = document.getElementById('viewport');
    if (viewport) LayoutModel.init(viewport.clientWidth, viewport.clientHeight);
    this._syncFrames();
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
      const overlay = entry.frame.querySelector('.card-overlay');
      const wvArea = entry.frame.querySelector('.webview-area') || entry.frame.querySelector('webview');
      if (LayoutModel.mode === 'cards' || LayoutModel.mode === 'focus') {
        const idx = Array.from(this.frames.keys()).indexOf(id);
        const isActive = idx === LayoutModel._activeCard;
        if (overlay) overlay.style.display = isActive ? 'none' : 'block';
        entry.frame.style.border = isActive ? '2px solid rgba(255,255,255,0.8)' : '1px solid var(--border)';
        if (wvArea) wvArea.style.opacity = isActive ? '1' : '0.6';
      } else {
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
    const PROVIDERS = {
      // ChatGPT
      'chatgpt.com':            { input: '[contenteditable][data-id], [contenteditable="true"]', send: '[data-testid="send-button"]' },
      // Gemini
      'gemini.google.com':      { input: '[contenteditable][role="textbox"]', send: 'button[aria-label*="Send" i], button[aria-label*="Envoyer" i]' },
      // Claude
      'claude.ai':              { input: '[contenteditable][data-placeholder], [contenteditable="true"]', send: 'button[aria-label*="Send" i], button[data-value="send"]' },
      // GLM
      'chatglm.cn':             { input: '[contenteditable]', send: null, useEnter: true },
      // Kimi (dual hostname)
      'kimi.ai':                { input: '.chat-input [contenteditable], #chat-input [contenteditable], [contenteditable]', send: null, useEnter: true },
      'kimi.com':               { input: '.chat-input [contenteditable], #chat-input [contenteditable], [contenteditable]', send: null, useEnter: true },
      // Grok
      'grok.com':               { input: '[contenteditable="true"], [contenteditable=""], div[contenteditable]', send: 'button[aria-label="Send message"], button[aria-label="Envoyer"], button[data-testid="send-button"]' },
      // Nvidia
      'build.nvidia.com':       { input: 'textarea', send: 'button[type="submit"], button[aria-label*="Send" i]' },
      // Venice
      'venice.ai':              { input: 'textarea', send: 'button[type="submit"]' },
      // Copilot
      'copilot.microsoft.com':  { input: 'textarea, [contenteditable]', send: 'button[aria-label*="Send" i], button[aria-label*="Submit" i], button[type="submit"]' },
      // Perplexity
      'perplexity.ai':          { input: 'textarea', send: 'button[aria-label*="Submit" i], button[type="submit"]' },
      // Mistral Le Chat
      'chat.mistral.ai':        { input: 'textarea, [contenteditable]', send: 'button[type="submit"], button[aria-label*="Send" i]' },
      // DeepSeek
      'chat.deepseek.com':      { input: 'textarea, [contenteditable]', send: 'button[type="submit"], [aria-label*="Send" i]', useEnter: false },
      // Meta AI
      'meta.ai':                { input: '[contenteditable], textarea', send: 'button[aria-label*="Send" i], button[type="submit"]' },
      // Qwen
      'qwenlm.ai':              { input: 'textarea, [contenteditable]', send: 'button[type="submit"], button[aria-label*="Send" i]' },
      // HuggingChat
      'huggingface.co':         { input: 'textarea', send: 'button[type="submit"], button[aria-label*="Send" i]' },
      // Phind
      'phind.com':              { input: 'textarea', send: 'button[type="submit"], button[aria-label*="Search" i]' },
      // You.com
      'you.com':                { input: 'textarea, [contenteditable]', send: 'button[type="submit"], button[aria-label*="Send" i]' },
      // Poe
      'poe.com':                { input: 'textarea', send: 'button[data-button-id="send"], button[type="submit"]' },
      // Groq
      'groq.com':               { input: 'textarea, [contenteditable]', send: 'button[type="submit"], button[aria-label*="Send" i]' },
      // Cohere Coral
      'coral.cohere.com':       { input: 'textarea', send: 'button[type="submit"], button[aria-label*="Send" i]' },
      // Pi AI
      'pi.ai':                  { input: 'textarea, [contenteditable]', send: null, useEnter: true },
      // OpenRouter
      'openrouter.ai':          { input: 'textarea, [contenteditable]', send: 'button[type="submit"], button[aria-label*="Send" i]' },
      // LMSYS Arena
      'chat.lmsys.org':         { input: 'textarea', send: 'button[id*="send"], button[type="submit"]' },
      // Together AI
      'api.together.ai':        { input: 'textarea', send: 'button[type="submit"], button[aria-label*="Send" i]' },
    };

    const escapedText = JSON.stringify(text);

    const injectJS = `(function(){
      var h = location.hostname.replace(/^www\./, '');
      var FP = ${JSON.stringify(PROVIDERS)};
      var fpKey = Object.keys(FP).find(function(k){ return h.endsWith(k); });
      var cfg = fpKey ? FP[fpKey] : {};
      var BLACKLIST = /attach|joindre|model|micro|image|file|photo|clip|gear|param|setting|voice|mic|audio|dict/i;

      var ed = null;
      if (cfg.input) {
        var sels = cfg.input.split(',').map(function(s){ return s.trim(); });
        for (var si = 0; si < sels.length; si++) {
          ed = document.querySelector(sels[si]);
          if (ed) break;
        }
      }
      if (!ed) ed = document.querySelector('[contenteditable="true"],[contenteditable=""]');
      if (!ed) ed = document.querySelector('textarea, input[type="text"]');
      if (!ed) return 'NO_INPUT';

      ed.focus();

      if (ed.isContentEditable) {
        ed.innerHTML = '';
        ed.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        var inserted = document.execCommand('insertText', false, ${escapedText});
        if (!inserted || !ed.textContent.trim()) {
          ed.innerHTML = '';
          var span = document.createElement('span');
          span.textContent = ${escapedText};
          ed.appendChild(span);
          var range = document.createRange();
          var sel = window.getSelection();
          range.selectNodeContents(ed);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        ed.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: ${escapedText} }));
        ed.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        var proto = ed.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        var nv = Object.getOwnPropertyDescriptor(proto, 'value');
        if (nv && nv.set) nv.set.call(ed, ${escapedText});
        else ed.value = ${escapedText};
        ed.dispatchEvent(new Event('input', { bubbles: true }));
        ed.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (cfg.useEnter) {
        setTimeout(function() {
          ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          ed.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          ed.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        }, 300);
        return 'ENTER_DISPATCHED';
      }

      function findSendBtn() {
        if (cfg.send) {
          var ss = cfg.send.split(',').map(function(s){ return s.trim(); });
          for (var i = 0; i < ss.length; i++) {
            try {
              var b = document.querySelector(ss[i]);
              if (b && !b.disabled && b.offsetParent !== null && !BLACKLIST.test(b.getAttribute('aria-label') || b.className || '')) return b;
            } catch(e) {}
          }
        }
        var allBtns = Array.prototype.slice.call(document.querySelectorAll('button[aria-label]'));
        for (var j = 0; j < allBtns.length; j++) {
          var lbl = allBtns[j].getAttribute('aria-label').toLowerCase();
          if ((lbl.indexOf('send') !== -1 || lbl.indexOf('envoyer') !== -1 || lbl.indexOf('submit') !== -1)
              && !BLACKLIST.test(lbl)
              && !allBtns[j].disabled && allBtns[j].offsetParent !== null) return allBtns[j];
        }
        var node = ed.parentElement;
        for (var d = 0; d < 8 && node; d++, node = node.parentElement) {
          var sub = node.querySelector('button[type="submit"]');
          if (sub && !sub.disabled && sub.offsetParent !== null && !BLACKLIST.test(sub.getAttribute('aria-label') || sub.className || '')) return sub;
          var svgBtns = Array.prototype.slice.call(node.querySelectorAll('button')).filter(function(b){
            return b.querySelector('svg') && !b.disabled && b.offsetParent !== null && !BLACKLIST.test(b.getAttribute('aria-label') || b.className || '');
          });
          if (svgBtns.length === 1) return svgBtns[0];
          if (svgBtns.length > 1) {
            var scored = svgBtns.find(function(b){
              var l = (b.getAttribute('aria-label') || '').toLowerCase();
              return l.indexOf('send') !== -1 || l.indexOf('envoyer') !== -1 || l.indexOf('submit') !== -1;
            });
            if (scored) return scored;
            var clean = svgBtns.filter(function(b){ return !BLACKLIST.test(b.getAttribute('aria-label') || b.className || ''); });
            if (clean.length >= 1) return clean[clean.length - 1];
          }
        }
        return null;
      }

      var attempts = 0;
      function poll() {
        var form = ed.closest('form');
        if (form) { try { form.requestSubmit(); return; } catch(e) {} }
        var btn = findSendBtn();
        if (btn) { btn.click(); return; }
        if (++attempts < 15) setTimeout(poll, 200);
      }
      setTimeout(poll, 400);
      return 'INJECTED';
    })();`;

    this.frames.forEach((entry) => {
      const wv = entry.frame.querySelector('webview');
      if (!wv) return;
      wv.executeJavaScript(injectJS)
        .then(r => console.log('[DISPATCH ' + entry.id + ']', r))
        .catch(e => console.error('[DISPATCH ' + entry.id + ']', e.message));
    });
  },
};
