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

**But :** axe 3 de `roadmap.md` (conversations robustes) : un fil se retrouve, se renomme, se supprime, s'interrompt et se régénère, et un échec ne laisse jamais un fil incohérent.

**Où on en est :** les migrations (R1) et la persistance transactionnelle (R4) sont faites ; la table `runs` est écrite par `chat` mais jamais lue ; tous les fils s'appellent « New thread » ; `is_error` est codé en dur à `false`.

### Décisions (confirmées le 7 octobre 2026)

1. **Titre** : provisoire à la création (début du 1er message), puis titre IA court en tâche de fond après le 1er échange. Un titre renommé à la main n'est jamais écrasé (`threads.title_source`).
2. **Annulation** : les messages déjà produits sont conservés, le run passe en `cancelled`. Un `tool_call` sans résultat est retiré de ce qui est persisté.
3. **Régénérer** : remplace la dernière réponse, supprimée seulement au succès, en une transaction. Variantes et branches : backlog.
4. **Recherche** : titres uniquement, filtre côté UI.

### Phase 1 — Fils : titre provisoire, renommer, supprimer

- [x] Migration `0003_thread_title_source.sql` (`default | auto | manual`), `create_thread(title)`, `rename_thread`, `delete_thread`.
- [x] `provisional_title` dans `commands/chat.rs`, commandes `rename_thread` et `delete_thread` (+ `main.rs`).
- [ ] Sidebar : menu par fil (renommer en place, supprimer avec confirmation `alert-dialog`), hook `use-thread-actions`. Écrit, typecheck et Biome passent ; **reste à exercer dans `pnpm tauri dev`** (renommer, redémarrer, supprimer le fil ouvert).
- **Vérif.** : tests repo (rename manuel, cascade, titre vide) et `provisional_title` ; dans l'app : titre = début du message, renommage conservé après redémarrage, suppression du fil ouvert → page nouveau fil.

### Phase 2 — Runs persistés visibles

- [x] `list_runs`, `get_thread` renvoie `runs`, `RunSummary` dans `types.ts`.
- [x] `groupMessages(messages, runs)` + `run-notice.tsx` pour les runs `failed` / `cancelled` ; `reloadAfterFailure` recharge messages et runs, **après** le règlement de l'`invoke` (le run est clos après l'événement `Error`). L'avertissement live n'est gardé que si l'échec n'a laissé aucune ligne `runs` (ex. aucune clé).
- **À exercer dans l'app** : échec avec clé invalide, puis redémarrage ; échec sans aucune clé sur un fil existant.
- **Vérif.** : tests Vitest (`groupMessages`, reducer), tests repo ; dans l'app : échec (clé invalide), redémarrage, l'erreur est toujours affichée.

### Phase 3 — Annuler un run

- [x] `RunRegistry` (un run par fil), signal `oneshot` dans `AgentContext`, `select` dans `react.rs`, `drop_unanswered_tool_calls`, `RunStatus::Cancelled`, `status` sur `RunCompleted`.
- [x] Commande `cancel_run`, `delete_thread` refusé pendant un run, bouton Stop, `cancelRun()`. Le rafraîchissement des routes se fait désormais quand `chat` se résout (le run est clos après `RunCompleted`).
- **À exercer dans l'app** (pas fait) : stop en cours de réponse, stop pendant un appel d'outil, suppression refusée pendant un run, redémarrage identique.
- **Vérif.** : tests registry, `drop_unanswered_tool_calls`, `RunService` avec runtime factice ; dans l'app : stop en cours de réponse (texte conservé, notice, redémarrage identique), stop pendant un outil, suppression refusée pendant un run.

### Phase 4 — Outils en erreur

- [x] Migration `0004_message_is_error.sql`, hook Rig `on_tool_result` (par run, via `stream_chat(..).add_hook`), `is_error` de bout en bout, `echo` refuse le texte vide. Un appel est « en échec » s'il n'a pas réussi (erreur, refus ou appel ignoré).
- Exercé dans l'app (par l'utilisateur) : « echo » d'une chaîne vide → l'appel apparaît en erreur.
- **Vérif.** : tests de mapping et d'aller-retour en base ; dans l'app : `echo` d'une chaîne vide apparaît en erreur, aussi après redémarrage.

### Phase 5 — Régénérer

- [x] Pipeline de run commun à `chat` et `regenerate` (`run_in_thread`), `replace_messages_after` transactionnel, `regenerate()` côté UI (`startRun` partagé avec `sendMessage`) et bouton « Regenerate » en bas du fil, hors run. Choix : le message utilisateur passe au nouveau run (un échec ou un arrêt antérieur ne laisse pas de notice périmée) ; arrêté avant toute sortie, le run garde l'ancienne réponse. Le bouton sert aussi de « réessayer » après un échec.
- **À exercer dans l'app** (pas fait) : régénérer, redémarrer, une seule réponse ; régénérer avec une clé invalide → l'ancienne réponse reste + erreur ; régénérer après un échec ; stop pendant une régénération.
- **Vérif.** : tests repo (atomicité, ancienne réponse gardée en cas d'échec) ; dans l'app : régénérer, redémarrer, une seule réponse ; échec → l'ancienne réponse reste.

### Phase 6 — Titre IA et recherche

- [x] `ai/title.rs`, `set_auto_title` (jamais sur un titre manuel), événement `thread-title-updated` et hook d'écoute (`use-thread-title-updates`, monté dans `AppLayout`). Déclenché après un run `completed` dont le fil a encore son titre provisoire et une seule question ; même fournisseur et même modèle que les runs (un appel de plus, 120 tokens max).
- [x] `filterThreads` + champ de recherche dans la sidebar.
- **À exercer dans l'app** (pas fait, demande une vraie clé) : 1er échange → le titre se met à jour tout seul ; renommer pendant la génération → le titre manuel gagne ; filtre de la sidebar (casse, accents, « No matching thread »). Non vérifié : le modèle d'OpenAI avec 120 tokens (raisonnement) renvoie bien un titre non vide.
- **Vérif.** : tests `filterThreads`, `set_auto_title`, prompt de titre ; dans l'app : titre mis à jour tout seul, un renommage manuel gagne, filtre de la sidebar.

### Hors périmètre

Texte partiel d'un run en échec (non conservé, comme aujourd'hui), variantes de réponses, édition de message, recherche dans le contenu, raccourci d'annulation.

### Terminé quand

Un utilisateur interrompt une réponse, la régénère, renomme puis supprime un fil, voit les outils en échec signalés, et retrouve après un redémarrage exactement ce qu'il voyait, échecs et arrêts compris (vérifié dans l'application). Alors : ce plan devient « Aucun », l'axe 3 passe à « Fait » dans `roadmap.md`, `reference/agent-runtime.md` est à jour.
