# Todo

Plan de travail de la fonctionnalité en cours. La stratégie et les horizons sont dans [roadmap.md](roadmap.md) ; les idées non planifiées dans [backlog.md](backlog.md) ; la revue du code existant et ses corrections dans [fixes.md](fixes.md). Ce fichier est le découpage exécutable.

## Mode d'emploi

- Travailler le **Plan en cours** de haut en bas, un commit par phase. Ne pas piocher dans le backlog sauf demande.
- Une tâche n'est faite que lorsque sa ligne **Vérif.** passe. Cocher la case dans le même changement.
- Les tâches marquées `(décision à prendre)` dépendent d'une entrée de **Décisions**. La confirmer avec l'utilisateur avant d'implémenter ; sans réponse, ne pas implémenter et le dire.
- Ne pas cocher une tâche qu'on n'a pas pu vérifier : dire ce qui manque (en particulier ce qui n'a pas été exercé dans l'application).
- Si le plan s'avère faux, le corriger d'abord, puis continuer. Quand le plan est terminé, le remplacer par « Aucun », mettre à jour le statut dans `roadmap.md` et la documentation concernée.
- Toujours finir par `pnpm typecheck`, `pnpm check`, `cargo clippy --all-targets` et `cargo test` (plus `pnpm test` une fois R6 fait), et dire ce qui échoue.

Un plan contient : un but, un « où on en est », des **Décisions** (chacune avec une recommandation, confirmée avant les tâches qui en dépendent), des tâches regroupées en phases (un commit par phase), chacune avec les fichiers touchés et une ligne **Vérif.**, et un bloc « Terminé quand ».

---

## Plan en cours

**But :** repartir d'une base saine : le travail en cours fusionné, les vérifications au vert, les bugs connus corrigés et les contrats structurants (base, erreurs, IPC) fixés avant d'ajouter des fonctionnalités. Axe 1 de la roadmap.

**Où on en est :** revue faite le 7 octobre 2026, consignée dans `fixes.md` (31 entrées, aucune appliquée). Le travail sur le vault, les fournisseurs et l'écran d'amorçage n'est pas encore commité sur `feat/Vault-Access-#5`. Aujourd'hui `pnpm typecheck` échoue (donc le build) et l'envoi d'un message échoue (B1).

**Hors de ce plan :** les fonctionnalités de l'axe 3 (titres, annulation, gestion des fils), qui seront le plan suivant. Seuls R1 et R4 en préparent le terrain.

### Décisions (à confirmer avec l'utilisateur)

1. **Échec d'un run (B7)** : recommandation : garder le message utilisateur, recharger le fil depuis la base après une erreur, puis tracer l'échec avec la table `runs` (R4).
2. **Migrations SQLite (R1)** : recommandation : `PRAGMA user_version` et scripts SQL embarqués, sans dépendance.
3. **Casse IPC (R3)** : recommandation : tout en camelCase maintenant ; la génération des types depuis Rust reste au backlog.
4. **Périmètre** : les entrées marquées **Rejeté** dans `fixes.md` passent au backlog et sont retirées de ce plan.

### Phase 0 : fusion et validation

- [ ] Commiter le travail en cours sur `feat/Vault-Access-#5` et fusionner dans `main` (fait par l'utilisateur). **Vérif. :** `git status` propre sur `main`.
- [ ] Relire `fixes.md` et remplir chaque ligne *Statut*. **Vérif. :** aucune ligne *Statut* vide.
- [ ] Retirer `examples/` (modèles de fichiers de suivi d'un autre projet, plus utiles une fois ces fichiers écrits) ou l'ajouter au `.gitignore`. **Vérif. :** `git status` ne le montre plus.

### Phase 1 : outillage (`fixes.md` phase 0)

- [ ] F0.1 `spinner.tsx`. Fichiers : `src/components/ui/spinner.tsx`, skill `meant-ui`. **Vérif. :** `pnpm typecheck` et `pnpm build` passent.
- [ ] F0.2 `.gitattributes` et renormalisation, dans un commit à part. **Vérif. :** `git ls-files --eol` sans `w/crlf`.
- [ ] F0.3 exclusions Biome. Fichier : `biome.jsonc`. **Vérif. :** `pnpm check` passe.
- [ ] F0.4 base rustfmt, dans un commit à part. Fichiers : `src-tauri/rustfmt.toml`, tout `src-tauri/src`. **Vérif. :** `cargo fmt --check` passe.
- [ ] F0.5 avertissements clippy et code mort Rust. **Vérif. :** `cargo clippy --all-targets -- -D warnings` passe.
- [ ] F0.6 hooks Git (pre-commit local, pre-push). Fichiers : `.husky/`, `package.json`. **Vérif. :** un push avec une erreur de types est refusé.
- [ ] F0.7 dépendances. Fichiers : `package.json`, `global.css`, `components/ui/sonner.tsx`. **Vérif. :** `pnpm typecheck` ; toast en thème sombre et animation de menu vérifiés dans l'app.

### Phase 2 : bugs (`fixes.md` phase 1)

- [ ] B1 `ChatRequest`. Fichier : `commands/chat.rs`. **Vérif. :** un message reçoit une réponse dans l'app.
- [ ] B2 erreur émise une seule fois. Fichiers : `ai/agent/react.rs`, `runs/service.rs`, `thread-context.tsx`. **Vérif. :** test Rust du `RunService` ; clé invalide → un seul avertissement dans l'app.
- [ ] B3 événements d'un autre fil ignorés, réducteur de run extrait. Fichiers : `features/threads/thread-context.tsx`, `features/threads/run-reducer.ts`. **Vérif. :** changer de fil pendant un run dans l'app ; tests du réducteur après R6.
- [ ] B4 `groupMessages`. **Vérif. :** test après R6.
- [ ] B5 `AppConfig::default`. **Vérif. :** `cargo test`.
- [ ] B6 contenu des résultats d'outils. **Vérif. :** test aller-retour ; `echo` affiche le texte brut dans l'app.
- [ ] B7 échec de run (décision 1). **Vérif. :** voir `fixes.md`.
- [ ] B8 routeur, B9 barre latérale. **Vérif. :** voir `fixes.md`.

### Phase 3 : sécurité et local-first (`fixes.md` phase 2)

- [ ] S1 avatars locaux, S2 CSP, S3 plugin shell, S4 reliquats d'environnement. **Vérif. :** aucune requête réseau à l'ouverture d'un fil ; l'app démarre en dev et en build sans violation CSP.

### Phase 4 : refactors structurants (`fixes.md` phase 3)

- [ ] R1 migrations SQLite (décision 2). Fichiers : `db/repository.rs`, `db/migrations/`. **Vérif. :** tests base vide et base existante.
- [ ] R2 erreurs typées. Fichiers : `db/error.rs`, une `AppError` partagée, toutes les commandes, `src/lib/types.ts`. **Vérif. :** `cargo clippy`, `pnpm typecheck` ; sans clé valide, le message mène aux réglages.
- [ ] R3 casse IPC (décision 3). Fichiers : `db/models.rs`, `ai/agent/types.rs`, `src/lib/types.ts`, `thread-context.tsx`. **Vérif. :** fil avec appel d'outil correct en direct et après rechargement.
- [ ] R4 transaction et table `runs`. Dépend de R1. **Vérif. :** tests du repository en mémoire.
- [ ] R5 thème en enum, validation du nom. **Vérif. :** `cargo test`, `pnpm typecheck`.
- [ ] R6 Vitest et tests Rust du cœur. **Vérif. :** `pnpm test`, `cargo test`.
- [ ] R7 CI GitHub Actions. **Vérif. :** CI verte sur la branche, rouge sur une erreur volontaire.

### Phase 5 : nettoyage (`fixes.md` phase 4)

- [ ] C1 code mort frontend, C2 finitions d'interface, C3 incohérences React, C4 documentation de référence. **Vérif. :** `pnpm typecheck`, `pnpm check`, passage visuel en thème clair et sombre, plus de lien mort dans `reference/`.

### Terminé quand

Sur `main` : toutes les vérifications passent en local et en CI ; un utilisateur installe l'application, la configure, converse avec un appel d'outil, provoque une erreur de clé et voit un seul message clair, change de fil pendant un run sans mélange, et retrouve après redémarrage exactement ce qui est en base. `fixes.md` ne contient plus d'entrée en attente, et l'axe 1 de `roadmap.md` passe à « Fait ».
