# Teststatus - Whisky Collection Manager v0.19.14

**Stand:** 2026-11-14. Die Unit- und Integrationstests sowie die Versions- und Konsistenzpruefungen wurden nach den Aenderungen erfolgreich ausgefuehrt. Historische Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.14. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien, Uebersetzungen, 18 Markdown-Dateien und relative Links geprueft. |
| `npm test` | **460/460 bestanden** | Unit- und Integrationstests; Fachuebersicht-Bilder ohne Klickaktion, direkte Fachaktionen, Flaschenvorschau im Moebelmodal und Rueckkehr in der Modalkette. |
| `npm run test:browser` | **Blockiert** | Lauf versucht, startet wegen fehlendem Paket `playwright-core` nicht (`ERR_MODULE_NOT_FOUND`). Die Browser-Regression ist aktualisiert, aber nicht ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

## Aenderungen v0.19.14

- Flaschenbilder der Fachinhalt-Uebersicht sind reine Anzeige ohne Klickaktion und ohne Mehrfachauswahl.
- `Umlagern` und `Zur Detailseite` bleiben direkt auf jeder Fachkarte; ein Umlagern-Modal kehrt beim Schliessen zur Fachuebersicht zurueck.
- Flaschen im Moebelmodal bleiben einzeln anklickbar; die Regalwand behaelt Doppelklick fuer Flaschendetails sowie Einfachklick fuer Mehrfachauswahl.
- Browser-Test und Lagerdokumentation an die voneinander getrennten Modalaktionen angepasst.

**Offen:** End-to-End-Pruefung im Browser, mobile Geraete und Pi-Docker-Betrieb.
