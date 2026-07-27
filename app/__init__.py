"""
ArcClone — Navigateur multi-panneaux IA pour macOS.
Application desktop PySide6 + QtWebEngine.
"""

import sys
import os

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont, QPalette, QColor

from .main_window import MainWindow


def main():
    QApplication.setOrganizationName("ArcClone")
    QApplication.setApplicationName("ArcClone")
    QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setFont(QFont("SF Pro Text", 11))
    # Fallback if SF Pro not available
    font = app.font()
    font.setFamilies(["SF Pro Text", "Helvetica Neue", "Helvetica", "sans-serif"])
    app.setFont(font)

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
