# Teststatus - Whisky Collection Manager v0.17.13

**Stand:** 2026-11-13. **Status:** Node-Pruefungen erfolgreich, Browser- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.17.13 konsistent. |
| `npm run check` | **Bestanden** | 229 JavaScript-Dateien, 962 i18n-Referenzen, 18 Markdown-Dateien und 2 referenzierte Testbilddateien vorhanden. |
| Negativprobe ohne Testbild | **Bestanden** | Beim kurzzeitigen Entfernen der neuen Referenz-PNG meldet `scripts/check.js` den genauen fehlenden Dateipfad; nach Wiederherstellung gruener Check. |
| `npm test` | **376/376 bestanden** | Vollstaendiger Unit- und Integrationstestlauf. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Playwright-Abhaengigkeiten sind lokal nicht verfuegbar; `npm ci --offline` scheitert am fehlenden npm-Cache. Die 59 Chromium-Tests muessen in GitHub Actions laufen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem pruefen. |

## Aenderungen v0.17.13

- Die bisher vorhandene 120x180-PNG `tests/fixtures/photo-wb-reference.png` wurde ohne Inhaltsaenderung nach `tests/fixtures/photo-import-reference.png` umbenannt. Alle fuenf fehlerhaften Browserfaelle verwenden nun eine existierende Datei.
- `npm run check` prueft relative `../fixtures/`-Referenzen in Tests, bevor CI die Browser-Suite startet. Keine Browser-Tests entfernt und keine Produktivfunktionen veraendert.

**Hinweis:** Ein erfolgreicher Node-Testlauf und die Fixture-Pruefung bestaetigen nicht die erfolgreiche Ausfuehrung der Browser-Tests. Der vollstaendige CI-Browserlauf bleibt ausstehend.
