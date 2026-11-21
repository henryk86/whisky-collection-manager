# Teststatus - Whisky Collection Manager v1.10.0

**Stand:** 2026-11-21. Automatischer Release-Snapshot aus Merge 7947b710a53b (v1.9.0).

## Pruefungen

- `npm test`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- test: verify column configuration persistence across page reloads in collection table
- fix: persist collection view and correct sorting test
- test: improve collection table and layout tests for visibility and positioning
- fix: fix toolbar visibility checks and enhance advanced filter functionality in tests
- feat: enhance collection table with configurable columns and sorting
- feat: enhance collection filters with toggle functionality and improved UI

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
