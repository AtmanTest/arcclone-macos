/**
 * TeamAI — Report Manager
 * Collecte les r\u00e9ponses des webviews + export .md + export Google Drive
 */
const ReportManager = {
  _data: [],

  open() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.classList.add('open');
    this._collect();
  },

  async _collect() {
    const body = document.getElementById('report-body');
    if (!body) return;
    body.innerHTML = '<div style="color:#888;padding:20px;">\u23f3 Collecte des r\u00e9ponses...</div>';
    this._data = [];

    const promises = [];
    WinManager.frames.forEach((entry, id) => {
      const wv = entry.frame.querySelector('webview');
      if (!wv) return;
      const label = entry.combo?.options[entry.combo.selectedIndex]?.text || id;
      promises.push(
        wv.executeJavaScript(`(function(){
          var el = document.querySelector('.message:last-child, [data-message-author-role="assistant"]:last-child, .response:last-child, article:last-child, [class*="response"]:last-child');
          if (!el) el = document.body;
          return (el ? el.innerText : '').substring(0, 2000);
        })()`)
        .then(text => ({ label, text: text || '(pas de r\u00e9ponse)' }))
        .catch(() => ({ label, text: '(erreur de collecte)' }))
      );
    });

    this._data = await Promise.all(promises);
    this._render();

    // Auto-export Drive si activ\u00e9
    const autoExport = document.getElementById('drive-auto-export')?.checked
      || localStorage.getItem('teamai_drive_auto') === 'true';
    if (autoExport) setTimeout(() => this.exportToDrive(), 500);
  },

  _render() {
    const body = document.getElementById('report-body');
    if (!body) return;
    if (!this._data.length) { body.innerHTML = '<div style="color:#888;padding:20px;">Aucune donn\u00e9e</div>'; return; }
    body.innerHTML = this._data.map(d => `
      <div style="margin-bottom:16px;border-bottom:1px solid #1e1e2e;padding-bottom:12px;">
        <div style="color:#7C3AED;font-weight:700;font-size:12px;margin-bottom:6px;">${d.label}</div>
        <div style="color:#ccc;font-size:11px;line-height:1.6;white-space:pre-wrap;">${d.text.replace(/</g,'&lt;')}</div>
      </div>
    `).join('');
  },

  _toMarkdown() {
    // 14 sections
    const now   = new Date();
    const date  = now.toLocaleString('fr-FR');
    const iso   = now.toISOString().slice(0,10);
    const prompt = document.getElementById('prompt-input')?.value || '(aucun prompt)';
    const count = this._data.length;
    const providers = this._data.map(d => d.label).join(', ');

    // Section 1 — En-tête
    let md = `# 📋 Rapport TeamAI
`;
    md += `> Généré le **${date}** — ${count} IA consultée${count>1?'s':''}

`;
    md += `---

`;

    // Section 2 — Prompt
    md += `## 1. Prompt soumis

> ${prompt.replace(/
/g,'
> ')}

`;

    // Section 3 — IA consultées
    md += `## 2. IA consultées (${count})

${this._data.map((d,i)=>`${i+1}. ${d.label}`).join('
')}

`;

    // Section 4 — Résumé exécutif
    const firstText = this._data[0]?.text?.substring(0,300) || '';
    md += `## 3. Résumé exécutif

_Première réponse reçue (${this._data[0]?.label || '—'}) :_

${firstText}…

`;

    // Section 5-N — Réponses individuelles
    md += `## 4. Réponses détaillées

`;
    this._data.forEach((d, i) => {
      md += `### ${i+1}. ${d.label}

${d.text}

---

`;
    });

    // Section — Points communs
    md += `## 5. Points communs

_À remplir manuellement ou via analyse._

`;

    // Section — Divergences
    md += `## 6. Divergences notables

_À remplir manuellement ou via analyse._

`;

    // Section — Meilleure réponse
    md += `## 7. Meilleure réponse (subjective)

_À déterminer selon le contexte._

`;

    // Section — Sources citées
    const urls = this._data.flatMap(d => [...d.text.matchAll(/https?:\/\/[^\s)"]+/g)].map(m=>m[0]));
    md += `## 8. URLs / Sources citées (${urls.length})

${urls.length ? urls.map(u=>`- ${u}`).join('
') : '_Aucune URL détectée._'}

`;

    // Section — Code détecté
    const hasCode = this._data.some(d => d.text.includes('```'));
    md += `## 9. Blocs de code détectés

${hasCode ? '_Des blocs de code ont été trouvés dans les réponses ci-dessus._' : '_Aucun bloc de code détecté._'}

`;

    // Section — Statistiques
    md += `## 10. Statistiques

`;
    this._data.forEach(d => {
      const words = d.text.split(/\s+/).filter(Boolean).length;
      md += `- **${d.label}** : ~${words} mots, ${d.text.length} caractères
`;
    });
    md += '
';

    // Section — Temps de session
    md += `## 11. Contexte session

- Date : ${date}
- Providers : ${providers}
- Fenêtres actives : ${count}

`;

    // Section — Tags
    md += `## 12. Tags suggérés

_#teamai #ia #${iso}_

`;

    // Section — Actions suivantes
    md += `## 13. Actions suivantes

- [ ] Vérifier les sources
- [ ] Comparer les divergences
- [ ] Sauvegarder sur Drive

`;

    // Section — Pied de page
    md += `## 14. Pied de page

_Rapport généré automatiquement par [TeamAI](https://github.com/AtmanTest/arcclone-macos) v${document.getElementById("version-badge")?.textContent || "?"}_
`;

    return md;
  },

  exportMd() {
    const blob = new Blob([this._toMarkdown()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TeamAI_rapport_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
  },

  async exportToDrive() {
    const btn = document.getElementById('report-export-drive');
    if (btn) { btn.textContent = '\u23f3 Upload Drive...'; btn.disabled = true; }
    try {
      const status = await teamai.getGoogleStatus();
      if (!status || !status.connected) {
        alert('\u26a0\ufe0f Connecte-toi \u00e0 Google d\'abord dans R\u00e9glages.');
        Settings.open();
        if (btn) { btn.textContent = '\ud83d\udcc2 Sauvegarder sur Drive'; btn.disabled = false; }
        return;
      }
      // Ouvrir Google Drive dans une fen\u00eatre de la partition partag\u00e9e
      // et d\u00e9clencher l'upload via l'API Drive REST (avec le token Google de la session)
      await teamai.exportReportToDrive({
        filename: `TeamAI_rapport_${new Date().toISOString().slice(0,10)}.md`,
        content: this._toMarkdown(),
        mimeType: 'text/markdown',
      });
      if (btn) { btn.textContent = '\u2705 Sauvegard\u00e9 sur Drive'; }
      setTimeout(() => { if (btn) { btn.textContent = '\ud83d\udcc2 Sauvegarder sur Drive'; btn.disabled = false; } }, 3000);
    } catch(e) {
      alert('\u274c Drive: ' + (e.message || e));
      if (btn) { btn.textContent = '\ud83d\udcc2 Sauvegarder sur Drive'; btn.disabled = false; }
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('report-close-modal')?.addEventListener('click', () => {
    document.getElementById('report-modal')?.classList.remove('open');
  });
  document.getElementById('report-close-btn')?.addEventListener('click', () => {
    document.getElementById('report-modal')?.classList.remove('open');
  });
  document.getElementById('report-export-md')?.addEventListener('click', () => ReportManager.exportMd());
  document.getElementById('report-export-drive')?.addEventListener('click', () => ReportManager.exportToDrive());
  document.getElementById('report-refresh')?.addEventListener('click', () => ReportManager._collect());

  // Persistance checkbox auto-export
  const cb = document.getElementById('drive-auto-export');
  if (cb) {
    cb.checked = localStorage.getItem('teamai_drive_auto') === 'true';
    cb.addEventListener('change', () => localStorage.setItem('teamai_drive_auto', cb.checked));
  }
});
