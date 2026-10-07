# Corrections planifiées

Revue du code existant, branche `feat/Vault-Access-#5` avec le travail non commité du 7 octobre 2026 (vault, providers, splashscreen, settings). **Aucune de ces corrections n'est appliquée** : chaque entrée attend d'être relue et validée.

Les grosses fonctionnalités sont dans [roadmap.md](roadmap.md), les idées non planifiées dans [backlog.md](backlog.md) et le plan en cours dans [todo.md](todo.md). Ce fichier liste ce qu'il faut corriger **avant** de repartir sur des fonctionnalités.

## Mode d'emploi

- Relire chaque entrée et la marquer **OK**, **Modifier** (avec la consigne) ou **Rejeté** dans sa ligne *Statut*.
- Les entrées `(décision à prendre)` proposent une option recommandée : la confirmer ou en choisir une autre.
- Une fois les entrées validées, les implémenter phase par phase, un commit par phase, dans l'ordre (la phase 0 rend les vérifications fiables pour la suite). Une entrée n'est faite que lorsque sa ligne **Vérif.** passe.
- Les entrées rejetées ou reportées vont dans `backlog.md`. Quand tout est traité, supprimer ce fichier ou le réduire à « Aucune correction en attente ».

## État constaté (7 octobre 2026)

| Vérification | Résultat |
| --- | --- |
| `cargo test` | 14 tests passent (storage, vault) |
| `cargo clippy --all-targets` | 0 erreur, 16 avertissements (imports inutilisés, code mort, `needless_return`, doc comment) |
| `cargo fmt --check` | 67 blocs à reformater : le code Rust n'a jamais été passé à rustfmt |
| `pnpm typecheck` | **échoue** : 1 erreur dans `src/components/ui/spinner.tsx`, donc `pnpm build` et `tauri build` sont cassés |
| `pnpm check` (Biome) | **échoue** : 37 erreurs, toutes de format (fins de ligne CRLF et schémas générés de `src-tauri/gen`) |
| Tests frontend | aucun outil de test |
| Application lancée | non exercée pendant la revue (pas de clé de test) : les bugs ci-dessous viennent de la lecture du code |

Gravité : **Bloquant** (casse une fonctionnalité de base), **Majeur** (bug visible ou risque réel), **Mineur** (dette, cohérence).

---

## Phase 0 : outillage et vérifications fiables

But : que `pnpm typecheck`, `pnpm check`, `cargo fmt --check` et `cargo clippy` passent sur une base propre, pour que toute régression ultérieure soit visible.

### F0.1 — `pnpm build` cassé par `spinner.tsx` (Bloquant)

**Constat :** `src/components/ui/spinner.tsx:4` type ses props en `React.ComponentProps<"svg">` puis les étale sur `RiLoaderLine`, dont les props interdisent `children`. `tsc` sort en erreur, et `pnpm build` (`tsc && vite build`) avec.
**Correction :** typer les props avec `RemixiconProps` (`import type { RemixiconProps } from "@remixicon/react"`) ou retirer `children` avant l'étalement. Noter la retouche locale dans la skill `meant-ui` (un `shadcn add spinner --overwrite` la ferait disparaître).
**Vérif. :** `pnpm typecheck` et `pnpm build` passent.
**Statut :**

### F0.2 — Fins de ligne CRLF (Majeur)

**Constat :** `core.autocrlf=true` et pas de `.gitattributes`. Les fichiers extraits sont en CRLF, que Biome refuse (35 des 37 erreurs). Les fichiers créés récemment sont en LF : le dépôt est mixte.
**Correction :** ajouter un `.gitattributes` (`* text=auto eol=lf`, plus `*.png *.ico *.icns binary`), puis `git add --renormalize .` dans un commit dédié, sans autre changement.
**Vérif. :** `git ls-files --eol` ne montre plus de `w/crlf` ; `pnpm check` n'a plus d'erreur de format sur `src/`.
**Statut :**

### F0.3 — Biome analyse les fichiers générés de Tauri (Mineur)

**Constat :** `src-tauri/gen/schemas/*.json` (générés par Tauri) sont vérifiés par Biome. `biome.jsonc` n'exclut que `components/ui`.
**Correction :** ajouter `"!src-tauri/gen"` et `"!src-tauri/target"` dans `files.includes`.
**Vérif. :** `pnpm check` passe sans erreur.
**Statut :**

### F0.4 — Pas de base rustfmt (Mineur)

**Constat :** indentation et coupures irrégulières (`main.rs:24`, `react.rs`, `update_config.rs:25`) ; 67 écarts avec rustfmt.
**Correction :** ajouter `src-tauri/rustfmt.toml` (`edition = "2021"`), lancer `cargo fmt` dans un commit qui ne fait que ça. Ce fichier active aussi le formatage Rust du hook Claude Code.
**Vérif. :** `cargo fmt --check` passe.
**Statut :**

### F0.5 — Avertissements clippy et code mort Rust (Mineur)

**Constat :**
- imports inutilisés : `ai/tools/mod.rs:3` (`serde_json::Value`) ; `vault/keyring_store.rs:46-55` (module de tests vide avec 4 imports) ;
- jamais utilisés : `ChatRole` (`ai/agent/types.rs:61`), `ThreadMessage::content` (`types.rs:94`), `DbError` (`db/error.rs`), variantes `RunStatus::Completed/Failed` (`runs/service.rs:13`), `ToolError::InvalidInput/Execution` (`ai/tools/mod.rs:7`, pas construites mais utiles aux futurs outils) ;
- `ai/tools/rig.rs` n'est déclaré dans aucun `mod` : fichier orphelin jamais compilé ;
- `runs/service.rs:60` : `return` inutile et `error.to_string()` dans un `format!` ;
- `TomlCodec::encode` (`storage/codec.rs:15`) : `PathBuf::new()` avec un commentaire « voir note plus bas » sans note.
**Correction :** supprimer `ChatRole`, `ThreadMessage::content`, le module de tests vide, `tools/rig.rs` ; garder `DbError` et `RunStatus` pour R2 et R4 (ou les supprimer si ces entrées sont rejetées) ; marquer `ToolError` `#[allow(dead_code)]` avec une raison, ou le brancher dans `echo`. Pour `encode`, prendre le chemin en paramètre comme `decode`.
**Vérif. :** `cargo clippy --all-targets -- -D warnings` passe.
**Statut :**

### F0.6 — Le hook de pré-commit télécharge ultracite à chaque commit (Mineur)

**Constat :** `package.json` › `lint-staged` lance `pnpm dlx ultracite fix`, et `.husky/pre-commit` lance `pnpm dlx lint-staged`, alors que les deux sont en devDependencies : téléchargement à chaque commit, et version potentiellement différente de celle du dépôt.
**Correction :** `pnpm exec lint-staged` dans le hook et `ultracite fix` dans `lint-staged`. Ajouter un `pre-push` qui lance `pnpm typecheck`, `pnpm check`, puis `cargo clippy --all-targets -- -D warnings` et `cargo test` dans `src-tauri`.
**Vérif. :** un commit sur un fichier mal formaté le corrige sans accès réseau ; un push avec une erreur de types est refusé.
**Statut :**

### F0.7 — Dépendances inutilisées ou mal branchées (Mineur)

**Constat :**
- `react-hook-form` et `tailwindcss-animate` ne sont importés nulle part ;
- `tw-animate-css` est installé mais pas importé dans `global.css` : les classes d'animation de shadcn (`animate-in`, `fade-in`… sur menus, tooltips, sheets) ne font rien ;
- `next-themes` n'est utilisé que par `components/ui/sonner.tsx:8`, sans `ThemeProvider` de next-themes : les toasts restent sur `system` et ignorent le thème choisi ;
- `@tauri-apps/plugin-shell` n'est appelé nulle part (voir S3).
**Correction :** retirer `react-hook-form`, `tailwindcss-animate` et `next-themes` ; ajouter `@import "tw-animate-css";` dans `global.css` ; faire lire le thème résolu à `sonner.tsx` depuis notre `useTheme` (retouche locale d'un composant shadcn, à noter dans la skill).
**Vérif. :** `pnpm typecheck` ; dans l'app, un toast suit le thème sombre et un menu s'ouvre avec son animation.
**Statut :**

---

## Phase 1 : bugs

### B1 — Toute conversation échoue : `ChatRequest` exige `model` et `tools` (Bloquant)

**Constat :** `commands/chat.rs:12-13` ajoute `model: String` et `tools: Vec<String>` (non optionnels, jamais lus), mais `thread-context.tsx:317` n'envoie que `threadId` et `input`. La désérialisation de la commande échoue (« missing field `model` ») : aucun message ne peut être envoyé.
**Correction :** retirer les deux champs ; le choix du modèle et des outils sera conçu avec l'axe « Modèles » de la roadmap. Si on veut garder la forme de la requête, les passer en `Option<_>` avec `#[serde(default)]`.
**Vérif. :** `cargo check` ; dans l'app, un premier message dans un nouveau fil reçoit une réponse.
**Statut :**

### B2 — Une erreur de run s'affiche jusqu'à trois fois (Majeur)

**Constat :** sur une erreur de flux, `react.rs:117` émet `Error` puis renvoie `Err` ; `RunService::run` (`runs/service.rs:55`) émet un second `Error` ; `chat` renvoie l'erreur, l'`invoke` est rejeté et `thread-context.tsx:325` appelle encore `handleError`. Le premier appel ajoute le message au segment en cours, les suivants créent chacun un message « ⚠️ ».
**Correction :** un seul émetteur, `RunService` (supprimer l'émission dans `react.rs`) ; côté UI, ignorer le rejet de l'`invoke` si un `Error` a déjà terminé le run (`activeRunRef.current === false`). Les erreurs survenues avant le run (pas de provider, fil introuvable) n'arrivent que par le rejet : elles restent affichées une fois.
**Vérif. :** test Rust de `RunService` avec un runtime factice qui échoue : un seul `Error` émis. Dans l'app, avec une clé invalide : un seul avertissement.
**Statut :**

### B3 — Changer de fil pendant un run mélange les conversations (Majeur)

**Constat :** le `ThreadProvider` est monté une seule fois dans `AppLayout`. Si l'utilisateur ouvre un autre fil pendant un run, `hydrate` charge le fil B (le garde-fou de `thread-context.tsx:335` ne protège que le même fil), puis les événements du run A continuent d'être ajoutés à l'affichage, et `RunCompleted` remplace les messages de B par l'instantané de A (`thread-context.tsx:297`).
**Correction :** capturer l'id du fil du run (mis à jour sur `ThreadCreated`) dans la closure de `sendMessage`. Pour tout événement dont le fil n'est plus celui affiché, ne mettre à jour que l'état du run (`activeRunRef`, `isBusy`), sans toucher aux messages. Sortir la logique de traitement des événements dans un réducteur pur (`features/threads/run-reducer.ts`) pour pouvoir la tester.
**Vérif. :** tests du réducteur (événements d'un autre fil ignorés, `RunCompleted` du fil courant appliqué) ; dans l'app : lancer un run, ouvrir un autre fil, revenir, l'historique est correct.
**Statut :**

### B4 — Un appel d'outil en tête de liste ne reçoit jamais son résultat (Mineur)

**Constat :** `features/threads/utils.ts:37` teste `existing?.kind === "tool" && index` ; pour l'index 0, `index` est falsy et le résultat est ignoré. Rare aujourd'hui (un fil commence par un message utilisateur), mais faux.
**Correction :** `index !== undefined`.
**Vérif. :** test unitaire de `groupMessages` (voir R6).
**Statut :**

### B5 — `AppConfig::default()` ne respecte pas les valeurs par défaut (Majeur)

**Constat :** `config/model.rs:3` dérive `Default`, ce qui donne `theme = ""` et `username = ""` ; les fonctions `default_theme` et `default_username` ne servent qu'à la désérialisation. `AtomicFileStore::update` part de `unwrap_or_default()` quand le fichier n'existe pas : une mise à jour partielle au premier lancement écrit un thème vide.
**Correction :** implémenter `Default` à la main en appelant les mêmes fonctions, et ajouter un test « `update` sans fichier → thème `system` ». Voir aussi R5 (thème en enum).
**Vérif. :** `cargo test`.
**Statut :**

### B6 — Les résultats d'outils sont rejoués au modèle sous forme de JSON interne à Rig (Majeur)

**Constat :** `react.rs:183` stocke `serde_json::to_value(&tool_result.content)`, c'est-à-dire la sérialisation de `OneOrMany<ToolResultContent>` (par exemple `[{"type":"text","text":"hello"}]`). Au tour suivant, `to_rig_message` (`react.rs:265`) le renvoie au modèle comme texte brut : le modèle voit la structure de Rig au lieu de `hello`. L'UI affiche la même structure.
**Correction :** stocker le texte du résultat (concaténation des parties texte) dans `content`, et reconstruire `ToolResultContent::text` à partir de ce texte. Pour les anciens messages déjà stockés, accepter les deux formes à la lecture.
**Vérif. :** test unitaire aller-retour `ThreadMessage::ToolResult` → ligne stockée → `to_rig_message` ; dans l'app, l'outil `echo` affiche `hello`.
**Statut :**

### B7 — Un run en échec laisse un message utilisateur orphelin (Mineur, décision à prendre)

**Constat :** le message utilisateur est persisté avant le run (`chat.rs:48`), le reste seulement en cas de succès. Après un échec, la base contient le message utilisateur seul, l'UI garde un message optimiste avec un id client, et le prochain envoi produit deux messages utilisateur consécutifs dans l'historique envoyé au modèle. Le texte partiel déjà affiché est perdu.
**Options :**
1. (Recommandé) Garder le message utilisateur et persister le texte partiel avec une marque d'échec ; c'est le travail de R4 (table `runs`, statut `failed`). En attendant, après un `Error`, recharger le fil depuis la base (`revalidate`) pour que l'UI montre l'état réel.
2. Supprimer le message utilisateur en cas d'échec et le remettre dans le champ de saisie.
**Vérif. :** dans l'app, avec une clé invalide puis valide : l'historique envoyé ne contient pas deux messages utilisateur à la suite, et l'affichage correspond à la base après rechargement.
**Statut :**

### B8 — Le routeur est recréé à chaque rendu d'`AppRouter` (Mineur)

**Constat :** `app/router.tsx:40` appelle `createAppRouter()` dans le rendu. Tout nouveau rendu d'`App` recrée le routeur, relance les loaders et perd l'état de navigation.
**Correction :** créer le routeur une seule fois au niveau du module (ou `useMemo` sans dépendance).
**Vérif. :** `pnpm typecheck` ; dans l'app, changer le thème depuis les réglages ne recharge pas la liste des fils.
**Statut :**

### B9 — Barre latérale : fil actif non réactif et liste non rafraîchie (Mineur)

**Constat :** `components/sidebar/nav-threads.tsx:27` lit `window.location` (global) au lieu de `useLocation` : le fil actif n'est pas toujours mis en évidence après une navigation. La liste n'est revalidée qu'à la création d'un fil (`new-thread.tsx:19`) : après un échange dans un fil existant, l'ordre par `updated_at` n'est plus à jour. Directive `"use client"` héritée de Next.js inutile.
**Correction :** `NavLink` (ou `useLocation`) ; revalider la liste sur `RunCompleted` ; retirer `"use client"`.
**Vérif. :** dans l'app, le fil courant est surligné et remonte en tête après un message.
**Statut :**

---

## Phase 2 : sécurité et local-first

### S1 — Des avatars sont chargés depuis github.com (Majeur)

**Constat :** `assistant-message.tsx:24` et `user-message.tsx:22` chargent `https://github.com/shadcn.png` à chaque message : une requête réseau vers un tiers, contraire au principe « rien ne quitte la machine ».
**Correction :** retirer `AvatarImage` ; `AvatarFallback` avec une icône (assistant) et les initiales de `config.username` (utilisateur).
**Vérif. :** `grep -r "https://" src` ne renvoie plus que des commentaires ; dans l'app, aucun appel réseau à l'ouverture d'un fil (onglet réseau des devtools).
**Statut :**

### S2 — Pas de Content Security Policy (Majeur)

**Constat :** `tauri.conf.json` › `app.security.csp: null`. L'app affiche du Markdown produit par un LLM ; `react-markdown` n'interprète pas le HTML brut par défaut, mais sans CSP la moindre régression (plugin `rehype-raw`, lien `javascript:`) suffirait à exécuter du code avec accès à l'IPC.
**Correction :** une CSP stricte, par exemple `default-src 'self'; img-src 'self' data: asset: http://asset.localhost; style-src 'self' 'unsafe-inline'; connect-src ipc: http://ipc.localhost`, à ajuster en dev (Vite sur `:1420`). Les appels aux providers partent de Rust et ne sont pas concernés.
**Vérif. :** `pnpm tauri dev` et `pnpm tauri build` démarrent sans violation CSP dans la console ; une image distante dans une réponse Markdown est bloquée.
**Statut :**

### S3 — Plugin shell activé sans usage (Mineur)

**Constat :** `tauri_plugin_shell` est initialisé (`main.rs:30`) et `shell:default` accordé (`capabilities/migrated.json`), mais rien ne l'utilise. La capability s'appelle encore `migrated` (migration depuis Tauri v1).
**Correction :** retirer le plugin (Rust et npm) et la permission ; renommer la capability en `default` avec une description.
**Vérif. :** `cargo check`, `pnpm typecheck`, l'app démarre.
**Statut :**

### S4 — Reliquats de configuration par variables d'environnement (Mineur)

**Constat :** `main.rs:24` charge `.env` en debug (`dotenvy`) alors que les clés viennent désormais du vault ; `src/config/env.ts` et `src/lib/create-env.ts` valident un `VITE_API_URL` que rien n'utilise ; `.env.example` ne documente que cette variable. Un `.env` local contenant d'anciennes clés peut traîner.
**Correction :** retirer `dotenvy`, `env.ts`, `create-env.ts` et `VITE_API_URL` ; réduire `.env.example` à un commentaire (« Meant ne lit plus de variables d'environnement ; les clés sont dans le vault »). Vérifier soi-même le `.env` local et le supprimer s'il ne contient que d'anciennes clés.
**Vérif. :** `cargo check`, `pnpm typecheck`, l'app démarre sans `.env`.
**Statut :**

---

## Phase 3 : refactors structurants

Ces entrées changent des contrats (base de données, IPC, erreurs). Chacune demande une décision ; une fois validées, elles peuvent devenir le plan en cours de `todo.md`.

### R1 — Migrations SQLite (Majeur, décision à prendre)

**Constat :** le schéma est créé par `CREATE TABLE IF NOT EXISTS` (`db/repository.rs:21`). La moindre évolution (titre généré, table `runs`, `is_error`) n'a aucun moyen de s'appliquer à une base existante.
**Options :**
1. (Recommandé) `PRAGMA user_version` et une liste ordonnée de scripts SQL embarqués (`include_str!("migrations/0001_init.sql")`), appliqués dans une transaction au démarrage. Aucune dépendance.
2. `rusqlite_migration` : même principe, en dépendance.
**Vérif. :** tests sur base en mémoire : base vide → dernière version ; base créée par l'ancien code → migrée sans perte.
**Statut :**

### R2 — Erreurs typées de bout en bout (Majeur)

**Constat :** `ThreadRepository` renvoie `Result<_, String>` partout ; les commandes mélangent `String`, `StoreError` et `VaultError` ; `AgentError` implémente `Display` et `From<AgentError> for String` avec deux formats différents (`runtime.rs:31` et `:41`). L'UI reçoit des chaînes sans moyen de distinguer « pas de clé » d'une erreur réseau.
**Correction :** `DbError` en `thiserror` (rusqlite, mutex) ; une `AppError` sérialisée `{ kind, message }` pour toutes les commandes (`kind` : `vault`, `config`, `db`, `provider`, `notFound`, `invalidInput`, `internal`) ; le TS reçoit un type `AppError` et les écrans réagissent au `kind` (par exemple « pas de provider » → lien vers les réglages). Retirer `From<AgentError> for String`.
**Vérif. :** `cargo clippy`, `pnpm typecheck` ; dans l'app, envoyer un message sans clé valide affiche un message qui mène aux réglages.
**Statut :**

### R3 — Casse incohérente des données échangées par IPC (Majeur, décision à prendre)

**Constat :** `Thread` est sérialisé en camelCase, `StoredThreadMessage` et tous les `AgentEvent` en snake_case, les requêtes en camelCase. Le type TS `ThreadBaseMessage` déclare `createdAt?` (jamais reçu : Rust envoie `created_at`) à côté de `thread_id`.
**Options :**
1. (Recommandé) Tout en camelCase : `#[serde(rename_all = "camelCase")]` sur `StoredThreadMessage` et `rename_all_fields = "camelCase"` sur `AgentEvent`, puis mise à jour de `lib/types.ts` et `thread-context.tsx` en une fois. C'est la convention JS et celle déjà retenue pour `Thread` et les requêtes.
2. Générer les types TS depuis Rust (`ts-rs` ou `specta`/`tauri-specta`), ce qui supprime aussi la synchronisation manuelle. Plus de mise en place ; à envisager avec ou après l'option 1.
**Vérif. :** `pnpm typecheck` ; dans l'app, un fil avec appel d'outil s'affiche en direct et après rechargement.
**Statut :**

### R4 — Persistance d'un run : transaction et table `runs` (Majeur, décision à prendre)

**Constat :** les messages produits sont insérés un par un (`chat.rs:95`), chacun dans sa propre opération : une erreur au milieu laisse un run à moitié écrit. `Run` et `RunStatus` existent sans être persistés, ce qui empêche de tracer un échec (B7), une annulation (roadmap) ou le coût d'un run.
**Correction proposée :** `ThreadRepository::append_messages(thread_id, &[...])` en une transaction ; table `runs` (id, thread_id, provider, model, status, error, started_at, ended_at) écrite au début (`running`) et à la fin (`completed`/`failed`), avec la clé `run_id` sur les messages. Dépend de R1.
**Vérif. :** tests du repository en mémoire (insertion atomique, statut `failed` après une erreur simulée).
**Statut :**

### R5 — Thème et préférences validés côté Rust (Mineur)

**Constat :** `AppConfig.theme` est un `String` (`config/model.rs:6`) et `UpdateConfigRequest` accepte n'importe quelle valeur ; seul le type TS le restreint à `light | dark | system`. Le `username` n'est validé que côté UI (3 à 10 caractères), avec la règle dupliquée entre `lib/schemas.ts` et `splash-form.tsx:43`.
**Correction :** `enum Theme { Light, Dark, System }` en `serde(rename_all = "lowercase")` (compatible avec les fichiers existants) ; validation du `username` dans `update_config` ; `splash-form.tsx` réutilise `preferencesSchema`.
**Vérif. :** `cargo test` (décodage d'un `config.toml` existant, refus d'un thème inconnu) ; `pnpm typecheck`.
**Statut :**

### R6 — Tests du cœur métier (Majeur)

**Constat :** seuls `storage` et `vault` sont testés. Rien ne couvre la conversion des messages (`to_rig_message`, `TryFrom<StoredThreadMessage>`), le repository, ni la logique pure du frontend (`groupMessages`, futur réducteur de run). Pas d'outil de test côté TS.
**Correction :** Vitest (sans DOM) pour `features/threads/utils.ts`, le réducteur de B3 et `lib/schemas.ts`, avec un script `pnpm test`. Côté Rust : `ThreadRepository` constructible sur `Connection::open_in_memory()` pour le tester, et des tests aller-retour des messages. Ajouter `pnpm test` au pre-push (F0.6).
**Vérif. :** `pnpm test` et `cargo test` passent et couvrent les cas listés.
**Statut :**

### R7 — Intégration continue (Mineur)

**Constat :** aucune CI ; les vérifications ne tournent que si on y pense.
**Correction :** workflow GitHub Actions sur push et pull request : `pnpm typecheck`, `pnpm check`, `pnpm test`, puis `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` (Ubuntu, dépendances système de Tauri installées). Les builds d'installeurs restent hors périmètre (roadmap, axe « Distribution »).
**Vérif. :** la CI passe sur une branche propre et échoue sur une erreur de types volontaire.
**Statut :**

---

## Phase 4 : nettoyage

### C1 — Code mort côté frontend (Mineur)

**Constat :** jamais importés : `hooks/use-threads.ts`, `lib/actions.ts` (et la commande Rust `get_thread_messages`, remplacée par `get_thread`), `components/sidebar/nav-secondary.tsx`, `components/sidebar/search-form.tsx`, `components/theme-toggle.tsx` (remplacé par le formulaire de préférences). Deux boutons de copie presque identiques : `clipboard-button.tsx` (`Clipboardbutton`) et `content-clipboard-button.tsx` (`ClipboardButton`).
**Correction :** supprimer les fichiers inutilisés et la commande `get_thread_messages` ; fusionner les deux boutons de copie en un seul composant.
**Vérif. :** `pnpm typecheck`, `cargo check`, `grep` des noms supprimés vide.
**Statut :**

### C2 — Finitions d'interface (Mineur)

**Constat :**
- textes en français au milieu d'une UI anglaise : `tool-call-item.tsx:40` (« en cours… », « terminé ») et `:58` (« Résultat ») ;
- coquilles et faux contenus : « Personnal » (`site-header.tsx:51`), « Path : to be done » (`local-info.tsx:48`), bouton « Contact support » sans action (`not-found.tsx:22`), « prefered » (formulaires), placeholder « shadcn » sur le champ username ;
- `thread-input.tsx:64-80` : le menu « + » propose quatre actions (fichiers, image, recherche approfondie, recherche web) qui ne font rien ;
- `error-base.tsx` code ses couleurs en dur (`bg-red-50`, `text-gray-900`), illisible en thème sombre ;
- page d'accueil (`home.tsx`) réduite au mot « Meant ».
**Correction :** passer les textes en anglais, corriger les coquilles, retirer le bouton « Contact support », masquer le menu « + » tant que rien n'est branché (les idées vont au backlog), utiliser les tokens de thème dans `error-base.tsx`. La page d'accueil relève de la roadmap.
**Vérif. :** `pnpm typecheck` ; passage visuel dans l'app en thème clair et sombre.
**Statut :**

### C3 — Petites incohérences de code React (Mineur)

**Constat :** `ThemeProvider` reçoit `storageKey` (`provider.tsx:9`) qu'il étale sur le `Context.Provider` (`theme-provider.tsx:87`), reliquat de la version `localStorage` ; `console.debug` à chaque événement de stream (`thread-context.tsx:199`) et au chargement d'un fil (`thread.tsx:15`) ; `sendMessage` dépend de `messages` et est recréé à chaque flush du buffer (30 ms pendant un stream).
**Correction :** retirer `storageKey` et les `console.debug` ; lire l'instantané via une ref pour stabiliser `sendMessage`.
**Vérif. :** `pnpm typecheck`, `pnpm check`.
**Statut :**

### C4 — Documentation de référence décalée (Mineur)

**Constat :**
- `reference/ARCHITECTURE.md` renvoie vers `AGENT.md`, qui n'existe pas (le fichier est `reference/agents.md`), et le nom se confond avec le nouveau `AGENTS.md` racine ;
- `reference/config.md` décrit des événements `config-loaded` / `config-missing` / `config-error` et un `useConfigBootstrap` remplacés par les commandes `check_vault` / `load_config` et `useBootstrap` ; la section 4 (vault) annonce une documentation à venir ;
- `Cargo.toml` : `description = "A Tauri App"`, `authors = ["you"]`.
**Correction :** renommer `reference/agents.md` en `reference/agent-runtime.md` et corriger les liens ; mettre `config.md` à jour (amorçage, vault, `ProviderId`, invariant « au moins un provider ») ; renseigner `Cargo.toml`.
**Vérif. :** plus aucun lien mort dans `reference/` (`grep -n "AGENT.md" reference`).
**Statut :**
