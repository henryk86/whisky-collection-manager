# Teststatus - Whisky Collection Manager v1.6.0

**Stand:** 2026-11-18. Automatischer Release-Snapshot aus Merge 61e9ab0c6fde (v1.5.3).

## Pruefungen

- `npm test`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- fix: improve custom whisky picker interaction with viewport-aware clicking and HEX value comparison
- feat: enhance whisky color management with custom HEX support and improved UI
- feat: update flavor profile to support ten axes and enhance tasting functionality
- feat: Add optional Let's Encrypt support with DNS-01 for public HTTPS endpoint

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
