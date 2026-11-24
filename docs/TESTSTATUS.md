# Teststatus - Whisky Collection Manager v1.12.2

**Stand:** 2026-11-24. Automatischer Release-Snapshot aus Merge b1fef71c9342 (v1.12.1).

## Pruefungen

- `npm test`: **Noch nicht ausgeführt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

Aenderungen und fruehere Releases: [Changelog](../CHANGELOG.md).
