# Teststatus - Whisky Collection Manager v0.20.0

**Stand:** 2026-11-14. Pruefungen der Quellcode-Aenderungen abgeschlossen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten auf v0.20.0 konsistent. |
| `npm run check` | **Bestanden** | 256 JavaScript-Dateien, 1015 i18n-Referenzen und 19 Markdown-Dateien mit 129 relativen Links geprueft. |
| `npm test` | **468/468 bestanden** | Unit- und Integrationstests, darunter 6 neue Offline-Release-Tests. |
| `node --test tests/unit/offline-release.test.js` | **6/6 bestanden** | SHA-256-Versiegelung, fehlende/manipulierte Assets, Symlinkschutz, ausschliesslich lokale Installation und Release-Workflow-Verknuepfung. |
| `sh -n deploy/save-offline-release.sh` und Kopiertest | **Bestanden** | SHA-256-Verifikation vor/nach Kopie, Wiederholung ohne Ueberschreiben und Ablehnung einer manipulierten Zieldatei. |
| YAML-Syntax | **Bestanden** | Release-Workflow mit Ruby YAML-Parser geladen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Keine Browser-/WebGL-Abnahme fuer v0.20.0. |
| Offline-Bundle mit echten npm-/ONNX-Dateien | **Nicht lokal ausfuehrbar** | Paketserver/Modellhosting nicht erreichbar. Vollstaendiger Neuinstallationstest mit `npm_config_offline=true` ist im Release-Workflow hinterlegt, aber noch nicht in GitHub Actions ausgefuehrt. |
| Docker-Image-Export ARM64/AMD64 und `docker load` | **Nicht lokal ausfuehrbar** | Docker Engine in der Testumgebung nicht vorhanden; automatisierte Tests im GitHub-Release-Workflow hinterlegt, aber noch nicht ausgefuehrt. |
| Raspberry-Pi-Live-Test und USB/NAS-Laufwerk | **Nicht ausgefuehrt** | Vor der produktiven Verwendung auf dem Zielsystem pruefen. |

## Aenderungen v0.20.0

- GitHub-Releases erzeugen kuenftig ein Offline-Installations-ZIP mit allen npm-Abhaengigkeiten, KI-Modell, ONNX/WASM-Laufzeit, Lizenzen und SHA-256-Manifest.
- Offline-Start validiert das Archiv, installiert fehlende Pakete mit `npm ci --offline` aus einer temporaeren Cache-Kopie und verzichtet auf Downloadversuche.
- Separate ARM64- und AMD64-Docker-Archive mit `docker save` und Offline-Import-/Startpruefung im Release-Workflow.
- Verifizierte, getrennte Archivierung der Release-Dateien auf USB/NAS-Zielen neben den verschluesselten Datenbackups.
- Anleitung: [OFFLINE_RELEASES.md](OFFLINE_RELEASES.md).

**Offen:** GitHub-Actions-Release-Build und echte Wiederherstellung aus den dort erzeugten Offline-Artefakten; Pi- und Mobil-/Browser-Abnahme.
