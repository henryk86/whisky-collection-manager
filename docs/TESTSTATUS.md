# Teststatus - Whisky Collection Manager v1.7.0

**Stand:** 2026-11-19. Automatischer Release-Snapshot aus Merge 64aafffaa98a (v1.6.2).

## Pruefungen

- `npm test`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- feat: update branding to "Whisky Collection Manager" across multiple files and enhance authentication UI
- fix(docs): correct heading formatting in TESTSTATUS.md and update test assertions for changelog validation
- fix(docs): correct title formatting in TESTSTATUS.md
- feat(auth): implement optional login and user management features

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
