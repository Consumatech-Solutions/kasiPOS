# Contribuer à KasiPOS Frontend
## Portée de ce Document

Ce fichier définit le processus de contribution et les attentes de revue.
Pour l'installation et les commandes de base, utilisez `README.fr.md`.
Pour les règles de comportement des assistants IA, utilisez `docs/fr/claude.md`.

## 1. Avant de Commencer

Avant d'ouvrir une pull request:
- vérifiez les issues et PR actives pour éviter les doublons,
- discutez des évolutions larges ou transverses avant implémentation,
- demandez des clarifications si le besoin est ambigu,
- gardez une PR concentrée sur un seul problème.

## 2. Convention de Nommage des Branches

Utilisez des noms courts et explicites:
- `feat/add-cart-discounts`
- `fix/offline-sync-bug`
- `docs/update-readme`
- `refactor/product-table`

## 3. Convention des Messages de Commit

Ce repo utilise Conventional Commits (`@commitlint/config-conventional`).

Exemples:
- `feat: add barcode scanner support`
- `fix: resolve offline sync duplication`
- `docs: update installation guide`
- `refactor: simplify cart logic`
- `test: add sales flow tests`

## 4. Processus de Pull Request

Pour chaque PR:
- gardez-la focalisée et de taille raisonnable,
- liez l'issue correspondante si disponible,
- expliquez clairement ce qui change et pourquoi,
- ajoutez des captures d'écran pour les changements UI,
- vérifiez que les checks passent avant revue,
- demandez une revue aux maintainers.

Checks minimum avant PR:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Pour les changements de flux UI/comportement, executez aussi:

```bash
npm run cypress:run
```

## 5. Checklist de Revue

- [ ] La portée de la PR est limitée et les changements hors sujet sont retirés.
- [ ] Les messages de commit sont clairs et conformes.
- [ ] Les checks requis passent en local.
- [ ] Les changements UI incluent des captures d'écran.
- [ ] Les notes de risque ou migration sont ajoutées si nécessaire.

## 6. Signalement d'Issues

Merci d'inclure:
- un titre clair,
- des étapes de reproduction,
- comportement attendu vs comportement observé,
- captures d'écran ou vidéos si utile,
- navigateur, OS et type d'appareil.

Si possible, ajoutez logs et messages d'erreur pour accélérer le triage.

## 7. Communauté et Communication

Nous encourageons les discussions respectueuses et la collaboration.

- restez clair et respectueux dans les issues et PR,
- demandez des clarifications quand le contexte manque,
- facilitez la revue avec des messages concis et précis.
