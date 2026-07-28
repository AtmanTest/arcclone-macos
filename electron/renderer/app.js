const ErrorBar = {
  _timeout: null,
  show(msg) {
    const bar = document.getElementById('error-bar');
    if (!bar) return;
    bar.textContent = '⚠ ' + msg;
    bar.classList.add('show');
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => bar.classList.remove('show'), 8000);
  },
  clear() {
    const bar = document.getElementById('error-bar');
    if (bar) bar.classList.remove('show');
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  PromptDispatcher.init();
  await WinManager.init();
  await Sidebar.init();

  // Resize observer for viewport
  const viewport = document.getElementById('viewport');
  if (viewport) {
    let t; const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => WinManager._layout(), 100); });
    ro.observe(viewport);
  }

  // File attachment with type detection
  document.getElementById('btn-attach')?.addEventListener('click', async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.multiple = false;
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const input = document.getElementById('prompt-input');
      if (!input) return;
      // Detect file type
      const isText = file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')
        || file.name.endsWith('.js') || file.name.endsWith('.py') || file.name.endsWith('.json')
        || file.name.endsWith('.csv') || file.name.endsWith('.html') || file.name.endsWith('.css')
        || file.name.endsWith('.xml') || file.name.endsWith('.yaml') || file.name.endsWith('.yml')
        || file.name.endsWith('.log') || file.name.endsWith('.sh');
      const isImage = file.type.startsWith('image/');
      if (isText) {
        const text = await file.text();
        input.value += `\n\n[Fichier: ${file.name}]\n${text.substring(0, 10000)}`;
      } else if (isImage) {
        input.value += `\n\n📷 [Image: ${file.name}] — L'upload d'images n'est pas supporté en dispatch multi-IA. Ajoute l'image manuellement dans chaque chat.`;
      } else {
        input.value += `\n\n📎 [Fichier: ${file.name} (${(file.size / 1024).toFixed(1)} KB)] — Format non-texte, ajoute-le manuellement.`;
      }
    });
    fileInput.click();
  });

  // Update button
  document.getElementById('btn-update')?.addEventListener('click', async () => {
    if (!confirm('Mettre à jour depuis GitHub ? L\'app va redémarrer.')) return;
    const btn = document.getElementById('btn-update');
    if (btn) { btn.textContent = '⏳ Mise à jour...'; btn.disabled = true; }
    try {
      const result = await teamai.updateApp();
      alert(result);
    } catch (e) {
      alert('❌ Erreur: ' + e.message);
      if (btn) { btn.textContent = '🔄 Mettre à jour'; btn.disabled = false; }
    }
  });

  // Auto-save session
  window.addEventListener('beforeunload', () => {
    if (WinManager.count > 0) localStorage.setItem('teamai_session', JSON.stringify({ views: WinManager.list }));
  });
});
