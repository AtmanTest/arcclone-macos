# TeamAI — Navigateur multi-panneaux IA pour macOS

Application desktop macOS-native avec **Python + PySide6 + QtWebEngine**.

9 IA pré-chargées au démarrage : GPT-5.6 Terra, GPT-5.6 Sol Max, Gemini 3.1 Pro, Raisonnement, Claude Sonnet 5, Z GLM 5.2, Kimi K2.6, Grok 4.5, Nemotron 3 Ultra.

## Fonctionnalités

- 🧠 **9 panneaux IA** au démarrage, ajout infini
- 🔒 **Sessions isolées** (QWebEngineProfile distinct par panneau)
- 📐 **3 layouts** : Grille, Colonnes, Auto-Fill
- 🚀 **Prompt global** : une question → toutes les IA → soumission automatique
- 🕶️ **Mode privé** on/off
- 📋 **Historique** avec purge
- 🍪 **Purger les cookies**
- ✕ **Bouton fermer** sur chaque panneau
- ↺ **Reset layout**
- 💾 **Workspace** sauvegarde/restauration

## Installation

```bash
pip install git+https://github.com/AtmanTest/arcclone-macos.git
teamai
```

Ou en local :
```bash
git clone https://github.com/AtmanTest/arcclone-macos.git
cd arcclone-macos
python3 -m venv venv
source venv/bin/activate
pip install PySide6
python app.py
```

## Raccourcis

| Raccourci | Action |
|-----------|--------|
| Enter | Envoyer prompt à toutes les IA |
| Shift+Enter | Nouvelle ligne dans le prompt |
| Ctrl+N | Nouveau panneau |
| Ctrl+R | Tout recharger |
| Ctrl+G | Layout Grille |
| Ctrl+C | Layout Colonnes |
| Ctrl+A | Layout Auto-Fill |
| Ctrl+Shift+R | Reset layout |
| Ctrl+Shift+P | Mode privé |
