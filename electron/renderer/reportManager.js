/**
 * TeamAI — Report Manager v2
 * Génère un rapport HTML autonome, lisible, par IA
 */
const ReportManager = {
  _data: [],

  open() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.classList.add('open');
    this._collect();
  },

  async _collect() {
    // Petite notification visuelle
    const btn = document.getElementById('btn-report');
    if (btn) { const old = btn.textContent; btn.textContent = '⏳ Collecte...'; btn.disabled = true; }
    
    const body = document.getElementById('report-body');
    if (body) body.innerHTML = '<div style="color:#888;padding:20px;text-align:center;">⏳ Collecte des réponses...<br><span style="font-size:10px;color:#555;">Le rapport HTML s\'ouvrira automatiquement.</span></div>';

    this._data = [];
    const promises = [];
    WinManager.frames.forEach((entry, id) => {
      const wv = entry.frame.querySelector('webview');
      if (!wv) return;
      const label = entry.combo?.options[entry.combo.selectedIndex]?.text || id;
      const providerId = entry.combo?.value || id;
      promises.push(
        wv.executeJavaScript(`(function(){
          var sel = '.message:last-child, [data-message-author-role="assistant"]:last-child, .response:last-child, article:last-child, [class*="response"]:last-child, .prose:last-child, [class*="answer"]:last-child';
          var el = document.querySelector(sel);
          if (!el) el = document.body;
          var text = el ? el.innerText : '';
          var html = el ? el.innerHTML : '';
          return JSON.stringify({ text: text.substring(0, 30000), html: html.substring(0, 5000) });
        })()`)
        .then(raw => {
          try {
            const parsed = JSON.parse(raw);
            return { label, providerId, text: parsed.text || '(pas de réponse)', html: parsed.html || '' };
          } catch { return { label, providerId, text: raw || '(pas de réponse)', html: '' }; }
        })
        .catch(() => ({ label, providerId, text: '(erreur de collecte)', html: '' }))
      );
    });

    this._data = await Promise.all(promises);
    this._generateHTML();
  },

  _generateHTML() {
    // Fermer la modale + réactiver bouton
    const modal = document.getElementById('report-modal');
    if (modal) modal.classList.remove('open');
    const btn = document.getElementById('btn-report');
    if (btn) { btn.textContent = '📋 Rapport'; btn.disabled = false; }
    
    const now = new Date();
    const date = now.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const prompt = document.getElementById('prompt-input')?.value || '(aucun prompt saisi)';
    const count = this._data.length;
    const providers = this._data.map(d => d.label);

    // Stats
    const stats = this._data.map(d => ({
      label: d.label,
      words: d.text.split(/\s+/).filter(Boolean).length,
      chars: d.text.length,
    }));

    // URLs détectées
    const allUrls = [...new Set(this._data.flatMap(d => [...d.text.matchAll(/https?:\/\/[^\s)"'\]]+/g)].map(m => m[0])))];
    
    // Code blocks
    const hasCode = this._data.some(d => d.text.includes('```'));

    // Lines de réponse par IA
    const responsesHTML = this._data.map((d, i) => {
      const s = stats[i];
      const codeFormatted = d.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
        .replace(/\n/g, '<br>');

      const colors = ['#7C3AED', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6'];
      const color = colors[i % colors.length];

      return `
      <div class="resp-card" style="border-left: 3px solid ${color};">
        <div class="resp-header">
          <div class="resp-badge" style="background:${color}15; color:${color};">${d.label}</div>
          <div class="resp-meta">${s.words} mots · ${s.chars.toLocaleString()} car.</div>
          <button class="toggle-btn" onclick="this.parentElement.nextElementSibling.classList.toggle('collapsed');this.textContent=this.textContent==='▲'?'▼':'▲'">▲</button>
        </div>
        <div class="resp-body">${codeFormatted}</div>
      </div>`;
    }).join('\n');

    // URLs
    const urlsHTML = allUrls.length ? allUrls.map(u => 
      `<a href="${u}" target="_blank" class="url-link">${u.length > 80 ? u.slice(0,80)+'…' : u}</a>`
    ).join('\n') : '<span class="dim">Aucune URL détectée.</span>';

    // Tableau comparatif
    const tableRows = stats.map((s, i) => {
      const bars = ['#7C3AED', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
      const c = bars[i % bars.length];
      const maxWords = Math.max(...stats.map(x => x.words), 1);
      const pct = (s.words / maxWords * 100).toFixed(0);
      return `<tr><td style="color:${c};">${s.label}</td><td>${s.words.toLocaleString()}</td><td>${s.chars.toLocaleString()}</td><td><div class="bar" style="width:${pct}%;background:${c};"></div></td></tr>`;
    }).join('\n');

    // Version depuis le badge
    const version = document.getElementById('version-badge')?.textContent || '?';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport TeamAI — ${date}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0B0B0F; color: #E2E8F0; font-family: system-ui, -apple-system, 'Inter', sans-serif;
    padding: 32px 24px; max-width: 960px; margin: 0 auto; line-height: 1.6;
  }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
  .subtitle { color: #64748B; font-size: 12px; margin-bottom: 20px; }
  .meta-bar {
    display: flex; gap: 12px; flex-wrap: wrap; padding: 12px 16px;
    background: #111118; border: 1px solid #1E1E2E; border-radius: 10px;
    margin-bottom: 24px; font-size: 12px; color: #94A3B8;
  }
  .meta-bar strong { color: #E2E8F0; }
  .prompt-box {
    background: #0D0D14; border: 1px solid #2A2A3E; border-radius: 10px;
    padding: 16px; margin-bottom: 24px;
  }
  .prompt-box .label {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
    color: #64748B; margin-bottom: 8px;
  }
  .prompt-box .text {
    font-size: 13px; color: #E2E8F0; line-height: 1.7; white-space: pre-wrap;
  }
  .resp-card {
    background: #111118; border: 1px solid #1E1E2E; border-radius: 10px;
    margin-bottom: 16px; overflow: hidden;
  }
  .resp-header {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-bottom: 1px solid #1A1A28;
  }
  .resp-badge {
    font-size: 11px; font-weight: 700; padding: 2px 10px;
    border-radius: 6px; letter-spacing: 0.3px;
  }
  .resp-meta { font-size: 10px; color: #64748B; margin-left: auto; }
  .toggle-btn {
    background: none; border: 1px solid #2A2A3A; color: #64748B;
    border-radius: 4px; cursor: pointer; font-size: 9px; width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
  }
  .toggle-btn:hover { background: #1E1E2E; }
  .resp-body {
    padding: 14px; font-size: 12.5px; line-height: 1.7; color: #CBD5E1;
    max-height: none; overflow-y: auto; transition: max-height 0.3s;
  }
  .resp-body.collapsed { max-height: 180px; overflow-y: hidden; }
  .resp-body pre {
    background: #0A0A12; border: 1px solid #1E1E2E; border-radius: 6px;
    padding: 12px; overflow-x: auto; font-size: 11px; line-height: 1.5;
    margin: 8px 0; font-family: 'SF Mono', 'Cascadia Code', monospace;
  }
  .resp-body pre code { background: none; padding: 0; }
  .resp-body br { content: ''; display: block; margin: 4px 0; }
  h2 {
    font-size: 14px; font-weight: 700; margin: 28px 0 12px;
    padding-bottom: 6px; border-bottom: 1px solid #1E1E2E;
  }
  .url-link {
    display: inline-block; color: #7C3AED; font-size: 11px;
    padding: 3px 8px; margin: 2px; background: #1E1A30; border-radius: 4px;
    text-decoration: none; word-break: break-all;
  }
  .url-link:hover { background: #2A1E4A; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }
  th { text-align: left; padding: 8px 10px; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E1E2E; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 8px 10px; border-bottom: 1px solid #1A1A28; }
  .bar { height: 6px; border-radius: 3px; max-width: 200px; }
  .dim { color: #555; font-size: 11px; }
  .badge {
    display: inline-block; font-size: 10px; padding: 1px 8px; border-radius: 10px;
    background: #1E1A30; color: #7C3AED; font-weight: 600;
  }
  .footer {
    margin-top: 40px; padding-top: 16px; border-top: 1px solid #1E1E2E;
    font-size: 10px; color: #555; text-align: center;
  }
  @media (max-width: 640px) {
    body { padding: 16px 12px; }
    .resp-header { flex-wrap: wrap; }
    .resp-meta { margin-left: 0; width: 100%; }
  }
</style>
</head>
<body>

<h1>📋 Rapport TeamAI</h1>
<div class="subtitle">Généré le ${date} · ${count} IA ${count > 1 ? 'consultées' : 'consultée'}</div>

<div class="meta-bar">
  <span>IA : <strong>${providers.join(', ')}</strong></span>
  <span>·</span>
  <span>Mots totaux : <strong>${stats.reduce((a, s) => a + s.words, 0).toLocaleString()}</strong></span>
  <span>·</span>
  <span>URLs : <strong>${allUrls.length}</strong></span>
  <span>·</span>
  <span>Code : <strong>${hasCode ? '✅ Détecté' : '—'}</strong></span>
</div>

<div class="prompt-box">
  <div class="label">📝 Prompt soumis</div>
  <div class="text">${prompt}</div>
</div>

<h2>🤖 Réponses détaillées</h2>
${responsesHTML}

<h2>🔗 URLs / Sources ${allUrls.length ? `<span class="badge">${allUrls.length}</span>` : ''}</h2>
<div style="display:flex;flex-wrap:wrap;gap:4px;">${urlsHTML}</div>

<h2>📊 Comparatif</h2>
<table>
  <thead><tr><th>IA</th><th>Mots</th><th>Caractères</th><th>Proportion</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>

<h2>📌 Notes</h2>
<p class="dim">Les réponses ont été collectées depuis les fenêtres ouvertes au moment du rapport.
Le bouton ▲/▼ permet de réduire les longues réponses.</p>

<div class="footer">
  Généré par <strong>TeamAI</strong> ${version} · ${date}
</div>

</body>
</html>`;

    // Sauvegarde + ouverture
    this._saveAndOpen(html);
  },

  _saveAndOpen(html) {
    try {
      const { join } = require('path');
      const { writeFileSync } = require('fs');
      const { tmpdir } = require('os');
      const filename = `TeamAI_rapport_${new Date().toISOString().slice(0,10)}.html`;
      const filePath = join(tmpdir(), filename);
      writeFileSync(filePath, html, 'utf-8');
      
      // Ouvrir dans le navigateur
      if (typeof teamai !== 'undefined' && teamai.openUrl) {
        teamai.openUrl('file://' + filePath);
      }
    } catch(e) {
      // Fallback: download via blob
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `TeamAI_rapport_${new Date().toISOString().slice(0,10)}.html`;
      a.click();
    }
  },

  exportMd() {
    // On garde l'export .md en réutilisant l'ancienne méthode _toMarkdown legacy
    const md = this._toMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TeamAI_rapport_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
  },

  // ── Legacy Markdown export (conservé pour compatibilité Drive) ──
  _toMarkdown() {
    const now   = new Date();
    const date  = now.toLocaleString('fr-FR');
    const iso   = now.toISOString().slice(0,10);
    const prompt = document.getElementById('prompt-input')?.value || '(aucun prompt)';
    const count = this._data.length;
    const providers = this._data.map(d => d.label).join(', ');
    let md = `# 📋 Rapport TeamAI\n\n> Généré le **${date}** — ${count} IA consultée${count>1?'s':''}\n\n---\n\n## 1. Prompt soumis\n\n> ${prompt.replace(/\n/g, '\n> ')}\n\n## 2. IA consultées (${count})\n\n${this._data.map((d,i)=>`${i+1}. ${d.label}`).join('\n')}\n\n## 3. Résumé exécutif\n\n_Première réponse reçue (${this._data[0]?.label || '—'}) :_\n\n${this._data[0]?.text?.substring(0,300) || ''}…\n\n## 4. Réponses détaillées\n\n`;
    this._data.forEach((d, i) => {
      md += `### ${i+1}. ${d.label}\n\n${d.text}\n\n---\n\n`;
    });
    const urls = [...new Set(this._data.flatMap(d => [...d.text.matchAll(/https?:\/\/[^\s)"'\]]+/g)].map(m=>m[0])))];
    md += `## 5. URLs / Sources (${urls.length})\n\n${urls.length ? urls.map(u=>`- ${u}`).join('\n') : '_Aucune URL détectée.'}\n\n`;
    const hasCode = this._data.some(d => d.text.includes('```'));
    md += `## 6. Blocs de code\n\n${hasCode ? '_Des blocs de code ont été détectés._' : '_Aucun bloc de code._'}\n\n`;
    md += `## 7. Statistiques\n\n`;
    this._data.forEach(d => {
      const words = d.text.split(/\s+/).filter(Boolean).length;
      md += `- **${d.label}** : ~${words} mots, ${d.text.length} caractères\n`;
    });
    md += `\n_Contexte : ${date} — ${providers}_\n\n_Rapport généré automatiquement par TeamAI v${document.getElementById("version-badge")?.textContent || "?"}_\n`;
    return md;
  },

  async exportToDrive() {
    const btn = document.getElementById('report-export-drive');
    if (btn) { btn.textContent = '⏳ Upload Drive...'; btn.disabled = true; }
    try {
      const status = await teamai.getGoogleStatus();
      if (!status || !status.connected) {
        alert('⚠️ Connecte-toi à Google d\'abord dans Réglages.');
        Settings.open();
        if (btn) { btn.textContent = '📂 Sauvegarder sur Drive'; btn.disabled = false; }
        return;
      }
      await teamai.exportReportToDrive({
        filename: `TeamAI_rapport_${new Date().toISOString().slice(0,10)}.md`,
        content: this._toMarkdown(),
        mimeType: 'text/markdown',
      });
      if (btn) { btn.textContent = '✅ Sauvegardé sur Drive'; }
      setTimeout(() => { if (btn) { btn.textContent = '📂 Sauvegarder sur Drive'; btn.disabled = false; } }, 3000);
    } catch(e) {
      alert('❌ Drive: ' + (e.message || e));
      if (btn) { btn.textContent = '📂 Sauvegarder sur Drive'; btn.disabled = false; }
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
  document.getElementById('report-export-html')?.addEventListener('click', () => ReportManager._collect());
  document.getElementById('report-export-drive')?.addEventListener('click', () => ReportManager.exportToDrive());
  document.getElementById('report-refresh')?.addEventListener('click', () => ReportManager._collect());

  const cb = document.getElementById('drive-auto-export');
  if (cb) {
    cb.checked = localStorage.getItem('teamai_drive_auto') === 'true';
    cb.addEventListener('change', () => localStorage.setItem('teamai_drive_auto', cb.checked));
  }
});
