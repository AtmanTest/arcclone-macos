/**
 * TeamAI — Dispatch Progress Bar
 * Affiche le statut de chaque IA en série pendant un Search All.
 * API publique :
 *   DispatchProgress.start(entries)   → entries = [{id, label, icon, color}]
 *   DispatchProgress.tick(id, status) → status: 'pending'|'loading'|'ok'|'error'
 *   DispatchProgress.finish()
 */
const DispatchProgress = (() => {
  // ── Logo SVG/img par provider ──────────────────────────────────────────
  const LOGOS = {
    // ChatGPT / OpenAI
    chatgpt:    { type:'svg', src:'<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.28 9.94a5.82 5.82 0 0 0-.5-4.79 5.9 5.9 0 0 0-6.35-2.83A5.86 5.86 0 0 0 11 .5a5.9 5.9 0 0 0-5.62 4.09 5.87 5.87 0 0 0-3.92 2.84 5.9 5.9 0 0 0 .73 6.92 5.82 5.82 0 0 0 .5 4.8 5.9 5.9 0 0 0 6.35 2.82A5.86 5.86 0 0 0 13 23.5a5.9 5.9 0 0 0 5.63-4.1 5.87 5.87 0 0 0 3.91-2.83 5.9 5.9 0 0 0-.72-6.93l-.54.3.54-.3ZM13 21.88a4.38 4.38 0 0 1-2.81-1.02l.14-.08 4.66-2.69a.77.77 0 0 0 .39-.67v-6.57l1.97 1.14a.07.07 0 0 1 .04.05v5.44A4.4 4.4 0 0 1 13 21.88ZM3.55 17.86a4.37 4.37 0 0 1-.52-2.95l.14.08 4.66 2.69a.77.77 0 0 0 .77 0l5.69-3.29v2.27a.07.07 0 0 1-.03.06l-4.71 2.72a4.4 4.4 0 0 1-6-.58Zm-1.22-9.6A4.38 4.38 0 0 1 4.62 6.1v5.5a.77.77 0 0 0 .39.67l5.69 3.28-1.97 1.14a.07.07 0 0 1-.07 0L3.94 13.9a4.4 4.4 0 0 1-1.6-5.64ZM19.04 13l-5.69-3.29 1.97-1.13a.07.07 0 0 1 .07 0l4.71 2.72a4.39 4.39 0 0 1-.68 7.93v-5.5a.77.77 0 0 0-.38-.73Zm1.96-2.96-.14-.08-4.66-2.68a.77.77 0 0 0-.77 0L9.74 10.57V8.3a.07.07 0 0 1 .03-.06L14.48 5.5a4.4 4.4 0 0 1 6.52 4.54ZM8.75 12.94 6.78 11.8a.07.07 0 0 1-.04-.06V6.3a4.39 4.39 0 0 1 7.2-3.37l-.14.08-4.66 2.69a.77.77 0 0 0-.39.67v6.57Zm1.07-2.3 2.53-1.46 2.53 1.46v2.92l-2.53 1.46-2.53-1.46v-2.92Z" fill="currentColor"/></svg>' },
    raisonnement: { type:'svg', src:'<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.28 9.94a5.82 5.82 0 0 0-.5-4.79 5.9 5.9 0 0 0-6.35-2.83A5.86 5.86 0 0 0 11 .5a5.9 5.9 0 0 0-5.62 4.09 5.87 5.87 0 0 0-3.92 2.84 5.9 5.9 0 0 0 .73 6.92 5.82 5.82 0 0 0 .5 4.8 5.9 5.9 0 0 0 6.35 2.82A5.86 5.86 0 0 0 13 23.5a5.9 5.9 0 0 0 5.63-4.1 5.87 5.87 0 0 0 3.91-2.83 5.9 5.9 0 0 0-.72-6.93l-.54.3.54-.3ZM13 21.88a4.38 4.38 0 0 1-2.81-1.02l.14-.08 4.66-2.69a.77.77 0 0 0 .39-.67v-6.57l1.97 1.14a.07.07 0 0 1 .04.05v5.44A4.4 4.4 0 0 1 13 21.88ZM3.55 17.86a4.37 4.37 0 0 1-.52-2.95l.14.08 4.66 2.69a.77.77 0 0 0 .77 0l5.69-3.29v2.27a.07.07 0 0 1-.03.06l-4.71 2.72a4.4 4.4 0 0 1-6-.58Zm-1.22-9.6A4.38 4.38 0 0 1 4.62 6.1v5.5a.77.77 0 0 0 .39.67l5.69 3.28-1.97 1.14a.07.07 0 0 1-.07 0L3.94 13.9a4.4 4.4 0 0 1-1.6-5.64ZM19.04 13l-5.69-3.29 1.97-1.13a.07.07 0 0 1 .07 0l4.71 2.72a4.39 4.39 0 0 1-.68 7.93v-5.5a.77.77 0 0 0-.38-.73Zm1.96-2.96-.14-.08-4.66-2.68a.77.77 0 0 0-.77 0L9.74 10.57V8.3a.07.07 0 0 1 .03-.06L14.48 5.5a4.4 4.4 0 0 1 6.52 4.54ZM8.75 12.94 6.78 11.8a.07.07 0 0 1-.04-.06V6.3a4.39 4.39 0 0 1 7.2-3.37l-.14.08-4.66 2.69a.77.77 0 0 0-.39.67v6.57Zm1.07-2.3 2.53-1.46 2.53 1.46v2.92l-2.53 1.46-2.53-1.46v-2.92Z" fill="currentColor"/></svg>' },
    // Gemini
    gemini:     { type:'svg', src:'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#4285F4"/><path d="M12 24C5.373 24 0 18.627 0 12S5.373 0 12 0s12 5.373 12 12-5.373 12-12 12zm0-1.5c5.799 0 10.5-4.701 10.5-10.5S17.799 1.5 12 1.5 1.5 6.201 1.5 12 6.201 22.5 12 22.5z" fill="#4285F4" opacity=".2"/></svg>' },
    // Claude
    claude:     { type:'img', src:'https://cdn.simpleicons.org/anthropic/D97757' },
    // Grok
    grok:       { type:'img', src:'https://cdn.simpleicons.org/x/ffffff' },
    // Kimi
    kimi:       { type:'emoji', src:'🌙' },
    // ChatGLM
    zglm:       { type:'emoji', src:'🔷' },
    // Copilot
    copilot:    { type:'img', src:'https://cdn.simpleicons.org/microsoftcopilot/0078D4' },
    // Perplexity
    perplexity: { type:'img', src:'https://cdn.simpleicons.org/perplexity/20B2AA' },
    // Mistral
    mistral:    { type:'img', src:'https://cdn.simpleicons.org/mistral/FF6B35' },
    // DeepSeek
    deepseek:   { type:'emoji', src:'🔵' },
    // Meta
    meta:       { type:'img', src:'https://cdn.simpleicons.org/meta/0866FF' },
    // Qwen
    qwen:       { type:'emoji', src:'☁️' },
    // HuggingChat
    huggingchat:{ type:'img', src:'https://cdn.simpleicons.org/huggingface/FF9D00' },
    // Phind
    phind:      { type:'emoji', src:'🔍' },
    // You.com
    you:        { type:'emoji', src:'🅨' },
    // Poe
    poe:        { type:'img', src:'https://cdn.simpleicons.org/quora/8B5CF6' },
    // Groq
    groq:       { type:'emoji', src:'⚡' },
    // Cohere
    cohere:     { type:'img', src:'https://cdn.simpleicons.org/cohere/39D353' },
    // Pi
    pi:         { type:'emoji', src:'π' },
    // Venice
    venice:     { type:'emoji', src:'🎭' },
    // Nvidia Nemotron
    nemotron:   { type:'img', src:'https://cdn.simpleicons.org/nvidia/76B900' },
    // OpenRouter
    openrouter: { type:'emoji', src:'🔀' },
    // Together
    together:   { type:'emoji', src:'🤝' },
    // LMSYS
    lmsys:      { type:'emoji', src:'🏟' },
  };

  // ── Status icons ────────────────────────────────────────────────────────
  const STATUS_ICON = {
    pending: '<span class="dp-status-dot dp-pending"></span>',
    loading: '<span class="dp-spinner"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="30" stroke-dashoffset="10"/></svg></span>',
    ok:      '<span class="dp-status-icon dp-ok">✓</span>',
    error:   '<span class="dp-status-icon dp-err">✗</span>',
  };

  let _entries = [];
  let _bar = null;
  let _chips = {};
  let _hideTimer = null;

  function _logoHTML(id) {
    const l = LOGOS[id];
    if (!l) return `<span class="dp-emoji">${'🤖'}</span>`;
    if (l.type === 'svg')   return `<span class="dp-logo-svg">${l.src}</span>`;
    if (l.type === 'img')   return `<img class="dp-logo-img" src="${l.src}" alt="" loading="lazy" onerror="this.style.display='none'"/>`;
    if (l.type === 'emoji') return `<span class="dp-emoji">${l.src}</span>`;
    return '';
  }

  function _getOrCreateBar() {
    let bar = document.getElementById('dp-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'dp-bar';
      bar.innerHTML = `
        <div class="dp-track">
          <div class="dp-fill" id="dp-fill"></div>
        </div>
        <div class="dp-chips" id="dp-chips"></div>
      `;
      // Insérer juste sous le prompt-bar
      const pb = document.getElementById('prompt-bar');
      if (pb && pb.parentNode) pb.parentNode.insertBefore(bar, pb.nextSibling);
      else document.getElementById('main')?.prepend(bar);
    }
    return bar;
  }

  function _render() {
    const chipsEl = document.getElementById('dp-chips');
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    _chips = {};
    _entries.forEach(e => {
      const chip = document.createElement('div');
      chip.className = 'dp-chip dp-chip--pending';
      chip.dataset.id = e.id;
      chip.title = e.label;
      chip.innerHTML = `
        <span class="dp-chip-logo">${_logoHTML(e.id)}</span>
        <span class="dp-chip-status" id="dp-s-${e.id}">${STATUS_ICON.pending}</span>
      `;
      chipsEl.appendChild(chip);
      _chips[e.id] = chip;
    });
    _updateFill();
  }

  function _updateFill() {
    const fill = document.getElementById('dp-fill');
    if (!fill || !_entries.length) return;
    const done = _entries.filter(e => e._status === 'ok' || e._status === 'error').length;
    const pct = Math.round((done / _entries.length) * 100);
    fill.style.width = pct + '%';
    fill.style.background = pct === 100
      ? 'linear-gradient(90deg, #4ADE80, #06B6D4)'
      : 'linear-gradient(90deg, #7C3AED, #06B6D4)';
  }

  // ── API publique ─────────────────────────────────────────────────────────
  return {
    start(entries) {
      clearTimeout(_hideTimer);
      _entries = entries.map(e => ({ ...e, _status: 'pending' }));
      _bar = _getOrCreateBar();
      _bar.classList.remove('dp-hidden');
      _bar.classList.add('dp-visible');
      _render();
    },

    tick(id, status /* 'loading'|'ok'|'error' */) {
      const entry = _entries.find(e => e.id === id);
      if (!entry) return;
      entry._status = status;
      const chip = _chips[id];
      if (!chip) return;
      chip.className = `dp-chip dp-chip--${status}`;
      const statusEl = document.getElementById(`dp-s-${id}`);
      if (statusEl) statusEl.innerHTML = STATUS_ICON[status] || STATUS_ICON.pending;
      _updateFill();
    },

    finish() {
      _hideTimer = setTimeout(() => {
        _bar && _bar.classList.remove('dp-visible');
        _bar && _bar.classList.add('dp-hidden');
      }, 2800);
    },
  };
})();
