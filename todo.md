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

Aucun. Le dernier plan (socle : corrections de la revue, outillage, CI) est terminé et vérifié dans l’application le 7 octobre 2026 ; son détail est dans l’historique git (`fix/review-fixes`). Prochain plan : axe 3 de `roadmap.md` (conversations robustes), à découper ici avant de commencer.
