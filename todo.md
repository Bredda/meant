# Todo

Plan de travail de la fonctionnalité en cours. La stratégie et les horizons sont dans [roadmap.md](roadmap.md) ; les idées non planifiées dans [backlog.md](backlog.md) ; la revue du code existant et ses corrections dans [fixes.md](fixes.md). Ce fichier est le découpage exécutable.

## Mode d'emploi

- Travailler le **Plan en cours** de haut en bas, un commit par phase. Ne pas piocher dans le backlog sauf demande.
- Une tâche n'est faite que lorsque sa ligne **Vérif.** passe. Cocher la case dans le même changement.
- Les tâches marquées `(décision à prendre)` dépendent d'une entrée de **Décisions**. La confirmer avec l'utilisateur avant d'implémenter ; sans réponse, ne pas implémenter et le dire.
- Ne pas cocher une tâche qu'on n'a pas pu vérifier : dire ce qui manque (en particulier ce qui n'a pas été exercé dans l'application).
- Si le plan s'avère faux, le corriger d'abord, puis continuer. Quand le plan est terminé, le remplacer par « Aucun », mettre à jour le statut dans `roadmap.md` et la documentation concernée.
- Toujours finir par `pnpm typecheck`, `pnpm check`, `pnpm test`, `cargo clippy --all-targets` et `cargo test`, et dire ce qui échoue.

Un plan contient : un but, un « où on en est », des **Décisions** (chacune avec une recommandation, confirmée avant les tâches qui en dépendent), des tâches regroupées en phases (un commit par phase), chacune avec les fichiers touchés et une ligne **Vérif.**, et un bloc « Terminé quand ».

---

## Plan en cours

**But :** repartir d'une base saine : le travail en cours fusionné, les vérifications au vert, les bugs connus corrigés et les contrats structurants (base, erreurs, IPC) fixés avant d'ajouter des fonctionnalités. Axe 1 de la roadmap.

**Où on en est :** les 31 entrées de `fixes.md` sont appliquées sur la branche `fix/review-fixes` (un commit par entrée, R6 en deux). En local, `pnpm typecheck`, `pnpm check`, `pnpm test` (21 tests), `pnpm build`, `cargo fmt --check`, `cargo clippy -- -D warnings` et `cargo test` (37 tests) passent. **Rien n'a été exercé dans l'application** (pas de clé de test pendant la session) : voir la dernière section.

**Hors de ce plan :** les fonctionnalités de l'axe 3 (titres, annulation, gestion des fils), qui seront le plan suivant. R1 (migrations) et R4 (table `runs`) en préparent le terrain.

### Décisions (confirmées avec l'utilisateur)

1. **Échec d'un run (B7)** : le message utilisateur est gardé ; après une erreur, l'UI recharge le fil depuis la base et garde l'avertissement à la suite ; l'échec est tracé dans la table `runs` (R4).
2. **Migrations SQLite (R1)** : `PRAGMA user_version` et scripts SQL embarqués, sans dépendance.
3. **Casse IPC (R3)** : tout en camelCase ; la génération des types depuis Rust reste au backlog.
4. **F0.1** : corriger `spinner.tsx` et noter la retouche dans la skill (`components/ui` reste exclu de Biome).

### Phase 0 : fusion et validation

- [x] Commiter et fusionner `feat/Vault-Access-#5` dans `main` (fait par l'utilisateur).
- [x] Relire `fixes.md` et remplir chaque ligne *Statut*.
- [ ] Retirer `examples/` ou l'ajouter au `.gitignore` (à décider par l'utilisateur, non traité).

### Phase 1 : outillage

- [x] F0.1 à F0.7. **Vérif. :** `pnpm typecheck`, `pnpm build`, `pnpm check`, `cargo fmt --check`, `cargo clippy -- -D warnings` passent ; le pre-push refuse une erreur de types. **Non exercé dans l'app :** toasts en thème sombre, animations des menus (F0.7).

### Phase 2 : bugs

- [x] B1 à B9. **Vérif. :** tests Rust (`RunService` émet une seule erreur, extraction et rejeu des résultats d'outils, `AppConfig::default`) et Vitest (réducteur de run, fil masqué, rechargement après échec, `groupMessages` à l'index 0). **Non exercé dans l'app :** envoi d'un message, erreur de clé, changement de fil pendant un run, outil `echo`, surbrillance et rafraîchissement de la barre latérale.

### Phase 3 : sécurité et local-first

- [x] S1 à S4. **Vérif. :** plus d'URL distante dans `src`, `cargo check` valide la CSP, plugin shell et `dotenvy` retirés. **Non exercé :** démarrage en dev et en build sans violation CSP.

### Phase 4 : refactors structurants

- [x] R1 à R7. **Vérif. :** tests de migration (base vide, base existante, double passage), du repository en mémoire (positions, transaction tout ou rien, statut des runs), de `AppError` et du camelCase ; Vitest pour `errors.ts` et les schémas. **Non vérifié :** la CI (R7) ne tournera qu'après un push ; le toast « Open Settings » (R2) n'a pas été vu.

### Phase 5 : nettoyage

- [x] C1 à C4. **Vérif. :** `pnpm typecheck`, `pnpm check`, plus de référence aux fichiers supprimés ni de lien mort dans `reference/`. **Non fait :** passage visuel en thème clair et sombre.

### Terminé quand

Sur `main` : toutes les vérifications passent en local et en CI ; un utilisateur installe l'application, la configure, converse avec un appel d'outil, provoque une erreur de clé et voit un seul message clair, change de fil pendant un run sans mélange, et retrouve après redémarrage exactement ce qui est en base. `fixes.md` ne contient plus d'entrée en attente, et l'axe 1 de `roadmap.md` passe à « Fait ».

### Reste à vérifier à la main avant de clore ce plan

Dans `pnpm tauri dev`, avec une vraie clé :

1. **Démarrage** : aucune violation CSP dans la console des devtools ; la base existante est migrée (ses fils s'affichent toujours) ; aucune requête réseau à l'ouverture d'un fil.
2. **Conversation** : un premier message dans un nouveau fil reçoit une réponse (B1) ; demander d'utiliser `echo` : le résultat s'affiche en texte brut, en direct puis après rechargement (B6, R3).
3. **Erreurs** : remplacer la clé par une clé au bon format mais invalide : un seul avertissement dans le fil et un toast « Open Settings » qui mène aux réglages (B2, R2) ; l'historique affiché correspond à la base après rechargement (B7).
4. **Navigation** : lancer un run, ouvrir un autre fil, revenir : aucun mélange (B3) ; le fil actif est surligné et remonte en tête après un message (B9) ; changer le thème ne recharge pas la liste (B8).
5. **Interface** : toasts et menus en thème sombre (F0.7) ; avatars locaux (S1) ; page d'erreur lisible en thème sombre, textes en anglais (C2).
6. **Build** : `pnpm tauri build` démarre sans violation CSP (S2).
7. **CI** : pousser la branche et vérifier que le workflow passe (R7).

Quand c'est fait : remplacer ce plan par « Aucun », passer l'axe 1 de `roadmap.md` à « Fait » et réduire `fixes.md` à « Aucune correction en attente ».
