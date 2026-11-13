# Teststatus - Whisky Collection Manager v0.17.12

**Stand:** 2026-11-13. **Status:** Node-Pruefungen erfolgreich; vollstaendige Browser- und Docker-Pruefungen offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsdaten 0.17.12 konsistent. |
| `npm run check` | **Bestanden** | 229 JavaScript-Dateien, 962 referenzierte i18n-Schluessel, 18 Markdown-Dateien. |
| `npm test` | **376/376 bestanden** | Unit- und Integrationstests; reine Namens-Abwesenheitstests wurden entfernt. |
| Reproduktion des CI-Fehlers | **Bestanden** | 0.17.10 mit 0.17.11 ueberschrieben: 231 JavaScript-Dateien und exakt der gemeldete fehlende Schluessel. Nach Entfernen der beiden alten Dateien: 229 Dateien und `npm run check` gruen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Chromium-Tests sind separat in CI zu pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

## Aenderungen v0.17.12

- Zwei beim Provider-Refactoring entfallene Quelldateien muessen bei bestehendem Git-Checkout geloescht und die Loeschungen committed werden; es fehlen keine Uebersetzungen in der aktuellen Importimplementierung.
- Fragile Tests, die lediglich das Nichtvorkommen von `Whiskybase` im Quelltext oder in der Dokumentation verlangen, entfernt. Positive Import- und API-Verhaltenstests bleiben erhalten.
- Upgrade-Hinweis samt konkretem `git rm`-Befehl in README dokumentiert.

Eine vollstaendige GitHub-Actions- und Browser-Abnahme von 0.17.12 steht noch aus.
