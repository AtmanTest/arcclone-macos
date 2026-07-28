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
  const providers = await teamai.loadProviders();
  PromptDispatcher.init();
  await WinManager.init(providers);
  await Sidebar.init(providers);

  // Resize observer
  const viewport = document.getElementById('viewport');
  if (viewport) {
    let t; const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => WinManager._layout(), 100); });
    ro.observe(viewport);
  }

  // File attachment
  document.getElementById('btn-attach')?.addEventListener('click', async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.multiple = false;
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const input = document.getElementById('prompt-input');
      if (!input) return;
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
        input.value += `\n\n📷 [Image: ${file.name}] — Ajoute l'image manuellement dans chaque chat.`;
      } else {
        input.value += `\n\n📎 [Fichier: ${file.name} (${(file.size / 1024).toFixed(1)} KB)] — Ajoute-le manuellement.`;
      }
    });
    fileInput.click();
  });

  // ── Update button ──
  const updateBtn = document.getElementById('btn-update');
  async function checkUpdate() {
    if (!updateBtn) return;
    try {
      const info = await teamai.checkUpdate();
      if (info.hasUpdate) {
        updateBtn.textContent = `🔄 Mise à jour disponible (${info.behind} commits)`;
        updateBtn.style.color = '#EF4444';
        updateBtn.style.fontWeight = '700';
        updateBtn.disabled = false;
      } else {
        updateBtn.textContent = '✓ À jour';
        updateBtn.style.color = '#555';
        updateBtn.style.fontWeight = '400';
        updateBtn.disabled = true;
      }
    } catch {
      updateBtn.textContent = '🔄 Mettre à jour';
      updateBtn.style.color = '#666';
      updateBtn.disabled = false;
    }
  }
  checkUpdate();
  // Periodic check every 5 min
  setInterval(checkUpdate, 300000);

  updateBtn?.addEventListener('click', async () => {
    if (!confirm('Mettre à jour depuis GitHub ? L\'app va redémarrer.')) return;
    updateBtn.textContent = '⏳ Mise à jour...'; updateBtn.disabled = true;
    try {
      await teamai.updateApp();
    } catch (e) {
      alert('❌ Erreur: ' + e.message);
      updateBtn.textContent = '🔄 Mettre à jour'; updateBtn.disabled = false;
    }
  });

  // ── Add IA button ──
  document.getElementById('btn-add-ia')?.addEventListener('click', () => {
    const name = prompt('Nom du provider IA :');
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').trim();
    if (!id) return;
    const url = prompt('URL du provider :', 'https://');
    if (!url) return;
    const icon = prompt('Icône (emoji) :', '🤖') || '🤖';
    // Add to providers list
    WinManager.providers.push({ id, label: name, url, icon });
    WinManager.addView(id);
  });

  // Auto-save session
  window.addEventListener('beforeunload', () => {
    if (WinManager.count > 0) localStorage.setItem('teamai_session', JSON.stringify({ views: WinManager.list }));
  });
});
