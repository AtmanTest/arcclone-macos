"""
layout_manager.py — Gestion des layouts grille, colonnes, auto-fill Apple.
Utilise QSplitter pour le redimensionnement par drag.
"""

from enum import Enum

from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QSplitter, QSizePolicy
from PySide6.QtCore import Qt, Signal


class LayoutMode(Enum):
    GRID = "grid"
    COLUMNS = "columns"
    AUTO_FILL = "auto_fill"


class LayoutManager(QWidget):
    layout_changed = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._panes: list[QWidget] = []
        self._mode = LayoutMode.AUTO_FILL
        self._container = QWidget()
        self._container_layout = QVBoxLayout(self._container)
        self._container_layout.setContentsMargins(0, 0, 0, 0)
        self._container_layout.setSpacing(0)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        main_layout.addWidget(self._container)

        self.setStyleSheet("background: #151528;")

    def set_panes(self, panes: list[QWidget]):
        self._panes = panes
        self._rebuild()

    def add_pane(self, pane: QWidget):
        self._panes.append(pane)
        self._rebuild()

    def remove_pane(self, pane: QWidget):
        if pane in self._panes:
            self._panes.remove(pane)
            pane.setParent(None)
            self._rebuild()

    def set_mode(self, mode: LayoutMode):
        self._mode = mode
        self._rebuild()

    def mode(self) -> LayoutMode:
        return self._mode

    def pane_count(self) -> int:
        return len(self._panes)

    def _rebuild(self):
        # Clear old layout
        old = self._container_layout.takeAt(0)
        if old and old.widget():
            old.widget().setParent(None)

        if not self._panes:
            return

        if self._mode == LayoutMode.COLUMNS:
            self._build_columns()
        elif self._mode == LayoutMode.GRID:
            self._build_grid()
        else:
            self._build_auto_fill()

        self.layout_changed.emit()

    def _build_columns(self):
        """Colonnes parallèles avec QSplitter horizontal."""
        splitter = QSplitter(Qt.Horizontal)
        splitter.setHandleWidth(3)
        splitter.setChildrenCollapsible(True)
        for pane in self._panes:
            pane.setParent(splitter)
            pane.show()
            splitter.addWidget(pane)
        self._container_layout.addWidget(splitter)

    def _build_grid(self):
        """Grille adaptative: 2x2 pour 4, s'adapte pour plus."""
        splitter = QSplitter(Qt.Vertical)
        splitter.setHandleWidth(3)
        splitter.setChildrenCollapsible(False)

        n = len(self._panes)
        cols = max(2, int(n ** 0.5) + (1 if n > int(n ** 0.5) ** 2 else 0))
        rows = (n + cols - 1) // cols

        # Group into rows
        for r in range(rows):
            row_splitter = QSplitter(Qt.Horizontal)
            row_splitter.setHandleWidth(2)
            row_splitter.setChildrenCollapsible(False)
            for c in range(cols):
                idx = r * cols + c
                if idx < n:
                    pane = self._panes[idx]
                    pane.setParent(row_splitter)
                    pane.show()
                    row_splitter.addWidget(pane)
            splitter.addWidget(row_splitter)

        self._container_layout.addWidget(splitter)

    def _build_auto_fill(self):
        """Apple-style auto-fill: intelligent selon le nombre de panneaux."""
        n = len(self._panes)

        if n == 1:
            # Plein écran
            self._panes[0].setParent(self._container)
            self._container_layout.addWidget(self._panes[0])

        elif n == 2:
            # 2 colonnes
            splitter = QSplitter(Qt.Horizontal)
            splitter.setHandleWidth(3)
            for p in self._panes:
                p.setParent(splitter)
                p.show()
                splitter.addWidget(p)
            self._container_layout.addWidget(splitter)

        elif n == 3:
            # 1 colonne gauche (50%) + 2 colonnes droites empilées
            main_splitter = QSplitter(Qt.Horizontal)
            main_splitter.setHandleWidth(3)

            left = self._panes[0]
            left.setParent(main_splitter)
            left.show()
            main_splitter.addWidget(left)

            right_splitter = QSplitter(Qt.Vertical)
            right_splitter.setHandleWidth(2)
            for i in range(1, 3):
                p = self._panes[i]
                p.setParent(right_splitter)
                p.show()
                right_splitter.addWidget(p)
            main_splitter.addWidget(right_splitter)
            main_splitter.setSizes([500, 500])
            self._container_layout.addWidget(main_splitter)

        elif n == 4:
            # Grille 2x2 classique
            outer = QSplitter(Qt.Vertical)
            outer.setHandleWidth(3)
            for row in range(2):
                row_splitter = QSplitter(Qt.Horizontal)
                row_splitter.setHandleWidth(2)
                for col in range(2):
                    idx = row * 2 + col
                    p = self._panes[idx]
                    p.setParent(row_splitter)
                    p.show()
                    row_splitter.addWidget(p)
                outer.addWidget(row_splitter)
            self._container_layout.addWidget(outer)

        else:
            # 5+ panneaux: grille adaptative compacte
            cols = 3 if n <= 6 else 4
            rows = (n + cols - 1) // cols

            outer = QSplitter(Qt.Vertical)
            outer.setHandleWidth(2)
            for r in range(rows):
                row_splitter = QSplitter(Qt.Horizontal)
                row_splitter.setHandleWidth(2)
                for c in range(cols):
                    idx = r * cols + c
                    if idx < n:
                        p = self._panes[idx]
                        p.setParent(row_splitter)
                        p.show()
                        row_splitter.addWidget(p)
                outer.addWidget(row_splitter)
            self._container_layout.addWidget(outer)
