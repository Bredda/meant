# Todo

Plan de travail de la fonctionnalité en cours. La stratégie et les horizons sont dans [roadmap.md](roadmap.md) ; les idées non planifiées sont dans [backlog.md](backlog.md) ; ce fichier est le découpage exécutable.

## Mode d'emploi

- Travailler le **Plan en cours** de haut en bas, un commit par phase. Ne pas piocher dans le backlog sauf demande.
- Une tâche n'est faite que lorsque sa ligne **Vérif.** passe. Cocher la case dans le même changement.
- Les tâches marquées `(décision à prendre)` dépendent d'une entrée de **Décisions**. La confirmer avec l'utilisateur avant d'implémenter ; sans réponse, appliquer la recommandation et le dire.
- Ne pas cocher une tâche qu'on n'a pas pu vérifier : dire ce qui manque.
- Si le plan s'avère faux, le corriger d'abord, puis continuer. Quand le plan est terminé, le remplacer par « Aucun », mettre à jour le statut dans `roadmap.md` et la documentation concernée.
- Toujours finir par `pnpm lint:ci`, `pnpm check-types` et `pnpm test`.

Un plan contient : un but, un « où on en est », des **Décisions** (chacune avec une recommandation, confirmée avant les tâches qui en dépendent), des tâches regroupées en phases (un commit par phase), chacune avec les fichiers touchés et une ligne **Vérif.**, et un bloc « Terminé quand ».

---

## Plan en cours

**But :** refondre la relecture d'une révision : une seule révision ouverte par cours, des relecteurs choisis parmi les utilisateurs (sans nouveau rôle), plus de lien secret, et des remarques ancrées sur le contenu, sans repasser sans cesse de « relecture » à « brouillon ».

**Où on en est :** rien n'est écrit. Aujourd'hui un cours peut avoir un brouillon et une révision en relecture en même temps ; la relecture passe par un lien secret (`previewToken`, `/review/[token]`) en lecture seule ; corriger impose de repasser en brouillon.

**Hors de ce plan :** le cycle de vie des inscriptions face à une nouvelle révision (migrer une inscription, refaire un chapitre). À cadrer après celui-ci ; seule dépendance connue : à la publication, il faudra peut-être capturer l'« impact » du changement (déduit de `diffContent` ou déclaré), sans qu'on s'en occupe maintenant.

### Décisions (confirmées avec l'utilisateur)

1. **Pas de rôle `reviewer`** : un relecteur est une affectation `revision_reviewer` (révision, utilisateur avec clé étrangère : le nom se lit à l'affichage, l'avis s'ajoutera en phase 4). Tout utilisateur actif peut être choisi (recherche par nom ou email), même hors des groupes du cours ; l'affectation donne l'accès à cette seule révision. Ceux qui ont au moins une affectation en cours voient le menu « Relectures ».
2. **Une seule révision ouverte par cours** : l'index unique porte sur `draft` et `preview` ensemble (plus un brouillon et une relecture simultanés). Créer ou cloner pendant qu'une révision est ouverte donne un 409 explicite. **Migration** (choix fait faute de réponse, à confirmer) : elle ne supprime rien ; si un cours a déjà un brouillon et une relecture, elle s'arrête avec un message qui nomme les cours, et il faut en supprimer ou publier un avant de relancer.
3. **Contenu vivant** : la révision reste modifiable pendant la relecture, le statut ne bouge plus entre `preview` et `draft` (`preview` -> `draft` sert à « retirer de la relecture »). Un avis mémorise la `updatedAt` de la révision ; si le contenu change après, l'avis est **périmé**. Pas de « tours » figés pour l'instant. Dès la phase 1, l'éditeur et `saveContent` acceptent aussi une révision en relecture.
4. **Remarques ancrées sur les ids stables** : une remarque cible la révision, un chapitre, un bloc ou une question, avec un extrait cité optionnel. Pas d'ancrage à la ligne ou au caractère. Chaque cible a un fil (réponses, statut ouvert ou traité). Les remarques vivent dans leur propre table, hors du `content` jsonb : le verrouillage optimiste de l'éditeur n'est pas touché. Un élément supprimé fait passer ses remarques dans une liste « éléments supprimés ».
5. **Publier est conseillé, pas bloqué** : s'il reste des remarques ouvertes ou des avis manquants ou périmés, la publication demande une confirmation (`409 CONFIRM_REQUIRED`, comme la dépréciation).
6. **Plus de lien de relecture** : suppression de `previewToken`, des routes `preview-link` et de `/review/[token]`. Les anciens types d'événements (`revision.new-link`, `revision.revoke-link`) gardent leur libellé dans `apps/web/lib/events.ts` pour les lignes déjà enregistrées.

### Phase 1 : une révision ouverte et des relecteurs

Ordre retenu : les relecteurs ne sont **obligatoires qu'en phase 2**, quand le lien secret disparaît (en phase 1 l'interface web n'a pas encore de sélecteur, et le lien reste le seul accès).

- [x] Index unique « une révision `draft` ou `preview` par cours » (et un index « une `published` »), table `revision_reviewer` (migration `0011`, avec une garde qui refuse les cours ayant déjà un brouillon et une relecture). Fichiers : `packages/db/src/schema/courses.ts`, `packages/types/src/index.ts`. **Vérif. :** migration appliquée sur la base de dev (sans conflit). La garde n'a pas été exercée avec un cours ayant les deux révisions.
- [x] Règles pures dans `apps/api/src/lib/revision-rules.ts` (une seule révision ouverte, édition d'une révision en relecture, liste de relecteurs) avec tests. **Vérif. :** `pnpm --filter api test` passe.
- [x] Création et clonage refusés (409 `OPEN_REVISION`) tant qu'une révision est ouverte ; `saveContent` accepte une révision en relecture ; passage en relecture avec `reviewerIds` ; `POST` et `DELETE .../reviewers` ; `GET /api/writer/reviewer-candidates`. Fichiers : `lib/revisions.ts`, `routes/writer/revisions.ts`. **Vérif. :** 20 contrôles `curl` avec cookie de session sur un cours `zz-` jetable (409 `OPEN_REVISION`, relecteur inconnu, doublons, ajout et retrait, édition en relecture, candidats), tous passés.
- [x] Événements `revision.reviewer-add`, `revision.reviewer-remove` (types, libellés web et détail).
- [x] Web : l'éditeur accepte une révision en relecture, « Nouvelle révision » et « Cloner » sont bloqués tant qu'une révision est ouverte, « Repasser en brouillon » ne l'est plus. **Vérif. :** types et Biome ; non exercé dans le navigateur.

### Phase 2 : accès relecteur et fin du lien secret

- [x] `GET /api/me/reviews` (mes relectures) et `GET /api/reviews/:revisionId` (contenu, base, avis du relecteur, remarques). `canReadAsset` s'appuie sur l'affectation, plus sur `?review=<token>`. Fichiers : `routes/review.ts`, `lib/assets.ts`, `routes/assets.ts`. **Vérif. :** `curl` avec un second utilisateur jetable (hors groupes) : il liste, lit la révision et ses images, un non-relecteur (même admin) reçoit 404, l'accès cesse au retour en brouillon ou au retrait ; tous passés.
- [x] Web : menu « Relectures » avec compteur, pages `/reviews` et `/reviews/[revisionId]` (reprend `review-viewer.tsx`), dialogue de choix des relecteurs à la place de `review-link-dialog.tsx`. **Vérif. :** types, Biome et pages chargées avec `curl` (relecteur et non-relecteur, entrée de menu, anciennes pages 404). **Non exercé dans un navigateur** : le dialogue des relecteurs (recherche, ajout, retrait) et le clic sur les boutons.
- [x] Relecteurs **obligatoires** pour passer en relecture (au moins un, validé côté API, l'auteur peut se choisir ; on ne peut pas retirer le dernier). **Vérif. :** règle pure testée, `curl` (409 `NO_REVIEWER`).
- [x] Suppression de `previewToken`, des routes `preview-link`, de `/review/[token]` et de `?review=` dans `lib/asset-url.ts` (migration). **Vérif. :** plus aucune référence (`grep`), `pnpm check-types`, migration `0012` appliquée. Une révision déjà en relecture avant cette migration n'a pas de relecteur : il faut en ajouter depuis « Relecteurs ».

### Phase 3 : remarques et fils

- [x] Table `review_comment` (révision, cible : type + `chapterId` + `itemId`, extrait cité, auteur et instantané du nom, parent du fil, statut, traitée par, dates). Routes pour créer, répondre, marquer traité ou rouvert (relecteurs affectés et éditeurs du cours). **Vérif. :** 32 contrôles `curl` avec un relecteur et un utilisateur étranger jetables (création sur révision, chapitre, bloc, question, cible inconnue ou incomplète refusée, réponses, traitée et rouverte, élément supprimé donc fil orphelin, lecture seule en brouillon, 404 hors affectation) ; fonction pure `reviewTargetExists` testée.
- [x] Web, relecteur : bouton « Commenter » sur chaque titre de chapitre, bloc et question (extrait cité si du texte est sélectionné), fils dépliables. Composants dans `components/review/*` et `components/content/*`.
- [x] Web, formateur : pastille de remarques ouvertes sur les mêmes éléments dans l'éditeur et panneau « Remarques » groupé par chapitre avec défilement vers l'élément et liste « éléments supprimés ». **Vérif. :** types, Biome, tests (`lib/review-targets`) et rendu des pages en `curl` (fils, citation, boutons, panneau et pastilles). **Non exercé dans un navigateur** : l'envoi d'une remarque, la réponse, « Marquer traitée », la sélection de texte citée et le survol qui révèle « Commenter ». Pas de pastille sur chaque bloc dans l'éditeur : le panneau groupé par chapitre et la pastille de chapitre portent le suivi.

### Phase 4 : avis et publication

- [x] Avis par relecteur (« validé » ou « modifications demandées », `PUT /api/reviews/:revisionId/verdict`, événement `revision.verdict`), avis **périmé** quand la révision a changé depuis (`verdict_revision_updated_at`, migration `0014`). Affichage de l'état de la relecture sur la page de la révision (`ReviewState`) et dans le dialogue des relecteurs. **Vérif. :** règles pures testées (`reviewerState`, `summarizeReview`) et `curl` (avis sur un brouillon refusé, non-relecteur 404, avis invalide 400, état périmé après une modification).
- [x] Publication : `409 CONFIRM_REQUIRED` avec `warnings` tant qu'il reste des remarques ouvertes ou des avis manquants, périmés ou « modifications demandées » ; la confirmation du web les liste avec celle de la dépréciation. **Vérif. :** `curl` des quatre cas, puis publication sans confirmation une fois tout traité ; règle pure `reviewWarnings` testée côté API et côté web.
- [x] Documentation : skill `youlearn-courses`, `roadmap.md`, entrée « Refonte de la relecture » du backlog supprimée.

### Terminé quand

Un formateur envoie la seule révision ouverte d'un cours en relecture en choisissant des utilisateurs ; ceux-ci la retrouvent dans « Relectures », commentent des blocs, des questions ou des chapitres ; le formateur corrige pendant la relecture, traite les fils et publie (avec confirmation s'il reste des points ouverts) sans jamais repasser par le brouillon ; il n'existe plus aucun lien de relecture. Toujours finir par `pnpm lint:ci`, `pnpm check-types` et `pnpm test`.

### Reste à vérifier à la main avant de clore ce plan

Tout ce qui précède est vérifié contre la vraie base (`curl` avec des utilisateurs jetables préfixés `zz-`) et par le rendu des pages, mais **rien n'a été exercé dans un navigateur** : le dialogue des relecteurs (recherche, ajout, retrait, envoi en relecture), l'envoi d'une remarque, la réponse, « Marquer traitée », la citation du texte sélectionné et le bouton « Commenter » au survol, les boutons d'avis, la confirmation de publication avec ses avertissements, et le défilement d'une page de relecture sur écran étroit. La garde de la migration `0011` (cours ayant déjà un brouillon et une relecture) n'a pas été exercée sur un cas réel. Quand c'est fait : remplacer ce plan par « Aucun » et passer le statut de l'axe 7 dans `roadmap.md`.
