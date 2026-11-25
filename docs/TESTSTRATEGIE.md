# Teststrategie

## Welche Prüfung beweist was?

| Befehl / Umgebung | Prüfumfang |
|---|---|
| `npm run check` | JS-Syntax, Imports, Modulgrenzen, Übersetzungen, Dokumentationslinks und Deploymentkonfiguration |
| `npm test` | Unit- und Integrationstests für Fachregeln, Persistenz, API, Backup, Migration, Negativfälle und native DOM-Assertions in Chromium |
| `npm run test:browser` | Playwright/Chromium: Navigation, Formularbedienung, Modals, Fokus, responsive Geometrie, Sprachen, Scroll |
| `npm run test:visual` | 144 Aufnahmen: Überlauf und Modalinteraktion; PR-CI vergleicht frische Geometrie und Pixel |
| GitHub Actions | Vollständige PR-/Push-Prüfungen mit Screenshots und Differenzbildern als Fehlerartefakte |

Die UI-Assertions in `npm test` verwenden Chromium und den produktiven DOM-Renderer, nicht eine zweite Rendering-Implementierung der Anwendung. Chromium muss vor `npm test` installiert sein. Ein bestandener Unit-Test ersetzt keinen Browserlauf; Screenshots ersetzen keine Interaktionsprüfung. Der eingeschränkte Modus `WHISKY_BROWSER_DOM_ONLY=true` prüft kein echtes Vorwärts-/Rückwärts-/Neuladen im HTTP-Browser. Reale Mobilgeräte, Safari/Firefox, Screenreader, WebGL/GPU und Dauerbetrieb benötigen getrennte Abnahmen.

**Testgrundsatz:** Verhalten, API-Ausgaben und DOM messen; keine Unit-Tests, die nur konkrete CSS-/JS-Quelltextzeilen erwarten. Ein fehlgeschlagener Verhaltenstest darf nicht durch das bloße Entfernen seiner Assertion „behoben“ werden.

## Visueller PR-Vergleich

Die PR-CI vergleicht frische Aufnahmen des tatsächlichen Zielbranch-Commits und des Merge-Kandidaten mit derselben Chromium-Version. Überlauf, Aufnahmefehler und Interaktionsfehler blockieren unabhängig von der Freigabe. Bild- und Geometrieänderungen werden gezielt im PR freigegeben. Details: [Visuelle Tests](DESIGNSYSTEM_VISUELLE_TESTS.md).

## Ablauf für Änderungen

1. Auswirkung auf Daten, GUI, API, Deployment und Dokumentation bewerten.
2. Tests für das zu ändernde Verhalten ergänzen; Fehler gegen den unveränderten Ausgangsstand nachvollziehen.
3. `npm run check` und `npm test`; bei UI zusätzlich Browser- und visuelle Regression.
4. Im gesamten PR nur tatsächlich betroffene Dokumentation aktualisieren; eine Begründung bei Nichtbetroffenheit ist nicht erforderlich.
5. Fehlende Prüfungen und Risiken bei Bedarf im Review oder in den Testunterlagen festhalten. Die PR-Beschreibung darf leer bleiben; CI-Ergebnisse nicht mit manueller Hardwarefreigabe verwechseln.

Für Laufzeitmessungen auf dem Raspberry Pi getrennte Testdaten und wiederholte GET-/ETag-Anfragen benutzen; Schreibtests niemals unbeabsichtigt gegen erhaltenswerte Daten ausführen.
