# Teststatus - Whisky Collection Manager v1.11.0

**Stand:** 2026-11-22. Automatischer Release-Snapshot aus Merge 5b5198eccea6 (v1.10.0).

## Pruefungen

- `npm test`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- fix: Missing schema update, harmonized various back link implementations
- feat(tasting): add optional rating comment field and update UI
- feat: update tasting summary layout to improve navigation and display of latest tastings
- refactor: remove unused whisky color display and update tasting summary layout for improved clarity
- fix: tasting summary layout and styles for improved UI/UX
- feat: enhance tasting summary to include compact flavor radar and color display, with responsive styles
- test: enhance overview quick filters to include flavor filter visibility and accessibility checks
- feat: Implement planned tasting flights with validation and persistence, added new filtering for tasting profiles
- feat: enhance toast notifications with dismissible close button and accessibility features

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
