/**
 * PresetLayouts — Mode switching + keyboard shortcuts
 * Ctrl+Shift+G → Grid, Ctrl+Shift+F → Focus, Ctrl+Shift+R → Reset, Ctrl+Shift+H → Split H, Ctrl+Shift+C → Cards
 */
const PresetLayouts = {
  _toolbar: null,

  init() {
    this._createToolbar();
    this._bindShortcuts();
  },

  _createToolbar() {
    // Add layout mode buttons in the prompt bar area
    const promptActions = document.getElementById('prompt-actions');
    if (!promptActions) return;

    const modes = [
      { id: 'grid', label: '⊞', title: 'Grille Auto' },
      { id: 'split-h', label: '≡', title: 'Split Horizontal' },
      { id: 'focus', label: '⊙', title: 'Focus' },
      { id: 'cards', label: '🃏', title: 'Cards' },
      { id: 'manual', label: '✥', title: 'Manuel' },
    ];

    modes.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'mode-btn';
      btn.dataset.mode = m.id;
      btn.textContent = m.label;
      btn.title = m.title + ' (Ctrl+Shift+' + m.id.charAt(0).toUpperCase() + ')';
      btn.addEventListener('click', () => this.setMode(m.id));
      promptActions.appendChild(btn);
    });

    // Add style for mode buttons
    const style = document.createElement('style');
    style.textContent = `
      .mode-btn {
        background: var(--border); border: none; border-radius: 4px;
        color: #888; font-size: 12px; width: 22px; height: 22px;
        cursor: pointer; transition: all 0.1s; display: flex;
        align-items: center; justify-content: center;
      }
      .mode-btn:hover { background: var(--accent); color: white; }
      .mode-btn.active { background: var(--accent); color: white; }
    `;
    document.head.appendChild(style);
  },

  setMode(mode) {
    LayoutModel.setMode(mode);
    // Update button states
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    // Apply layout
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
