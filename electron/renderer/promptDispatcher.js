/**
 * TeamAI — Prompt Dispatcher
 * Dispatch direct vers WinManager._dispatchToAll()
 * Intègre DispatchProgress pour le feedback en temps réel.
 */
const PromptDispatcher = {
  init() {
    const input = document.getElementById('prompt-input');
    const btn   = document.getElementById('go-btn');
    if (!input || !btn) return;

    const dispatch = () => {
      const text = input.value.trim();
      if (!text) return;
      if (typeof WinManager._dispatchToAll === 'function') {
        WinManager._dispatchToAll(text);
      }
    };

    btn.addEventListener('click', dispatch);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) return;
      if (e.key === 'Enter') { e.preventDefault(); dispatch(); }
    });
  },
};
