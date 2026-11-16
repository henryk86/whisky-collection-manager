# Teststatus - Whisky Collection Manager v0.28.9

**Stand:** 2026-11-16. **Status:** Unit-/Integrationstests und statische Pruefungen bestanden. Chromium-Browsertests konnten wegen fehlender npm-Abhaengigkeiten nicht gestartet werden; CI- und Zielsystempruefungen bleiben offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten fuer v0.28.9 konsistent. |
| `npm run check` | **Erfolgreich** | 301 JavaScript-Dateien einschliesslich View-Listener-Regel, Uebersetzungen und 177 relative Dokumentationslinks geprueft. |
| `npm test` | **562/562 bestanden** | Vollstaendige Unit-/Integrationstests einschliesslich der neuen Aktions- und Cache-Tests. |
| `npm run test:browser` | **Blockiert (nicht ausgefuehrt)** | `playwright-core` fehlt (`ERR_MODULE_NOT_FOUND`). `npm ci` konnte wegen fehlender Erreichbarkeit der npm-Registry nicht abgeschlossen werden. Der neue Verkostungs-DELETE-Regressionstest wurde daher nicht im Browser ausgefuehrt. |
| GitHub Actions / CI | **Nicht geprueft** | Pipeline-Lauf nach dem Push erforderlich; die v0.28.8-CI-Regression in `teststatus.test.js` ist lokal behoben. |
| Docker-Image / ARM64-Live-Test / iOS und Android | **Nicht lokal ausgefuehrt** | Zielplattformen sind hier nicht verfuegbar. |

## Aenderungen v0.28.9

- A-3: Aktionen liefern ausdrueckliche Erfolgs-/Fehlerergebnisse. Mutations- und Bestaetigungsaktionen verlassen betroffene Views nicht bei API-Fehlern; Erfolgsmeldungen und Modal-Schliessen erfolgen nach erfolgreichem Aktualisieren. Browser-Regressionstest fuer HTTP 500 beim Loeschen einer Verkostung hinzugefuegt.
- A-4: Statische Dateien erhalten ETag/Last-Modified und 304-Revalidierung. Unversionierte KI-Dateien sind nicht immutable; HTTP-Integrationstest ergaenzt.
- B-1.1: `scripts/check.js` erkennt neue direkte View-Eventlistener; bestehende Widget- und Modal-Ausnahmen bleiben explizit erfasst.
- CI-Teststatus: Die v0.28.8-Statusregex akzeptiert jetzt numerisch formulierte Browserergebnisse, ohne Tests mit fehlendem Browserlauf als bestanden auszugeben.

## Offene Punkte

- Die vollstaendige Browser-Suite muss in CI oder nach `npm ci` auf einer geeigneten lokalen Maschine ausgefuehrt werden; insbesondere der neue DELETE-Regressionstest sowie der frueher instabile Test fuer mehrfach datierte Verkostungen.
- B-1.2 bis B-6 bleiben getrennte Architekturaufgaben; keine Datenmigration oder Umstellung des Renderers in diesem Patch.
