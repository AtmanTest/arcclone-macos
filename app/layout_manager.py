"""
layout_manager.py — QGridLayout stable, pas de crash sur remove.
"""

from enum import Enum
from PySide6.QtWidgets import QWidget, QVBoxLayout, QGridLayout, QSizePolicy
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
        if pane not in self._panes:
            return
        self._grid.removeWidget(pane)
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
        # Remove all from grid without deleting widgets
        while self._grid.count():
            item = self._grid.takeAt(0)
            if item and item.widget():
                self._grid.removeWidget(item.widget())

        if not self._panes:
            return

        n = len(self._panes)
        rows, cols = self._grid_dims(n)

        positions = self._positions(rows, cols, n)
        for idx, (r, c, rs, cs) in enumerate(positions):
            if idx < len(self._panes):
                pane = self._panes[idx]
                self._grid.addWidget(pane, r, c, rs, cs)
                pane.show()
                pane.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.layout_changed.emit()

    def _grid_dims(self, n):
        if self._mode == LayoutMode.COLUMNS:
            return (1, n)
        if self._mode == LayoutMode.GRID:
            cols = max(2, int(n ** 0.5) + (1 if n > int(n ** 0.5) ** 2 else 0))
            rows = (n + cols - 1) // cols
            return (rows, cols)
        # AUTO_FILL
        if n <= 1: return (1, 1)
        if n == 2: return (1, 2)
        if n == 3: return (2, 2)
        if n == 4: return (2, 2)
        if n <= 6: return (2, 3)
        if n <= 8: return (2, 4)
        if n <= 9: return (3, 3)
        if n <= 12: return (3, 4)
        cols = int(n ** 0.5) + (1 if n > int(n ** 0.5) ** 2 else 0)
        return ((n + cols - 1) // cols, cols)

    def _positions(self, rows, cols, n):
        """Calcule (r, c, rowspan, colspan) pour chaque pane."""
        if self._mode == LayoutMode.GRID or self._mode == LayoutMode.COLUMNS:
            idx = 0
            res = []
            for r in range(rows):
                for c in range(cols):
                    if idx < n:
                        res.append((r, c, 1, 1))
                        idx += 1
            return res
        # AUTO_FILL
        if n == 1:
            return [(0, 0, 1, 1)]
        if n == 2:
            return [(0, 0, 1, 1), (0, 1, 1, 1)]
        if n == 3:
            return [(0, 0, 2, 1), (0, 1, 1, 1), (1, 1, 1, 1)]
        if n == 4:
            return [(0, 0, 1, 1), (0, 1, 1, 1), (1, 0, 1, 1), (1, 1, 1, 1)]
        idx = 0
        res = []
        for r in range(rows):
            for c in range(cols):
                if idx < n:
                    res.append((r, c, 1, 1))
                    idx += 1
        return res
