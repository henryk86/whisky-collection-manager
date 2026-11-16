# Teststatus - Whisky Collection Manager v1.5.0

**Stand:** 2026-11-16. Automatischer Release-Snapshot aus Merge 63a3bb1b30d8 (v0.27.12).

## Pruefungen

- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit `npm run check`, `npm test` und `npm run test:browser`.
- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.

## Aenderungen

- fix(ci): make release cutover deterministic
- feat: implement local commit message validation with git hooks
- fix(ci): exclude historical commits from first release
- fix(ci): correct initial release transition and PR validation
- feat(release-automation): implement automated release planning and snapshot creation

Fruehere CI-Resultate: [TESTHISTORIE.md](TESTHISTORIE.md).
