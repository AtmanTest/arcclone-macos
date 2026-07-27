"""
prompt_dispatcher.py — Injection de prompts dans les panneaux via runJavaScript().
Stratégies: textarea, contenteditable, input. Auto-submit après injection.
Envoie à TOUS les panneaux, pas seulement ceux du provider correspondant.
"""

from PySide6.QtCore import QTimer


def _js_str(s):
    """Safe JSON string for JS."""
    import json
    return json.dumps(s)


class PromptDispatcher:
    """Distribue un prompt à tous les panneaux et tente la soumission automatique."""

    def dispatch_all(self, prompt: str, panes: list, auto_submit: bool = True):
        """Envoie le prompt à tous les panneaux actifs."""
        if not prompt or not panes:
            return

        for pane in panes:
            self._inject_and_submit(pane, prompt, auto_submit)

    def _inject_and_submit(self, pane, prompt: str, auto_submit: bool):
        """Injecte le prompt dans le pane, puis soumet si auto_submit."""
        page = pane.web_page
        if not page:
            return

        safe = _js_str(prompt)

        # Try contenteditable first, then textarea
        js = f"""
        (function() {{
            const selectors = [
                '[contenteditable="true"]',
                '#prompt-textarea',
                'textarea',
                '.ProseMirror',
                '[role="textbox"]',
                'input[type="text"]'
            ];
            for (const sel of selectors) {{
                const el = document.querySelector(sel);
                if (!el) continue;
                el.focus();
                if (el.isContentEditable || el.tagName === 'DIV' || el.classList.contains('ProseMirror')) {{
                    el.textContent = '';
                    document.execCommand('insertText', false, {safe});
                }} else {{
                    el.value = {safe};
                }}
                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                el.dispatchEvent(new Event('keydown', {{ bubbles: true }}));
                return el;
            }}
            return null;
        }})();
        """
        page.runJavaScript(js, self._make_submit_callback(page, auto_submit))

    def _make_submit_callback(self, page, auto_submit: bool):
        if not auto_submit:
            return None

        def callback(result):
            if result is not None:
                # Attendre que le DOM se stabilise, puis soumettre
                QTimer.singleShot(600, lambda: self._try_submit(page))

        return callback

    def _try_submit(self, page):
        """Tente de soumettre par Enter ou clic sur bouton."""
        js = """
        (function() {
            const el = document.activeElement || document.querySelector('textarea') ||
                       document.querySelector('[contenteditable="true"]') ||
                       document.querySelector('[role="textbox"]');
            if (!el) return false;

            // Try Enter key
            const ev = new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                bubbles: true, cancelable: true
            });
            if (el.dispatchEvent(ev)) return true;

            // Try submit button
            const btns = document.querySelectorAll('button[type="submit"], button:has(svg), ' +
                'button[data-testid="send-button"], button[aria-label*="Send"], ' +
                'button[aria-label*="Envoyer"]');
            for (const btn of btns) {
                if (btn.offsetParent !== null) { btn.click(); return true; }
            }
            return false;
        })();
        """
        page.runJavaScript(js)
