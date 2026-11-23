# Teststatus - Whisky Collection Manager v1.12.0

**Stand:** 23. November 2026. Dies ist **keine Produktionsfreigabe**; maßgeblich für einen PR ist die GitHub-CI des konkreten Commits.

| Prüfung | Tatsächlich ausgeführtes Ergebnis |
|---|---|
| `npm run check` | **Bestanden** – Syntax, Imports, Übersetzungen, Dokumentationslinks und Deploymentverträge |
| Unit-/Integrationstests (`npm test`) | **706/706 bestanden** (vollständiger Lauf im aktuellen Prüfstand) |
| `npm run test:visual` | **136/136 Geometrie-/Interaktionsprüfungen bestanden** mit lokalem Chromium 144; Pixelwerte im Diagnosemodus, Browserbindung für strikten Modus vorhanden |
| `npm run test:browser` | **Lokal offen**: `playwright-core` ist in dieser Umgebung nicht verfügbar; vollständiger Browserlauf in GitHub Actions erforderlich |
| GitHub Actions | Für diesen Änderungenstand noch nicht ausgeführt |
| Reale Mobilgeräte, Safari, Firefox, Screenreader, WebGL-Zielhardware und Dauerbetrieb | Nicht abschließend abgenommen |

**Einordnung:** Layout-, Überlauf- und Modalinteraktionstests blockieren PRs. Pixelunterschiede werden bis zur Freigabe neuer CI-kompatibler Referenzen nur diagnostiziert. Die vollständig installierte Playwright-Browsersuite muss in der normalen GitHub-CI laufen. Ein grüner Unit-/Screenshotlauf ersetzt sie nicht.

Testumfang und Befehle: [Teststrategie](TESTSTRATEGIE.md). Funktions- und Releaseänderungen: [Changelog](../CHANGELOG.md). Bei der nächsten relevanten Änderung diesen Status auf die tatsächlich neu ausgeführten Prüfungen aktualisieren, nicht als Testchronik fortschreiben.
