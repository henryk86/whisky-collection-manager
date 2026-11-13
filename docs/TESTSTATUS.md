# Teststatus - Whisky Collection Manager v0.16.14

**Stand:** 13.11.2026. **Basis:** v0.16.13, Korrektur der Kartenkamera nach dem Speichern einer Destillerieposition. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben und Release-Metadaten stimmen überein. |
| `npm run check` | **Bestanden** | 210 JavaScript-Dateien, 892 Übersetzungsschlüssel und 83 relative Links geprüft (vor finaler Dokumentationsprüfung). |
| `npm test` | **345/345 bestanden** | Vollständige Unit- und Integrationstests mit `--test-concurrency=4`; bestehende Funktionen ohne Regression. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Neuer Chromium-Regressionstest für Erhalt von Zoom, Zentrierung und Metadatenänderungen ergänzt; Playwright-Installation hier nicht abgeschlossen (Timeout). |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Raspberry Pi nach erfolgreichem Release prüfen. |

## Änderungen v0.16.14

- Der Karten-Viewer kann die aktuelle Kamera (Mittelpunkt und Zoomstufe) beim Neuzeichnen übernehmen, anstatt alle Standorte erneut einzupassen.
- Bei geänderten Destilleriekoordinaten wird ausschließlich zur aktualisierten Position geschwenkt, ohne die gewählte Zoomstufe zu verändern. Reine Status- und Namensänderungen lösen keine Neuzentrierung aus.
- Der Schalter „Alle Destillerien anzeigen“ führt weiterhin bewusst eine Neuberechnung des Kartenausschnitts aus; das Aufrufen der Karte aus einer Abfüllungsdetailseite behält seine gezielte Fokussierung.
- Browser-Regressionstest ergänzt; echte Chromium-Ausführung auf CI noch zu bestätigen. Anwendungsdaten, Importformat und Docker-Konfiguration unverändert.
