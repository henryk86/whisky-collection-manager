# Teststatus - Whisky Collection Manager v1.8.0

**Stand:** 2026-11-20. Automatischer Release-Snapshot aus Merge 2bbe3812d95a (v1.7.0).

## Pruefungen

- `npm test`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- fix: enhance warehouse finder tests with additional bottle dimming assertions
- fix: enhance warehouse UI with improved furniture photo management and actions
- feat: implement warehouse bottle finder with pagination and location assignment

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
