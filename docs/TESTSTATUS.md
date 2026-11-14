# Teststatus - Whisky Collection Manager v0.17.15

**Stand:** 2026-11-14. **Status:** Node-Unit-/Integrationstests, Versions- und statische Pruefungen erfolgreich. Browser-, Windows- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten fuer 0.17.15 konsistent. |
| `npm run check` | **Bestanden** | Node-Syntax, Imports, Test-Fixtures, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **386/386 bestanden** | Vollstaendige lokale Unit-/Integrationssuite inklusive sieben Start-Unit-Tests und einem realen `npm start`-Prozess-Smoke-Test in einer isolierten Testinstallation. |
| Start-Prozess-Smoke-Test | **Bestanden** | Ruft wirklich `npm start` auf; prueft Vorbereitung vor Serverstart ohne Netzwerkbedarf durch ersetzte Modellvorbereitung und einen Testserver. |
| Echte Erstinstallation (`npm ci` + ONNX-/WASM-Download + TLS-Erstellung) | **Nicht lokal ausgefuehrt** | Ohne Netz-/Systemvoraussetzungen hier nicht vollstaendig end-to-end getestet; Ablauf und Fehlerfaelle in Unit-Tests geprueft. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Chromium-Suite fuer diese Version nicht ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Docker-Entrypoint bleibt unveraendert, Build nicht erneut getestet. |
| Windows-PowerShell-Starttest | **Nicht lokal ausgeführt** | Verhalten unter nativem Windows nicht verifiziert; plattformunabhaengiger Node-Starter und Batch-Aufruf vorhanden. |

## Aenderungen v0.17.15

- `npm start` startet nun `scripts/start.js`: fehlende/veraltete npm-Abhaengigkeiten ueber `npm ci` einrichten; Cutout-Assets pruefen und bei Bedarf herunterladen; `.env` bei lokalem Erststart anlegen; bei fehlenden Standardzertifikaten lokale HTTPS-Einrichtung starten; anschliessend Server ausfuehren.
- Vorhandene Installationen und Zertifikate bleiben erhalten. Bei Fehlern in der Vorbereitung startet der Server nicht unvollstaendig.
- `start-unix.sh` und `start-windows.bat` verwenden denselben Startablauf. Der Docker-Entrypoint und sein Buildzeit-Installationsprozess bleiben unveraendert.
- Neue Regressionstests pruefen Reihenfolge, notwendige/skippbare Installationen, Produktionsmodus, TLS-Konfiguration und Fehlerabbruch sowie den realen Prozessaufruf.

**Hinweis:** Die lokale Erstinstallation und der echte Download aller ONNX-Dateien wurden hier nicht mit realem Netzwerkzugriff ausgefuehrt. Ein erfolgreicher Modell-Download, Windows-Start und Browserlauf sind damit nicht zugesichert.
