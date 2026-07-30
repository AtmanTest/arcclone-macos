/**
 * TeamAI v6 — Login Assistant (amélioré)
 * Ouvre une vraie fenêtre BrowserWindow Electron pour la connexion.
 * Supporte trousseau Apple, passkeys, Google OAuth natif.
 * Nouveau: startSingle(prov) pour ajouter une seule IA + guide inscription.
 */
const LoginAssistant = {
  _providers: [],
  _currentIdx: 0,
  _modalOpen: false,

  start() {
    this._providers = (WinManager.providers || []).filter(p => p.id && p.id !== 'default');
    this._currentIdx = 0;
    this._modalOpen = true;
    this._openModal();
    this._showCurrent();
  },

  // Pour ajouter une seule IA (depuis btn Ajouter IA)
  startSingle(prov) {
    this._providers = [prov];
    this._currentIdx = 0;
    this._modalOpen = true;
    this._openModal();
    this._showCurrent();
  },

  _openModal() {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    modal.classList.add('open');
    teamai.onLoginWindowClosed((pid) => {
      if (pid === this._providers[this._currentIdx]?.id) {
        this._markConnected(pid);
      }
    });
  },

  _showCurrent() {
    if (this._currentIdx >= this._providers.length) {
      this._finish();
      return;
    }
    const prov = this._providers[this._currentIdx];
    document.getElementById('login-icon').textContent = prov.icon || '\ud83c\udf10';
    document.getElementById('login-label').textContent = prov.label || prov.id;
    document.getElementById('login-step-num').textContent = this._currentIdx + 1;
    document.getElementById('login-total').textContent = this._providers.length;
    document.getElementById('login-prev').disabled = this._currentIdx === 0;

    // Instructions adapt\u00e9es: inscription vs connexion
    const instruction = document.getElementById('login-instruction');
    if (instruction) {
      instruction.innerHTML = `
        <div style="margin-bottom:8px;color:#fff;font-size:12px;font-weight:600;">${prov.icon} ${prov.label}</div>
        <div style="color:#aaa;font-size:11px;line-height:1.6;">
          1. La fen\u00eatre de connexion de <strong style="color:#fff">${prov.label}</strong> vient de s'ouvrir.<br>
          2. Si tu n'as pas de compte \u2192 clique sur <em>"S'inscrire"</em> ou <em>"Sign up"</em>.<br>
          3. Connecte-toi avec Google ou cr\u00e9e un compte gratuit.<br>
          4. Une fois connect\u00e9, clique <strong style="color:#4ADE80">"Suivant"</strong> ci-dessous.
        </div>
        <div style="margin-top:10px;">
          <a id="login-open-url" href="#" style="color:#7C3AED;font-size:10px;text-decoration:underline;">\ud83d\udd17 Ouvrir ${prov.url} dans le navigateur</a>
        </div>
      `;
      document.getElementById('login-open-url')?.addEventListener('click', (e) => {
        e.preventDefault();
        teamai.openUrl(prov.url);
      });
    }

    const container = document.getElementById('login-webview-container');
    if (container) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:13px;background:#0a0a0f;border-radius:8px;">\ud83d� Fen\u00eatre de connexion ouverte...</div>';
    }

    const partition = `persist:teamai_${prov.id}_login`;
    teamai.openLoginWindow(prov.id, prov.url, partition);
  },

  next() {
    const prov = this._providers[this._currentIdx];
    if (prov) { this._markConnected(prov.id); teamai.closeLoginWindow(prov.id); }
    this._currentIdx++;
    this._showCurrent();
  },

  skip() {
    if (this._providers[this._currentIdx]) teamai.closeLoginWindow(this._providers[this._currentIdx].id);
    this._currentIdx++;
    this._showCurrent();
  },

  prev() {
    if (this._providers[this._currentIdx]) teamai.closeLoginWindow(this._providers[this._currentIdx].id);
    if (this._currentIdx > 0) { this._currentIdx--; this._showCurrent(); }
  },

  _markConnected(providerId) {
    const connected = JSON.parse(localStorage.getItem('teamai_connected') || '{}');
    connected[providerId] = true;
    localStorage.setItem('teamai_connected', JSON.stringify(connected));
    Sidebar._updateProviderStatuses();
  },

  _finish() {
    const prov = this._providers[this._currentIdx];
    if (prov) teamai.closeLoginWindow(prov.id);
    this._modalOpen = false;
    document.getElementById('login-modal')?.classList.remove('open');
    const msg = this._providers.length === 1
      ? `\u2705 ${this._providers[0].label} configur\u00e9 ! Session persist\u00e9e.`
      : `\u2705 Tous les comptes configur\u00e9s ! Sessions persist\u00e9es dans Electron.`;
    alert(msg);
  },

  cancel() {
    for (const p of this._providers) teamai.closeLoginWindow(p.id);
    this._modalOpen = false;
    document.getElementById('login-modal')?.classList.remove('open');
  },
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-done')?.addEventListener('click', () => LoginAssistant.next());
  document.getElementById('login-skip')?.addEventListener('click', () => LoginAssistant.skip());
  document.getElementById('login-prev')?.addEventListener('click', () => LoginAssistant.prev());
  document.getElementById('login-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('login-modal')) LoginAssistant.cancel();
  });
});
