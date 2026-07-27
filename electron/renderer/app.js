/**
 * TeamAI v3 — App Entry Point
 */
document.addEventListener('DOMContentLoaded', async () => {
  PromptDispatcher.init();
  await WinManager.init();
  await Sidebar.init();

  // Scroll sync: viewport → IPC → reposition BrowserViews
  const viewport = document.getElementById('viewport');
  if (viewport) {
    let scrollTimer;
    viewport.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        teamai.scrollViewport(viewport.scrollTop);
      }, 30);
    });
  }

  // Restore session
  const saved = localStorage.getItem('teamai_session');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.views?.length > 0 && confirm('Restaurer la session précédente ?')) {
        await teamai.clearAll();
        for (const v of data.views) {
          const id = await teamai.addView(v.providerId || 'default');
          if (id && v.url && v.url !== 'about:blank') {
            setTimeout(() => teamai.navigateView(id, v.url), 800);
          }
        }
      }
    } catch {}
  }

  // Auto-save session on close
  window.addEventListener('beforeunload', () => {
    teamai.getViews().then(views => {
      if (views.length > 0) {
        localStorage.setItem('teamai_session', JSON.stringify({
          views: views.map(v => ({ providerId: v.providerId, url: v.url })),
        }));
      }
    }).catch(() => {});
  });
});
