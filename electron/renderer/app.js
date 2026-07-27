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

  // File attachment support
  document.getElementById('btn-attach')?.addEventListener('click', async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.multiple = true;
    fileInput.addEventListener('change', async () => {
      const files = Array.from(fileInput.files);
      if (files.length === 0) return;
      for (const file of files) {
        const text = await file.text();
        const input = document.getElementById('prompt-input');
        if (input) input.value += `\n\n[Fichier: ${file.name}]\n${text.substring(0, 10000)}`;
      }
    });
    fileInput.click();
  });

  // Auto-save session
  window.addEventListener('beforeunload', () => {
    if (WinManager.count > 0) localStorage.setItem('teamai_session', JSON.stringify({ views: WinManager.list }));
  });
});
