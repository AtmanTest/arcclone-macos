"""
main_window.py — Fenêtre principale ArcClone.
Sidebar gauche Arc-style + zone centrale avec panneaux + barre prompt global.
"""

import json
import os

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLineEdit, QLabel, QScrollArea,
    QSplitter, QMenu, QMenuBar, QMessageBox, QFrame, QTextEdit
)
from PySide6.QtCore import Qt, Signal, QSize, QTimer
from PySide6.QtGui import QFont, QAction

from .browser_pane import BrowserPane
from .layout_manager import LayoutManager, LayoutMode
from .provider_registry import ProviderRegistry
from .prompt_dispatcher import PromptDispatcher


STORAGE_DIR = ".arcclone_workspace"


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self._registry = ProviderRegistry()
        self._dispatcher = PromptDispatcher()
        self._panes: list[BrowserPane] = []
        self._layout_manager = LayoutManager()
        self._pane_counter = 0

        self.setWindowTitle("ArcClone")
        self.setMinimumSize(1200, 800)
        self.resize(1400, 900)
        self._setup_menu()
        self._build_ui()
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

        file_menu = menu.addMenu("ArcClone")
        save_act = QAction("💾 Sauvegarder workspace", self)
        save_act.triggered.connect(self._save_workspace)
        file_menu.addAction(save_act)

        load_act = QAction("📂 Charger workspace", self)
        load_act.triggered.connect(self._load_workspace_dialog)
        file_menu.addAction(load_act)

        file_menu.addSeparator()
        quit_act = QAction("Quitter", self)
        quit_act.triggered.connect(self.close)
        file_menu.addAction(quit_act)

        layout_menu = menu.addMenu("Layout")
        grid_act = QAction("Grille", self)
        grid_act.triggered.connect(lambda: self._set_layout(LayoutMode.GRID))
        layout_menu.addAction(grid_act)

        cols_act = QAction("Colonnes", self)
        cols_act.triggered.connect(lambda: self._set_layout(LayoutMode.COLUMNS))
        layout_menu.addAction(cols_act)

        auto_act = QAction("Auto-Fill", self)
        auto_act.triggered.connect(lambda: self._set_layout(LayoutMode.AUTO_FILL))
        layout_menu.addAction(auto_act)

        pane_menu = menu.addMenu("Panneaux")
        add_act = QAction("+ Nouveau panneau", self)
        add_act.triggered.connect(lambda: self._add_pane())
        pane_menu.addAction(add_act)

        self._reload_all_act = QAction("⟳ Tout recharger", self)
        self._reload_all_act.triggered.connect(self._reload_all)
        pane_menu.addAction(self._reload_all_act)

    def _build_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QHBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # Sidebar
        sidebar = self._build_sidebar()
        root.addWidget(sidebar)

        # Main area (prompt bar + layout manager)
        main_area = QWidget()
        main_layout = QVBoxLayout(main_area)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Prompt bar
        prompt_bar = self._build_prompt_bar()
        main_layout.addWidget(prompt_bar)

        # Layout manager
        main_layout.addWidget(self._layout_manager, 1)

        root.addWidget(main_area, 1)

        # Add initial panes (default 4 AI providers)
        self._add_default_panes()

    def _build_sidebar(self) -> QWidget:
        sidebar = QWidget()
        sidebar.setFixedWidth(240)
        sidebar.setObjectName("sidebar")
        layout = QVBoxLayout(sidebar)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(6)

        # Logo
        logo = QLabel("🧭 ArcClone")
        logo.setObjectName("sidebarLogo")
        logo.setFont(QFont("SF Pro Display", 14, QFont.Weight.DemiBold))
        layout.addWidget(logo)

        # Space selector
        space_btn = QPushButton("🚀  Space IA  ▼")
        space_btn.setObjectName("spaceBtn")
        layout.addWidget(space_btn)

        # Presets
        layout.addWidget(QLabel("PRESETS"))
        presets = ["4 IA", "Recherche", "Code", "Comparaison"]
        for p in presets:
            btn = QPushButton(p)
            btn.setObjectName("presetBtn")
            btn.clicked.connect(lambda checked, x=p: self._apply_preset(x))
            layout.addWidget(btn)

        # Providers list
        layout.addWidget(QLabel("PROVIDERS"))
        self._sidebar_providers = QWidget()
        self._providers_layout = QVBoxLayout(self._sidebar_providers)
        self._providers_layout.setContentsMargins(0, 0, 0, 0)
        self._providers_layout.setSpacing(2)

        for p in self._registry.all():
            label = QLabel(f"{p.icon}  {p.label}")
            label.setObjectName("providerLabel")
            label.setCursor(Qt.PointingHandCursor)
            label.mousePressEvent = lambda e, x=p: self._add_pane_for_provider(x)
            self._providers_layout.addWidget(label)

        layout.addWidget(self._sidebar_providers)
        layout.addStretch()

        # Status
        status = QLabel("●  v0.4.0")
        status.setObjectName("sidebarStatus")
        layout.addWidget(status)

        sidebar.setStyleSheet("""
            #sidebar {
                background: #1e1e2e;
                border-right: 1px solid #2d2d44;
            }
            #sidebarLogo {
                color: #e0e0ff;
                font-size: 16px;
                padding: 6px 0;
            }
            QLabel {
                color: #8888aa;
                font-size: 10px;
                font-weight: 600;
                padding: 4px 0;
                letter-spacing: 0.5px;
            }
            #spaceBtn {
                background: #2d2d44;
                border: 1px solid #3a3a55;
                border-radius: 8px;
                color: #e0e0ff;
                padding: 8px 12px;
                text-align: left;
                font-size: 12px;
            }
            #spaceBtn:hover {
                border-color: #6c63ff;
            }
            #presetBtn {
                background: transparent;
                border: 1px solid #2d2d44;
                border-radius: 6px;
                color: #8888aa;
                padding: 5px 10px;
                text-align: left;
                font-size: 10px;
            }
            #presetBtn:hover {
                background: #2d2d44;
                color: #e0e0ff;
                border-color: #6c63ff;
            }
            #providerLabel {
                color: #e0e0ff;
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 6px;
                font-weight: normal;
            }
            #providerLabel:hover {
                background: #2d2d44;
            }
            #sidebarStatus {
                color: #555577;
                font-size: 9px;
                font-weight: normal;
                padding: 4px 0;
            }
        """)

        return sidebar

    def _build_prompt_bar(self) -> QWidget:
        bar = QWidget()
        bar.setObjectName("promptBar")
        layout = QHBoxLayout(bar)
        layout.setContentsMargins(8, 4, 8, 4)
        layout.setSpacing(6)

        self._prompt_input = QTextEdit()
        self._prompt_input.setObjectName("promptInput")
        self._prompt_input.setPlaceholderText("Pose ta question à toutes les IA en parallèle...")
        self._prompt_input.setFixedHeight(34)
        self._prompt_input.setFont(QFont("SF Mono", 11))
        self._prompt_input.setTabChangesFocus(True)
        layout.addWidget(self._prompt_input, 1)

        self._mode_btn = QPushButton("Auto")
        self._mode_btn.setObjectName("modeBtn")
        self._mode_btn.setFixedSize(50, 28)
        self._mode_btn.setCheckable(True)
        self._mode_btn.clicked.connect(self._toggle_mode)
        layout.addWidget(self._mode_btn)

        self._dispatch_btn = QPushButton("🚀 Envoyer partout")
        self._dispatch_btn.setObjectName("dispatchBtn")
        self._dispatch_btn.setFixedHeight(28)
        self._dispatch_btn.clicked.connect(self._dispatch_prompt)
        layout.addWidget(self._dispatch_btn)

        self._add_pane_btn = QPushButton("+")
        self._add_pane_btn.setObjectName("addPaneBtn")
        self._add_pane_btn.setFixedSize(28, 28)
        self._add_pane_btn.clicked.connect(lambda: self._add_pane())
        layout.addWidget(self._add_pane_btn)

        bar.setStyleSheet("""
            #promptBar {
                background: #1e1e2e;
                border-bottom: 1px solid #2d2d44;
            }
            #promptInput {
                background: #252540;
                border: 1px solid #2d2d44;
                border-radius: 8px;
                padding: 4px 10px;
                color: #e0e0ff;
                font-size: 11px;
            }
            #promptInput:focus {
                border-color: #6c63ff;
            }
            #modeBtn {
                background: #2d2d44;
                border: 1px solid #3a3a55;
                border-radius: 6px;
                color: #e0e0ff;
                font-size: 10px;
                font-weight: 600;
            }
            #modeBtn:checked {
                background: #6c63ff;
                border-color: #6c63ff;
            }
            #dispatchBtn {
                background: #6c63ff;
                border: none;
                border-radius: 6px;
                color: white;
                font-size: 11px;
                font-weight: 600;
                padding: 0 14px;
            }
            #dispatchBtn:hover {
                background: #7b74ff;
            }
            #addPaneBtn {
                background: #2d2d44;
                border: 1px solid #3a3a55;
                border-radius: 14px;
                color: #e0e0ff;
                font-size: 16px;
                font-weight: 300;
            }
            #addPaneBtn:hover {
                background: #6c63ff;
                border-color: #6c63ff;
            }
        """)

        return bar

    def _add_default_panes(self):
        providers = self._registry.get_default_preset()
        if not providers:
            self._add_pane()
            self._add_pane()
            self._add_pane()
            self._add_pane()
        else:
            for p in providers:
                self._add_pane_for_provider(p)
        self._layout_manager.set_mode(LayoutMode.AUTO_FILL)

    def _add_pane(self):
        self._pane_counter += 1
        pane = BrowserPane(provider_id="default", profile_name=f"pane_{self._pane_counter}")
        pane.title_changed.connect(lambda t, idx=len(self._panes): None)
        pane.load("about:blank")
        self._panes.append(pane)
        self._layout_manager.add_pane(pane)

    def _add_pane_for_provider(self, provider):
        self._pane_counter += 1
        name = f"{provider.id}_{self._pane_counter}"
        pane = BrowserPane(provider_id=provider.id, profile_name=name)
        pane.set_badge(provider.icon)
        pane.load(provider.url)
        self._panes.append(pane)
        self._layout_manager.add_pane(pane)

    def _remove_pane(self, pane: BrowserPane):
        if pane in self._panes:
            self._panes.remove(pane)
            self._layout_manager.remove_pane(pane)

    def _set_layout(self, mode: LayoutMode):
        self._layout_manager.set_mode(mode)

    def _toggle_mode(self):
        is_manual = self._mode_btn.isChecked()
        self._mode_btn.setText("Manuel" if is_manual else "Auto")

    def _dispatch_prompt(self):
        prompt = self._prompt_input.toPlainText().strip()
        if not prompt:
            return

        mode = "manual" if self._mode_btn.isChecked() else "auto"

        for pane in self._panes:
            provider_id = pane.provider_id
            self._dispatcher.dispatch(prompt, pane, provider_id, mode)

    def _reload_all(self):
        for pane in self._panes:
            pane.web_view.reload()

    def _apply_preset(self, preset_name: str):
        # Remove all existing panes
        for pane in list(self._panes):
            self._remove_pane(pane)

        if preset_name == "4 IA":
            for p in self._registry.get_default_preset():
                self._add_pane_for_provider(p)
        else:
            for _ in range(4):
                self._add_pane()

        self._layout_manager.set_mode(LayoutMode.AUTO_FILL)

    def _save_workspace(self):
        data = {
            "panes": [{"url": p.current_url, "provider": p.provider_id} for p in self._panes],
            "layout": self._layout_manager.mode().value
        }
        path = os.path.join(os.path.expanduser("~"), STORAGE_DIR, "workspace.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        QMessageBox.information(self, "ArcClone", "Workspace sauvegardé ✅")

    def _load_workspace(self):
        path = os.path.join(os.path.expanduser("~"), STORAGE_DIR, "workspace.json")
        if not os.path.exists(path):
            return
        try:
            with open(path, "r") as f:
                data = json.load(f)
            for pane in list(self._panes):
                self._remove_pane(pane)
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
            mode_str = data.get("layout", "auto_fill")
            for m in LayoutMode:
                if m.value == mode_str:
                    self._layout_manager.set_mode(m)
                    break
        except Exception:
            pass

    def _load_workspace_dialog(self):
        self._load_workspace()
        QMessageBox.information(self, "ArcClone", "Workspace chargé ✅")

    def _apply_theme(self):
        self.setStyleSheet("""
            QMainWindow {
                background: #0b0d14;
            }
            QWidget {
                color: #e0e0ff;
            }
            QScrollArea {
                background: transparent;
                border: none;
            }
            QSplitter::handle {
                background: #2d2d44;
            }
            QSplitter::handle:horizontal {
                width: 2px;
            }
            QSplitter::handle:vertical {
                height: 2px;
            }
            QSplitter::handle:hover {
                background: #6c63ff;
            }
        """)
