/**
 * TeamAI — App Entry Point
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Init modules
  PromptDispatcher.init();
  Bookmarks.init();

  // Wait for WindowManager to sync
  await WindowManager.init();

  // Sidebar buttons
  document.getElementById('reset-layout')?.addEventListener('click', () => {
    // Reloads default view positions
    teamai.addDefaultViews().then(() => WindowManager.restoreDefault());
  });

  document.getElementById('save-session')?.addEventListener('click', () => {
    const data = {
      views: WindowManager.list.map(v => ({ providerId: v.providerId, url: v.url })),
      bookmarks: Bookmarks.items,
    };
    localStorage.setItem('teamai_session', JSON.stringify(data));
    alert('Session sauvegardée ✅');
  });

  // Check for saved session
  const saved = localStorage.getItem('teamai_session');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.views && data.views.length > 0 && confirm('Restaurer la session précédente ?')) {
        await teamai.clearAllViews();
        WindowManager.views.clear();
        for (const v of data.views) {
          const id = await teamai.addView(v.providerId || 'default');
          if (id && v.url && v.url !== 'about:blank') {
            setTimeout(() => teamai.navigateView(id, v.url), 500);
          }
        }
        const ids = await teamai.getViewIds();
        await WindowManager._sync(ids);
      }
    } catch {}
  }
});
