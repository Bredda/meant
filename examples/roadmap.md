# YouLearn — Feuille de route

## Vision

Une plateforme d'apprentissage où les **cours** (puis les **programmes**) sont rendus visibles aux bons utilisateurs grâce aux **groupes** que l'administrateur leur attribue. Les formateurs rédigent et font relire leurs cours, les apprenants les suivent, et un cours peut déboucher sur une **certification**. Personne ne s'inscrit seul : les comptes sont créés par les administrateurs.

Parcours cible :

```text
un formateur rédige un cours → il est relu et publié → un apprenant du bon groupe le suit → il réussit l'examen final → il obtient un certificat vérifiable
```

Le socle côté formateur est là ; ce qui manque pour boucler ce parcours, c'est tout le côté apprenant.

## Principes

- La visibilité passe par les groupes ; le groupe « Commun » est implicite et ne donne jamais de droit d'écriture.
- Le serveur fait foi : l'interface ne remplace jamais une vérification de droits, et les bonnes réponses d'un quiz n'atteignent jamais un apprenant (tirage et correction côté serveur).
- Une révision publiée ne change plus jamais ; corriger, c'est cloner en brouillon, relire, puis republier.
- Le contenu et ses règles vivent dans des paquets purs et testés (`@youlearn/content`) ; l'infrastructure (HTTP, base, stockage) reste en périphérie.
- Tout ce qui compte est journalisé (événements) et l'application ne supprime jamais un fichier pour de bon : elle le déplace vers le bucket « déprécié ».
- On n'ajoute de la complexité que lorsqu'un besoin réel la justifie.

## Vue d'ensemble

| # | Axe | Horizon | Statut |
| --- | --- | --- | --- |
| 1 | Socle du projet | Fait | Suivi du travail, images Docker et stack complète, CI et releases (premières exécutions à constater sur GitHub) |
| 2 | Rédaction des cours | Fait | Révisions, éditeur, relecture, durées estimées et examen final disponibles côté formateur |
| 3 | Parcours apprenant | Fait | Fiche du cours, inscription figée sur une révision, lecteur, verrouillage, quiz (tirage et correction côté serveur), examen final en une tentative, « Mes sessions » et suivi formateur |
| 4 | Certification | Plus tard | Dépend de l'axe 3 ; conception arrêtée, rien d'écrit |
| 5 | Programmes | Plus tard | Pas commencé |
| 6 | Médias et fichiers lourds | Plus tard | Images seulement ; vidéos YouTube et Vimeo en lien |
| 7 | Relecture et cycle de vie des révisions | En cours | Relecture : écrite, à valider à la main (`todo.md`). Cycle de vie des inscriptions face à une nouvelle révision : à cadrer après |

## 1. Socle du projet

**But :** pouvoir travailler à plusieurs, livrer et déployer sans effort.

Fait : un suivi du travail à trois niveaux (`roadmap.md` pour les grosses fonctionnalités, `todo.md` pour celle en cours, `backlog.md` pour les idées non planifiées), la conteneurisation (une image web, une image API, un compose complet avec un service de migration, `pnpm stack:up`), puis une CI qui vérifie les images et les titres de pull request, et un workflow release-please qui publie les releases et les images sur GHCR. Reste à constater sur GitHub : la première pull request de release et la première publication.

**Terminé quand :** un merge sur `main` ouvre une pull request de release, et la fusionner publie une version taguée et ses images, démarrables avec un seul `docker compose up`. Le dépôt remplit ces conditions ; la preuve sur GitHub reste à faire.

## 2. Rédaction des cours

**But :** un formateur écrit un cours, le fait relire et le publie en toute sécurité.

Disponible : cours et groupes, révisions (brouillon, relecture, publié, déprécié), éditeur de chapitres (texte Markdown, vidéos, quiz n parmi m), images, lien de relecture, comparaison de révisions. Ajouté sur la branche `feat/graduation` : durée estimée par chapitre (obligatoire pour passer en relecture, totalisée par révision) et cours certifiant avec un examen final obligatoire, toujours en dernier chapitre.

**Terminé quand :** la branche est fusionnée et la documentation formateur décrit les durées et la certification.

## 3. Parcours apprenant

**But :** qu'un apprenant puisse réellement suivre un cours publié.

Disponible : fiche du cours depuis la carte du catalogue, inscription explicite qui fige la révision publiée, lecteur chapitre par chapitre, chapitre suivant verrouillé par un quiz bloquant, quiz (tirage de n questions sur m et correction côté serveur, tentatives illimitées avec corrigé), examen final en une seule tentative sans corrigé (l'échec marque l'inscription `failed`, tracée pour formateurs et administrateurs, et l'apprenant recommence depuis le début), page « Mes sessions » et liste des apprenants d'un cours. C'est le prérequis de la certification.

**Terminé quand :** un apprenant ouvre un cours depuis le catalogue, le lit jusqu'au bout, réussit ses quiz et retrouve sa progression à son retour. Les parcours côté API et pages sont vérifiés ; le jeu interactif du quiz dans le navigateur n'a pas été exercé à la main.

## 4. Certification

**But :** délivrer une preuve de réussite fiable et vérifiable.

Une table `certificate` conserve un instantané (apprenant, intitulé du cours, clé de révision, score, date, numéro unique) ; le PDF est généré à la demande avec pdf-lib à partir de cet instantané, avec un gabarit générique (logo et couleurs configurables) ; une page publique `/verify/<numéro>` confirme la validité, via le QR code du PDF, et permet une révocation. Open Badges et le stockage figé du PDF restent au backlog.

**Terminé quand :** un apprenant qui réussit l'examen final d'un cours certifiant télécharge son certificat, et n'importe qui peut en vérifier l'authenticité.

## 5. Programmes

**But :** regrouper des cours en parcours, avec la même visibilité par groupes.

Pas encore conçu : à cadrer une fois l'axe 3 en place (ordre des cours, prérequis, progression d'ensemble, lien avec la certification).

**Terminé quand :** un administrateur ou un formateur compose un programme et un apprenant le suit de bout en bout.

## 6. Médias et fichiers lourds

**But :** aller au-delà des images et des liens vidéo.

Vidéos hébergées par l'application, envoi de gros fichiers par URL présignée, et pièces jointes aux cours, en gardant la règle « on ne supprime jamais, on déprécie ».

**Terminé quand :** un formateur peut ajouter une vidéo ou un document volumineux sans passer par un service externe.

## 7. Relecture et cycle de vie des révisions

**But :** que relire et publier une révision soit fluide pour le formateur, et que les apprenants déjà inscrits sur une révision précédente soient traités correctement.

Relecture (écrite, à valider à la main) : une seule révision ouverte par cours, des relecteurs choisis parmi les utilisateurs sans nouveau rôle, un menu « Relectures » à la place du lien secret, des remarques ancrées sur les chapitres, blocs et questions, un avis par relecteur (périmé si le contenu change) et un contenu qui reste modifiable pendant la relecture ; publier avec une relecture inachevée demande une confirmation.

Cycle de vie des inscriptions (à cadrer après) : que devient un apprenant qui a commencé ou terminé une révision quand une plus récente est publiée (migration de l'inscription en gardant les chapitres inchangés, refaire ce qui a changé, impact d'un changement déduit du diff ou déclaré à la publication).

**Terminé quand :** la relecture se fait sans repasser par le brouillon, et une publication ne laisse plus un apprenant sur une révision obsolète sans option claire.

## Hors périmètre pour l'instant

Inscription libre des utilisateurs (les comptes restent créés par les administrateurs), paiement ou vente de cours, et déploiement multi-instance ou haute disponibilité. À reconsidérer si un besoin réel apparaît.
