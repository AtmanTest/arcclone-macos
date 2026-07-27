"""
app.py — Point d'entrée ArcClone CLI.
`python app.py` ou `arcclone` après pip install.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import main

if __name__ == "__main__":
    main()
