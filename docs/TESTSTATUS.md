# Teststatus - Whisky Collection Manager v0.16.10

**Stand:** 12.11.2026. **Basis:** Quellpaket v0.16.10 und separat gepflegte private Erweiterung v0.16.10. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben im öffentlichen Projekt stimmen überein. |
| `npm run check` | **Bestanden** | 209 JavaScript-Dateien, 892 referenzierte Übersetzungsschlüssel und 81 relative Links geprüft. |
| `npm test` (mit `--test-concurrency=4`) | **341/341 bestanden** | Öffentliche Unit- und Integrationstests, einschließlich Verbot älterer Importformate und entferntem HTML-Endpunkt. |
| Private Erweiterung: `npm test` | **30/30 bestanden** | Separates Projekt, Extraktion, Tab-Wiederverwendung und Bildtransfer mit simulierten Browserdaten. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Reale Browserinteraktion und Zusammenspiel mit Erweiterung offen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Ausführung auf Raspberry Pi nach CI-Release prüfen. |

Die öffentlichen Unit-/Integrationstests wurden mit `node --test --test-concurrency=4 tests/unit/*.test.js tests/integration/*.test.js` ausgeführt. Eine echte angemeldete Quellseite und der Browser-Erweiterungsablauf wurden hier nicht live geprüft.

## Änderungen v0.16.10

- Nur noch `#wcm-import=` mit Payload-Version 2 und `source: "external"` wird angenommen. Alte Fragmente und Payload-Version 1 werden nicht mehr verarbeitet.
- Alten HTML-Importparser samt API-Endpunkt und den dazugehörigen Unit-Tests entfernt; ein Integrationstest prüft den entfallenen Endpunkt.
- Öffentliches Repository ohne Erweiterungsdateien und ohne anbieterspezifische Anleitung.
- WB-ID und Quellenlink bleiben im Datenmodell, Formular und bereits gespeicherten Einträgen erhalten. Kein Datenbankschemawechsel.
- Die private Erweiterung wurde auf das neue Format umgestellt; beide Projekte müssen gemeinsam aktualisiert werden.
