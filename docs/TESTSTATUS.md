# Teststatus - Whisky Collection Manager v0.28.8

**Stand:** 2026-11-16. **Status:** Unit-/Integrationstests und Chromium-Browsersuite im DOM-Modus erfolgreich; echte HTTP-Browsernavigation, GitHub-CI und Zielsystempruefungen offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Versionsmetadaten fuer v0.28.8 konsistent. |
| `npm run check` | **Erfolgreich** | 298 JavaScript-Dateien, Uebersetzungen und 176 relative Markdown-Links geprueft. |
| `npm test` | **558/558 bestanden** | Vollstaendige Unit-/Integrationstests einschliesslich Testserver-Isolation. |
| `npm run test:browser` | **80 bestanden, 0 fehlgeschlagen, 1 uebersprungen** | Chromium 144, DOM-Modus. Die Browser-History-Pruefung ist im DOM-Modus nicht ausfuehrbar. |
| Gezielte Upload-, Sample-, Scroll-, Help- und Flight-Browsertests | **5/5 bestanden** | Upload-Regressionsfall mit mehrfachem Re-Render und exakt je einem gespeicherten Bild/Beleg. |
| Browser-Navigation ueber echten HTTP-Seitenaufruf | **Umgebungsbedingt nicht ausgefuehrt** | Chromium blockiert die lokale Navigation mit `ERR_BLOCKED_BY_ADMINISTRATOR`; DOM-Modus nutzt echte ES-Module und HTTP-Requests ueber die Test-Weiterleitung. |
| GitHub Actions / vollstaendige CI-Pruefung | **Ausstehend** | Auf GitHub nach dem Push verifizieren. |
| Docker-Image / ARM64-Live-Test und echte Mobilgeraete | **Nicht lokal ausgefuehrt** | Auf dem Zielsystem pruefen. |

## Aenderungen v0.28.8

- Upload-Events fuer Fotos und Dokumente physischer Flaschen zentral delegiert statt bei jedem Rendern neu gebunden; dadurch keine mehrfach gespeicherten Uploads nach teilweiser DOM-Aktualisierung.
- Browser-Regressionstests fuer geaenderte Flaschenkarten, Scroll-Clamping am Seitenende, verzogerte Reloads und neue Hilfethemen berichtigt; neuer Browser-Regressionstest fuer doppelte Uploads.
- Flight-Validierung zaehlt Verkostungsreferenzen einmalig per Map; leere Bewertungsanzeigen halten ihre Rasterspalte ein.

## Offene Punkte aus dem Code-Review

- Fehlerbehandlung in `action()` (A-3), Cache-Revalidierung statischer Dateien (A-4) und umfassende Rendering-/Daten-/Schema-/Testarchitektur (B-1 bis B-6) sind **nicht** Bestandteil dieses Patch-Releases; siehe [TECHNISCHE_SCHULDEN.md](TECHNISCHE_SCHULDEN.md).
- Ein gelegentlich instabiler Browsertest fuer mehrfach datierte Verkostungen wurde im Gesamtlauf bestanden, ist jedoch noch nicht durch wiederholte Laeufe entflakt.
