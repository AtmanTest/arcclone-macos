/**
 * DispatchProgress — barre de progression multi-IA
 */

const DP_LOGOS = {
  raisonnement: { svg: '<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/1024px-ChatGPT_logo.svg.png" alt="ChatGPT">', color: '#10a37f' },
  gemini:       { svg: '<img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" alt="Gemini">', color: '#4285F4' },
  claude:       { svg: '<img src="https://claude.ai/favicon.ico" alt="Claude">', color: '#D97757' },
  grok:         { svg: '<img src="https://grok.com/favicon.ico" alt="Grok">', color: '#1DA1F2' },
  kimi:         { svg: '<img src="https://www.moonshot.cn/favicon.ico" alt="Kimi">', color: '#EC4899' },
  zglm:         { svg: '<img src="https://chatglm.cn/favicon.ico" alt="GLM">', color: '#06B6D4' },
  copilot:      { svg: '<img src="https://www.microsoft.com/favicon.ico" alt="Copilot">', color: '#0078D4' },
  perplexity:   { svg: '<img src="https://www.perplexity.ai/favicon.ico" alt="Perplexity">', color: '#20B2AA' },
  mistral:      { svg: '<img src="https://chat.mistral.ai/favicon.ico" alt="Mistral">', color: '#FF6B35' },
  deepseek:     { svg: '<img src="https://chat.deepseek.com/favicon.ico" alt="DeepSeek">', color: '#00CED1' },
  meta:         { svg: '<img src="https://meta.ai/favicon.ico" alt="Meta">', color: '#0866FF' },
  qwen:         { svg: '<img src="https://qwenlm.ai/favicon.ico" alt="Qwen">', color: '#FF4500' },
  huggingchat:  { svg: '<img src="https://huggingface.co/favicon.ico" alt="HuggingChat">', color: '#FF9D00' },
  phind:        { svg: '<img src="https://www.phind.com/favicon.ico" alt="Phind">', color: '#6366F1' },
  you:          { svg: '<img src="https://you.com/favicon.ico" alt="You">', color: '#00D4AA' },
  poe:          { svg: '<img src="https://poe.com/favicon.ico" alt="Poe">', color: '#8B5CF6' },
  groq:         { svg: '<img src="https://groq.com/favicon.ico" alt="Groq">', color: '#F97316' },
  cohere:       { svg: '<img src="https://coral.cohere.com/favicon.ico" alt="Cohere">', color: '#39D353' },
  pi:           { svg: '<img src="https://pi.ai/favicon.ico" alt="Pi">', color: '#E91E8C' },
  venice:       { svg: '<img src="https://venice.ai/favicon.ico" alt="Venice">', color: '#A855F7' },
  nemotron:     { svg: '<img src="https://build.nvidia.com/favicon.ico" alt="Nemotron">', color: '#F59E0B' },
  openrouter:   { svg: '<img src="https://openrouter.ai/favicon.ico" alt="OpenRouter">', color: '#6366F1' },
  lmsys:        { svg: '<img src="https://chat.lmsys.org/favicon.ico" alt="LMSYS">', color: '#EF4444' },
  together:     { svg: '<img src="https://api.together.ai/favicon.ico" alt="Together">', color: '#FF6B6B' },
  default:      { svg: '<span>\ud83e\udd16</span>', color: '#555' },
};

const DispatchProgress = {
  _container: null,
  _entries: [],
  _states: {},
  _timer: null,

  start(entries) {
    this._entries = entries;
    this._states = {};
    for (const e of entries) this._states[e.id] = 'idle';
    this._render();
  },

  tick(id, status) {
    if (!this._states.hasOwnProperty(id)) return;
    this._states[id] = status;
    this._update(id);
  },

  finish() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.dismiss(), 4000);
  },

  dismiss() {
    if (!this._container) return;
    this._container.classList.add('dp-exit');
    setTimeout(() => {
      if (this._container) { this._container.remove(); this._container = null; }
    }, 400);
  },

  _render() {
    if (this._container) { this._container.remove(); this._container = null; }

    const bar = document.createElement('div');
    bar.className = 'dp-bar';
    bar.id = 'dispatch-progress-bar';

    const label = document.createElement('span');
    label.className = 'dp-label';
    label.textContent = 'Dispatch';
    bar.appendChild(label);

    const track = document.createElement('div');
    track.className = 'dp-track';

    for (const e of this._entries) {
      const info = DP_LOGOS[e.providerId] || DP_LOGOS.default;
      const item = document.createElement('div');
      item.className = 'dp-item dp-idle';
      item.dataset.id = e.id;
      item.title = e.label;

      const logo = document.createElement('div');
      logo.className = 'dp-logo';
      logo.innerHTML = info.svg;
      const img = logo.querySelector('img');
      if (img) img.onerror = () => { logo.innerHTML = `<span>${e.icon || '\ud83e\udd16'}</span>`; };

      const statusIcon = document.createElement('div');
      statusIcon.className = 'dp-status';
      statusIcon.innerHTML = '<span class="dp-dot"></span>';

      item.appendChild(logo);
      item.appendChild(statusIcon);
      track.appendChild(item);
    }

    const dismiss = document.createElement('button');
    dismiss.className = 'dp-dismiss';
    dismiss.innerHTML = '\u2715';
    dismiss.title = 'Fermer';
    dismiss.onclick = () => this.dismiss();

    bar.appendChild(track);
    bar.appendChild(dismiss);

    const promptBar = document.getElementById('prompt-bar');
    if (promptBar && promptBar.parentNode) {
      promptBar.parentNode.insertBefore(bar, promptBar.nextSibling);
    } else {
      document.body.appendChild(bar);
    }

    this._container = bar;
    requestAnimationFrame(() => bar.classList.add('dp-visible'));
  },

  _update(id) {
    if (!this._container) return;
    const item = this._container.querySelector(`.dp-item[data-id="${id}"]`);
    if (!item) return;
    const status = this._states[id];
    item.className = `dp-item dp-${status}`;
    const si = item.querySelector('.dp-status');
    if (!si) return;
    if (status === 'idle')    si.innerHTML = '<span class="dp-dot"></span>';
    if (status === 'loading') si.innerHTML = '<span class="dp-spinner"></span>';
    if (status === 'ok')      si.innerHTML = '<span class="dp-check">\u2713</span>';
    if (status === 'error')   si.innerHTML = '<span class="dp-cross">\u2717</span>';
  },
};
