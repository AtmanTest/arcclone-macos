"""
prompt_dispatcher.py — Injection de prompts dans les panneaux via runJavaScript().
Stratégies: textarea, contenteditable, input, Enter key simulation.
"""

import asyncio
from typing import Optional

from PySide6.QtCore import QTimer
from PySide6.QtWebEngineCore import QWebEnginePage

from app.provider_registry import Provider, ProviderRegistry


class PromptDispatcher:
    def __init__(self):
        self._registry = ProviderRegistry()

    def dispatch(self, prompt: str, pane, provider_id: str, mode: str = "auto"):
        """
        Injecte `prompt` dans le panneau selon la stratégie du provider.

        mode: "auto" (soumission automatique), "manual" (copie seulement)
        """
        provider = self._registry.get(provider_id)
        if not provider:
            self._fallback_textarea(pane.web_page, prompt)
            return

        strategy = provider.prompt_strategy

        if strategy == "contenteditable":
            self._inject_contenteditable(pane.web_page, prompt, provider, mode)
        elif strategy == "textarea":
            self._inject_textarea(pane.web_page, prompt, provider, mode)
        else:
            self._inject_textarea(pane.web_page, prompt, provider, mode)

    def _inject_textarea(self, page: QWebEnginePage, prompt: str, provider: Provider, mode: str):
        """Injecte dans un textarea, puis soumet si mode auto."""
        selector = provider.input_selectors[0] if provider.input_selectors else "textarea"
        js = f"""
        (function() {{
            const el = document.querySelector('{selector}');
            if (!el) return false;
            el.value = {repr(prompt)};
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            return true;
        }})();
        """
        page.runJavaScript(js, self._js_callback(page, prompt, provider, mode))

    def _inject_contenteditable(self, page: QWebEnginePage, prompt: str, provider: Provider, mode: str):
        """Injecte dans un contenteditable (ProseMirror, etc.), puis soumet si mode auto."""
        selector = provider.input_selectors[0] if provider.input_selectors else "[contenteditable='true']"
        js = f"""
        (function() {{
            const el = document.querySelector('{selector}');
            if (!el) return false;
            el.focus();
            el.textContent = '';
            document.execCommand('insertText', false, {repr(prompt)});
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            return true;
        }})();
        """
        page.runJavaScript(js, self._js_callback(page, prompt, provider, mode))

    def _js_callback(self, page: QWebEnginePage, prompt: str, provider: Provider, mode: str):
        """Returns a callback that submits after a delay if mode is auto."""
        if mode != "auto":
            return None

        def callback(result):
            if result is True or result is None:
                # Wait for DOM to settle, then submit
                QTimer.singleShot(800, lambda: self._submit(page, provider))

        return callback

    def _submit(self, page: QWebEnginePage, provider: Provider):
        """Tente de soumettre en cliquant sur le bouton submit ou en simulant Enter."""
        # Try clicking submit button
        for selector in provider.submit_selectors:
            js = f"""
            (function() {{
                const btn = document.querySelector('{selector}');
                if (btn) {{ btn.click(); return true; }}
                return false;
            }})();
            """
            page.runJavaScript(js, lambda ok: None)
            return

        # Fallback: simulate Enter in textarea
        for selector in provider.input_selectors:
            js = f"""
            (function() {{
                const el = document.querySelector('{selector}');
                if (!el) return false;
                const ev = new KeyboardEvent('keydown', {{ key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true }});
                el.dispatchEvent(ev);
                return true;
            }})();
            """
            page.runJavaScript(js, lambda ok: None)
            return

    def _fallback_textarea(self, page: QWebEnginePage, prompt: str):
        """Fallback générique si aucun provider trouvé."""
        js = f"""
        (function() {{
            const el = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
            if (!el) return false;
            el.focus();
            if (el.tagName === 'TEXTAREA') {{
                el.value = {repr(prompt)};
            }} else {{
                el.textContent = '';
                document.execCommand('insertText', false, {repr(prompt)});
            }}
            return true;
        }})();
        """
        page.runJavaScript(js)


def repr(s: str) -> str:
    """Safe JS string representation."""
    return json.dumps(s)


import json
