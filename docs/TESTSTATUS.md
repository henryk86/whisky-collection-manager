# Teststatus - Whisky Collection Manager v1.3.2

**Stand:** 2026-11-16. **Status:** Node-/Integrationspruefungen und gezielte Chromium-DOM-Pruefung erfolgreich. Die vollstaendige GitHub-CI-Browsersuite fuer v1.3.2 bleibt eine offene Release-Abnahme. Vorherige Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version, Metadaten und SHA-256-Quellmanifest stimmen ueberein. |
| `npm run check` | **Bestanden** | Syntax, Importe, Architektur, Uebersetzungen, Dokumentation, Dialog- und Regex-Budgetregeln. |
| `npm test` | **545/545 bestanden** | Vollstaendige Node-Unit-/Integrationstests; ein historischer CSS-Quelltexttest wurde durch eine Chromium-Laufzeitpruefung ersetzt. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Die Playwright-Abhaengigkeit steht in dieser Umgebung nicht zur Verfuegung; der Installationsversuch konnte nicht abgeschlossen werden. Der neue Regressionstest ist in der Suite enthalten. |
| Chromium-DOM-Test, direktes Umlagern | **Bestanden** | Browser hat die Lagerortwahl und Speichern sofort angezeigt; PUT zum Zielfach wurde mit HTTP 200 beantwortet und die Zuordnung durch erneuten GET nachgewiesen. |
| Chromium-DOM-Test, Lagerort entfernen | **Bestanden** | Ohne weiteres Aufklappen wurde „Ohne Lagerort“ gespeichert (HTTP 200, Zuordnung entfernt). |
| Chromium-DOM-Stilpruefung | **Bestanden** | Native Radiobuttons werden mit berechneten 18 x 18 px und `appearance: auto` gerendert. |
| GitHub Actions / regulaere Browsernavigation | **Ausstehend** | CI fuer genau v1.3.2 pruefen. GitHub CI fuer v1.3.1 war laut Rueckmeldung des Repository-Betreibers gruen. |
| Docker / Raspberry Pi ARM64 / echte Mobilgeraete | **Nicht lokal ausgefuehrt** | Auf den Zielsystemen separat pruefen. |

## Aenderungen v1.3.2

- Nach „Umlagern“ direkt Raum, Moebel und Fach waehlen und Speichern; Anzeige des aktuellen Lagerorts bleibt erhalten. Einzel- und Mehrfachzuordnung verwenden dieselbe Komponente.
- Die nicht mehr benoetigte verschachtelte Aktion „Lagerort ändern“ wurde entfernt, einschliesslich des vorherigen Speicher-Guards.
- Chromium-Browserregression prueft unmittelbare Bedienelemente, Umspeichern in ein anderes Fach und „Ohne Lagerort“.
- B-5: Ein historischer CSS-Quelltexttest wurde durch echte Browserstilpruefungen ersetzt. Das alte Regex-Budget ist jetzt 751 statt 754.

## Offene Abnahmen und Review-Folgen

- Vollstaendige Playwright-Browser-Suite in GitHub Actions fuer v1.3.2 (einschliesslich des neuen Regressionstests).
- B-5: Historische Regex-Pruefungen fuer Lager-/3D-Implementierungsdetails weiter mit gleichwertigen Verhaltenstests ersetzen.
- Raspberry-Pi-/Docker-/Mobilgeraete-Verhalten getrennt pruefen. Schema 5 und alle bestehenden Daten werden nicht veraendert.
