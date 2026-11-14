# Teststatus - Whisky Collection Manager v0.23.6

**Stand:** 2026-11-14. **Status:** Node-Tests und gezielte Browserpruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.23.6 konsistent. |
| `npm run check` | **Bestanden** | JavaScript-Syntax, Uebersetzungen und Dokumentationslinks geprueft. |
| `npm test` | **487/487 bestanden** | Alle Node-Unit- und Integrationstests. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige HTTP-Browser-Suite einschliesslich echtem Zurueck-/Vorwaerts-Navigieren in GitHub Actions pruefen. |
| Gezielte Chromium-DOM-Tests | **4/4 bestanden** | Destillerienverwaltung, mobile Einstellungen, alle Destillerien samt Pagoden und Karten-Kameraerhalt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach dem Release auf dem Zielsystem pruefen. |

## Aenderungen v0.23.6

- Browser-Tests oeffnen vor dem Importdialog und der Destillerienverwaltung die dafuer vorgesehenen Einstellungsbereiche (Desktop-Seitenmenue oder mobiler Bereichswaehler).
- Destillerien-Test prueft nun die explizit gewollte vollstaendige Liste ohne eigenen Scrollbereich statt der alten Hoehenbegrenzung.
- Kartentest prueft den unveraenderten Zoom beim Ein-/Ausschalten und verwendet erst danach ausdruecklich "Alle Standorte anzeigen" fuer den Weltkartenausschnitt.
- Kartenfehler behoben: Beim Wechsel des Destillerien-Anzeigemodus werden die Pagoden-Marker ohne erneuten Kartenaufbau aktualisiert.

**Grenze:** Der HTTP-basierte Test fuer echte Browser-History und die komplette GitHub-Actions-Browsersuite konnten in der lokalen, auf DOM-Zugriff beschraenkten Umgebung nicht ausgefuehrt werden. Die Korrektur dieses History-Tests wurde im Quellcode und anhand der gemeinsamen Einstellungsnavigation kontrolliert, nicht in einem vollstaendigen realen Navigationslauf.
