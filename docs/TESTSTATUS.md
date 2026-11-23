# Teststatus - Whisky Collection Manager v1.12.0

**Stand:** 2026-11-23. Automatischer Release-Snapshot aus Merge a2d0e9267e9d (v1.11.0).

## Pruefungen

- `npm test`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- fix: improve modal behavior to preserve scrollbar track and prevent content shift during modal opening
- feat: enhance flight planning help functionality and preserve modal state
- docs: update README to streamline features and improve clarity on installation and security
- feat: enhance flight planning help and cask classification
- docs: update README with enhanced features and functionality descriptions; remove outdated code review documents
- feat: add file preview functionality for various document types with download fallback

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
