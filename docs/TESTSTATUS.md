# Teststatus - Whisky Collection Manager v1.2.1

**Stand:** 2026-11-16. **Status:** Vollstaendige Node-Pruefungen und Chromium-DOM-Browsersuite bestanden. Der reguläre GitHub-Actions-Browserlauf mit echter HTTP-Navigation fuer v1.2.1 ist noch offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Version, Metadaten und Dokumentation v1.2.1 konsistent. |
| `npm run check` | **Erfolgreich** | JavaScript-Syntax, Importgrenzen, i18n-Referenzen und Markdown-Links. |
| `npm test` | **568/568 bestanden** | Vollstaendige Unit- und Integrationstests. |
| `npm run test:browser` | **85 bestanden, 0 fehlgeschlagen, 1 uebersprungen** | Chromium 144 im DOM-Modus (`WHISKY_BROWSER_DOM_ONLY=true`), Playwright-Laufzeit v1.57 statt angepinnter npm-Version v1.65. Browser-History mit echter Seitennavigation wird in diesem Modus nicht geprueft. |
| Gezielter Regressionstest fuer mehrere datierte Verkostungen | **Bestanden** | Der bisher fehlschlagende Browserfall ist gruen; die Anzahl der Listeneintraege wird nach deren Erscheinen verifiziert. |
| Verzögerter Verkostungs-POST | **Bestanden** | Kontrollierter noch offener POST: Ruecknavigation und Speichern sind gesperrt; danach sind beide Eintraege im DOM und auf dem Server vorhanden. Der Test schlug vor dem Fix gegen v1.2.0 fehl. |
| Verkostungs-POST mit HTTP 500 und anschliessendem Retry | **Bestanden** | Eingaben bleiben erhalten, Bedienelemente werden wieder freigegeben, erneutes Speichern erzeugt genau eine Verkostung. |
| GitHub Actions / CI fuer v1.2.1 | **Ausstehend** | Regulare Browser-Suite mit echter Navigation und angepinnter Playwright-Version vor Merge nach main erforderlich. Der vorherige CI-Lauf fuer v1.2.0 hatte den Verkostungs-Regressionsfehler gemeldet. |
| Docker / ARM64 / echte mobile Endgeraete | **Nicht lokal ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

## Aenderungen v1.2.1

- Asynchrones Anlegen einer Verkostung sperrt bis zum Ende von POST und Sammlungs-Refresh die Entwurfsbedienelemente und Ruecknavigation; doppelte Speichervorgaenge werden verhindert.
- Bei fehlgeschlagenem Speichern bleibt der Entwurf mit seinen Eingaben erhalten. Spaete Antworten duerfen zwischenzeitliche Navigation nicht ueberschreiben.
- Zwei neue Browser-Regressionstests fuer verzögerte/fehlgeschlagene Speichervorgaenge; im bestehenden Chronologie-Test wird auf den zweiten DOM-Eintrag gewartet.
- Keine Aenderung an Schema 5, Bestandsdaten, Lager, Backups oder Migration.

## Offene Review-Punkte

B-1 (weitere Widget-Ansichten), B-2 (inkrementelle Mutationsantworten), B-5 (weitere Regex-Tests) und B-6 (historische Dokumentation) bleiben unveraendert offen. **Keine Merge-Freigabe ohne gruene GitHub-CI-Browsersuite fuer v1.2.1.**
