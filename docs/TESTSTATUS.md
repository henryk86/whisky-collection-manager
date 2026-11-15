# Teststatus - Whisky Collection Manager v0.27.12

**Stand:** 2026-11-15. **Status:** Node- und Chromium-Pruefungen erfolgreich. Browser-History ausserhalb des DOM-Testmodus, iOS Safari und Docker/ARM64 bleiben separat zu pruefen. Aeltere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten stimmen fuer v0.27.12 ueberein. |
| `npm run check` | **Erfolgreich** | Syntax, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **545/545 bestanden** | Unit- und Integrationstests vollstaendig abgeschlossen. |
| `npm run test:browser` | **Bestanden (76/77)** | Chromium im DOM-Testmodus: 76 erfolgreich, 0 fehlgeschlagen, 1 uebersprungen (echte Browser-History). |
| iOS Safari / Android | **Nicht lokal ausgeführt** | Manuelle Endgeraetepruefung ausstehend. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem ausstehend. |

## Aenderungen v0.27.12

- Fehlenden `toast`-Import in der Abfuellungsdetailansicht korrigiert. Dokumente und Fotos laden nach dem Speichern wieder korrekt in die aktualisierte Ansicht.
- Foto-Sortierung im Browsertest erst nach dem Scrollen der Galerie in den sichtbaren Bereich simuliert.
- Tests fuer den sechsten Schnellfilter, den Abschnitt `Eindruecke`, eindeutig benannte Modalschaltflaechen und den Abschluss asynchroner Loeschvorgaenge aktualisiert.
- In der DOM-Browser-Testumgebung haben spezifische Mock-Routen fuer den Freistellungsdienst Vorrang vor der allgemeinen Request-Weiterleitung.

## Grenzen

- Der Chromium-Lauf verwendete `WHISKY_BROWSER_DOM_ONLY=true`, weil der direkte Aufruf lokaler Browser-URLs in dieser Umgebung blockiert ist. Der explizit uebersprungene Test fuer Browser-History wird in diesem Modus nicht ausgefuehrt.
- Die beiden vorher fehlgeschlagenen KI-Mock-Tests wurden nach Korrektur des Routing-Verhaltens erneut erfolgreich ausgefuehrt und sind Teil der obigen 76 Browser-Pruefungen.
