# Teststatus - Whisky Collection Manager v1.12.0

**Stand:** 23. November 2026, aktueller Entwicklungsstand nach der Dokumentationsbereinigung. Dies ist **keine Produktionsfreigabe**; maßgeblich für einen PR ist die GitHub-CI des konkreten Commits.

| Prüfung | Tatsächlich ausgeführtes Ergebnis |
|---|---|
| `npm run check` | **Bestanden** – Syntax, Imports, Übersetzungen, Dokumentationslinks und Deploymentverträge |
| Unit-Tests | **523/523 bestanden** (vollständige `tests/unit/`-Suite) |
| Integrationstests | **174/174 bestanden**, auf vier vollständig abgeschlossene Läufe mit jeweils 12–13 Testdateien aufgeteilt |
| `npm test` als ein einziger Lauf | Wegen Ausführungslimit nach 156 erfolgreichen Fällen unterbrochen; deshalb **nicht** als vollständiger Einzellauf gewertet |
| `npm run test:visual` | **136/136 bestanden**, keine Referenz-/Geometrieabweichung |
| `npm run test:browser` | **Nicht ausführbar**: `playwright-core` fehlt lokal; 16 Testdateien konnten deshalb nicht geladen werden. Keine fachlichen Browserassertions ausgeführt |
| GitHub Actions | Für diese Dokumentationsänderung noch nicht ausgeführt |
| Reale Mobilgeräte, Safari, Firefox, Screenreader, WebGL-Zielhardware und Dauerbetrieb | Nicht abschließend abgenommen |

**Einordnung:** Die 174 Integrationstests sind alle erfolgreich durchlaufen, aber nicht als einzelner `npm test`-Prozess. Die vollständig installierte Playwright-Browsersuite muss in der normalen GitHub-CI laufen. Ein grüner Unit-/Screenshotlauf ersetzt sie nicht.

Testumfang und Befehle: [Teststrategie](TESTSTRATEGIE.md). Funktions- und Releaseänderungen: [Changelog](../CHANGELOG.md). Bei der nächsten relevanten Änderung diesen Status auf die tatsächlich neu ausgeführten Prüfungen aktualisieren, nicht als Testchronik fortschreiben.
