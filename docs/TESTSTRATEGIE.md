# Teststrategie

## Welche Prüfung beweist was?

| Befehl / Umgebung | Prüfumfang |
|---|---|
| `npm run check` | JS-Syntax, Imports, Modulgrenzen, Übersetzungen, Dokumentationslinks und Deploymentkonfiguration |
| `npm test` | Unit- und Integrationstests für Fachregeln, Persistenz, API, Backup, Migration, Negativfälle |
| `npm run test:browser` | Playwright/Chromium: Navigation, Formularbedienung, Modals, Fokus, responsive Geometrie, Sprachen, Scroll |
| `npm run test:visual` | 136 Referenzzustände: Geometrie/Überlauf/Modalinteraktion als CI-Gate, Pixelunterschiede nur als Diagnose |
| GitHub Actions | Vollständige PR-/Push-Prüfungen mit Screenshots und Differenzbildern als Fehlerartefakte |

Ein bestandener Unit-Test ersetzt keinen Browserlauf; Screenshots ersetzen keine Interaktionsprüfung. Der eingeschränkte Modus `WHISKY_BROWSER_DOM_ONLY=true` prüft kein echtes Vorwärts-/Rückwärts-/Neuladen im HTTP-Browser. Reale Mobilgeräte, Safari/Firefox, Screenreader, WebGL/GPU und Dauerbetrieb benötigen getrennte Abnahmen.

**Testgrundsatz:** Verhalten, API-Ausgaben und DOM messen; keine Unit-Tests, die nur konkrete CSS-/JS-Quelltextzeilen erwarten. Ein fehlgeschlagener Verhaltenstest darf nicht durch das bloße Entfernen seiner Assertion „behoben“ werden.

## Visuelle Referenzen

Mit `npm run test:visual` sind Geometrie und Interaktionen verpflichtend, Pixelvergleiche aktuell nicht. Die ursprünglichen Bilder wurden mit einer anderen Chromium-Version aufgenommen; die CI verwendet den gepinnten Playwright-Browser. Der Bericht weist den Versionsunterschied aus. `npm run test:visual:strict` ist erst mit freigegebenen, zur CI-Version passenden Referenzen sinnvoll. Referenzen niemals automatisch auf CI aktualisieren: Änderungen mit `npm run visual:update` lokal erstellen, prüfen und explizit committen. Details: [Visuelle Tests](DESIGNSYSTEM_VISUELLE_TESTS.md).

## Ablauf für Änderungen

1. Auswirkung auf Daten, GUI, API, Deployment und Dokumentation bewerten.
2. Tests für das zu ändernde Verhalten ergänzen; Fehler gegen den unveränderten Ausgangsstand nachvollziehen.
3. `npm run check` und `npm test`; bei UI zusätzlich Browser- und visuelle Regression.
4. Dokumentation zeitgleich aktualisieren oder eine begründete Nichtbetroffenheit im Commit/PR deklarieren. Der CI-Check [`scripts/check-doc-impact.js`](../scripts/check-doc-impact.js) überwacht diesen Schritt.
5. Fehlende Prüfungen und Risiken im PR benennen; CI-Ergebnisse nicht mit manueller Hardwarefreigabe verwechseln.

Für Laufzeitmessungen auf dem Raspberry Pi getrennte Testdaten und wiederholte GET-/ETag-Anfragen benutzen; Schreibtests niemals unbeabsichtigt gegen erhaltenswerte Daten ausführen.
