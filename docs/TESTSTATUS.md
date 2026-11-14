# Teststatus - Whisky Collection Manager v0.23.5

**Stand:** 2026-11-14. **Status:** gezielte Pruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.23.5 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Uebersetzungen und Dokumentation geprueft. |
| `npm test` | **487/487 bestanden** | Alle Node-Unit- und Integrationstests, inklusive neuem CSS-Abstandsregressionstest. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige Browser-Suite bleibt fuer GitHub Actions offen. |
| Gezielter Chromium-DOM-Test | **Bestanden (1/1)** | Einstellungen -> Allgemein: Abstand zwischen Bereichsueberschrift und erstem Panel bei 16px geprueft. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach dem Release auf dem Zielsystem pruefen. |

## Aenderungen v0.23.5

- Einstellungen: Der Allgemein-Abschnitt erhaelt 2 px mehr Abstand zwischen Bereichsueberschrift und erstem Inhaltspanel (16 statt 14 px), entsprechend den anderen Einstellungsgruppen. Keine anderen Oberflaechenfunktionen veraendert.

Die lokale volle Chromium-HTTP-Suite, reale Geraeteabnahme und ARM64-Live-Tests wurden nicht ausgefuehrt.
