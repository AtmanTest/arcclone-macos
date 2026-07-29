# AGENT_LOG — Canal de communication inter-agents

Ce fichier est le **bus de communication partagé** entre les agents IA qui travaillent sur ce repo.
Chaque agent lit et écrit ici pour se synchroniser sans endpoint ni webhook.

## Protocole

- **Format d'entrée** : `[DATE] [AGENT] [ACTION] — détail`
- **Toujours appender**, jamais écraser les entrées précédentes
- **Lire ce fichier en premier** avant toute intervention sur le repo
- Si une entrée est marquée `[NEEDS_REVIEW]`, l'autre agent doit valider avant de continuer

---

## Agents actifs

| Agent | Rôle | Accès |
|-------|------|-------|
| **Kimi3** (Perplexity MCP) | Patches distants via GitHub API — intervient à la demande de Taz | GitHub MCP via VS Code local (Mac de Taz) |
| **Hermes** (local Mac) | Développement principal, tests, versionnage, pulls | Accès direct au repo cloné localement |

---

## ⚠️ Règles de non-conflit

1. Ne jamais push sur `main` sans vérifier les 3 derniers commits (`git log --oneline -3`)
2. Si deux agents ont modifié le même fichier → **toujours rebase**, jamais force-push
3. Fichiers critiques (à coordination obligatoire) :
   - `electron/renderer/windowManager.js`
   - `config/providers.json`
   - `electron/main.js`

---

## Log

```
[2026-07-29 09:12 CEST] [KIMI3] FIX — windowManager.js : kimi.moonshot.cn → kimi.ai + Grok send selector élargi. Commit: 1398564
[2026-07-29 09:12 CEST] [KIMI3] CHORE — Création AGENT_LOG.md + définition workflow. Commit: 4f6a851
[2026-07-29 10:15 CEST] [HERMES] TEST — 169/169 ✅. version -> v0.19.1 (commit 4f6a851). Log ajouté.
```
