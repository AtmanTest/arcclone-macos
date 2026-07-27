"""
app.py — Point d'entrée TeamAI CLI.
`python app.py` ou `teamai` après pip install.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import main

if __name__ == "__main__":
    main()
