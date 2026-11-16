# Teststatus - Whisky Collection Manager v0.28.0

**Stand:** 2026-11-15. **Status:** Unit- und Integrationstests erfolgreich; gezielte Chromium-Tests erfolgreich. Vollständiger Browser-Gesamtlauf nicht abgeschlossen. Historische Berichte: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version 0.28.0 in den Release-Metadaten. |
| `npm run check` | **Bestanden** | Syntax/Importe, Übersetzungen und Markdown-Links. |
| `npm test` | **551/551 bestanden** | Enthält sechs gezielte neue Unit-/Integrationstests für Flight-Modell, Exklusivität, Anlegen, Sortieren, Löschen und Navigation. |
| `npm run test:browser` | **Nicht abgeschlossen** | Vollständiger lokaler DOM-Modus-Lauf nach 27 protokollierten Browserfällen (26 bestanden, 1 übersprungen) ohne Testergebnis wegen Timeouts beendet. Nicht als bestanden gewertet. |
| `tests/browser/app.test.js` (gezielt) | **2/2 bestanden** | Chromium: Flight anlegen, vorhandene eigene Notiz anhängen, neue externe Notiz atomar anlegen, Reihenfolge ändern; mobile Liste und Flight bei 390 und 320 px ohne horizontalen Überlauf. |
| Echter iOS Safari / Android / Docker ARM64 | **Nicht lokal ausgeführt** | Prüfen auf realen Zielgeräten. |

## Aenderungen v0.28.0

- Optionale Tasting-Flights: Name, Datum, gemeinsame Notiz und geordnete Verkostungs-IDs.
- Eine Verkostungsnotiz darf maximal einem Flight angehören; Server validiert dies atomar.
- Bereits vorhandene und neue eigene/externe Verkostungen können in einen Flight aufgenommen werden.
- Eine spätere externe Zuordnung zur Sammlung behält den Flight-Eintrag und seine Position.
- Beim Löschen des Flights werden die Einzelverkostungen nicht gelöscht; beim Löschen der Verkostung wird nur die Flight-Referenz bereinigt.
- Mobile Verkostungslisten: Titel und Bewertung auf getrennten Zeilen, damit kurze Titel nicht mehr gebrochen werden.

## Grenzen

Die visuelle Darstellung wurde mit Chromium bei Desktop- und Mobilbreite geprüft. Die vollständige Browsertestsuite hat in dieser Umgebung nach Test 27 nicht abgeschlossen. Daraus wird kein Erfolg der restlichen Testfälle abgeleitet.
