/**
 * TeamAI v4 — Entry Point
 */
document.addEventListener('DOMContentLoaded', async () => {
  PromptDispatcher.init();
  await WinManager.init();
  await Sidebar.init();

  // Resize → reflow grid
  const viewport = document.getElementById('viewport');
  if (viewport) {
    let resizeTimer;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => WinManager._sizeAll(), 100);
    });
    ro.observe(viewport);
  }

  // Auto-save session on close
  window.addEventListener('beforeunload', () => {
    if (WinManager.count > 0) {
      const views = WinManager.list;
      localStorage.setItem('teamai_session', JSON.stringify({ views }));
    }
  });
});
