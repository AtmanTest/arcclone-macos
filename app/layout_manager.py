"""
layout_manager.py — Layout stable sans rebuild destructif.
Chaque pane est ajouté/supprimé individuellement du QGridLayout.
Jamais de clear() qui détruit les vues web.
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

    def add_pane(self, pane):
        """Ajoute un pane sans toucher aux autres."""
        self._panes.append(pane)
        self._relayout()

    def remove_pane(self, pane):
        """Retire UNIQUEMENT ce pane du grid, ne touche pas aux autres."""
        if pane not in self._panes:
            return
        self._grid.removeWidget(pane)
        self._panes.remove(pane)
        self._relayout()

    def set_mode(self, mode):
        self._mode = mode
        self._relayout()

    def mode(self):
        return self._mode

    def _relayout(self):
        """Repositionne tous les panes dans le grid sans les supprimer."""
        n = len(self._panes)
        if n == 0:
            return

        rows, cols = self._dims(n)
        positions = self._positions(rows, cols, n)

        for idx, (r, c, rs, cs) in enumerate(positions):
            if idx < len(self._panes):
                pane = self._panes[idx]
                # Enlève du grid si déjà présent, puis re-ajoute à la bonne position
                self._grid.removeWidget(pane)
                self._grid.addWidget(pane, r, c, rs, cs)
                pane.show()
                pane.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        # Stretch pour remplir l'espace
        for i in range(self._grid.rowCount()):
            self._grid.setRowStretch(i, 1)
        for j in range(self._grid.columnCount()):
            self._grid.setColumnStretch(j, 1)

        self.layout_changed.emit()

    def _dims(self, n):
        if self._mode == LayoutMode.COLUMNS:
            return (1, n)
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
        """Calcule (r, c, rowspan, colspan)."""
        if n == 3 and self._mode != LayoutMode.COLUMNS:
            return [(0, 0, 2, 1), (0, 1, 1, 1), (1, 1, 1, 1)]
        res = []
        idx = 0
        for r in range(rows):
            for c in range(cols):
                if idx < n:
                    res.append((r, c, 1, 1))
                    idx += 1
        return res
