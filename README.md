# TeamAI — Multi-IA Desktop

Application desktop Electron macOS avec webviews multi-providers IA.

**9+ IA pré-chargées :** ChatGPT, Gemini, Claude, Grok, Kimi, GLM, Mistral, Perplexity, DeepSeek, Copilot, Meta/Llama.

## Fonctionnalités

- 🧠 **Multi-webviews** — une par IA, ajout infini
- 🔗 **Prompt global** — une question → toutes les IA
- 🔑 **Assistant Connexion** — login PKCE multi-comptes Google
- 📋 **Rapport IA** — export .md et Google Drive
- 🔖 **Favoris** — sessions sauvegardées
- 🔍 **SEARCH ALL** — dispatche le prompt à toutes les IA connectées

## Installation

```bash
git clone https://github.com/AtmanTest/arcclone-macos.git
cd arcclone-macos
npm install
npm start
```

## Mode dev

Créer un `.env` avec les identifiants Google OAuth :

```
GOOGLE_CLIENT_ID=votre_id
GOOGLE_CLIENT_SECRET=votre_secret
```
