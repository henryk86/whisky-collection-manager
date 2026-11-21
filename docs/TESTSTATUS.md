# Teststatus - Whisky Collection Manager v1.9.0

**Stand:** 2026-11-21. Automatischer Release-Snapshot aus Merge e31017e5ab48 (v1.8.0).

## Pruefungen

- `npm test`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- feat: add emptied date tracking for bottles, including validation and export support
- feat: enhance warehouse bottle navigation with return to bottling support and localization updates
- feat: add photo zoom functionality with controls and localization support
- fix: support PNG format as fallback for edited images and update error messages
- fix: show missing bottling and bottle details

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
