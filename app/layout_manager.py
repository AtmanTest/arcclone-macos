"""
layout_manager.py — Layout grille simple avec QGridLayout.
Pas de création/destruction de QSplitter, pas de crash.
"""

from enum import Enum
from PySide6.QtWidgets import QWidget, QVBoxLayout, QGridLayout, QSizePolicy
from PySide6.QtCore import Qt, Signal


class LayoutMode(Enum):
    GRID = "grid"
    COLUMNS = "columns"
    AUTO_FILL = "auto_fill"


def _auto_grid(n):
    """Retourne (rows, cols) selon le nombre de panneaux (Apple-style)."""
    if n <= 1:
        return (1, 1)
    if n == 2:
        return (1, 2)
    if n == 3:
        return (2, 2)  # 1 grand + 2 petits
    if n == 4:
        return (2, 2)
    if n <= 6:
        return (2, 3)
    if n <= 8:
        return (2, 4)
    if n <= 9:
        return (3, 3)
    if n <= 12:
        return (3, 4)
    cols = int(n ** 0.5) + (1 if n > int(n ** 0.5) ** 2 else 0)
    rows = (n + cols - 1) // cols
    return (rows, cols)


class LayoutManager(QWidget):
    layout_changed = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._panes: list[QWidget] = []
        self._mode = LayoutMode.AUTO_FILL
        self._grid = QGridLayout()
        self._grid.setContentsMargins(0, 0, 0, 0)
        self._grid.setSpacing(2)
        main = QVBoxLayout(self)
        main.setContentsMargins(0, 0, 0, 0)
        main.addLayout(self._grid)
        self.setStyleSheet("background: #151528;")

    def set_panes(self, panes):
        self._panes = panes
        self._rebuild()

    def add_pane(self, pane):
        self._panes.append(pane)
        self._rebuild()

    def remove_pane(self, pane):
        if pane in self._panes:
            self._panes.remove(pane)
            self._rebuild()

    def set_mode(self, mode):
        self._mode = mode
        self._rebuild()

    def mode(self):
        return self._mode

    def pane_count(self):
        return len(self._panes)

    def _rebuild(self):
        # Remove all items from grid (does NOT delete widgets)
        while self._grid.count():
            item = self._grid.takeAt(0)
            if item and item.widget():
                self._grid.removeWidget(item.widget())

        if not self._panes:
            return

        n = len(self._panes)

        if self._mode == LayoutMode.COLUMNS:
            rows, cols = 1, n
        elif self._mode == LayoutMode.GRID:
            rows, cols = _auto_grid(n)
        else:
            rows, cols = _auto_grid(n)

        positions = self._compute_positions(rows, cols, n)
        for idx, (r, c, rs, cs) in enumerate(positions):
            pane = self._panes[idx]
            self._grid.addWidget(pane, r, c, rs, cs)
            pane.show()
            pane.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.layout_changed.emit()

    def _compute_positions(self, rows, cols, n):
        """Calcule les positions (row, col, rowspan, colspan) pour n panneaux."""
        positions = []

        if self._mode == LayoutMode.COLUMNS:
            for i in range(n):
                positions.append((0, i, 1, 1))
            return positions

        if self._mode == LayoutMode.GRID:
            idx = 0
            for r in range(rows):
                for c in range(cols):
                    if idx < n:
                        positions.append((r, c, 1, 1))
                        idx += 1
            return positions

        # AUTO_FILL — Apple-style
        if n == 1:
            positions.append((0, 0, 1, 1))
        elif n == 2:
            positions.append((0, 0, 1, 1))
            positions.append((0, 1, 1, 1))
        elif n == 3:
            positions.append((0, 0, 2, 1))  # Gauche : toute la hauteur
            positions.append((0, 1, 1, 1))  # Droite haut
            positions.append((1, 1, 1, 1))  # Droite bas
        elif n == 4:
            positions.append((0, 0, 1, 1))
            positions.append((0, 1, 1, 1))
            positions.append((1, 0, 1, 1))
            positions.append((1, 1, 1, 1))
        else:
            idx = 0
            for r in range(rows):
                for c in range(cols):
                    if idx < n:
                        positions.append((r, c, 1, 1))
                        idx += 1

        return positions
