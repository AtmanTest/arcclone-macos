/**
 * TeamAI — Dispatch Progress Bar
 * Affiche l'état de chaque IA lors d'un SEARCH ALL
 * États : pending (🔄) → ok (✅) → error (❌)
 */
const DispatchProgress = {
  _bar: null,
  _chips: {},
  _total: 0,
  _done: 0,

  // Shortlabels pour garder les chips courts
  _shortLabel(label) {
    const MAP = {
      'ChatGPT': 'GPT', 'Gemini': 'Gem', 'Claude': 'Cla', 'Mistral': 'Mis',
      'DeepSeek': 'DS', 'Perplexity': 'Pplx', 'Copilot': 'Cop', 'Grok': 'Grk',
      'HuggingChat': 'HF', 'Phind': 'Phn', 'Venice': 'Ven', 'Nvidia': 'Nvd',
      'Meta AI': 'Meta', 'Qwen': 'Qwn', 'You.com': 'You', 'Poe': 'Poe',
      'Groq': 'Groq', 'Cohere': 'Coh', 'Pi AI': 'Pi', 'OpenRouter': 'OR',
      'Together': 'Tgt', 'LMSYS': 'LMS', 'GLM': 'GLM', 'Kimi': 'Kimi',
    };
    for (const [k, v] of Object.entries(MAP)) {
      if (label.includes(k)) return v;
    }
    return label.slice(0, 4);
  },

  /**
   * Initialise et affiche la barre avec tous les providers en état pending
   * @param {Array} providers - liste des providers actifs [{id, label}]
   */
  start(providers) {
    this._chips = {};
    this._total = providers.length;
    this._done = 0;

    const bar = document.getElementById('dispatch-progress');
    if (!bar) return;
    this._bar = bar;

    bar.innerHTML = providers.map(p => {
      const short = this._shortLabel(p.label || p.id);
      return `<span class="dp-chip dp-pending" data-id="${p.id}" title="${p.label || p.id}">🔄 ${short}</span>`;
    }).join('');

    // Mémoriser refs
    providers.forEach(p => {
      this._chips[p.id] = bar.querySelector(`[data-id="${p.id}"]`);
    });

    bar.classList.add('active');
  },

  /**
   * Marque un provider comme OK
   */
  setOk(providerId) {
    const chip = this._chips[providerId];
    if (!chip) return;
    const short = chip.textContent.replace(/^[🔄✅❌]\s*/, '');
    chip.className = 'dp-chip dp-ok';
    chip.textContent = `✅ ${short}`;
    this._checkDone();
  },

  /**
   * Marque un provider comme en erreur
   */
  setError(providerId) {
    const chip = this._chips[providerId];
    if (!chip) return;
    const short = chip.textContent.replace(/^[🔄✅❌]\s*/, '');
    chip.className = 'dp-chip dp-error';
    chip.textContent = `❌ ${short}`;
    this._checkDone();
  },

  _checkDone() {
    this._done++;
    if (this._done >= this._total) {
      setTimeout(() => {
        if (this._bar) this._bar.classList.remove('active');
      }, 3000);
    }
  },

  reset() {
    if (this._bar) {
      this._bar.innerHTML = '';
      this._bar.classList.remove('active');
    }
    this._chips = {};
    this._done = 0;
    this._total = 0;
  },
};
