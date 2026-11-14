# Teststatus - Whisky Collection Manager v0.19.15

**Stand:** 2026-11-14. Node-Pruefungen und gezielte Chromium-DOM-Tests erfolgreich. Historische Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.15. |
| `npm run check` | **Bestanden** | JavaScript-Syntax/Importe, Uebersetzungsschluessel und Dokumentationslinks geprueft. |
| `npm test` | **460/460 bestanden** | Vollstaendige Unit- und Integrationstests. |
| Gezielte Chromium-Tests (DOM-Modus) | **3/3 bestanden** | Die drei zuvor in GitHub Actions gescheiterten Browser-Testfaelle (Raumplan/Three.js, Fachuebersicht/Modal, Moebelwerkzeuge) bestehen zusammen bei Ausfuehrung mit `WHISKY_BROWSER_DOM_ONLY=true` und lokalem Chromium. Verwendet wurde die lokal verfuegbare Playwright-Laufzeit, nicht das in package-lock.json festgelegte Paket. |
| `npm run test:browser` (normaler Lauf) | **Nicht abgeschlossen** | Direkte Browser-Navigation auf `127.0.0.1` wird hier mit `ERR_BLOCKED_BY_ADMINISTRATOR` abgelehnt. GitHub-Actions-Lauf mit realer Navigation separat pruefen. |
| Vollstaendige Browser-Suite / Docker / ARM64 | **Nicht ausgefuehrt** | Auf CI- beziehungsweise Zielsystem separat pruefen. |

## Aenderungen v0.19.15

- 3D-Raumplan-Browsertest an den aktuellen Wechsel zu `Regale & Faecher` angepasst. Testmoebel erhalten ein Fach, damit sie in der Regalwand sichtbar sind.
- Modal-Browsertest waehlt eindeutig den Schliessen-Button in der Dialog-Kopfzeile statt auch `Abbrechen` zu treffen. Inerte Flaschenbilder werden mit einem echten Mauszeiger-Klick auf die Bildflaeche geprueft.
- Mehrfachbearbeitungs-Browsertest prueft vier Aktionen im separaten Moebelverwaltungsmodal statt im Reiter `Raumplaene`. Der eigentliche Raumplan bleibt frei von diesen Aktionen.
- Keine Aenderung der Anwendungslogik oder der bisherigen Flaschen- und Fachklicks.

**Offen:** Erneuter GitHub-Actions-Browserlauf mit normaler Navigation, komplette Browser-Suite und reale mobile Endgeraete.
