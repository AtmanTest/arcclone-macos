"""
browser_pane.py — Panneau navigateur individuel avec QWebEngineProfile isolé.
Chaque pane = un profil séparé → cookies/cache/session indépendants.
"""

from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLineEdit, QPushButton, QLabel
from PySide6.QtCore import Qt, Signal, QUrl
from PySide6.QtGui import QFont

STORAGE_DIR = ".arcclone_profiles"


class BrowserPane(QWidget):
    url_changed = Signal(str)
    title_changed = Signal(str)
    load_finished = Signal(bool)

    def __init__(self, provider_id: str = "default", profile_name: str = None, parent=None):
        super().__init__(parent)
        self.provider_id = provider_id
        self._profile_name = profile_name or f"pane_{id(self)}"
        self._url = "about:blank"
        self._loading = False

        # Create isolated profile
        self._profile = self._create_profile(self._profile_name)

        # Create page + view with this profile
        self._page = QWebEnginePage(self._profile, self)
        self._view = QWebEngineView(self)
        self._view.setPage(self._page)

        # Signals
        self._page.urlChanged.connect(self._on_url_changed)
        self._page.titleChanged.connect(self._on_title_changed)
        self._page.loadFinished.connect(self._on_load_finished)

        # UI
        self._build_ui()
        self._apply_style()

    def _create_profile(self, name: str) -> QWebEngineProfile:
        profile = QWebEngineProfile(name, self)
        # Persist storage per profile
        import os
        storage = os.path.join(os.path.expanduser("~"), STORAGE_DIR, name)
        profile.setHttpCacheType(QWebEngineProfile.DiskHttpCache)
        profile.setHttpCacheMaximumSize(50 * 1024 * 1024)
        profile.setPersistentStoragePath(storage)
        profile.setPersistentCookiesPolicy(QWebEngineProfile.ForcePersistentCookies)
        return profile

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Toolbar
        toolbar = QWidget()
        toolbar.setObjectName("paneToolbar")
        t_layout = QHBoxLayout(toolbar)
        t_layout.setContentsMargins(4, 2, 4, 2)
        t_layout.setSpacing(3)

        self._back_btn = QPushButton("◀")
        self._back_btn.setFixedSize(22, 22)
        self._back_btn.setObjectName("paneNavBtn")
        self._back_btn.clicked.connect(lambda: self._view.back())

        self._fwd_btn = QPushButton("▶")
        self._fwd_btn.setFixedSize(22, 22)
        self._fwd_btn.setObjectName("paneNavBtn")
        self._fwd_btn.clicked.connect(lambda: self._view.forward())

        self._reload_btn = QPushButton("⟳")
        self._reload_btn.setFixedSize(22, 22)
        self._reload_btn.setObjectName("paneNavBtn")
        self._reload_btn.clicked.connect(lambda: self._view.reload())

        self._url_input = QLineEdit()
        self._url_input.setObjectName("paneUrl")
        self._url_input.setPlaceholderText("Entrez une URL...")
        self._url_input.returnPressed.connect(self._navigate)
        self._url_input.setFont(QFont("SF Mono", 10))

        self._badge = QLabel()
        self._badge.setFixedSize(18, 18)
        self._badge.setObjectName("paneBadge")

        layout.addWidget(toolbar)
        layout.addWidget(self._view, 1)
        t_layout.addWidget(self._badge)
        t_layout.addWidget(self._back_btn)
        t_layout.addWidget(self._fwd_btn)
        t_layout.addWidget(self._reload_btn)
        t_layout.addWidget(self._url_input, 1)

    def _apply_style(self):
        self.setStyleSheet("""
            #paneToolbar {
                background: #1e1e2e;
                border-bottom: 1px solid #2d2d44;
            }
            #paneNavBtn {
                background: transparent;
                border: none;
                color: #8888aa;
                font-size: 11px;
                border-radius: 4px;
                padding: 0;
            }
            #paneNavBtn:hover {
                background: #2d2d44;
                color: #e0e0ff;
            }
            #paneUrl {
                background: #252540;
                border: 1px solid #2d2d44;
                border-radius: 5px;
                padding: 2px 8px;
                color: #e0e0ff;
                font-size: 10px;
                height: 22px;
            }
            #paneUrl:focus {
                border-color: #6c63ff;
                background: #1a1a35;
            }
            #paneBadge {
                font-size: 14px;
            }
        """)

    def _navigate(self):
        url = self._url_input.text().strip()
        if not url:
            return
        if not url.startswith(("http://", "https://", "about:")):
            url = "https://" + url
        self._url = url
        self._view.setUrl(QUrl(url))

    def _on_url_changed(self, qurl: QUrl):
        url = qurl.toString()
        self._url = url
        self._url_input.setText(url)
        self.url_changed.emit(url)

    def _on_title_changed(self, title: str):
        self.title_changed.emit(title)

    def _on_load_finished(self, ok: bool):
        self._loading = False
        self.load_finished.emit(ok)

    def load(self, url: str):
        if not url.startswith(("http://", "https://", "about:")):
            url = "https://" + url
        self._url = url
        self._url_input.setText(url)
        self._view.setUrl(QUrl(url))

    def set_badge(self, icon: str):
        self._badge.setText(icon)

    @property
    def web_view(self) -> QWebEngineView:
        return self._view

    @property
    def web_page(self) -> QWebEnginePage:
        return self._page

    @property
    def profile(self) -> QWebEngineProfile:
        return self._profile

    @property
    def current_url(self) -> str:
        return self._url
