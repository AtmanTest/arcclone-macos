/**
 * TeamAI v5 — Login Assistant
 * Ouvre une vraie fenêtre BrowserWindow Electron pour la connexion.
 * Supporte trousseau Apple, passkeys, Google OAuth natif.
 */
const LoginAssistant = {
  _providers: [],
  _currentIdx: 0,
  _modalOpen: false,

  start() {
    this._providers = (WinManager.providers || []).filter(p => p.id && p.id !== 'default');
    this._currentIdx = 0;
    this._modalOpen = true;

    const modal = document.getElementById('login-modal');
    if (!modal) return;
    modal.classList.add('open');

    // Listen for window close events from main
    teamai.onLoginWindowClosed((pid) => {
      // Mark as potentially connected when user closes the window
      if (pid === this._providers[this._currentIdx]?.id) {
        this._markConnected(pid);
      }
    });

    this._showCurrent();
  },

  _showCurrent() {
    if (this._currentIdx >= this._providers.length) {
      this._finish();
      return;
    }

    const prov = this._providers[this._currentIdx];
    document.getElementById('login-icon').textContent = prov.icon || '🌐';
    document.getElementById('login-label').textContent = prov.label || prov.id;
    document.getElementById('login-step-num').textContent = this._currentIdx + 1;
    document.getElementById('login-total').textContent = this._providers.length;
    document.getElementById('login-prev').disabled = this._currentIdx === 0;

    // Remove the embedded webview container — we use a real window
    const container = document.getElementById('login-webview-container');
    if (container) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:13px;background:#0a0a0f;border-radius:8px;">🔑 Fenêtre de connexion ouverte...</div>';
    }

    // Update instruction
    const instruction = document.getElementById('login-instruction');
    if (instruction) {
      instruction.textContent = `Connecte-toi à ${prov.label} dans la fenêtre qui s'est ouverte. Utilise ton trousseau Apple / Chrome. Referme la fenêtre une fois connecté.`;
    }

    // Open native BrowserWindow with proper partition
    const partition = `persist:teamai_${prov.id}_login`;
    const url = prov.url || 'about:blank';
    teamai.openLoginWindow(prov.id, url, partition);
  },

  next() {
    const prov = this._providers[this._currentIdx];
    if (prov) {
      this._markConnected(prov.id);
      teamai.closeLoginWindow(prov.id);
    }
    this._currentIdx++;
    this._showCurrent();
  },

  skip() {
    if (this._providers[this._currentIdx]) {
      teamai.closeLoginWindow(this._providers[this._currentIdx].id);
    }
    this._currentIdx++;
    this._showCurrent();
  },

  prev() {
    // Close current window
    if (this._providers[this._currentIdx]) {
      teamai.closeLoginWindow(this._providers[this._currentIdx].id);
    }
    if (this._currentIdx > 0) {
      this._currentIdx--;
      // Don't mark connected when going back
      this._showCurrent();
    }
  },

  _markConnected(providerId) {
    const connected = JSON.parse(localStorage.getItem('teamai_connected') || '{}');
    connected[providerId] = true;
    localStorage.setItem('teamai_connected', JSON.stringify(connected));
    Sidebar._updateProviderStatuses();
  },

  _finish() {
    // Close any remaining login window
    const prov = this._providers[this._currentIdx];
    if (prov) teamai.closeLoginWindow(prov.id);

    this._modalOpen = false;
    document.getElementById('login-modal')?.classList.remove('open');
    alert('✅ Tous les comptes configurés ! Les sessions sont persistées dans Electron.');
  },

  cancel() {
    // Close all login windows
    for (const p of this._providers) {
      teamai.closeLoginWindow(p.id);
    }
    this._modalOpen = false;
    document.getElementById('login-modal')?.classList.remove('open');
  },
};

// Wire modal buttons
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-done')?.addEventListener('click', () => LoginAssistant.next());
  document.getElementById('login-skip')?.addEventListener('click', () => LoginAssistant.skip());
  document.getElementById('login-prev')?.addEventListener('click', () => LoginAssistant.prev());
  document.getElementById('login-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('login-modal')) LoginAssistant.cancel();
  });
});
