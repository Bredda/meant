# Meant — Feuille de route

## Vision

Un atelier d'IA **local d'abord** sur le bureau : on y construit, lance et utilise des **agents** qui combinent un modèle (distant ou local) et des **outils** (natifs ou MCP), sur ses propres fichiers et sa propre machine. Les données restent locales ; seuls les appels au fournisseur de modèle choisi quittent la machine.

Parcours cible :

```text
l'utilisateur configure un fournisseur → il ouvre un fil avec un agent → l'agent répond en streaming,
appelle des outils autorisés sur la machine → le fil, ses runs et leurs coûts restent consultables localement
```

Le socle technique est là (Tauri, cœur Rust, streaming, persistance SQLite, vault, réglages). Les conversations sont robustes ; il manque de quoi en faire un outil de travail complet : choisir son modèle, échanger des images, des documents et de l'audio, et surtout des outils utiles avec un modèle de permissions.

## Principes

- Rust décide, React affiche : exécution IA, persistance et capacités natives vivent dans le cœur Rust.
- Local d'abord : aucun appel réseau hors du fournisseur configuré, ni ressource distante, ni télémétrie.
- Les secrets vont de l'interface au vault, jamais dans l'autre sens ; aucune commande ne renvoie une clé.
- L'état persisté fait foi ; le direct du streaming n'est qu'un aperçu remplacé à la fin du run.
- Un outil qui agit sur la machine (fichiers, shell, réseau) ne s'exécute qu'avec une permission explicite.
- On n'ajoute de la complexité que lorsqu'un besoin réel la justifie.

## Vue d'ensemble

| # | Axe | Horizon | Statut |
| --- | --- | --- | --- |
| 1 | Socle du projet | Fait | Instructions agents, skills, hooks, revue appliquée, tests (Vitest, cargo), pre-push et CI, CI verte sur `main` |
| 2 | Configuration et secrets | Fait | Assistant de premier lancement, préférences dans `config.toml`, clés Anthropic et OpenAI dans le vault, réglages. Fusionné, B5, R5 et S4 appliqués |
| 3 | Conversations robustes | Fait | Renommer et supprimer un fil, titre généré, runs persistés et affichés, annulation, outils en erreur, régénération, recherche par titre, suivi du scroll |
| 4 | Fournisseurs et modèles | Ensuite | Deux fournisseurs, modèle codé en dur, premier fournisseur configuré utilisé, aucune notion de capacités |
| 5 | Multi-modalité | Ensuite | Texte seul : un message est une chaîne, pas de pièce jointe, pas d'autre sortie que du texte ; dépend du modèle du fil (axe 4) |
| 6 | Outils natifs et permissions | Plus tard | Un outil de démonstration (`echo`), pas de modèle de permissions |
| 7 | MCP | Plus tard | Pas commencé |
| 8 | Agents configurables | Plus tard | Un seul agent implicite (préambule codé en dur) |
| 9 | Modèles locaux | Plus tard | Pas commencé |
| 10 | Connaissances locales | Plus tard | Pas commencé |
| 11 | Distribution | En cours | Flux de release en place (release-please, installeurs Linux, Windows et macOS en CI), installeurs non signés, pas de mise à jour automatique |

## 1. Socle du projet

**But :** pouvoir développer vite sans casser : vérifications fiables, conventions écrites, dette connue et traitée.

Fait : `AGENTS.md` (et `CLAUDE.md`), skills `meant-core`, `meant-agent` et `meant-ui`, hook de formatage automatique, suivi du travail à quatre fichiers (`roadmap.md`, `todo.md`, `backlog.md`, `fixes.md`). Revue complète du code existant dans `fixes.md`.

Fait aussi : les 31 corrections de la revue (build, envoi de message, fins de ligne, bugs du streaming, CSP, migrations SQLite, table `runs`, erreurs typées, camelCase sur l’IPC, Vitest, CI), vérifiées dans l’application ; la CI passe sur la PR et sur `main`.

**Terminé quand :** `pnpm typecheck`, `pnpm check`, `pnpm test`, `cargo clippy -- -D warnings` et `cargo test` passent en local et en CI, et `fixes.md` ne contient plus d'entrée en attente.

## 2. Configuration et secrets

**But :** qu'un nouvel utilisateur configure l'application en une minute, sans jamais exposer une clé.

Disponible (fusionné dans `main`) : écran d'amorçage (vault, configuration), assistant de premier lancement (nom, thème, au moins une clé), réglages (préférences, ajout, remplacement et suppression de clés avec au moins un fournisseur conservé), clés dans le vault du système, préférences dans `config.toml`, validation du format des clés côté UI et côté Rust.

**Terminé quand :** la branche est fusionnée et les corrections B5, R5 et S4 de `fixes.md` sont faites. Les trois conditions sont remplies.

## 3. Conversations robustes

**But :** qu'un fil se comporte comme dans un client de chat sérieux : on retrouve, renomme, supprime et interrompt ses conversations, et un échec ne laisse jamais un fil incohérent.

Fait : runs persistés (table `runs`, statut, erreur) et affichés dans le fil, titre provisoire puis titre généré en arrière-plan (jamais sur un titre renommé à la main), renommer et supprimer un fil, annuler un run en cours (les messages produits sont conservés), régénérer la dernière réponse, recherche par titre dans la liste des fils, signalement des outils en erreur (`is_error`). Détail du fonctionnement dans `reference/agent-runtime.md`.

Limites connues : le texte partiel d'un run en échec n'est pas conservé (celui d'un run arrêté l'est), un outil en cours d'exécution au moment d'un arrêt est abandonné (à traiter avec les outils à effets de bord de l'axe 6).

**Terminé quand :** un utilisateur interrompt une réponse, renomme puis supprime un fil, et retrouve après un redémarrage exactement ce qu'il voyait, échecs compris.

## 4. Fournisseurs et modèles

**But :** choisir son modèle par fil, savoir ce que chaque modèle accepte et produit, et brancher d'autres fournisseurs sans toucher au reste de l'application.

À faire : liste des modèles par fournisseur, **avec leurs capacités** (types de contenu acceptés en entrée et produits en sortie : texte, image, document, audio…), modèle choisi au niveau du fil (avec un défaut dans les réglages), sélecteur dans la zone de saisie, suppression de `default_provider`. Les capacités sont une donnée du catalogue des modèles, pas un cas particulier : l'axe 5 s'en sert pour refuser une pièce jointe avant l'envoi, et pour cela l'interface doit connaître le modèle d'un fil avant l'envoi (aujourd'hui Rust choisit le fournisseur au moment du run). Ensuite, fournisseurs compatibles OpenAI (OpenRouter, Mistral, endpoints personnalisés). Coût et tokens par run affichés dans le fil.

**Terminé quand :** deux fils ouverts en même temps utilisent deux modèles de deux fournisseurs différents, chaque run affiche son modèle et son coût, et l'interface sait, pour chaque fil, ce que son modèle accepte.

## 5. Multi-modalité

**But :** échanger autre chose que du texte. L'utilisateur joint des images, des documents et de l'audio à un message ; l'agent peut produire des images (puis de l'audio) ; une pièce jointe reste sur la machine jusqu'à l'envoi du message. Dépend de l'axe 4 : ce qu'on peut joindre dépend du modèle du fil.

Aujourd'hui un message est une chaîne (`content`) et seul le texte arrive en flux. Rig porte déjà les parties image, audio, vidéo et document en entrée, et l'image en sortie (réponse de l'assistant et résultat d'outil) : le travail est dans notre modèle de données, notre stockage et notre interface, pas dans la bibliothèque.

À cadrer :

- **Modèle de données.** Un message devient une liste de *parties* (texte, image, audio, document, vidéo plus tard). Les lignes existantes deviennent une seule partie texte (migration SQLite) ; `StoredThreadMessage`, `ThreadMessage`, `src/lib/types.ts` et `to_rig_message` changent ensemble.
- **Stockage.** Les octets vont dans un dossier de données local, en fichiers nommés par empreinte (une pièce jointe réutilisée n'est stockée qu'une fois) ; la base ne garde que la référence, le type MIME, la taille et le nom. Jamais de base64 dans SQLite ni dans l'état React.
- **Entrée.** Le menu « + » de la zone de saisie (esquissé dans `thread-input.tsx`), le glisser-déposer et le collage d'une image ; aperçu avant l'envoi, retrait, limites de taille et de nombre. À trancher : comment les octets passent à Rust (sélecteur natif et chemin, ou IPC binaire). La CSP laisse déjà passer `img-src blob:` ; l'audio et la vidéo demanderont d'ouvrir `media-src`.
- **Capacités des modèles.** Fournies par le catalogue de l'axe 4 (types acceptés en entrée et produits en sortie, par modèle). Une pièce jointe que le modèle du fil ne sait pas lire est refusée avant l'envoi, avec un message clair, plutôt que par une erreur du fournisseur.
- **Sortie.** Parties non textuelles produites par le modèle et images renvoyées par un outil : événements de flux dédiés, identifiants stables entre le direct et le persisté (snapshot + remplacement inchangé), rendu dans le fil.
- **Audio.** Entrée native quand le modèle l'accepte, transcription sinon ; enregistrement au micro et réponse vocale à part, en dernier.
- **Confidentialité.** Une pièce jointe ne quitte la machine qu'avec le message envoyé, et aucune URL distante renvoyée par un modèle n'est chargée automatiquement.

Ordre prévu : images en entrée, documents (PDF, texte, code), images en sortie, audio, vidéo. À ne pas confondre avec l'axe 10 : là le fichier est indexé pour être retrouvé, ici il voyage avec le message.

**Terminé quand :** l'utilisateur joint une image et un PDF à un message, pose une question dessus et obtient une réponse qui s'y appuie ; après un redémarrage le fil réaffiche les pièces jointes à l'identique ; et une pièce jointe que le modèle du fil ne gère pas est refusée avant l'envoi.

## 6. Outils natifs et permissions

**But :** que l'agent agisse sur la machine (fichiers, Git, shell) sous le contrôle explicite de l'utilisateur.

À cadrer : modèle de permissions (par outil, par dossier, « demander à chaque fois » ou « toujours autoriser »), stockage des autorisations dans un fichier local via `AtomicFileStore`, demande d'autorisation dans le fil pendant le run, convention d'erreur des outils (erreur métier rendue au modèle, erreur fatale qui stoppe le run). Premiers outils : lecture et recherche de fichiers dans un dossier de travail, Git en lecture, puis écriture de fichiers et shell.

**Terminé quand :** l'agent lit et modifie un fichier d'un dossier autorisé après une confirmation dans le fil, et un refus est rendu au modèle qui continue sans planter.

## 7. MCP

**But :** brancher des serveurs MCP comme sources d'outils, avec le même modèle de permissions que les outils natifs.

À faire : configuration des serveurs (stdio et HTTP) dans les réglages, cycle de vie des processus côté Rust, exposition des outils MCP à l'agent via la même abstraction que les outils natifs. Rien de spécifique à MCP ne doit fuir dans l'interface ni dans la boucle de l'agent. Dépend de l'axe 6.

**Terminé quand :** un serveur MCP ajouté dans les réglages fournit des outils utilisables dans un fil, soumis aux mêmes permissions.

## 8. Agents configurables

**But :** faire de l'agent l'abstraction principale : un agent = un préambule, un modèle, un jeu d'outils.

À faire : bibliothèque d'agents locale (créer, dupliquer, modifier), choix de l'agent à la création d'un fil, agent par défaut. Dépend des axes 4 et 6.

**Terminé quand :** l'utilisateur crée un agent « relecteur de code » avec son modèle et ses outils, et l'utilise dans un nouveau fil.

## 9. Modèles locaux

**But :** utiliser un modèle qui tourne sur la machine, sans rien changer à l'architecture.

À cadrer : Ollama en premier (déjà pris en charge par Rig), puis éventuellement llama.cpp ou Candle embarqués. Le modèle local passe par la même interface que les fournisseurs distants. Dépend de l'axe 4.

**Terminé quand :** un fil fonctionne entièrement hors ligne avec un modèle local, outils compris.

## 10. Connaissances locales

**But :** que l'agent s'appuie sur les documents de l'utilisateur sans les envoyer ailleurs qu'au modèle.

À cadrer : indexation de dossiers choisis, embeddings (locaux de préférence), stockage vectoriel remplaçable (SQLite ou LanceDB), outil de recherche exposé à l'agent.

**Terminé quand :** l'agent répond à une question sur un dossier indexé en citant les fichiers sources.

## 11. Distribution

**But :** installer et mettre à jour Meant sans passer par le code source.

Fait : release-please (PR de release avec changelog et version, déclenchée en la fusionnant), builds Windows, macOS (arm64 et x64) et Linux attachés à la release GitHub, Conventional Commits imposés par commitlint (`reference/release.md`). Le job de build n'a pas encore tourné : le premier tag sera son test.

À faire : signature (certificat Windows, Apple Developer ID et notarisation), mise à jour automatique (désactivable, en accord avec le principe local d'abord, avec clés de l'updater), jeton `RELEASE_PLEASE_TOKEN` et protection de `main`.

**Terminé quand :** une version taguée produit des installeurs signés téléchargeables, et une version installée se met à jour après confirmation.

## Hors périmètre pour l'instant

Comptes et synchronisation dans le cloud, collaboration multi-utilisateur, application mobile, hébergement de modèles pour des tiers. À reconsidérer si un besoin réel apparaît.
