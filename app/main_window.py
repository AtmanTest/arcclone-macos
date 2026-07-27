"""
main_window.py — TeamAI fenêtre principale. 
Sidebar claire, 9 providers, ✕ close, prompt GO distribué, historique, session.
"""

import json, os
from datetime import datetime
from functools import partial

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLineEdit, QLabel, QScrollArea,
    QMenu, QMenuBar, QMessageBox, QTextEdit, QFrame
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
        self._counter = 0
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
            QMenuBar { background: #1e1e2e; color: #8888aa; border-bottom: 1px solid #2d2d44; }
            QMenuBar::item:selected { background: #2d2d44; color: #e0e0ff; }
            QMenu { background: #1e1e2e; color: #e0e0ff; border: 1px solid #2d2d44; }
            QMenu::item:selected { background: #6c63ff; }
        """)
        f = mb.addMenu("TeamAI")
        for item in [("💾 Sauvegarder session", self._save_session),
                      ("📂 Charger session", self._load_session_dialog),
                      None, ("Quitter", self.close)]:
            if item is None: f.addSeparator()
            else: t, cb = item; a = QAction(t, self); a.triggered.connect(cb); f.addAction(a)

        v = mb.addMenu("Vue")
        a = QAction("Mode privé", self, checkable=True, shortcut=QKeySequence("Ctrl+Shift+P"))
        a.triggered.connect(self._toggle_private); v.addAction(a)
        v.addSeparator()
        for t, cb in [("🗑️ Purger historique", self._clear_history),
                       ("🍪 Purger cookies", self._clear_cookies)]:
            a = QAction(t, self); a.triggered.connect(cb); v.addAction(a)

        p = mb.addMenu("Panneaux")
        for t, cb, sc in [("+ Nouveau", self._add_pane, "Ctrl+N"),
                           ("⟳ Recharger tout", self._reload_all, "Ctrl+R")]:
            a = QAction(t, self); a.triggered.connect(cb)
            if sc: a.setShortcut(QKeySequence(sc))
            p.addAction(a)

    # ===== UI =====
    def _build_ui(self):
        c = QWidget(); self.setCentralWidget(c)
        r = QHBoxLayout(c); r.setContentsMargins(0,0,0,0); r.setSpacing(0)
        r.addWidget(self._build_sidebar())
        m = QWidget(); ml = QVBoxLayout(m); ml.setContentsMargins(0,0,0,0); ml.setSpacing(0)
        ml.addWidget(self._build_prompt()); ml.addWidget(self._layout, 1)
        r.addWidget(m, 1)
        self._add_default_panes()

    # ===== SIDEBAR =====
    def _build_sidebar(self):
        s = QWidget(); s.setFixedWidth(230); s.setObjectName("sidebar")
        l = QVBoxLayout(s); l.setContentsMargins(8,6,8,6); l.setSpacing(4)

        logo = QLabel("🧠 TeamAI"); logo.setObjectName("sidebarLogo"); l.addWidget(logo)

        self._stats = QLabel("Fenêtres: 0 | IA: 0"); self._stats.setObjectName("statsLabel"); l.addWidget(self._stats)
        self._status = QLabel("● Standard"); self._status.setObjectName("statusLabel"); l.addWidget(self._status)

        l.addSpacing(4)
        l.addWidget(self._section_label("PROVIDERS"))

        scroll = QScrollArea(); scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        pw = QWidget(); self._prov_layout = QVBoxLayout(pw)
        self._prov_layout.setContentsMargins(0,0,0,0); self._prov_layout.setSpacing(2)
        for pv in self._reg.all():
            btn = QPushButton(f"{pv.icon}  {pv.label}")
            btn.setObjectName("provBtn")
            btn.setCursor(Qt.PointingHandCursor)
            btn.clicked.connect(partial(self._add_provider, pv))
            self._prov_layout.addWidget(btn)
        scroll.setWidget(pw); l.addWidget(scroll, 1)

        l.addSpacing(4)
        l.addWidget(self._section_label("FAVORIS"))
        self._bm_scroll = QScrollArea(); self._bm_scroll.setWidgetResizable(True)
        self._bm_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._bm_scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        self._bm_w = QWidget(); self._bm_layout = QVBoxLayout(self._bm_w)
        self._bm_layout.setContentsMargins(0,0,0,0); self._bm_layout.setSpacing(2)
        self._bm_scroll.setWidget(self._bm_w); l.addWidget(self._bm_scroll)

        ab = QPushButton("+ Ajouter favori"); ab.setObjectName("bmBtn")
        ab.clicked.connect(self._add_bookmark); l.addWidget(ab)

        l.addSpacing(4)
        for txt, cb in [("↺ Reset layout", self._reset_layout),
                        ("💾 Sauvegarder session", self._save_session)]:
            b = QPushButton(txt); b.setObjectName("sideBtn"); b.clicked.connect(cb); l.addWidget(b)

        s.setStyleSheet("""
            #sidebar { background: #1e1e2e; border-right: 1px solid #2d2d44; }
            #sidebarLogo { color: #e0e0ff; font-size: 15px; font-weight: 700; padding: 4px 0; }
            #statsLabel { font-size: 9px; color: #6c63ff; }
            #statusLabel { font-size: 9px; color: #555577; }
            #provBtn, #bmBtn, #sideBtn {
                background: transparent; border: none; border-radius: 5px;
                color: #e0e0ff; font-size: 11px; padding: 4px 6px; text-align: left;
            }
            #provBtn:hover, #bmBtn:hover, #sideBtn:hover { background: #2d2d44; }
            #bmBtn { border: 1px dashed #3a3a55; font-size: 9px; padding: 3px 6px; }
            #bmBtn:hover { border-color: #6c63ff; }
        """)
        return s

    def _section_label(self, text):
        lbl = QLabel(text); lbl.setStyleSheet("color: #5555aa; font-size: 9px; font-weight: 600; letter-spacing: 0.5px;")
        return lbl

    # ===== PROMPT BAR =====
    def _build_prompt(self):
        bar = QWidget(); bar.setObjectName("promptBar")
        l = QHBoxLayout(bar); l.setContentsMargins(8,4,8,4); l.setSpacing(6)
        self._inp = QTextEdit()
        self._inp.setObjectName("promptInput")
        self._inp.setPlaceholderText("Pose ta question à TOUTES les IA (Enter = GO)")
        self._inp.setFixedHeight(34); self._inp.setFont(QFont("SF Mono", 11))
        self._inp.setTabChangesFocus(False); self._inp.installEventFilter(self)
        l.addWidget(self._inp, 1)
        self._go = QPushButton("C'est un ordre, GO !")
        self._go.setObjectName("goBtn"); self._go.setFixedHeight(30)
        self._go.clicked.connect(self._dispatch)
        l.addWidget(self._go)
        self._pvt = QPushButton("👁️")
        self._pvt.setObjectName("pvtBtn"); self._pvt.setFixedSize(30,30)
        self._pvt.setCheckable(True); self._pvt.clicked.connect(self._toggle_private)
        l.addWidget(self._pvt)
        bar.setStyleSheet("""
            #promptBar { background: #1e1e2e; border-bottom: 1px solid #2d2d44; }
            #promptInput {
                background: #252540; border: 1px solid #2d2d44; border-radius: 8px;
                padding: 4px 10px; color: #e0e0ff; font-size: 11px;
            }
            #promptInput:focus { border-color: #6c63ff; }
            #goBtn { background: #6c63ff; border: none; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 700; padding: 0 18px; }
            #goBtn:hover { background: #7b74ff; }
            #pvtBtn { background: #2d2d44; border: 1px solid #3a3a55; border-radius: 15px; color: #8888aa; font-size: 14px; }
            #pvtBtn:checked { background: #1e3a5f; border-color: #3b82f6; }
        """)
        return bar

    def eventFilter(self, obj, event):
        if obj is self._inp and event.type() == event.Type.KeyPress:
            if event.key() == Qt.Key.Key_Return and not event.modifiers() & Qt.ShiftModifier:
                self._dispatch(); return True
        return super().eventFilter(obj, event)

    # ===== PANES =====
    def _add_default_panes(self):
        self._clear_all()
        for pv in self._reg.get_default_preset():
            self._add_one(pv)
        self._layout.relayout()
        self._layout.set_mode(LayoutMode.AUTO_FILL)
        self._renumber(); self._update_stats()

    def _add_provider(self, pv):
        """Ajoute un seul fournisseur (appelé par sidebar)."""
        self._add_one(pv)
        self._layout.relayout()
        self._renumber(); self._update_stats()

    def _add_one(self, pv=None, url=None):
        """Crée et ajoute un seul pane sans relayout."""
        self._counter += 1
        pid = pv.id if pv else "default"
        name = f"priv_{pid}_{self._counter}" if self._private else f"{pid}_{self._counter}"
        p = BrowserPane(pid, name, self._counter)
        if pv: p.set_badge(pv.icon)
        p.url_changed.connect(partial(self._on_url, p))
        p.close_requested.connect(self._remove_pane)
        p.load(url or (pv.url if pv else "about:blank"))
        self._panes.append(p)
        self._layout.add_pane(p, defer=True)

    def _add_pane(self):
        """Ajoute un pane vierge."""
        self._add_one(None, "about:blank")
        self._layout.relayout()
        self._renumber(); self._update_stats()

    def _remove_pane(self, pane):
        if pane not in self._panes: return
        self._panes.remove(pane)
        self._layout.remove_pane(pane)
        try: pane.cleanup()
        except RuntimeError: pass
        self._renumber(); self._update_stats()

    def _clear_all(self):
        for p in list(self._panes):
            self._panes.remove(p)
            self._layout.remove_pane(p, defer=True)
            try: p.cleanup()
            except RuntimeError: pass
        self._layout.relayout()
        self._update_stats()

    def _renumber(self):
        for i, p in enumerate(self._panes, 1): p.set_number(i)

    def _update_stats(self):
        self._stats.setText(f"Fenêtres: {len(self._panes)} | IA: {sum(1 for p in self._panes if p.provider_id != 'default')}")

    # ===== PROMPT =====
    def _dispatch(self):
        t = self._inp.toPlainText().strip()
        if not t: return
        self._disp.dispatch_all(t, self._panes, True)
        self._inp.clear()

    def _reload_all(self):
        for p in self._panes:
            try: p.web_view.reload()
            except RuntimeError: pass

    # ===== HISTORY =====
    def _on_url(self, pane, url):
        if self._private or not url or url in ("about:blank",""): return
        self._history.append({"url":url, "time":datetime.now().isoformat(), "provider":pane.provider_id})
        if len(self._history) > 2000: self._history = self._history[-1000:]
        self._save_history()

    # ===== BOOKMARKS =====
    def _add_bookmark(self):
        url, label = None, None
        for p in self._panes:
            u = p.current_url
            if u and u not in ("about:blank",""): url = u; break
        if not url: url = "https://chatgpt.com"; label = "ChatGPT"
        if not label: label = url.split("//")[-1].split("/")[0]
        self._bookmarks.append({"url":url, "label":label, "icon":"🔖"})
        self._save_bookmarks(); self._render_bookmarks()

    def _render_bookmarks(self):
        if not hasattr(self, '_bm_layout'): return
        while self._bm_layout.count():
            i = self._bm_layout.takeAt(0)
            if i.widget(): i.widget().deleteLater()
        for bm in self._bookmarks:
            w = QWidget(); wl = QHBoxLayout(w); wl.setContentsMargins(2,1,2,1); wl.setSpacing(4)
            lbl = QLabel(f"{bm.get('icon','🔖')}  {bm['label']}")
            lbl.setStyleSheet("color:#e0e0ff;font-size:10px;"); lbl.setCursor(Qt.PointingHandCursor)
            lbl.mousePressEvent = lambda e, u=bm["url"]: (self._add_one(url=u), self._layout.relayout(), self._renumber(), self._update_stats())
            db = QPushButton("✕"); db.setFixedSize(14,14)
            db.setStyleSheet("QPushButton{background:transparent;border:none;color:#555577;font-size:7px}QPushButton:hover{color:#ff5f57}")
            db.clicked.connect(lambda checked, b=bm: (self._bookmarks.remove(b), self._save_bookmarks(), self._render_bookmarks()))
            wl.addWidget(lbl,1); wl.addWidget(db); self._bm_layout.addWidget(w)

    # ===== PRIVATE =====
    def _toggle_private(self):
        self._private = not self._private
        self._status.setText("🕶️ Privé" if self._private else "● Standard")
        self._pvt.setChecked(self._private)
        for p in list(self._panes):
            self._panes.remove(p); self._layout.remove_pane(p, defer=True)
            try: p.cleanup()
            except RuntimeError: pass
        self._layout.relayout()
        self._add_default_panes()

    # ===== SESSION =====
    def _save_session(self):
        d = {"panes":[{"url":p.current_url,"provider":p.provider_id} for p in self._panes],
             "layout":self._layout.mode().value}
        p = os.path.join(os.path.expanduser("~"), STORAGE, "session.json")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p,"w") as f: json.dump(d,f,indent=2)
        QMessageBox.information(self,"TeamAI","Session sauvegardée ✅")

    def _load_session(self):
        p = os.path.join(os.path.expanduser("~"), STORAGE, "session.json")
        if not os.path.exists(p): return
        try:
            with open(p) as f: d = json.load(f)
            self._clear_all()
            for pd in d.get("panes",[]):
                self._counter += 1
                pid = pd.get("provider","default"); pv = self._reg.get(pid)
                p = BrowserPane(pid, f"pane_{self._counter}", self._counter)
                if pv: p.set_badge(pv.icon)
                p.url_changed.connect(partial(self._on_url, p))
                p.close_requested.connect(self._remove_pane)
                p.load(pd.get("url","about:blank"))
                self._panes.append(p); self._layout.add_pane(p, defer=True)
            self._layout.relayout()
            for m in LayoutMode:
                if m.value == d.get("layout","auto_fill"): self._layout.set_mode(m); break
            self._renumber(); self._update_stats()
        except: pass

    def _load_session_dialog(self):
        self._load_session(); QMessageBox.information(self,"TeamAI","Session chargée ✅")

    def _reset_layout(self):
        self._layout.set_mode(LayoutMode.AUTO_FILL)
        QMessageBox.information(self,"TeamAI","Layout réinitialisé ✅")

    def _clear_history(self):
        self._history = []; self._save_history()
        QMessageBox.information(self,"TeamAI","Historique purgé ✅")

    def _clear_cookies(self):
        for p in self._panes:
            try: p.profile.cookieStore().deleteAllCookies()
            except RuntimeError: pass
        QMessageBox.information(self,"TeamAI","Cookies purgés ✅")

    def _save_history(self):
        p = os.path.join(os.path.expanduser("~"), STORAGE, "history.json")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        try:
            with open(p,"w") as f: json.dump(self._history,f)
        except: pass

    def _save_bookmarks(self):
        p = os.path.join(os.path.expanduser("~"), STORAGE, "bookmarks.json")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        try:
            with open(p,"w") as f: json.dump(self._bookmarks,f)
        except: pass

    def _load_history(self):
        p = os.path.join(os.path.expanduser("~"), STORAGE, "history.json")
        if os.path.exists(p):
            try:
                with open(p) as f: self._history = json.load(f) or []
            except: self._history = []

    def _load_bookmarks(self):
        p = os.path.join(os.path.expanduser("~"), STORAGE, "bookmarks.json")
        if os.path.exists(p):
            try:
                with open(p) as f: self._bookmarks = json.load(f) or []
            except: self._bookmarks = []

    def _apply_theme(self):
        self.setStyleSheet("""
            QMainWindow { background: #0b0d14; }
            QWidget { color: #e0e0ff; }
            QScrollArea { background: transparent; border: none; }
        """)
