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
    const date = new Date().toLocaleString('fr-FR');
    const prompt = document.getElementById('prompt-input')?.value || '';
    return `# Rapport TeamAI\n_${date}_\n\n**Prompt:** ${prompt}\n\n---\n\n`
      + this._data.map(d => `## ${d.label}\n\n${d.text}`).join('\n\n---\n\n');
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
