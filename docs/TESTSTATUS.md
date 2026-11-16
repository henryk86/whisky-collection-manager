# Teststatus - Whisky Collection Manager v1.5.2

**Stand:** 2026-11-16. Automatischer Release-Snapshot aus Merge 18847d0334c0 (v1.5.1).

## Pruefungen

- `npm test`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- fix(ci): correct generated release test status
- fix(ci): implement version PR workflow and synchronization for protected main

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
