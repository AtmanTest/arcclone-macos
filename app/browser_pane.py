"""
browser_pane.py — Panneau navigateur individuel avec QWebEngineProfile isolé.
Signal close_requested + numéro de fenêtre.
"""

import os
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLineEdit, QPushButton, QLabel, QComboBox
from PySide6.QtCore import Qt, Signal, QUrl
from PySide6.QtGui import QFont

STORAGE_DIR = ".teamai_profiles"


class BrowserPane(QWidget):
    url_changed = Signal(str)
    title_changed = Signal(str)
    load_finished = Signal(bool)
    close_requested = Signal(object)

    def __init__(self, provider_id="default", profile_name=None, pane_number=1, providers=None, parent=None):
        super().__init__(parent)
        self.provider_id = provider_id
        self.pane_number = pane_number
        self._providers = providers or []
        self._profile_name = profile_name or f"pane_{id(self)}"
        self._url = "about:blank"
        self._loading = False

        self._profile = QWebEngineProfile(self._profile_name, self)
        storage = os.path.join(os.path.expanduser("~"), STORAGE_DIR, self._profile_name)
        self._profile.setHttpCacheType(QWebEngineProfile.DiskHttpCache)
        self._profile.setHttpCacheMaximumSize(50 * 1024 * 1024)
        self._profile.setPersistentStoragePath(storage)
        self._profile.setPersistentCookiesPolicy(QWebEngineProfile.ForcePersistentCookies)

        self._page = QWebEnginePage(self._profile, self)
        self._view = QWebEngineView(self)
        self._view.setPage(self._page)

        self._page.urlChanged.connect(self._on_url_changed)
        self._page.titleChanged.connect(self._on_title_changed)
        self._page.loadFinished.connect(self._on_load_finished)

        self._build_ui()
        self._apply_style()

    def cleanup(self):
        try:
            self._page.deleteLater()
            self._view.deleteLater()
            self._profile.deleteLater()
        except RuntimeError:
            pass

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        toolbar = QWidget()
        toolbar.setObjectName("paneToolbar")
        t = QHBoxLayout(toolbar)
        t.setContentsMargins(3, 2, 3, 2)
        t.setSpacing(2)

        self._number = QLabel(str(self.pane_number))
        self._number.setObjectName("paneNumber")
        self._number.setFixedSize(16, 16)

        self._badge = QLabel()
        self._badge.setFixedSize(16, 16)
        self._badge.setObjectName("paneBadge")

        self._provider_combo = QComboBox()
        self._provider_combo.setObjectName("providerCombo")
        self._provider_combo.setFixedWidth(140)
        for p in self._providers:
            self._provider_combo.addItem(f"{p.get('icon','')} {p.get('label','')}", p.get("id"))
        # Select current provider
        for i in range(self._provider_combo.count()):
            if self._provider_combo.itemData(i) == self.provider_id:
                self._provider_combo.setCurrentIndex(i)
                break
        self._provider_combo.currentIndexChanged.connect(self._on_provider_changed)

        self._back = QPushButton("◀")
        self._back.setFixedSize(20, 20)
        self._back.setObjectName("paneBtn")
        self._back.clicked.connect(lambda: self._safe_call(lambda: self._view.back()))

        self._fwd = QPushButton("▶")
        self._fwd.setFixedSize(20, 20)
        self._fwd.setObjectName("paneBtn")
        self._fwd.clicked.connect(lambda: self._safe_call(lambda: self._view.forward()))

        self._reload = QPushButton("⟳")
        self._reload.setFixedSize(20, 20)
        self._reload.setObjectName("paneBtn")
        self._reload.clicked.connect(lambda: self._safe_call(lambda: self._view.reload()))

        self._url_input = QLineEdit()
        self._url_input.setObjectName("paneUrl")
        self._url_input.setPlaceholderText("URL ou recherche...")
        self._url_input.returnPressed.connect(self._navigate)
        self._url_input.setFont(QFont("SF Mono", 9))

        self._close = QPushButton("✕")
        self._close.setFixedSize(18, 18)
        self._close.setObjectName("paneClose")
        self._close.clicked.connect(lambda: self.close_requested.emit(self))

        layout.addWidget(toolbar)
        layout.addWidget(self._view, 1)
        t.addWidget(self._number)
        t.addWidget(self._badge)
        t.addWidget(self._provider_combo)
        t.addWidget(self._back)
        t.addWidget(self._fwd)
        t.addWidget(self._reload)
        t.addWidget(self._url_input, 1)
        t.addWidget(self._close)

    def _apply_style(self):
        self.setStyleSheet("""
            #paneToolbar { background: #1e1e2e; border-bottom: 1px solid #2d2d44; }
            #paneNumber {
                background: #2d2d44; color: #8888aa; font-size: 8px; font-weight: 700;
                border-radius: 3px; qproperty-alignment: AlignCenter;
            }
            #paneBtn {
                background: transparent; border: none; color: #8888aa;
                font-size: 10px; border-radius: 3px; padding: 0;
            }
            #paneBtn:hover { background: #2d2d44; color: #e0e0ff; }
            #paneUrl {
                background: #252540; border: 1px solid #2d2d44; border-radius: 4px;
                padding: 1px 6px; color: #e0e0ff; font-size: 9px; height: 20px;
            }
            #paneUrl:focus { border-color: #6c63ff; background: #1a1a35; }
            #paneBadge { font-size: 12px; }
            #providerCombo {
                background: #252540; border: 1px solid #2d2d44; border-radius: 4px;
                color: #e0e0ff; font-size: 9px; padding: 1px 2px; min-height: 18px;
            }
            #providerCombo:focus { border-color: #6c63ff; }
            #providerCombo::drop-down { border: none; width: 16px; }
            #providerCombo::down-arrow { image: none; border: none; }
            #providerCombo QAbstractItemView {
                background: #1e1e2e; color: #e0e0ff; border: 1px solid #2d2d44;
                selection-background-color: #6c63ff; font-size: 9px;
            }
            #paneClose {
                background: transparent; border: none; color: #555577;
                font-size: 9px; border-radius: 3px; padding: 0;
            }
            #paneClose:hover { background: #ff5f5733; color: #ff5f57; }
        """)

    def _on_provider_changed(self, idx):
        if idx < 0 or idx >= len(self._providers):
            return
        p = self._providers[idx]
        self.provider_id = p.get("id", "default")
        self._badge.setText(p.get("icon", ""))
        self.load(p.get("url", "about:blank"))

    def _navigate(self):
        text = self._url_input.text().strip()
        if not text:
            return
        if "." in text and not text.startswith(("http://", "https://", "about:", "chrome-extension:")):
            text = "https://" + text
        elif "." not in text or " " in text:
            text = "https://www.google.com/search?q=" + text.replace(" ", "+")
        self._url = text
        self._safe_call(lambda: self._view.setUrl(QUrl(text)))

    def _safe_call(self, fn):
        """Appelle fn() en rattrapant RuntimeError (C++ object deleted)."""
        try:
            fn()
        except RuntimeError:
            pass  # C++ object already deleted, ignore

    def _on_url_changed(self, qurl):
        url = qurl.toString()
        self._url = url
        self._safe_call(lambda: self._url_input.setText(url))
        self.url_changed.emit(url)

    def _on_title_changed(self, title):
        self.title_changed.emit(title)

    def _on_load_finished(self, ok):
        self._loading = False
        self.load_finished.emit(ok)

    def load(self, url):
        if not url or url == "about:blank":
            self._url = "about:blank"
            self._url_input.clear()
            self._safe_call(lambda: self._view.setUrl(QUrl("about:blank")))
            return
        if not url.startswith(("http://", "https://", "about:")):
            url = "https://" + url
        self._url = url
        self._url_input.setText(url)
        self._safe_call(lambda: self._view.setUrl(QUrl(url)))

    def set_badge(self, icon):
        self._badge.setText(icon)

    def set_number(self, n):
        self.pane_number = n
        self._number.setText(str(n))

    @property
    def web_view(self): return self._view
    @property
    def web_page(self): return self._page
    @property
    def profile(self): return self._profile
    @property
    def current_url(self): return self._url
