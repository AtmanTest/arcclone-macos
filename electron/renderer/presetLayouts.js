/**
 * PresetLayouts — Mode switching + keyboard shortcuts
 * Ctrl+Shift+G → Grid, Ctrl+Shift+F → Focus, Ctrl+Shift+R → Reset, 
 * Ctrl+Shift+H → Split H, Ctrl+Shift+C → Cards
 * Modes : Grille ⊞ | Split ≡ | Focus ⊙ | Cards 🏛 | Manuel ✥
 */
const PresetLayouts = {
  _toolbar: null,

  init() {
    this._createToolbar();
    this._bindShortcuts();
  },

  _createToolbar() {
    const container = document.getElementById('mode-selector');
    if (!container) return;

    const modes = [
      { id: 'grid',    icon: '⊞', label: 'Grille',     desc: 'Auto',      color: '#7C3AED' },
      { id: 'split-h', icon: '≡', label: 'Split H',    desc: 'Horizontal', color: '#06B6D4' },
      { id: 'focus',   icon: '⊙', label: 'Focus',      desc: '70/30',     color: '#10B981' },
      { id: 'cards',   icon: '🏛', label: 'Cards',      desc: 'Carrousel', color: '#F59E0B' },
      { id: 'manual',  icon: '✥', label: 'Manuel',     desc: 'Libre',     color: '#EC4899' },
    ];

    container.innerHTML = `<div class="mode-title">📐 Disposition</div><div class="mode-buttons"></div>`;
    const btnsWrap = container.querySelector('.mode-buttons');

    modes.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'mode-btn';
      btn.dataset.mode = m.id;
      btn.innerHTML = `<span class="mode-icon">${m.icon}</span>
        <span class="mode-label">${m.label}</span>
        <span class="mode-desc">${m.desc}</span>`;
      btn.title = m.label + ' (Ctrl+Shift+' + m.id.charAt(0).toUpperCase() + ')';
      btn.style.setProperty('--mode-color', m.color);
      btn.addEventListener('click', () => this.setMode(m.id));
      btnsWrap.appendChild(btn);
    });

    const existing = document.getElementById('mode-selector-style');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = 'mode-selector-style';
    style.textContent = `
      #mode-selector {
        display: flex; align-items: center; gap: 8px;
        padding: 5px 10px 6px; background: var(--bg2, #0D0D14);
        border-top: 1px solid var(--border, #1E1E2E);
      }
      #mode-selector .mode-title {
        font-size: 11px; color: #aaa; font-weight: 700;
        letter-spacing: 0.5px; white-space: nowrap;
      }
      #mode-selector .mode-buttons {
        display: flex; gap: 4px; flex: 1;
      }
      #mode-selector .mode-btn {
        display: flex; align-items: center; gap: 5px;
        background: #13131E; border: 1px solid #1E1E2E;
        border-radius: 8px; padding: 6px 10px;
        cursor: pointer; transition: all 0.15s;
        color: #888; font-size: 10px; line-height: 1.1;
        flex: 1; justify-content: center; min-width: 0;
      }
      #mode-selector .mode-btn:hover {
        border-color: var(--mode-color, #7C3AED);
        background: #1A1A28; color: #ddd;
      }
      #mode-selector .mode-btn.active {
        background: var(--mode-color, #7C3AED);
        border-color: var(--mode-color, #7C3AED);
        color: white;
        box-shadow: 0 0 12px color-mix(in srgb, var(--mode-color, #7C3AED) 40%, transparent);
      }
      #mode-selector .mode-btn .mode-icon {
        font-size: 16px; line-height: 1;
      }
      #mode-selector .mode-btn .mode-label {
        font-weight: 700; font-size: 10px;
      }
      #mode-selector .mode-btn .mode-desc {
        font-size: 8px; color: inherit; opacity: 0.6;
        display: none;
      }
      @media (min-width: 700px) {
        #mode-selector .mode-btn .mode-desc { display: inline; }
      }
    `;
    document.head.appendChild(style);

    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === LayoutModel.mode);
    });
  },

  setMode(mode) {
    LayoutModel.setMode(mode);
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    WinManager._applyLayout();
    PersistenceManager.save();
  },

  _bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      switch (e.key.toLowerCase()) {
        case 'c': e.preventDefault(); this.setMode('cards'); break;
        case 'g': e.preventDefault(); this.setMode('grid'); break;
        case 'f': e.preventDefault(); this.setMode('focus'); break;
        case 'h': e.preventDefault(); this.setMode('split-h'); break;
        case 'r': e.preventDefault(); this.setMode('manual'); WinManager._resetLayout(); break;
      }
    });
  },
};
