# Teststatus - Whisky Collection Manager v0.19.16

**Stand:** 2026-11-14. Unit-, Integrations- und gezielter Chromium-DOM-Test erfolgreich. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.16. |
| `npm run check` | **Bestanden** | JavaScript, Sprachschluessel und Dokumentationslinks geprueft. |
| `npm test` | **462/462 bestanden** | Vollstaendige Unit- und Integrationstests, darunter Tests fuer belegte und leere Raeume, fehlende Zustimmung, atomare Auslagerung und unveraenderte Flaschenstammdaten. |
| Gezielter Chromium-Test (DOM-Modus) | **1/1 bestanden** | Im Raumplan geloester Raum mit Flasche: Modal, Abbrechen ohne Aenderung sowie anschliessende Auslagerung mit Raumloeschung im Browser geprueft. |
| `npm run test:browser` (normaler Lauf) | **Nicht lokal ausgeführt** | Vollstaendige Browser-Suite mit regulaerer Navigation nicht lokal geprueft. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

## Aenderungen v0.19.16

- Belegte Raeume bieten eine Anwendungssicherheitsabfrage mit den Optionen "Abbrechen" oder "Flaschen auslagern und Raum loeschen" und zeigen die Anzahl betroffener Flaschen.
- Der Server entfernt nach ausdruecklicher Zustimmung nur die Zuordnungen zu Faechern des betroffenen Raums und den Raum selbst in einer atomaren Warehouse-Schreiboperation; `collection.json` und andere Raeume bleiben unveraendert.
- Leere Raeume erhalten weiterhin eine normale Loeschbestaetigung. Neue Regressionstests pruefen Schutzverhalten, UI, API und Persistenz.

**Offen:** Vollstaendige Browser-Suite, reale mobile Endgeraete und Raspberry-Pi-/Docker-Livebetrieb verifizieren.
