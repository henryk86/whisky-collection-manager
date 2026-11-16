# Teststatus - Whisky Collection Manager v1.3.3

**Stand:** 2026-11-16. **Status:** Node-/Integrationstests und Architekturchecks bestanden. Die vollständige Chromium-Browserprüfung für v1.3.3 und der reguläre GitHub-CI-Lauf stehen aus. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version, Metadaten und Quellmanifest stimmen überein. |
| `npm run check` | **Bestanden** | Syntax, Importe, Dokumentationslinks, Übersetzungen und Architekturregeln. |
| `npm test` | **546/546 bestanden** | Vollständiger Node-Unit-/Integrationstestlauf einschließlich der Beschriftung „Umlagern“ in gerenderten Flaschendetails. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Die Node-Abhängigkeit `playwright-core` ist in dieser Umgebung nicht funktionsfähig verfügbar. Die erweiterten Regressionstests sind für den CI-Lauf enthalten. |
| Chromium-Layoutprüfung (isoliertes Dialogmarkup) | **Bestanden** | Echte Projekt-CSS und das gerenderte Dialogmarkup: Desktop 740 × 452 px bei 1366 px Viewport; Mobilansicht 360 × 695 px bei 390 px Viewport, ohne horizontales Überlaufen. Kein Ersatz für die vollständige Browser-Suite. |
| GitHub Actions / reguläre Browsernavigation | **Ausstehend** | Vollständige Suite für v1.3.3 nach Einspielen des Patches prüfen. |
| Docker / Raspberry Pi ARM64 / mobile Endgeräte | **Nicht lokal ausgeführt** | Auf dem Zielsystem separat prüfen. |

## Änderungen v1.3.3

- Der Aktionsbutton der physischen Flasche in den Abfüllungsdetails heißt „Umlagern“.
- Der gleiche, sofort geöffnete Zielwahldialog wird aus Flaschendetails und Lagerfach verwendet, ohne aufrufabhängiges Sonderverhalten.
- Kompakte Darstellung innerhalb des allgemeinen Dialogstils: Kontextfelder auf Desktop nebeneinander, drei Lagerziel-Selektoren in einer Zeile; responsive Stapelung auf Mobilgeräten.
- Chromium-Regressionstests kontrollieren Desktopmaße, direkte Auswahl aus Flaschendetails und mobile Darstellung.

## Offene Abnahme

- Vollständigen Browsertest in GitHub Actions durchführen; die Node-Tests belegen nicht die visuelle Darstellung in Chromium.
- Datenmodell, Migration, API und die bisherige fachliche Zuordnungslogik wurden nicht geändert.
