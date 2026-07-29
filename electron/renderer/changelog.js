/* TeamAI Changelog */
const ChangelogData = [
  {v:"0.20.0", date:"2026-07-29", commit:"831ed2d", author:"Kimi3", items:[
    "fix Grok: input contenteditable (pas textarea) + send selector 'Send message' exact + injection fallback curseur",
    "fix Popup mise \u00e0 jour: affiche commit SHA, auteur, correctifs + boutons Valider/Annuler",
    "fix Kimi URL providers.json: kimi.moonshot.cn \u2192 kimi.ai",
    "fix GLM + Kimi: submit via Enter (keydown/keypress/keyup React-compatible)",
    "fix Grok: blacklist voice/mic/audio/dict sur tous les s\u00e9lecteurs",
    "ajout AGENT_LOG.md sur tous les repos actifs (canal Kimi3 \u2194 Hermes)",
  ]},
  {v:"0.19.1", date:"2026-07-29", commit:"88486d4", author:"Hermes", items:[
    "Sync version + AGENT_LOG",
  ]},
  {v:"0.19.0", date:"2026-07-29", commit:"fdebfc5", author:"Kimi3", items:[
    "fix: fingerprints par hostname + execCommand('insertText') bypass isTrusted",
    "fix: native value setter + button scoring (remonte 8 niveaux, filtre settings)",
  ]},
  {v:"0.7.0", date:"2026-07-27", items:["Session persistante: partition partag\u00e9e par provider (m\u00eame cookies entre vues)", "Reset layout: remet toutes les fen\u00eatres \u00e0 la taille par d\u00e9faut", "Navigation buttons plus grands (\u25c4 \u25ba \u27f3 + \u2605 favoris)", "Bookmarks avec dossiers (localStorage)", "File upload: d\u00e9tection texte vs binaire (images non support\u00e9es)", "Z GLM: URL avec ?lang=en", "Resize handle plus grand"]},
  {v:"0.6.1", date:"2026-07-27", items:["Support passkey Apple / Touch ID (enableWebAuthn + enableCredentialsService)"]},
  {v:"0.6.0", date:"2026-07-27", items:["Assistant connexion: vraie fen\u00eatre BrowserWindow (trousseau Apple, passkey, Google OAuth natif)"]},
  {v:"0.5.0", date:"2026-07-27", items:["Prompt bar 4 lignes + attache fichiers", "Provider cards en grille 2 colonnes", "Redimensionnement fen\u00eatres (drag handle)", "Assistant connexion wizard", "Bouton Sauvegarder session"]},
  {v:"0.4.0", date:"2026-07-27", items:["Rewrite: <webview> remplace BrowserView", "Toolbars VISIBLES (\u25c4\u25ba\u27f3\u2715 combo URL)", "Flex-wrap grid scrollable 10 fen\u00eatres", "Zoom +/- fonctionnel"]},
];

const Changelog = {
  open(updateInfo) {
    let modal = document.getElementById('changelog-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'changelog-modal';
      modal.innerHTML = `
        <div id="changelog-content">
          <div id="changelog-header">
            <h2>\uD83D\uDCCB Changelog</h2>
            <button id="changelog-close">\u2715</button>
          </div>
          <div id="changelog-update-banner" style="display:none"></div>
          <div id="changelog-body"></div>
          <div id="changelog-footer">
            <button id="changelog-github">Voir sur GitHub</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#changelog-close').addEventListener('click', () => modal.classList.remove('open'));
      modal.querySelector('#changelog-github').addEventListener('click', () => {
        teamai.openUrl('https://github.com/AtmanTest/arcclone-macos/commits/main');
      });
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
    }

    // Afficher banner mise \u00e0 jour si infos disponibles
    const banner = modal.querySelector('#changelog-update-banner');
    if (updateInfo && updateInfo.commit) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div style="background:#1a2a1a;border:1px solid #4ADE80;border-radius:8px;padding:12px;margin-bottom:12px;">
          <div style="color:#4ADE80;font-weight:700;font-size:12px;margin-bottom:6px;">\u2B06 Mise \u00e0 jour disponible</div>
          <div style="color:#ccc;font-size:11px;margin-bottom:4px;">\uD83D\uDD17 Commit : <code style="color:#fff">${updateInfo.commit.slice(0,7)}</code></div>
          <div style="color:#ccc;font-size:11px;margin-bottom:4px;">\uD83D\uDC64 Auteur : <strong>${updateInfo.author || 'inconnu'}</strong></div>
          <div style="color:#ccc;font-size:11px;margin-bottom:8px;">\uD83D\uDCDD Message : ${updateInfo.message || ''}</div>
          ${updateInfo.changes && updateInfo.changes.length ? `<ul style="color:#aaa;font-size:10px;margin:0 0 8px 12px;padding:0;">${updateInfo.changes.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button id="update-confirm" style="flex:1;background:#4ADE80;color:#000;border:none;border-radius:6px;padding:7px;font-weight:700;cursor:pointer;">\u2713 Valider la mise \u00e0 jour</button>
            <button id="update-cancel" style="flex:1;background:#333;color:#aaa;border:none;border-radius:6px;padding:7px;cursor:pointer;">\u2715 Annuler</button>
          </div>
        </div>
      `;
      banner.querySelector('#update-confirm').addEventListener('click', () => {
        if (updateInfo.onConfirm) updateInfo.onConfirm();
        modal.classList.remove('open');
      });
      banner.querySelector('#update-cancel').addEventListener('click', () => {
        if (updateInfo.onCancel) updateInfo.onCancel();
        banner.style.display = 'none';
      });
    } else {
      banner.style.display = 'none';
    }

    // Render versions
    const body = modal.querySelector('#changelog-body');
    body.innerHTML = ChangelogData.map(entry => `
      <div class="version">${entry.v}${entry.commit ? ` <span style="color:#555;font-size:9px;">${entry.commit.slice(0,7)}</span>` : ''} \u2014 ${entry.date}${entry.author ? ` <span style="color:#888;font-size:9px;">par ${entry.author}</span>` : ''}</div>
      ${entry.items.map(i => `<div class="item">\u2022 ${i}</div>`).join('')}
    `).join('') + `<div class="version" style="margin-top:10px;color:#555;font-size:9px;">... versions ant\u00e9rieures</div>`;

    modal.classList.add('open');
  },
};
