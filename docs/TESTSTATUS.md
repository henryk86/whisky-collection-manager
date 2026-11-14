# Teststatus - Whisky Collection Manager v0.17.14

**Stand:** 2026-11-14. **Status:** Unit-/Integrationstests, Versions- und statische Prüfungen bestanden; Browser- und Docker-Prüfungen für diese Version nicht ausgeführt. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.17.14 sind konsistent. |
| `npm run check` | **Bestanden** | JavaScript-Importe und Syntax, i18n-Kataloge, Dokumentationslinks sowie Test-Fixtures geprüft. |
| `npm test` | **378/378 bestanden** | Gesamte lokal ausführbare Unit-/Integrationssuite, einschließlich zwei neuer Sprach-Regressionstests. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Browser-Verhalten für diese Version nicht überprüft. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Deployment weiterhin separat prüfen. |
| Windows-PowerShell-Testlauf | **Nicht lokal ausgeführt** | Windows-spezifische Probleme aus früheren Testberichten sind hiermit nicht behoben oder neu geprüft. |

## Änderungen v0.17.14

- Sichtbare erklärende Klammerzusätze aus Formular- und Detailbeschriftungen der Abfüllungs- und Flaschenansicht entfernt, sowohl auf Deutsch als auch auf Englisch.
- Informationen, die echte Werte darstellen (beispielsweise Anzahl von Fotos), behalten ihre dynamischen Zähler.
- Zwei gezielte Tests schützen die geänderten deutschen und englischen Beschriftungen vor Regressionen.

**Abgrenzung:** Es wurden nur Übersetzungstexte und Tests für diese Darstellung geändert, keine gespeicherten Daten, Feldtypen oder Validierungsregeln.
