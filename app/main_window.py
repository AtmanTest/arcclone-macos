"""
main_window.py — Fenêtre principale TeamAI.
Sidebar gauche + zone centrale multi-panneaux + barre prompt global.
"""

import json
import os
from datetime import datetime
from functools import partial

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLineEdit, QLabel, QScrollArea,
    QSplitter, QMenu, QMenuBar, QMessageBox, QApplication,
    QTextEdit, QCheckBox, QFrame
)
from PySide6.QtCore import Qt, Signal, QUrl, QTimer
from PySide6.QtGui import QFont, QAction, QKeySequence

from .browser_pane import BrowserPane
from .layout_manager import LayoutManager, LayoutMode
from .provider_registry import ProviderRegistry
from .prompt_dispatcher import PromptDispatcher

STORAGE_DIR = ".teamai_workspace"


class TeamAIWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self._registry = ProviderRegistry()
        self._dispatcher = PromptDispatcher()
        self._panes: list[BrowserPane] = []
        self._layout_manager = LayoutManager()
        self._pane_counter = 0
        self._private_mode = False
        self._history: list[dict] = []

        self.setWindowTitle("TeamAI")
        self.setMinimumSize(1200, 800)
        self.resize(1500, 950)
        self._setup_menu()
        self._build_ui()
        self._load_history()
        self._load_workspace()
        self._apply_theme()

    def _setup_menu(self):
        menu = self.menuBar()
        menu.setStyleSheet("""
            QMenuBar { background: #1e1e2e; color: #8888aa; border-bottom: 1px solid #2d2d44; padding: 2px; }
            QMenuBar::item:selected { background: #2d2d44; color: #e0e0ff; }
            QMenu { background: #1e1e2e; color: #e0e0ff; border: 1px solid #2d2d44; }
            QMenu::item:selected { background: #6c63ff; }
        """)

        fm = menu.addMenu("TeamAI")
        a = QAction("💾 Sauvegarder workspace", self)
        a.triggered.connect(self._save_workspace)
        fm.addAction(a)
        a = QAction("📂 Charger workspace", self)
        a.triggered.connect(self._load_workspace_dialog)
        fm.addAction(a)
        fm.addSeparator()
        a = QAction("Quitter", self)
        a.triggered.connect(self.close)
        fm.addAction(a)

        lm = menu.addMenu("Layout")
        a = QAction("Grille", self, shortcut=QKeySequence("Ctrl+G"))
        a.triggered.connect(lambda: self._set_layout(LayoutMode.GRID))
        lm.addAction(a)
        a = QAction("Colonnes", self, shortcut=QKeySequence("Ctrl+C"))
        a.triggered.connect(lambda: self._set_layout(LayoutMode.COLUMNS))
        lm.addAction(a)
        a = QAction("Auto-Fill", self, shortcut=QKeySequence("Ctrl+A"))
        a.triggered.connect(lambda: self._set_layout(LayoutMode.AUTO_FILL))
        lm.addAction(a)
        lm.addSeparator()
        a = QAction("↺ Reset tailles", self, shortcut=QKeySequence("Ctrl+Shift+R"))
        a.triggered.connect(self._reset_layout)
        lm.addAction(a)

        vm = menu.addMenu("Vue")
        a = QAction("Mode privé", self, checkable=True, shortcut=QKeySequence("Ctrl+Shift+P"))
        a.triggered.connect(self._toggle_private)
        vm.addAction(a)
        vm.addSeparator()
        a = QAction("🗑️ Purger historique", self)
        a.triggered.connect(self._clear_history)
        vm.addAction(a)
        a = QAction("🍪 Purger cookies", self)
        a.triggered.connect(self._clear_cookies)
        vm.addAction(a)

        pm = menu.addMenu("Panneaux")
        a = QAction("+ Nouveau panneau", self, shortcut=QKeySequence("Ctrl+N"))
        a.triggered.connect(self._add_pane)
        pm.addAction(a)
        a = QAction("⟳ Tout recharger", self, shortcut=QKeySequence("Ctrl+R"))
        a.triggered.connect(self._reload_all)
        pm.addAction(a)

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QHBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        sidebar = self._build_sidebar()
        root.addWidget(sidebar)

        main_area = QWidget()
        ml = QVBoxLayout(main_area)
        ml.setContentsMargins(0, 0, 0, 0)
        ml.setSpacing(0)

        # Prompt bar
        ml.addWidget(self._build_prompt_bar())
        ml.addWidget(self._layout_manager, 1)

        root.addWidget(main_area, 1)
        self._add_default_panes()

    def _build_sidebar(self) -> QWidget:
        s = QWidget()
        s.setFixedWidth(220)
        s.setObjectName("sidebar")
        lay = QVBoxLayout(s)
        lay.setContentsMargins(8, 8, 8, 8)
        lay.setSpacing(4)

        logo = QLabel("🧠 TeamAI")
        logo.setObjectName("sidebarLogo")
        lay.addWidget(logo)

        # Status
        self._private_lbl = QLabel("● Standard")
        self._private_lbl.setObjectName("privateLabel")
        lay.addWidget(self._private_lbl)

        # Providers list
        lay.addWidget(QLabel("PROVIDERS"))
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        pw = QWidget()
        self._providers_layout = QVBoxLayout(pw)
        self._providers_layout.setContentsMargins(0, 0, 0, 0)
        self._providers_layout.setSpacing(2)

        for p in self._registry.all():
            btn = QPushButton(f"{p.icon}  {p.label}")
            btn.setObjectName("providerBtn")
            btn.setCursor(Qt.PointingHandCursor)
            btn.clicked.connect(partial(self._add_pane_for_provider, p))
            self._providers_layout.addWidget(btn)

        scroll.setWidget(pw)
        lay.addWidget(scroll, 1)

        # Reset button
        reset = QPushButton("↺ Reset layout")
        reset.setObjectName("resetBtn")
        reset.clicked.connect(self._reset_layout)
        lay.addWidget(reset)

        # Full reload
        reload_all = QPushButton("⟳ Tout recharger")
        reload_all.setObjectName("resetBtn")
        reload_all.clicked.connect(self._reload_all)
        lay.addWidget(reload_all)

        s.setStyleSheet("""
            #sidebar { background: #1e1e2e; border-right: 1px solid #2d2d44; }
            #sidebarLogo { color: #e0e0ff; font-size: 15px; font-weight: 600; padding: 4px 0; }
            #privateLabel { font-size: 9px; color: #8888aa; padding: 2px 4px; border-radius: 4px; }
            QLabel { color: #5555aa; font-size: 9px; font-weight: 600; padding: 4px 0; letter-spacing: 0.5px; }
            #providerBtn {
                background: transparent; border: none; border-radius: 5px;
                color: #e0e0ff; font-size: 11px; padding: 4px 6px; text-align: left;
            }
            #providerBtn:hover { background: #2d2d44; }
            #resetBtn {
                background: #2d2d44; border: 1px solid #3a3a55; border-radius: 6px;
                color: #e0e0ff; font-size: 10px; padding: 5px 8px; margin-top: 4px;
            }
            #resetBtn:hover { border-color: #6c63ff; }
        """)
        return s

    def _build_prompt_bar(self) -> QWidget:
        bar = QWidget()
        bar.setObjectName("promptBar")
        lay = QHBoxLayout(bar)
        lay.setContentsMargins(8, 5, 8, 5)
        lay.setSpacing(6)

        self._prompt_input = QTextEdit()
        self._prompt_input.setObjectName("promptInput")
        self._prompt_input.setPlaceholderText("Pose ta question à toutes les IA... (Enter = envoyer)")
        self._prompt_input.setFixedHeight(34)
        self._prompt_input.setFont(QFont("SF Mono", 11))
        self._prompt_input.setTabChangesFocus(False)

        # Enter = envoyer, Shift+Enter = nouvelle ligne
        self._prompt_input.installEventFilter(self)

        lay.addWidget(self._prompt_input, 1)

        self._mode_label = QLabel("Auto")
        self._mode_label.setObjectName("modeLabel")
        lay.addWidget(self._mode_label)

        self._dispatch_btn = QPushButton("🚀 Envoyer partout")
        self._dispatch_btn.setObjectName("dispatchBtn")
        self._dispatch_btn.setFixedHeight(28)
        self._dispatch_btn.clicked.connect(self._dispatch_prompt)
        lay.addWidget(self._dispatch_btn)

        btn = QPushButton("+")
        btn.setObjectName("addPaneBtn")
        btn.setFixedSize(28, 28)
        btn.clicked.connect(self._add_pane)
        lay.addWidget(btn)

        self._private_btn = QPushButton("👁️")
        self._private_btn.setObjectName("privateBtn")
        self._private_btn.setFixedSize(28, 28)
        self._private_btn.setCheckable(True)
        self._private_btn.clicked.connect(self._toggle_private)
        lay.addWidget(self._private_btn)

        bar.setStyleSheet("""
            #promptBar { background: #1e1e2e; border-bottom: 1px solid #2d2d44; }
            #promptInput {
                background: #252540; border: 1px solid #2d2d44; border-radius: 8px;
                padding: 4px 10px; color: #e0e0ff; font-size: 11px;
            }
            #promptInput:focus { border-color: #6c63ff; }
            #modeLabel { color: #6c63ff; font-size: 10px; font-weight: 600; padding: 0 4px; }
            #dispatchBtn {
                background: #6c63ff; border: none; border-radius: 6px;
                color: white; font-size: 11px; font-weight: 600; padding: 0 14px;
            }
            #dispatchBtn:hover { background: #7b74ff; }
            #addPaneBtn {
                background: #2d2d44; border: 1px solid #3a3a55; border-radius: 14px;
                color: #e0e0ff; font-size: 16px; font-weight: 300;
            }
            #addPaneBtn:hover { background: #6c63ff; border-color: #6c63ff; }
            #privateBtn {
                background: #2d2d44; border: 1px solid #3a3a55; border-radius: 14px;
                color: #8888aa; font-size: 14px;
            }
            #privateBtn:checked { background: #1e3a5f; border-color: #3b82f6; color: #60a5fa; }
        """)
        return bar

    def eventFilter(self, obj, event):
        if obj is self._prompt_input and event.type() == event.Type.KeyPress:
            if event.key() == Qt.Key.Key_Return and not event.modifiers() & Qt.ShiftModifier:
                self._dispatch_prompt()
                return True
        return super().eventFilter(obj, event)

    def _add_default_panes(self):
        for p in self._registry.get_default_preset():
            self._add_pane_for_provider(p)
        self._layout_manager.set_mode(LayoutMode.AUTO_FILL)

    def _add_pane(self, url=None):
        self._pane_counter += 1
        profile = f"pane_{self._pane_counter}"
        if self._private_mode:
            profile = f"priv_{self._pane_counter}"
        pane = BrowserPane(provider_id="default", profile_name=profile)
        pane.url_changed.connect(lambda u, p=pane: self._on_url_changed(p, u))
        pane.close_requested.connect(self._remove_pane)
        pane.load(url or "about:blank")
        self._panes.append(pane)
        self._layout_manager.add_pane(pane)

    def _add_pane_for_provider(self, provider):
        self._pane_counter += 1
        name = f"{provider.id}_{self._pane_counter}"
        if self._private_mode:
            name = f"priv_{provider.id}_{self._pane_counter}"
        pane = BrowserPane(provider_id=provider.id, profile_name=name)
        pane.set_badge(provider.icon)
        pane.url_changed.connect(lambda u, p=pane: self._on_url_changed(p, u))
        pane.close_requested.connect(self._remove_pane)
        pane.load(provider.url)
        self._panes.append(pane)
        self._layout_manager.add_pane(pane)

    def _on_url_changed(self, pane, url):
        if not self._private_mode and url and url != "about:blank":
            self._history.append({
                "url": url,
                "time": datetime.now().isoformat(),
                "provider": pane.provider_id
            })
            if len(self._history) > 1000:
                self._history = self._history[-500:]
            self._save_history()

    def _remove_pane(self, pane):
        if pane in self._panes:
            idx = self._panes.index(pane)
            self._panes.pop(idx)
            self._layout_manager.remove_pane(pane)
            QTimer.singleShot(10, pane.cleanup)

    def _set_layout(self, mode):
        self._layout_manager.set_mode(mode)

    def _reset_layout(self):
        self._layout_manager.set_mode(LayoutMode.AUTO_FILL)

    def _toggle_private(self):
        self._private_mode = not self._private_mode
        label = "🕶️ Privé" if self._private_mode else "● Standard"
        self._private_lbl.setText(label)
        self._private_btn.setChecked(self._private_mode)
        # Recreate all panes with new profile names
        for pane in list(self._panes):
            self._remove_pane(pane)
        self._add_default_panes()

    def _dispatch_prompt(self):
        prompt = self._prompt_input.toPlainText()
        if not prompt.strip():
            return
        self._dispatcher.dispatch_all(prompt, self._panes, auto_submit=True)
        self._prompt_input.clear()

    def _reload_all(self):
        for pane in self._panes:
            pane.web_view.reload()

    def _clear_history(self):
        self._history = []
        self._save_history()
        QMessageBox.information(self, "TeamAI", "Historique purgé ✅")

    def _clear_cookies(self):
        for pane in self._panes:
            p = pane.profile
            p.cookieStore().deleteAllCookies()
        QMessageBox.information(self, "TeamAI", "Cookies purgés ✅")

    # === Workspace ===
    def _save_workspace(self):
        data = {
            "panes": [{"url": p.current_url, "provider": p.provider_id} for p in self._panes],
            "layout": self._layout_manager.mode().value
        }
        path = os.path.join(os.path.expanduser("~"), STORAGE_DIR, "workspace.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        QMessageBox.information(self, "TeamAI", "Workspace sauvegardé ✅")

    def _load_workspace(self):
        path = os.path.join(os.path.expanduser("~"), STORAGE_DIR, "workspace.json")
        if not os.path.exists(path):
            return
        try:
            with open(path) as f:
                data = json.load(f)
            for pdata in data.get("panes", []):
                self._pane_counter += 1
                pid = pdata.get("provider", "default")
                prov = self._registry.get(pid)
                pane = BrowserPane(provider_id=pid, profile_name=f"pane_{self._pane_counter}")
                if prov:
                    pane.set_badge(prov.icon)
                pane.load(pdata.get("url", "about:blank"))
                self._panes.append(pane)
                self._layout_manager.add_pane(pane)
            for m in LayoutMode:
                if m.value == data.get("layout", "auto_fill"):
                    self._layout_manager.set_mode(m)
                    break
        except Exception:
            pass

    def _load_workspace_dialog(self):
        self._load_workspace()
        QMessageBox.information(self, "TeamAI", "Workspace chargé ✅")

    # === History ===
    def _save_history(self):
        path = os.path.join(os.path.expanduser("~"), STORAGE_DIR, "history.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        try:
            with open(path, "w") as f:
                json.dump(self._history, f)
        except Exception:
            pass

    def _load_history(self):
        path = os.path.join(os.path.expanduser("~"), STORAGE_DIR, "history.json")
        if os.path.exists(path):
            try:
                with open(path) as f:
                    self._history = json.load(f) or []
            except Exception:
                self._history = []

    def _apply_theme(self):
        self.setStyleSheet("""
            QMainWindow { background: #0b0d14; }
            QWidget { color: #e0e0ff; }
            QScrollArea { background: transparent; border: none; }
        """)
