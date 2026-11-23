# Teststatus - Whisky Collection Manager v1.12.0

## Aktuelle Develop-Pruefung: Designsystem-Vereinfachung, 2026-11-23

**Basis:** exakt `WCM_Designsystem_Abschluss_Projekt.zip` (v1.12.0).

- `npm run check`: **bestanden** (einschliesslich aktualisierter Dokumentationslinks).
- `npm test`: **691/691 bestanden**.
- `npm run test:visual`: **136/136 bestanden**, keine optischen oder gemessenen Geometrieabweichungen gegen die unveraenderten Referenzen.
- `npm run test:browser`: **nicht lokal durchgefuehrt** (hier fehlt weiterhin `playwright-core`); auf CI offen.
- Keine Schema-, API-, Persistenz- oder Geschaeftslogikaenderungen; keine Versionsaenderung.
- Vereinfachte Modulstruktur und reduzierte Schnittstellen: [Designsystem-Entwicklung](DESIGNSYSTEM_ENTWICKLUNG.md).

---

## Vorherige Develop-Pruefung: Designsystem-Abschluss, 2026-11-23

**Grundlage:** korrigiertes Phase-5-Projekt (`1.12.0`), keine Release-Versionierung.

- `npm run check`: **bestanden** (Module, Übersetzungen, Dokumentation und CI-Verträge).
- `npm test`: **691/691 bestanden**, 0 fehlgeschlagen.
- `npm run test:visual`: direkter Chromium/CDP-Test mit **136/136 Screenshot- und Geometrievergleichen** in vier Breiten, zwei Themes und 17 Zuständen; zusätzlicher Fokus-/Escape-/Scroll-/Modal-Stack-Smokecheck erfolgreich.
- `npm run test:browser`: **in dieser Umgebung nicht ausführbar**. Der tatsächlich gestartete Lauf scheitert am fehlenden Paket `playwright-core`; `npm ci` konnte es wegen `EAI_AGAIN` (nicht erreichbare npm-Registry) nicht installieren. Die fehlgeschlagenen Modulladevorgänge sind **keine 16 fachlichen Browser-Testfehler**.
- **GitHub-Actions PR-CI mit Playwright und visuellem Vergleich:** noch nicht ausgeführt. Die neuen browserbasierten Closure-Tests sind integriert, aber im lokalen Browserpaket nicht ausführbar. Desktop Firefox, Safari, Android/iOS und Screenreader bleiben offen.

Detaillierte Abnahme, CI-Artefakte und Baseline-Freigabe: [Designsystem-Abschlussaudit](DESIGNSYSTEM_ABSCHLUSSAUDIT.md). Die folgenden Angaben sind der ältere Release-Snapshot und nicht das Ergebnis dieses Develop-Abschlusslaufs.


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
