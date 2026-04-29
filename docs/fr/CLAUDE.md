# CLAUDE.md
## Portée de ce Document

Ce fichier est uniquement dédié au comportement des assistants IA dans ce dépôt.

Pour l'onboarding projet et les commandes locales, utilisez README.fr.md.
Pour le processus de contribution et de PR, utilisez docs/fr/contribution.md.

## 1. Règles Principales pour les Changements IA

Les assistants IA doivent :

- inspecter les fichiers proches avant de générer du code,
- respecter les patterns existants et le style de nommage,
- réutiliser les composants/hooks/providers existants avant de créer du neuf,
- garder des changements minimaux, ciblés et reviewables,
- préserver l’UX et l’accessibilité sur les écrans tactiles.

Les assistants IA ne doivent PAS :

- modifier des fichiers non liés au sujet,
- lancer de gros refactors sans demande explicite,
- ajouter du code mort ou des abstractions inutiles,
- laisser des console de debug dans le code final,
- ignorer les retours de vérification après changements,
- dupliquer des composants ou hooks déjà existants,
- inventer des APIs backend ou formats de réponse non utilisés,
- introduire de nouvelles libs sans nécessité stricte et validation.

## 2. Garde-Fous d’Implémentation

Pour toute modification UI :

- conserver le responsive mobile/tablette/desktop,
- fournir des états de chargement pour les contenus asynchrones,
- fournir des états vides clairs quand il manque des données,
- fournir des états d’erreur actionnables avec piste de résolution,
- maintenir une bonne utilisabilité clavier et une structure sémantique,
- garder un espacement et une hiérarchie visuelle cohérents.

Règles state et données :

- Garder l’état serveur dans la couche query (TanStack Query).
- Garder l’état UI local dans le state composant, les providers context, ou des hooks ciblés.
- Éviter le prop drilling inutile ; utiliser les providers existants quand pertinent.
- Ne pas abuser d’un state global quand un state local suffit.
- Respecter la logique offline-first (networkMode: "offlineFirst" et queue/sync).

## 3. Exemples de Tâches Adaptées à l’IA

- Ajouter un filtre à une table produits en réutilisant les patterns hook/query.
- Corriger un spinner de chargement qui ne se termine pas sur un flux connu.
- Améliorer l’espacement mobile du checkout avec Tailwind et composants existants.
- Ajouter un état vide clair à la liste clients.
- Factoriser un helper dupliqué dans src/lib/utils sans changer le comportement.

## 4. Tâches à Éviter Sans Demande Explicite

- Réécrire toute l’architecture applicative en une seule PR.
- Remplacer TanStack Query ou la stratégie IndexedDB sans demande.
- Renommer de larges arborescences de dossiers par préférence de style.
- Ajouter des dépendances aléatoires pour une commodité locale.
- Refaire des composants existants au lieu de réutiliser src/components/ui.

## 5. Instruction Finale

Réalisez le plus petit changement de haute qualité qui respecte l’architecture actuelle.