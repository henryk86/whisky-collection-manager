# Teststatus - Whisky Collection Manager v0.17.9

**Stand:** 13.11.2026. **Basis:** v0.17.8; ausschließlich Fehlerkorrekturen im Fotoeditor und passende Regressionstests. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version in Paket, Lockfile, README, Changelog und Teststatus konsistent. |
| `npm run check` | **Bestanden** | 220 JavaScript-Dateien, 928 referenzierte Übersetzungsschlüssel, 98 relative Markdown-Links geprüft. |
| `npm test` | **366/366 bestanden** | Unit- und Integrationstests des ursprünglichen Funktionsumfangs. |
| Gezielte Chromium-Prüfung im lokalen DOM-Modus | **6/6 bestanden** | Fotoeditor-Layout, gespeicherte Freistellung und Umschalten, synchroner Originalvergleich, Maskenpinsel, reversible Bildkorrekturen, Weißabgleich. |
| ONNX-abhängige Browserregressionen (Tests 50 und 51) | **2/2 bestanden unter angepasstem Testaufbau** | Separater Validierungsklon mit synthetischem ONNX-Modul und für die lokale Sandbox korrigierter Import-URL; die Hilfsänderung ist **nicht** Teil des Releases. |
| Vollständiges `npm run test:browser` im normalen Navigationsmodus | **Nicht lokal ausgeführt** | Chromium blockiert hier `http://127.0.0.1` mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Vollständige GitHub-CI-Prüfung steht aus. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Prüfung auf dem Zielsystem offen. |

## Änderungen v0.17.9

- Vorher/Nachher zeichnet das ursprüngliche, vollständig deckende Foto vor dem Umschalten des UI-Zustands. Dadurch bleibt nicht kurzzeitig die transparente Freistellung sichtbar.
- Bereits gespeicherte Original- und Freistellungsbilder werden beim Öffnen des Editors vorgeladen; der Vorschauwechsel erfolgt ohne asynchrones Nachladen.
- Browser-Test zum Entfernen einer Freistellung prüft weiterhin vorhandene Originalkorrekturen statt fälschlich das uneditierte Originalbild zu erwarten.
- Regressionstest zur unmittelbar vollständigen Originalvorschau ergänzt; Slider-Test vergleicht numerische Werte statt browserabhängiger Zeichenfolgen.

**Keine Etikettenerkennung / OCR:** Ausgangspunkt ist ausdrücklich das Archiv v0.17.8. Die in v0.18.0 eingeführten Funktionen sind nicht enthalten.
