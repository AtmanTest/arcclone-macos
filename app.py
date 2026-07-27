"""
app.py — Point d'entrée ArcClone.
Lance l'application PySide6 avec QtWebEngine.
"""

import sys
import os

# Ensure the project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

from app.main_window import MainWindow


def main():
    QApplication.setOrganizationName("ArcClone")
    QApplication.setApplicationName("ArcClone")
    QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setFont(QFont("SF Pro Display", 11))

    # Global dark palette
    from PySide6.QtGui import QPalette, QColor
    palette = QPalette()
    palette.setColor(QPalette.Window, QColor("#0b0d14"))
    palette.setColor(QPalette.WindowText, QColor("#e0e0ff"))
    palette.setColor(QPalette.Base, QColor("#151528"))
    palette.setColor(QPalette.AlternateBase, QColor("#1e1e2e"))
    palette.setColor(QPalette.ToolTipBase, QColor("#1e1e2e"))
    palette.setColor(QPalette.ToolTipText, QColor("#e0e0ff"))
    palette.setColor(QPalette.Text, QColor("#e0e0ff"))
    palette.setColor(QPalette.Button, QColor("#2d2d44"))
    palette.setColor(QPalette.ButtonText, QColor("#e0e0ff"))
    palette.setColor(QPalette.BrightText, QColor("#ffffff"))
    palette.setColor(QPalette.Link, QColor("#6c63ff"))
    palette.setColor(QPalette.Highlight, QColor("#6c63ff"))
    palette.setColor(QPalette.HighlightedText, QColor("#ffffff"))
    app.setPalette(palette)

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
