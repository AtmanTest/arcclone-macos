const ReportManager = {
  async open() {
    document.getElementById('report-modal')?.classList.add('open');
    await this._collect();
  },
  close() { document.getElementById('report-modal')?.classList.remove('open'); },
  async _collect() {
    const body = document.getElementById('report-body');
    if (!body) return;
    body.textContent = 'Collecte...';
    const responses = [];
    let i = 0;
    for (const [id, entry] of WinManager.frames) {
      i++;
      body.textContent = `Collecte (${i}/${WinManager.count})...`;
      const js = `(function(){const sels=['.markdown','[data-message-author-role="assistant"]','.prose','.message-content','main','article'];const text=document.body?document.body.innerText.substring(0,5000):'';for(const s of sels){const el=document.querySelector(s);if(el&&el.innerText.length>100)return el.innerText.substring(0,5000)}return text;})();`;
      try {
        const text = await entry.webview.executeJavaScript(js);
        responses.push({ label: entry.combo?.options[entry.combo.selectedIndex]?.text || 'IA', url: entry.webview?.src || '', response: text || '(vide)' });
      } catch { responses.push({ label: 'IA', url: '', response: '(erreur)' }); }
    }
    let text = `# Rapport IA — ${new Date().toLocaleString()}\n\n`;
    for (const r of responses) { text += `---\n## ${r.label}\nURL: ${r.url || 'N/A'}\n\n${r.response || '(pas de réponse)'}\n\n`; }
    text += `---\n*${responses.length} IA interrogées par TeamAI*\n`;
    body.textContent = text;
  },
  _exportMD() {
    const body = document.getElementById('report-body');
    if (!body?.textContent) return;
    const blob = new Blob([body.textContent], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `rapport-ia-${Date.now()}.md`; a.click(); URL.revokeObjectURL(a.href);
  },
};
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('report-close-modal')?.addEventListener('click', () => ReportManager.close());
  document.getElementById('report-close-btn')?.addEventListener('click', () => ReportManager.close());
  document.getElementById('report-refresh')?.addEventListener('click', () => ReportManager._collect());
  document.getElementById('report-export-md')?.addEventListener('click', () => ReportManager._exportMD());
  document.getElementById('report-modal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('report-modal')) ReportManager.close(); });
});
