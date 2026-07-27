# ArcClone — Navigateur multi-panneaux IA pour macOS

Application desktop macOS-native construite avec **Python + PySide6 + QtWebEngine**.

## Fonctionnalités

- 4 panneaux web au démarrage (ChatGPT, Perplexity, Kimi, Claude)
- Sessions isolées par panneau (QWebEngineProfile distinct)
- 3 layouts : Grille, Colonnes, Auto-Fill (Apple-style)
- Redimensionnement par drag (QSplitter)
- Prompt global injecté dans tous les panneaux
- Ajout/suppression dynamique de panneaux
- Presets rapides (4 IA, Recherche, Code, Comparaison)
- Persistance des workspaces (JSON)
- Thème sombre macOS natif

## Installation

```bash
# Cloner
cd arcclone-desktop

# Créer un venv
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Lancer
python app.py
```

## Structure du projet

```
arcclone-desktop/
├── app.py                    # Point d'entrée
├── requirements.txt          # Dépendances
├── README.md
├── config/
│   └── providers.json        # Configuration des providers IA
├── icons/                    # Icônes SVG (optionnel)
├── styles/                   # Styles QSS (optionnel)
└── app/
    ├── __init__.py
    ├── main_window.py        # Fenêtre principale + UI
    ├── browser_pane.py       # Panneau navigateur isolé
    ├── layout_manager.py     # Layouts grille/colonnes/auto-fill
    ├── provider_registry.py  # Registre des providers IA
    └── prompt_dispatcher.py  # Injection de prompts DOM
```

## Utilisation

1. **Lancer** : `python app.py`
2. **Prompt global** : tape dans la barre du haut, clique 🚀 Envoyer partout
3. **Ajouter un panneau** : clique `+` ou menu Panneaux > Nouveau panneau
4. **Layouts** : menu Layout > Grille / Colonnes / Auto-Fill
5. **Presets** : clique dans la sidebar (4 IA, Recherche, etc.)
6. **Sauvegarder** : menu ArcClone > Sauvegarder workspace

## Configuration des providers

Édite `config/providers.json` pour ajouter/modifier des providers.

```json
{
  "id": "chatgpt",
  "label": "ChatGPT",
  "url": "https://chatgpt.com",
  "icon": "🤖",
  "prompt_strategy": "contenteditable",
  "input_selectors": ["textarea", "[contenteditable='true']"],
  "submit_selectors": ["button[data-testid='send-button']"]
}
```

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| Cmd+N | Nouveau panneau |
| Cmd+W | Fermer panneau |
| Cmd+Return | Envoyer prompt |
| Cmd+G | Layout Grille |
| Cmd+C | Layout Colonnes |
| Cmd+A | Layout Auto-Fill |
| Cmd+R | Tout recharger |

## Licence

MIT
