# Teststatus - Whisky Collection Manager v0.16.12

**Stand:** 13.11.2026. **Basis:** v0.16.11 mit automatischer Synchronisierung des Teststatus beim Versionssprung auf 0.16.12; Anwendungscode, Abhaengigkeiten und Docker-Konfiguration sind unveraendert. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben im öffentlichen Projekt stimmen überein. |
| `npm run check` | **Bestanden** | 209 JavaScript-Dateien, 892 referenzierte Übersetzungsschlüssel und 81 relative Links geprüft. |
| `npm test` (mit `--test-concurrency=4`) | **343/343 bestanden** | Öffentliche Unit- und Integrationstests, einschließlich Verbot älterer Importformate und entferntem HTML-Endpunkt. |
| Private Erweiterung: `npm test` | **Nicht erneut ausgefuehrt** | Separates privates Projekt; nicht Bestandteil dieses Quellpakets. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Reale Browserinteraktion und Zusammenspiel mit Erweiterung offen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Ausführung auf Raspberry Pi nach CI-Release prüfen. |

Die öffentlichen Unit-/Integrationstests wurden mit `node --test --test-concurrency=4 tests/unit/*.test.js tests/integration/*.test.js` ausgeführt. Eine echte angemeldete Quellseite und der Browser-Erweiterungsablauf wurden hier nicht live geprüft.

## Änderungen v0.16.12

- Release-Metadaten auf 0.16.12 fortgeschrieben; das Bump-Skript aktualisiert nun auch den Teststatus und archiviert vorherige Pruefberichte.
- release:check validiert jetzt die Teststatus-Version; die neuen Regressionstests verhindern erneute CI-Ausfaelle durch einen veralteten Teststatus. Kein Eingriff in Programmfunktionen, Importprotokoll oder Deployment.
- Ein fehlender Remote-Branch `develop` wird nicht durch dieses ZIP angelegt und muss auf GitHub separat eingerichtet werden.

## Historische Änderungen v0.16.11

- Dependabot-Abhaengigkeit `playwright-core` von 1.64.1 auf 1.65.0 aktualisiert; `package-lock.json` enthaelt die passende Archiv-URL und Integritaetspruefsumme.
- Zwei Tests fuer Docker- und Release-Workflow lesen die exakte `playwright-core`-Version aus `package.json` und verifizieren die Uebereinstimmung mit dem Lockfile. Dadurch scheitert CI nicht mehr durch legitime Dependabot-Updates.
- Sonstige Anwendungslogik, Datenformate, Importprotokoll und Deployment-Konfiguration bleiben unveraendert.

## Unveraenderte Funktionen aus v0.16.10

- Nur noch `#wcm-import=` mit Payload-Version 2 und `source: "external"` wird angenommen. Alte Fragmente und Payload-Version 1 werden nicht mehr verarbeitet.
- Alten HTML-Importparser samt API-Endpunkt und den dazugehörigen Unit-Tests entfernt; ein Integrationstest prüft den entfallenen Endpunkt.
- Öffentliches Repository ohne Erweiterungsdateien und ohne anbieterspezifische Anleitung.
- WB-ID und Quellenlink bleiben im Datenmodell, Formular und bereits gespeicherten Einträgen erhalten. Kein Datenbankschemawechsel.
- Die private Erweiterung wurde auf das neue Format umgestellt; beide Projekte müssen gemeinsam aktualisiert werden.
