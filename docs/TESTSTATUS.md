# Teststatus - Whisky Collection Manager v1.5.3

**Stand:** 2026-11-17. Automatischer Release-Snapshot aus Merge 95a8f64d2919 (v1.5.2).

## Pruefungen

- `npm test`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- `npm run test:browser`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.
- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- docs: update README and add new images for enhanced whisky collection management visuals
- fix: add error handling for missing backup management configuration and update localization for error messages
- fix: enhance backup diagnostics and error handling, including structured error codes and sensitive data redaction
- fix: ensure frontend imports are served and validate against HTTP allowlist
- fix: enhance backup worker diagnostics and error handling
- fix: prevent duplicate saves and use stable API error codes
- docs: update README to streamline project description and clarify development workflow
- docs(release): align documentation with protected main workflow
- chore(deps-dev): bump playwright-core from 1.65.0 to 1.65.1

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
