/**
 * TeamAI v5 — Login Assistant (wizard)
 * Guide l'utilisateur à travers chaque provider pour connecter son compte.
 * Une fois connecté, le cookie persiste dans la partition Electron.
 */
const LoginAssistant = {
  _providers: [],
  _currentIdx: 0,
  _webview: null,

  start() {
    this._providers = WinManager.providersList.filter(p => p.id && p.id !== 'default');
    this._currentIdx = 0;
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    modal.classList.add('open');
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

    // Create disposable webview for this provider
    const container = document.getElementById('login-webview-container');
    container.innerHTML = '';
    const wv = document.createElement('webview');
    wv.id = 'login-webview';
    wv.src = prov.url || 'about:blank';
    wv.setAttribute('partition', `persist:teamai_${prov.id}_login`);
    wv.setAttribute('allowpopups', '');
    wv.style.width = '100%'; wv.style.height = '100%'; wv.style.border = 'none';
    container.appendChild(wv);
    this._webview = wv;

    // Intercept Google OAuth
    wv.addEventListener('new-window', (e) => {
      if (e.url.includes('accounts.google.com') || e.url.includes('oauth')) {
        e.preventDefault();
        teamai.openAuthWindow(e.url, wv.getAttribute('partition') || '');
      }
    });
  },

  next() {
    // Mark as connected
    const prov = this._providers[this._currentIdx];
    const connected = JSON.parse(localStorage.getItem('teamai_connected') || '{}');
    connected[prov.id] = true;
    localStorage.setItem('teamai_connected', JSON.stringify(connected));
    Sidebar._updateProviderStatuses();

    this._currentIdx++;
    this._showCurrent();
  },

  skip() {
    this._currentIdx++;
    this._showCurrent();
  },

  prev() {
    if (this._currentIdx > 0) {
      this._currentIdx--;
      this._showCurrent();
    }
  },

  _finish() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('open');
    alert('✅ Tous les comptes configurés ! Les sessions sont persistées.');
    // Relancer toutes les vues avec les providers connectés
    const connected = JSON.parse(localStorage.getItem('teamai_connected') || '{}');
    localStorage.setItem('teamai_connected', JSON.stringify(connected));
  },

  cancel() {
    document.getElementById('login-modal')?.classList.remove('open');
  },
};

// Wire modal buttons
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-done')?.addEventListener('click', () => LoginAssistant.next());
  document.getElementById('login-skip')?.addEventListener('click', () => LoginAssistant.skip());
  document.getElementById('login-prev')?.addEventListener('click', () => LoginAssistant.prev());
  // Close on overlay click
  document.getElementById('login-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('login-modal')) LoginAssistant.cancel();
  });
});
