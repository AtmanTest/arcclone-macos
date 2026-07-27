/**
 * TeamAI — Report Manager
 * Collecte toutes les réponses IA et affiche dans un modal.
 * Export .md possible.
 */
const ReportManager = {
  async open() {
    // Create modal if not exists
    let modal = document.getElementById('report-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'report-modal';
      modal.innerHTML = `
        <div id="report-content">
          <div id="report-header">
            <h2>📋 Rapport IA — Synthèse</h2>
            <button id="report-close">✕</button>
          </div>
          <div id="report-body">Collecte des réponses en cours...</div>
          <div id="report-footer">
            <button class="secondary" id="report-export-md">📄 Export .md</button>
            <button class="secondary" id="report-refresh">⟳ Actualiser</button>
            <button id="report-close-btn">Fermer</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#report-close').addEventListener('click', () => this.close());
      modal.querySelector('#report-close-btn').addEventListener('click', () => this.close());
      modal.querySelector('#report-refresh').addEventListener('click', () => this._collect());
      modal.querySelector('#report-export-md').addEventListener('click', () => this._exportMD());

      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.close();
      });
    }

    modal.classList.add('open');
    await this._collect();
  },

  close() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.classList.remove('open');
  },

  async _collect() {
    const body = document.getElementById('report-body');
    if (!body) return;
    body.textContent = 'Collecte des réponses...';

    try {
      const responses = await teamai.collectResponses();
      let text = '';
      for (const r of responses) {
        text += `═══════════════════════════════════════════\n`;
        text += `${r.icon} [${r.label}] — #${r.id}\n`;
        text += `URL: ${r.url || 'N/A'}\n`;
        text += `───────────────────────────────────────────\n`;
        text += `${r.response || '(pas de réponse)'}\n\n`;
      }
      text += `═══════════════════════════════════════════\n`;
      text += `Rapport généré le ${new Date().toLocaleString()}\n`;
      text += `${responses.length} IA interrogées\n`;
      body.textContent = text;
    } catch (err) {
      body.textContent = `Erreur: ${err.message}`;
    }
  },

  _exportMD() {
    const body = document.getElementById('report-body');
    if (!body || !body.textContent) return;
    let md = `# Rapport IA — ${new Date().toISOString().slice(0, 10)}\n\n`;
    md += body.textContent.replace(/═══════════════════════════════════════════/g, '---\n');
    md += '\n---\n*Rapport généré par TeamAI*\n';

    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-ia-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
