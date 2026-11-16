# Teststatus - Whisky Collection Manager v0.28.7

**Stand:** 2026-11-16. **Status:** Lokale Unit-/Integrationstests und parallele Testserver-Pruefung erfolgreich; GitHub-CI, vollstaendige Browser-Suite und Zielsystempruefungen noch offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Versionsangaben v0.28.7 konsistent. |
| `npm run check` | **Erfolgreich** | Syntax, Importgraph, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **558/558 bestanden** | Vollstaendige Unit-/Integrationstests. |
| Tests zu `api.test.js`, `http.test.js`, `server-isolation.test.js` | **5 x 20/20 bestanden** | Wiederholte parallele Starts, HTTP-Zugriff, persistente Trennung und atomare Speicherung. |
| `npm run test:browser` | **Nicht lokal ausgefuehrt** | Browserabhaengigkeit `playwright-core` in diesem Arbeitsverzeichnis nicht installiert. |
| GitHub Actions | **Noch nicht ausgefuehrt** | Gemeldete CI-Race-Condition nach PR/Push erneut im CI bestaetigen. |
| Docker-Image / ARM64-Live-Test | **Nicht lokal ausgefuehrt** | Produktionsserver wurde nicht geaendert. |

## Aenderungen v0.28.7

- Die Integrationstesthilfe ueberlaesst die Portwahl dem bindenden Kindprozess (`listen(0)`) und wartet auf dessen IPC-Startmeldung. Ein anderer Testprozess kann dadurch nicht mehr irrtuemlich als eigener Server erkannt werden.
- Testserver und produktiver Serverstart bleiben getrennt: keine Aenderung an Endpunkten, JSON-Schema, Ports im Betrieb oder Sammlungsdaten.
- Neuer Integrationstest startet vier Server parallel und prueft getrennte Ports und Sammlungen.
- Anlass: In GitHub Actions schlug ein API-Test mit `fetch failed` fehl; ein anderer Test fand Daten aus einer parallelen Test-Session in seiner Collection.
