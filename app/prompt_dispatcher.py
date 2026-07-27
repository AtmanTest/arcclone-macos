"""
prompt_dispatcher.py — Injection JS robuste avec retry.
Injection dans TOUS les panneaux, Enter auto, retry si page pas prête.
"""

from PySide6.QtCore import QTimer
import json


class PromptDispatcher:

    def dispatch_all(self, prompt: str, panes: list, auto_submit=True):
        if not prompt.strip() or not panes:
            return
        pane_list = list(panes)
        for pane in pane_list:
            self._inject(pane, prompt, auto_submit, attempt=1)

    def _inject(self, pane, prompt, auto_submit, attempt=1):
        if attempt > 5:
            return
        if not pane:
            return
        try:
            page = pane.web_page
        except RuntimeError:
            return
        if not page:
            return

        safe = json.dumps(prompt)

        js = f"""
        (function() {{
            const sels = [
                '#prompt-textarea', '[contenteditable="true"]', 'textarea',
                '.ProseMirror', '[role="textbox"]', 'input[type="text"]'
            ];
            for (const sel of sels) {{
                const el = document.querySelector(sel);
                if (!el) continue;
                el.focus();
                if (el.isContentEditable || el.tagName === 'DIV') {{
                    el.textContent = '';
                    document.execCommand('insertText', false, {safe});
                }} else {{
                    el.value = {safe};
                }}
                el.dispatchEvent(new Event('input', {{bubbles:true}}));
                el.dispatchEvent(new Event('change', {{bubbles:true}}));
                return 'found';
            }}
            return 'not_found';
        }})();
        """
        try:
            page.runJavaScript(js, lambda r: self._on_injected(pane, page, r, prompt, auto_submit, attempt))
        except RuntimeError:
            pass

    def _on_injected(self, pane, page, result, prompt, auto_submit, attempt):
        if result == 'found' and auto_submit:
            QTimer.singleShot(800, lambda p=page: self._submit(p, attempt=1))
        elif result == 'not_found':
            QTimer.singleShot(1500, lambda p=pane: self._inject(
                p, prompt, auto_submit, attempt + 1
            ))

    def _submit(self, page, attempt=1):
        if attempt > 3:
            return
        js = """
        (function() {
            const btnSels = [
                'button[data-testid="send-button"]',
                'button[type="submit"]',
                'button:has(svg)',
                '[aria-label*="Send"]', '[aria-label*="send"]',
                '[aria-label*="Envoyer"]', '[aria-label*="envoyer"]',
                '.ProseMirror ~ div button'
            ];
            const el = document.activeElement || document.querySelector('textarea') ||
                       document.querySelector('[contenteditable="true"]');
            if (el) {
                const ev = new KeyboardEvent('keydown', {
                    key:'Enter', code:'Enter', keyCode:13, which:13,
                    bubbles:true, cancelable:true
                });
                if (!el.dispatchEvent(ev)) { return 'sent'; }
            }
            for (const sel of btnSels) {
                const btns = document.querySelectorAll(sel);
                for (const btn of btns) {
                    if (btn.offsetParent !== null) { btn.click(); return 'clicked'; }
                }
            }
            return 'failed';
        })();
        """
        try:
            page.runJavaScript(js, lambda r: self._on_submit_result(page, r, attempt))
        except RuntimeError:
            pass

    def _on_submit_result(self, page, result, attempt):
        if result == 'failed' and attempt < 3:
            QTimer.singleShot(1000, lambda p=page: self._submit(p, attempt + 1))
