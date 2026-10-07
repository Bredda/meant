# Backlog

Idées, fonctionnalités et corrections non planifiées. La stratégie est dans [roadmap.md](roadmap.md), le plan en cours dans [todo.md](todo.md), les corrections du code existant dans [fixes.md](fixes.md).

Ne pas piocher ici sans demande. Une entrée retenue passe dans la roadmap (grosse fonctionnalité) ou dans un plan de `todo.md` ; elle est alors retirée d'ici.

## Conversations

- **Modifier un message utilisateur** et relancer à partir de là, avec branches de conversation conservées.
- **Exporter un fil** en Markdown ou JSON, et l'importer.
- **Blocs de code** : coloration syntaxique et bouton de copie par bloc dans les réponses Markdown.
- **Pièces jointes** : fichiers et images dans la zone de saisie (le menu « + » de `thread-input.tsx` en esquisse l'idée).
- **Raccourcis clavier** : nouveau fil, recherche, envoi, annulation, navigation entre fils.
- **Informations du fil** : afficher le chemin de la base et le dossier de données dans la fenêtre « Thread infos » (aujourd'hui « to be done »).
- **Page d'accueil** utile : fils récents, raccourcis, état des fournisseurs.

## Modèles et fournisseurs

- **Vérifier une clé à l'enregistrement** par un appel léger au fournisseur, en plus du contrôle de préfixe.
- **Mise en cache des prompts** (Anthropic) pour réduire le coût des longs fils.
- **Génération d'images** et **recherche web** comme outils ou capacités de fournisseur.
- **Recherche approfondie** : agent multi-étapes dédié.

## Outils et sécurité

- **Journal des actions d'outils** consultable : ce qui a été exécuté, quand, avec quelle permission.
- **Bac à sable pour le shell** (dossier de travail limité, liste de commandes autorisées).
- **Sonde d'écriture du vault** au démarrage : `check_vault` ne teste aujourd'hui que la lecture d'une entrée absente.

## Données et configuration

- **Verrou sur `AtomicFileStore::update`** si plusieurs écritures concurrentes apparaissent (limite connue, voir `reference/config.md`).
- **Sauvegarde et restauration** des données locales (base, configuration ; jamais les clés).
- **Langue de l'interface** (français, anglais) dans les préférences.
- **Génération des types TypeScript depuis Rust** (`ts-rs`, `specta`) si la synchronisation manuelle de `src/lib/types.ts` devient une source de bugs (voir R3 dans `fixes.md`).

## Interface

- **Fenêtre d'erreur globale** plus utile : détail technique dépliable, copie du rapport, lien vers les logs.
- **Taille et position de la fenêtre** mémorisées entre deux lancements.
