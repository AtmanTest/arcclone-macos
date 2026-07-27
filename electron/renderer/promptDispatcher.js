/**
 * TeamAI — Prompt Dispatcher
 * Sends prompt to all open views via IPC → executeJavaScript.
 */
const PromptDispatcher = {
  init() {
    const input = document.getElementById('prompt-input');
    const btn = document.getElementById('go-btn');
    if (!input || !btn) return;

    const dispatch = () => {
      const text = input.value.trim();
      if (!text) return;
      teamai.dispatchPrompt(text);
      input.value = '';
    };

    btn.addEventListener('click', dispatch);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        dispatch();
      }
    });
  },
};
