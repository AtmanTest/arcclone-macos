const ChangelogData = [
  {v:'0.24.0', date:'2026-07-29 14:00', commit:'b762f90', author:'Hermes', items:['Logo SVG TeamAI (T stylisé violet + nodes réseau multi-AI)','Fix 5 régressions reportManager.js (multiline strings)','Tests adaptés (colors, CSS, focus) — 182 ✅']},
  {v:'0.23.2', date:'2026-07-29', commit:'', author:'Kimi3', items:['fix: caractères Unicode affichés correctement (plus de \\uXXXX)']},
  {v:'0.23.1', date:'2026-07-29', commit:'602d9cf', author:'Kimi3', items:['Google profile card dans la sidebar (avatar + email + dot)','Réglages: carte profil avec bannière dégradée + pills de statut']},
  {v:'0.23.0', date:'2026-07-29', commit:'9b6d197', author:'Kimi3', items:['Badge Google sous la version','Google Drive: export rapports + auto-export']},
  {v:'0.22.1', date:'2026-07-29', commit:'3746e42', author:'Kimi3', items:['fix popup mise à jour: SHA/auteur/message corrects','Popup sans titre ni croix — commit = lien GitHub']},
  {v:'0.22.0', date:'2026-07-29', commit:'efa04f2', author:'Kimi3', items:['Session Google partagée persist:google_shared','Bouton Réglages + modal complet']},
  {v:'0.21.0', date:'2026-07-29', commit:'2faba34', author:'Kimi3', items:['25 providers','Export/Import JSON providers']},
  {v:'0.7.0',  date:'2026-07-27', commit:'',        author:'',       items:['Session persistante','Reset layout','Navigation','Bookmarks','File upload']},
];

const GITHUB_COMMIT_BASE = 'https://github.com/AtmanTest/arcclone-macos/commit/';

const UpdatePopup = {
  show({ sha, fullSha, author, msg, behind, ghBase, onConfirm }) {
    let modal = document.getElementById('update-popup-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'update-popup-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;';
    const commitUrl = (fullSha && fullSha.length > 6) ? (ghBase + fullSha) : '';
    const commitLink = commitUrl
      ? `<a id="update-commit-link" href="#" style="color:#7C3AED;font-weight:700;font-family:monospace;text-decoration:underline;font-size:13px;">${sha}</a>`
      : `<code style="color:#fff;font-size:13px;">${sha}</code>`;
    modal.innerHTML = `
      <div style="background:#0f0f1a;border:1px solid #2a2a3a;border-radius:14px;padding:28px;width:420px;">
        <div style="color:#4ADE80;font-weight:700;font-size:15px;margin-bottom:18px;">⬆ ${behind} commit${behind>1?'s':''} disponible${behind>1?'s':''}</div>
        <div style="background:#111;border:1px solid #1e1e2e;border-radius:8px;padding:14px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="color:#888;font-size:11px;min-width:60px;">Commit</span><span>${commitLink}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="color:#888;font-size:11px;min-width:60px;">Auteur</span>
            <span style="color:#fff;font-size:12px;font-weight:600;">${author}</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <span style="color:#888;font-size:11px;min-width:60px;">Message</span>
            <span style="color:#ccc;font-size:11px;line-height:1.5;">${msg}</span>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <button id="update-popup-confirm" style="flex:1;background:#4ADE80;color:#000;border:none;border-radius:8px;padding:11px;font-weight:700;font-size:13px;cursor:pointer;">✓ Valider la mise à jour</button>
          <button id="update-popup-cancel" style="flex:1;background:#1e1e2e;color:#888;border:1px solid #333;border-radius:8px;padding:11px;font-size:13px;cursor:pointer;">✕ Annuler</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    if (commitUrl) {
      modal.querySelector('#update-commit-link')?.addEventListener('click', (e) => { e.preventDefault(); teamai.openUrl(commitUrl); });
    }
    modal.querySelector('#update-popup-confirm').addEventListener('click', () => { modal.remove(); if (onConfirm) onConfirm(); });
    modal.querySelector('#update-popup-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
};

const Changelog = {
  open() {
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
          <div id="changelog-footer"><button id="changelog-github">Voir sur GitHub</button></div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#changelog-close').addEventListener('click', () => modal.classList.remove('open'));
      modal.querySelector('#changelog-github').addEventListener('click', () => teamai.openUrl('https://github.com/AtmanTest/arcclone-macos/commits/main'));
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
    }
    const body = modal.querySelector('#changelog-body');
    body.innerHTML = ChangelogData.map(entry => {
      const commitUrl = entry.commit ? GITHUB_COMMIT_BASE + entry.commit : '';
      const commitBadge = commitUrl
        ? `<a href="#" class="commit-link" data-url="${commitUrl}" style="color:#7C3AED;font-family:monospace;font-size:9px;text-decoration:underline;margin-left:4px;">${entry.commit.slice(0,7)}</a>`
        : '';
      return `
        <div class="version">${entry.v}${commitBadge} — ${entry.date}${entry.author ? ` <span style="color:#888;font-size:9px;">par ${entry.author}</span>` : ''}</div>
        ${entry.items.map(i => `<div class="item">• ${i}</div>`).join('')}
      `;
    }).join('');
    body.querySelectorAll('.commit-link').forEach(a => {
      a.addEventListener('click', (e) => { e.preventDefault(); teamai.openUrl(a.dataset.url); });
    });
    modal.classList.add('open');
  },
};
