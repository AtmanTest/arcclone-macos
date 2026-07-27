/* TeamAI Changelog */
const ChangelogData = [
  {v:"0.7.0", date:"2026-07-27", items:["Session persistante: partition partagée par provider (même cookies entre vues)", "Reset layout: remet toutes les fenêtres à la taille par défaut", "Navigation buttons plus grands (◀ ▶ ⟳ + ★ favoris)", "Bookmarks avec dossiers (localStorage)", "File upload: détection texte vs binaire (images non supportées)", "Z GLM: URL avec ?lang=en", "Resize handle plus grand"]},
  {v:"0.6.1", date:"2026-07-27", items:["Support passkey Apple / Touch ID (enableWebAuthn + enableCredentialsService)"]},
  {v:"0.6.0", date:"2026-07-27", items:["Assistant connexion: vraie fenêtre BrowserWindow (trousseau Apple, passkey, Google OAuth natif)"]},
  {v:"0.5.0", date:"2026-07-27", items:["Prompt bar 4 lignes + attache fichiers", "Provider cards en grille 2 colonnes", "Redimensionnement fenêtres (drag handle)", "Assistant connexion wizard", "Bouton Sauvegarder session"]},
  {v:"0.4.0", date:"2026-07-27", items:["Rewrite: <webview> remplace BrowserView", "Toolbars VISIBLES (◀▶⟳✕ combo URL)", "Flex-wrap grid scrollable 10 fenêtres", "Zoom +/- fonctionnel"]},
];

const Changelog = {
  open() {
    // Create modal if not exists
    let modal = document.getElementById('changelog-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'changelog-modal';
      modal.innerHTML = `
        <div id="changelog-content">
          <div id="changelog-header">
            <h2>📋 Changelog</h2>
            <button id="changelog-close">✕</button>
          </div>
          <div id="changelog-body"></div>
          <div id="changelog-footer">
            <button id="changelog-github">Voir sur GitHub</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#changelog-close').addEventListener('click', () => modal.classList.remove('open'));
      modal.querySelector('#changelog-github').addEventListener('click', () => {
        teamai.openUrl('https://github.com/AtmanTest/arcclone-macos/releases');
      });
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
    }

    // Render versions
    const body = modal.querySelector('#changelog-body');
    body.innerHTML = ChangelogData.map(entry => `
      <div class="version">${entry.v} — ${entry.date}</div>
      ${entry.items.map(i => `<div class="item">• ${i}</div>`).join('')}
    `).join('') + `<div class="version" style="margin-top:10px;color:#555;font-size:9px;">... versions antérieures</div>`;

    modal.classList.add('open');
  },
};
