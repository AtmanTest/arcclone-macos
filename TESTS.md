# TeamAI — Tests de régression (smoke tests)

## Test 1 : Lancement
**Action** : `npm start`
**Attendu** : Fenêtre Electron s'ouvre → sidebar visible → 10 BrowserViews chargées

## Test 2 : Toolbar par fenêtre
**Action** : Cliquer ◀ ▶ ⟳ sur chaque fenêtre
**Attendu** : Navigation fonctionne, pas de crash

## Test 3 : Dropdown provider
**Action** : Changer le provider dans le combo d'une fenêtre
**Attendu** : La fenêtre recharge avec la nouvelle URL

## Test 4 : URL bar navigation
**Action** : Taper une URL + Enter
**Attendu** : La fenêtre navigue vers l'URL (ou Google search si pas de point)

## Test 5 : Fermeture fenêtre ✕
**Action** : Cliquer ✕ sur une fenêtre
**Attendu** : La fenêtre disparaît du DOM et de la sidebar, les autres restent

## Test 6 : Nouvel onglet IA +
**Action** : Cliquer "Nouvel Onglet IA +"
**Attendu** : Nouvelle fenêtre apparaît avec le premier provider

## Test 7 : Prompt GO
**Action** : Taper un message dans la barre en haut + Enter (ou clic GO)
**Attendu** : Le message est injecté dans TOUTES les fenêtres ouvertes + Enter auto

## Test 8 : Scroll viewport
**Action** : Scroller dans la zone des fenêtres
**Attendu** : Toutes les fenêtres défilent, les BrowserViews suivent

## Test 9 : Zoom +/-
**Action** : Cliquer + / − / ⊙ dans la sidebar
**Attendu** : Les fenêtres changent de taille (15% par pas), label mis à jour

## Test 10 : Sidebar window list
**Action** : Cliquer sur une entrée dans la liste de la sidebar
**Attendu** : Le viewport défile vers cette fenêtre

## Test 11 : Rapport complet
**Action** : Cliquer "📋 Rapport complet"
**Attendu** : Modal s'ouvre → collecte les réponses de toutes les fenêtres → affiche le texte → Export .md fonctionne

## Test 12 : Version badge
**Action** : Vérifier le badge en bas de la sidebar, cliquer dessus
**Attendu** : Badge affiche vX.X.X — commit. Clic → ouvre GitHub commits dans le navigateur

## Test 13 : Session save/restore
**Action** : Ouvrir des fenêtres → fermer l'app → rouvrir
**Attendu** : Dialogue "Restaurer la session ?" → Oui → les fenêtres sont rechargées

## Test 14 : Google OAuth
**Action** : Aller sur un site avec connexion Google (ex: ChatGPT), cliquer "Sign in with Google"
**Attendu** : Une popup Electron s'ouvre pour l'auth Google (pas Chrome externe)

## Test 15 : Fournisseurs
**Action** : Vérifier la liste des providers dans la sidebar
**Attendu** : 10 providers listés (dont Venice.ai en dernier)

## Test 16 : Scrollbar style
**Action** : Vérifier l'apparence des scrollbars
**Attendu** : Scrollbars fines, couleur assortie au thème dark
