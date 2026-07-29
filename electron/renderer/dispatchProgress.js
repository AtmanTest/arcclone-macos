/**
 * DispatchProgress v2 — barre de progression multi-IA
 * Intégrée dans le prompt-bar (pas étrangère à la zone de saisie)
 * Pas de dismiss automatique — reste visible jusqu'à fermeture manuelle ou nouveau dispatch
 * Option visible dans les Réglages : teamai_dispatch_bar_enabled
 */

const DP_LOGOS = {
  raisonnement: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/1024px-ChatGPT_logo.svg.png', color: '#10a37f' },
  gemini:       { url: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',                   color: '#4285F4' },
  claude:       { url: 'https://claude.ai/favicon.ico',           color: '#D97757' },
  grok:         { url: 'https://grok.com/favicon.ico',            color: '#1DA1F2' },
  kimi:         { url: 'https://www.moonshot.cn/favicon.ico',     color: '#EC4899' },
  zglm:         { url: 'https://chatglm.cn/favicon.ico',          color: '#06B6D4' },
  copilot:      { url: 'https://www.microsoft.com/favicon.ico',   color: '#0078D4' },
  perplexity:   { url: 'https://www.perplexity.ai/favicon.ico',   color: '#20B2AA' },
  mistral:      { url: 'https://chat.mistral.ai/favicon.ico',     color: '#FF6B35' },
  deepseek:     { url: 'https://chat.deepseek.com/favicon.ico',   color: '#00CED1' },
  meta:         { url: 'https://meta.ai/favicon.ico',             color: '#0866FF' },
  qwen:         { url: 'https://qwenlm.ai/favicon.ico',           color: '#FF4500' },
  huggingchat:  { url: 'https://huggingface.co/favicon.ico',      color: '#FF9D00' },
  phind:        { url: 'https://www.phind.com/favicon.ico',       color: '#6366F1' },
  you:          { url: 'https://you.com/favicon.ico',             color: '#00D4AA' },
  poe:          { url: 'https://poe.com/favicon.ico',             color: '#8B5CF6' },
  groq:         { url: 'https://groq.com/favicon.ico',            color: '#F97316' },
  cohere:       { url: 'https://coral.cohere.com/favicon.ico',    color: '#39D353' },
  pi:           { url: 'https://pi.ai/favicon.ico',               color: '#E91E8C' },
  venice:       { url: 'https://venice.ai/favicon.ico',           color: '#A855F7' },
  nemotron:     { url: 'https://build.nvidia.com/favicon.ico',    color: '#F59E0B' },
  openrouter:   { url: 'https://openrouter.ai/favicon.ico',       color: '#6366F1' },
  lmsys:        { url: 'https://chat.lmsys.org/favicon.ico',      color: '#EF4444' },
  together:     { url: 'https://api.together.ai/favicon.ico',     color: '#FF6B6B' },
};

const DispatchProgress = {
  _zone: null,      // le conteneur .dp-zone injecté dans le prompt-bar
  _entries: [],
  _states: {},

  /** Retourne true si la barre est activée dans les réglages */
  isEnabled() {
    return localStorage.getItem('teamai_dispatch_bar_enabled') !== 'false';
  },

  /**
   * Lance un nouveau dispatch — reconstruit les items, passe tout en idle
   * @param {Array<{id, label, icon, providerId}>} entries
   */
  start(entries) {
    if (!this.isEnabled()) return;
    this._entries = entries;
    this._states = {};
    for (const e of entries) this._states[e.id] = 'idle';
    this._ensureZone();
    this._buildItems();
  },

  /** Met à jour l'état d'un item */
  tick(id, status) {
    if (!this.isEnabled()) return;
    if (!Object.prototype.hasOwnProperty.call(this._states, id)) return;
    this._states[id] = status;
    this._updateItem(id);
  },

  /** Appelé quand tous les dispatches sont terminés — PAS de dismiss auto */
  finish() {
    // intentionnellement vide — la barre reste visible
  },

  /** Ferme et détruit la zone */
  dismiss() {
    if (!this._zone) return;
    this._zone.classList.add('dp-exit');
    setTimeout(() => {
      if (this._zone) { this._zone.remove(); this._zone = null; }
    }, 300);
  },

  // ── Private ─────────────────────────────────────────────────────────────

  /** Crée ou réutilise la zone dans le prompt-bar */
  _ensureZone() {
    const promptBar = document.getElementById('prompt-bar');
    if (!promptBar) return;

    // Réutilise si déjà là
    if (this._zone && promptBar.contains(this._zone)) return;

    // Nettoie un éventuel orphelin
    const old = document.getElementById('dp-zone');
    if (old) old.remove();

    const zone = document.createElement('div');
    zone.id = 'dp-zone';
    zone.className = 'dp-zone';

    // Barre de progression linéaire (ligne fine en haut du prompt-bar)
    const progressLine = document.createElement('div');
    progressLine.className = 'dp-progress-line';
    zone.appendChild(progressLine);

    // Ligne d'items
    const row = document.createElement('div');
    row.className = 'dp-row';

    // Label
    const label = document.createElement('span');
    label.className = 'dp-label';
    label.textContent = 'En cours';
    row.appendChild(label);

    // Track scrollable
    const track = document.createElement('div');
    track.className = 'dp-track';
    track.id = 'dp-track';
    row.appendChild(track);

    // Bouton fermer
    const close = document.createElement('button');
    close.className = 'dp-close';
    close.innerHTML = '✕';
    close.title = 'Masquer';
    close.onclick = () => this.dismiss();
    row.appendChild(close);

    zone.appendChild(row);
    promptBar.appendChild(zone);
    this._zone = zone;

    // Animation d'entrée
    requestAnimationFrame(() => zone.classList.add('dp-visible'));
  },

  /** Reconstruit tous les items dans le track */
  _buildItems() {
    const track = this._zone && this._zone.querySelector('#dp-track');
    if (!track) return;
    track.innerHTML = '';

    for (const e of this._entries) {
      const info = DP_LOGOS[e.providerId];
      const item = document.createElement('div');
      item.className = 'dp-item dp-idle';
      item.dataset.id = e.id;
      item.title = e.label;

      // Logo
      const logo = document.createElement('div');
      logo.className = 'dp-logo';
      if (info) {
        const img = document.createElement('img');
        img.src = info.url;
        img.alt = e.label;
        img.onerror = () => { logo.innerHTML = `<span class="dp-emoji">${e.icon || '🤖'}</span>`; };
        logo.appendChild(img);
      } else {
        logo.innerHTML = `<span class="dp-emoji">${e.icon || '🤖'}</span>`;
      }

      // Indicateur de statut
      const status = document.createElement('div');
      status.className = 'dp-status-icon';
      status.innerHTML = '<span class="dp-dot"></span>';

      item.appendChild(logo);
      item.appendChild(status);
      track.appendChild(item);
    }

    // Anime la barre de progression
    this._animateProgressLine();
  },

  /** Met à jour visuellement un item */
  _updateItem(id) {
    if (!this._zone) return;
    const item = this._zone.querySelector(`.dp-item[data-id="${id}"]`);
    if (!item) return;
    const st = this._states[id];
    item.className = `dp-item dp-${st}`;
    const si = item.querySelector('.dp-status-icon');
    if (!si) return;
    switch (st) {
      case 'idle':    si.innerHTML = '<span class="dp-dot"></span>'; break;
      case 'loading': si.innerHTML = '<span class="dp-spinner"></span>'; break;
      case 'ok':      si.innerHTML = '<span class="dp-check">✓</span>'; break;
      case 'error':   si.innerHTML = '<span class="dp-cross">✗</span>'; break;
    }
  },

  /** Anime la ligne fine de progression */
  _animateProgressLine() {
    const line = this._zone && this._zone.querySelector('.dp-progress-line');
    if (!line) return;
    line.style.width = '0%';
    line.classList.remove('dp-line-done');
    // Force reflow
    void line.offsetWidth;
    line.style.transition = 'width 0.6s cubic-bezier(0.16,1,0.3,1)';
    line.style.width = '60%';

    // Quand tout est fini, la complète à 100 %
    const checkDone = setInterval(() => {
      const all = Object.values(this._states);
      if (all.length && all.every(s => s === 'ok' || s === 'error')) {
        line.style.width = '100%';
        line.classList.add('dp-line-done');
        clearInterval(checkDone);
      }
    }, 300);
  },
};
