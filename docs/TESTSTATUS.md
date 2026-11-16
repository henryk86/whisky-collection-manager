# Teststatus - Whisky Collection Manager v1.5.1

**Stand:** 2026-11-16. Automatischer Release-Snapshot aus Merge 99735bddf25c (v1.5.0).

## Pruefungen

- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- fix(release): synchronize versions on main and develop

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
