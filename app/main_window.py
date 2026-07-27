"""
main_window.py — Fenêtre principale TeamAI.
Sidebar stats + espaces + bookmarks. 9 panneaux par défaut.
Historique, mode privé, sauvegarde session, Google search fallback.
"""

import json
import os
from datetime import datetime

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLineEdit, QLabel, QScrollArea,
    QMenu, QMenuBar, QMessageBox, QApplication,
    QTextEdit, QFrame, QSizePolicy
)
from PySide6.QtCore import Qt, QUrl, QTimer
from PySide6.QtGui import QFont, QAction, QKeySequence

from .browser_pane import BrowserPane
from .layout_manager import LayoutManager, LayoutMode
from .provider_registry import ProviderRegistry
from .prompt_dispatcher import PromptDispatcher

STORAGE = ".teamai_data"


class TeamAIWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self._reg = ProviderRegistry()
        self._disp = PromptDispatcher()
        self._panes: list[BrowserPane] = []
        self._layout = LayoutManager()
        self._pane_counter = 0
        self._private = False
        self._history: list[dict] = []
        self._bookmarks: list[dict] = []

        self.setWindowTitle("TeamAI")
        self.setMinimumSize(1200, 800)
        self.resize(1500, 950)
        self._setup_menu()
        self._load_history()
        self._load_bookmarks()
        self._build_ui()
        self._apply_theme()
        self._render_bookmarks()

    # ===== MENU =====
    def _setup_menu(self):
        mb = self.menuBar()
        mb.setStyleSheet("""
            QMenuBar { background: #1e1e2e; color: #8888aa; border-bottom: 1px solid #2d2d44; padding: 2px; }
            QMenuBar::item:selected { background: #2d2d44; color: #e0e0ff; }
            QMenu { background: #1e1e2e; color: #e0e0ff; border: 1px solid #2d2d44; }
            QMenu::item:selected { background: #6c63ff; }
        """)
        f = mb.addMenu("TeamAI")
        a = QAction("💾 Sauvegarder session", self)
        a.triggered.connect(self._save_session)
        f.addAction(a)
        a = QAction("📂 Charger session", self)
        a.triggered.connect(self._load_session_dialog)
        f.addAction(a)
        f.addSeparator()
        a = QAction("Quitter", self)
        a.triggered.connect(self.close)
        f.addAction(a)

        v = mb.addMenu("Vue")
        a = QAction("Mode privé", self, checkable=True, shortcut=QKeySequence("Ctrl+Shift+P"))
        a.triggered.connect(self._toggle_private)
        v.addAction(a)
        v.addSeparator()
        a = QAction("🗑️ Purger historique", self)
        a.triggered.connect(self._clear_history)
        v.addAction(a)
        a = QAction("🍪 Purger cookies", self)
        a.triggered.connect(self._clear_cookies)
        v.addAction(a)

        p = mb.addMenu("Panneaux")
        a = QAction("+ Nouveau", self, shortcut=QKeySequence("Ctrl+N"))
        a.triggered.connect(self._add_pane)
        p.addAction(a)
        a = QAction("⟳ Tout recharger", self, shortcut=QKeySequence("Ctrl+R"))
        a.triggered.connect(lambda: [x.web_view.reload() for x in self._panes])
        p.addAction(a)

    # ===== UI =====
    def _build_ui(self):
        c = QWidget()
        self.setCentralWidget(c)
        r = QHBoxLayout(c)
        r.setContentsMargins(0, 0, 0, 0)
        r.setSpacing(0)
        r.addWidget(self._build_sidebar())
        m = QWidget()
        ml = QVBoxLayout(m)
        ml.setContentsMargins(0, 0, 0, 0)
        ml.setSpacing(0)
        ml.addWidget(self._build_prompt())
        ml.addWidget(self._layout, 1)
        r.addWidget(m, 1)
        self._add_default_panes()

    # ===== SIDEBAR =====
    def _build_sidebar(self):
        s = QWidget()
        s.setFixedWidth(230)
        s.setObjectName("sidebar")
        l = QVBoxLayout(s)
        l.setContentsMargins(8, 6, 8, 6)
        l.setSpacing(4)

        # Logo
        logo = QLabel("🧠 TeamAI")
        logo.setObjectName("sidebarLogo")
        l.addWidget(logo)

        # Stats dashboard
        self._stats = QLabel("Fenêtres: 0 | IA: 0")
        self._stats.setObjectName("statsLabel")
        l.addWidget(self._stats)

        self._status = QLabel("● Standard")
        self._status.setObjectName("statusLabel")
        l.addWidget(self._status)

        l.addSpacing(4)
        l.addWidget(QLabel("ESPACES"), 0, Qt.AlignLeft)
        self._spaces_widget = QWidget()
        self._spaces_layout = QVBoxLayout(self._spaces_widget)
        self._spaces_layout.setContentsMargins(0, 0, 0, 0)
        self._spaces_layout.setSpacing(2)

        # Default space
        btn = QPushButton("🚀  Espace IA")
        btn.setObjectName("spaceBtn")
        btn.clicked.connect(self._add_default_panes)
        self._spaces_layout.addWidget(btn)

        l.addWidget(self._spaces_widget)

        # Bookmarks
        l.addSpacing(4)
        l.addWidget(QLabel("FAVORIS"))
        self._bm_scroll = QScrollArea()
        self._bm_scroll.setWidgetResizable(True)
        self._bm_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._bm_scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        self._bm_widget = QWidget()
        self._bm_layout = QVBoxLayout(self._bm_widget)
        self._bm_layout.setContentsMargins(0, 0, 0, 0)
        self._bm_layout.setSpacing(2)
        self._bm_scroll.setWidget(self._bm_widget)
        l.addWidget(self._bm_scroll, 1)

        # Add bookmark button
        ab = QPushButton("+ Ajouter la page courante aux favoris")
        ab.setObjectName("bmAddBtn")
        ab.clicked.connect(self._add_bookmark)
        l.addWidget(ab)

        # Bottom buttons
        reset = QPushButton("↺ Reset layout")
        reset.setObjectName("bottomBtn")
        reset.clicked.connect(self._reset_layout)
        l.addWidget(reset)

        save = QPushButton("💾 Sauvegarder session")
        save.setObjectName("bottomBtn")
        save.clicked.connect(self._save_session)
        l.addWidget(save)

        s.setStyleSheet("""
            #sidebar { background: #1e1e2e; border-right: 1px solid #2d2d44; }
            #sidebarLogo { color: #e0e0ff; font-size: 15px; font-weight: 700; padding: 4px 0; }
            #statsLabel { font-size: 9px; color: #6c63ff; padding: 2px 0; }
            #statusLabel { font-size: 9px; color: #555577; }
            QLabel { color: #5555aa; font-size: 9px; font-weight: 600; letter-spacing: 0.5px; }
            #spaceBtn {
                background: #2d2d44; border: 1px solid #3a3a55; border-radius: 6px;
                color: #e0e0ff; font-size: 11px; padding: 6px 8px; text-align: left;
            }
            #spaceBtn:hover { border-color: #6c63ff; }
            #bmAddBtn {
                background: transparent; border: 1px dashed #3a3a55; border-radius: 4px;
                color: #555577; font-size: 8px; padding: 3px 6px;
            }
            #bmAddBtn:hover { border-color: #6c63ff; color: #e0e0ff; }
            #bottomBtn {
                background: #2d2d44; border: 1px solid #3a3a55; border-radius: 5px;
                color: #e0e0ff; font-size: 9px; padding: 4px 8px;
            }
            #bottomBtn:hover { border-color: #6c63ff; }
        """)
        return s

    # ===== PROMPT BAR =====
    def _build_prompt(self):
        bar = QWidget()
        bar.setObjectName("promptBar")
        l = QHBoxLayout(bar)
        l.setContentsMargins(8, 4, 8, 4)
        l.setSpacing(6)

        self._inp = QTextEdit()
        self._inp.setObjectName("promptInput")
        self._inp.setPlaceholderText("Pose ta question à toutes les IA (Enter = GO)")
        self._inp.setFixedHeight(34)
        self._inp.setFont(QFont("SF Mono", 11))
        self._inp.setTabChangesFocus(False)
        self._inp.installEventFilter(self)
        l.addWidget(self._inp, 1)

        self._go = QPushButton("C'est un ordre, GO !")
        self._go.setObjectName("goBtn")
        self._go.setFixedHeight(30)
        self._go.clicked.connect(self._dispatch)
        l.addWidget(self._go)

        self._private_btn = QPushButton("👁️")
        self._private_btn.setObjectName("pvtBtn")
        self._private_btn.setFixedSize(30, 30)
        self._private_btn.setCheckable(True)
        self._private_btn.clicked.connect(self._toggle_private)
        l.addWidget(self._private_btn)

        bar.setStyleSheet("""
            #promptBar { background: #1e1e2e; border-bottom: 1px solid #2d2d44; }
            #promptInput {
                background: #252540; border: 1px solid #2d2d44; border-radius: 8px;
                padding: 4px 10px; color: #e0e0ff; font-size: 11px;
            }
            #promptInput:focus { border-color: #6c63ff; }
            #goBtn {
                background: #6c63ff; border: none; border-radius: 8px;
                color: white; font-size: 11px; font-weight: 700; padding: 0 18px;
            }
            #goBtn:hover { background: #7b74ff; }
            #pvtBtn {
                background: #2d2d44; border: 1px solid #3a3a55; border-radius: 15px;
                color: #8888aa; font-size: 14px;
            }
            #pvtBtn:checked { background: #1e3a5f; border-color: #3b82f6; }
        """)
        return bar

    def eventFilter(self, obj, event):
        if obj is self._inp and event.type() == event.Type.KeyPress:
            if event.key() == Qt.Key.Key_Return and not event.modifiers() & Qt.ShiftModifier:
                self._dispatch()
                return True
        return super().eventFilter(obj, event)

    # ===== PANES =====
    def _add_default_panes(self):
        # Reset existing panes
        self._clear_all_panes()
        for p in self._reg.get_default_preset():
            self._add_pane_for_provider(p)
        self._layout.set_mode(LayoutMode.AUTO_FILL)
        self._update_stats()

    def _add_pane(self, url=None):
        self._pane_counter += 1
        name = f"priv_{self._pane_counter}" if self._private else f"pane_{self._pane_counter}"
        p = BrowserPane("default", name, self._pane_counter)
        p.url_changed.connect(lambda u, x=p: self._on_url(x, u))
        p.close_requested.connect(self._remove_pane)
        p.load(url or "about:blank")
        self._panes.append(p)
        self._layout.add_pane(p)
        self._renumber()
        self._update_stats()

    def _add_pane_for_provider(self, prov):
        self._pane_counter += 1
        name = f"priv_{prov.id}_{self._pane_counter}" if self._private else f"{prov.id}_{self._pane_counter}"
        p = BrowserPane(prov.id, name, self._pane_counter)
        p.set_badge(prov.icon)
        p.url_changed.connect(lambda u, x=p: self._on_url(x, u))
        p.close_requested.connect(self._remove_pane)
        p.load(prov.url)
        self._panes.append(p)
        self._layout.add_pane(p)
        self._renumber()
        self._update_stats()

    def _remove_pane(self, pane):
        if pane not in self._panes:
            return
        idx = self._panes.index(pane)
        self._panes.pop(idx)
        self._layout.remove_pane(pane)
        QTimer.singleShot(50, pane.cleanup)
        self._renumber()
        self._update_stats()

    def _clear_all_panes(self):
        for p in list(self._panes):
            self._panes.remove(p)
            self._layout.remove_pane(p)
            p.cleanup()
        self._update_stats()

    def _renumber(self):
        for i, p in enumerate(self._panes, 1):
            p.set_number(i)

    def _update_stats(self):
        n = len(self._panes)
        ia = sum(1 for p in self._panes if p.provider_id != "default")
        self._stats.setText(f"Fenêtres: {n} | IA: {ia}")

    # ===== PROMPT DISPATCH =====
    def _dispatch(self):
        text = self._inp.toPlainText().strip()
        if not text:
            return
        self._disp.dispatch_all(text, self._panes, auto_submit=True)
        self._inp.clear()

    # ===== HISTORY =====
    def _on_url(self, pane, url):
        if self._private or not url or url in ("about:blank", ""):
            return
        self._history.append({
            "url": url, "time": datetime.now().isoformat(), "provider": pane.provider_id
        })
        if len(self._history) > 2000:
            self._history = self._history[-1000:]
        self._save_history()

    # ===== BOOKMARKS =====
    def _add_bookmark(self):
        # Find first pane with a real URL
        url = None
        label = None
        for p in self._panes:
            u = p.current_url
            if u and u not in ("about:blank", ""):
                url = u
                break
        if not url:
            url = "https://chatgpt.com"
            label = "ChatGPT"
        if not label:
            label = url.split("//")[-1].split("/")[0]

        self._bookmarks.append({"url": url, "label": label, "icon": "🔖"})
        self._save_bookmarks()
        self._render_bookmarks()

    def _render_bookmarks(self):
        while self._bm_layout.count():
            item = self._bm_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        for bm in self._bookmarks:
            w = QWidget()
            wl = QHBoxLayout(w)
            wl.setContentsMargins(2, 1, 2, 1)
            wl.setSpacing(4)
            label = QLabel(f"{bm.get('icon','🔖')}  {bm['label']}")
            label.setStyleSheet("color: #e0e0ff; font-size: 10px;")
            label.setCursor(Qt.PointingHandCursor)

            def go(url=bm["url"]):
                self._add_pane(url)
            label.mousePressEvent = lambda e, url=bm["url"]: go(url)

            del_btn = QPushButton("✕")
            del_btn.setFixedSize(14, 14)
            del_btn.setStyleSheet("""
                QPushButton { background: transparent; border: none; color: #555577; font-size: 7px; }
                QPushButton:hover { color: #ff5f57; }
            """)
            def remove(b=bm):
                self._bookmarks.remove(b)
                self._save_bookmarks()
                self._render_bookmarks()
            del_btn.clicked.connect(remove)

            wl.addWidget(label, 1)
            wl.addWidget(del_btn)
            self._bm_layout.addWidget(w)

    # ===== PRIVATE MODE =====
    def _toggle_private(self):
        self._private = not self._private
        self._status.setText("🕶️ Privé" if self._private else "● Standard")
        self._private_btn.setChecked(self._private)
        # Recreate all panes with private profiles
        old = list(self._panes)
        self._panes.clear()
        for p in old:
            self._layout.remove_pane(p)
            QTimer.singleShot(10, p.cleanup)
        QTimer.singleShot(100, self._add_default_panes)

    # ===== SESSION =====
    def _save_session(self):
        data = {
            "panes": [{"url": p.current_url, "provider": p.provider_id} for p in self._panes],
            "layout": self._layout.mode().value
        }
        path = os.path.join(os.path.expanduser("~"), STORAGE, "session.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        QMessageBox.information(self, "TeamAI", "Session sauvegardée ✅")

    def _load_session(self):
        path = os.path.join(os.path.expanduser("~"), STORAGE, "session.json")
        if not os.path.exists(path):
            return
        try:
            with open(path) as f:
                data = json.load(f)
            self._clear_all_panes()
            for pd in data.get("panes", []):
                self._pane_counter += 1
                pid = pd.get("provider", "default")
                prov = self._reg.get(pid)
                p = BrowserPane(pid, f"pane_{self._pane_counter}", self._pane_counter)
                if prov:
                    p.set_badge(prov.icon)
                p.url_changed.connect(lambda u, x=p: self._on_url(x, u))
                p.close_requested.connect(self._remove_pane)
                p.load(pd.get("url", "about:blank"))
                self._panes.append(p)
                self._layout.add_pane(p)
            for m in LayoutMode:
                if m.value == data.get("layout", "auto_fill"):
                    self._layout.set_mode(m)
                    break
            self._renumber()
            self._update_stats()
        except Exception:
            pass

    def _load_session_dialog(self):
        self._load_session()
        QMessageBox.information(self, "TeamAI", "Session chargée ✅")

    def _reset_layout(self):
        self._layout.set_mode(LayoutMode.AUTO_FILL)

    def _clear_history(self):
        self._history = []
        self._save_history()
        QMessageBox.information(self, "TeamAI", "Historique purgé ✅")

    def _clear_cookies(self):
        for p in self._panes:
            p.profile.cookieStore().deleteAllCookies()
        QMessageBox.information(self, "TeamAI", "Cookies purgés ✅")

    # ===== PERSISTENCE =====
    def _save_history(self):
        path = os.path.join(os.path.expanduser("~"), STORAGE, "history.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        try:
            with open(path, "w") as f:
                json.dump(self._history, f)
        except Exception:
            pass

    def _save_bookmarks(self):
        path = os.path.join(os.path.expanduser("~"), STORAGE, "bookmarks.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        try:
            with open(path, "w") as f:
                json.dump(self._bookmarks, f)
        except Exception:
            pass

    def _load_history(self):
        p = os.path.join(os.path.expanduser("~"), STORAGE, "history.json")
        if os.path.exists(p):
            try:
                with open(p) as f:
                    self._history = json.load(f) or []
            except Exception:
                self._history = []

    def _load_bookmarks(self):
        p = os.path.join(os.path.expanduser("~"), STORAGE, "bookmarks.json")
        if os.path.exists(p):
            try:
                with open(p) as f:
                    self._bookmarks = json.load(f) or []
            except Exception:
                self._bookmarks = []

    def _apply_theme(self):
        self.setStyleSheet("""
            QMainWindow { background: #0b0d14; }
            QWidget { color: #e0e0ff; }
            QScrollArea { background: transparent; border: none; }
        """)
