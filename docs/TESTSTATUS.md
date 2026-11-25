# Teststatus - Whisky Collection Manager v1.12.6

**Stand:** 2026-11-25. Entwicklungsstand auf `develop`, vor dem nächsten Release.

## Pruefungen

- `npm test`: **748/748 bestanden** (Unit- und Integrationstests, Node.js 22.16.0).
- `npm run check`: **Bestanden** (Syntax, Module, Übersetzungen, Dokumentation, Deployment, Formatierung, Zeilenlänge und JSDoc).
- Gezielter Browser-Test zur Fassauswahl, zu den Checkboxen für harte Filter und Entdeckungsmodus sowie zur Rückkehr aus der Planungshilfe: **Bestanden** (Chromium 144.0.7559.96, lokal verfügbare Playwright-Version 1.57.0-beta, DOM-Modus mit echten App-Modulen und CSS; Desktop 1366 px und Mobilansicht 390 px; Checkboxgröße gemäß Design-Token, horizontale Ausrichtung und Auswahlzustand). Die projektspezifische Playwright-Version ist nicht installiert; der vollständige Browser-Testlauf wurde nicht ausgeführt.
- Neuer visueller Zustand `modal-flight-expanded`: **8/8 Aufnahmen erfolgreich**, einschließlich Modalinteraktion und Prüfung auf abgeschnittene Inhalte und horizontalen Überlauf (Chromium 144, vier Breiten, beide Farbschemata). Die vollständige visuelle Suite wurde nicht ausgeführt; keine Aktualisierung der visuellen Referenzbilder.
- Release-Metadaten und SHA-256-Quellmanifest werden beim Release separat geprueft.
- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.
- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieser lokalen Prüfung.

Aenderungen und fruehere Releases: [Changelog](../CHANGELOG.md).
