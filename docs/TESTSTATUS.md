# Teststatus - Whisky Collection Manager v1.0.0

**Stand:** 2026-11-16. **Status:** Node-Unit-/Integrationstests und statische Pruefungen bestanden. Die vollstaendige Browserpruefung ist **nicht abgenommen**, weil `playwright-core` hier nicht installiert ist und der npm-Paketbezug in dieser Umgebung nicht moeglich war. CI, Docker/ARM64 und echte Mobilbrowser sind offen. Aeltere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Metadaten v1.0.0 konsistent. |
| `npm run check` | **Erfolgreich** | Syntax, Modulgrenzen, direkte View-Listener, i18n und Markdown-Links. |
| `npm test` | **557/557 bestanden** | Vollstaendige Node-Unit-/Integrationstests; neue ETag-, Cache-, Shared-Modul- und Schema-5-Tests enthalten. |
| `npm run test:browser` | **Blockiert (nicht ausgefuehrt)** | Start aller sechs Browsertestdateien mit `ERR_MODULE_NOT_FOUND` (`playwright-core`) abgebrochen. Kein Funktionstest im Browser moeglich. |
| GitHub Actions / CI | **Nicht geprueft** | Nach Push separat ausfuehren und Browserergebnisse bestaetigen. |
| Docker-Image / ARM64-Live-Test / iOS und Android | **Nicht lokal ausgefuehrt** | Deployment und Mobil-UI auf Zielplattformen pruefen. |

## Aenderungen v1.0.0

- **B-4:** Browser- und Server-Fachlogik in `shared/` zusammengefuehrt, Browserzugriff auf explizit freigegebene Dateien begrenzt; `scripts/check.js` kontrolliert die Abhaengigkeitsrichtung. Foto-Adjustment-Validierung unabhaengig vom UI-Lokalisierungscode.
- **B-2:** Validierte Sammlung und Lager im Arbeitsspeicher gehalten; Rueckgabe eigenstaendiger Datenkopien, automatische Neuvalidierung nach Dateiersatz sowie Invalidation nach Mutation und Restore. API-Revalidierung mit ETag, If-None-Match und HTTP 304.
- **B-1:** Generischer DOM-Regionenabgleich auf der Detailseite statt `outerHTML`-Sonderabgleich. Weitere Hauptseiten bleiben vorerst beim vollstaendigen DOM-Ersatz.
- **B-3:** Bewusster inkompatibler Schnitt auf Schema 5 **ohne Migration**. Verkostungsdaten werden nur in `bottlings[].tastings[]` gehalten; altes `legacyTastings` und abgeleitete persistierte Bewertungsfelder entfallen. Bestehende Schema-4-Spieldaten und das zugehoerige Lager werden archiviert und danach durch leere Schema-5-Daten ersetzt; alte JSON-Importe werden abgewiesen.
- **B-5:** Browser-Tests in sechs Fachbereiche mit gemeinsamem Helper aufgeteilt; Cache-/Schema-Verhalten mit neuen HTTP-Integrationstests abgesichert. Der systematische Ersatz aller alten Quelltext-Regex-Tests ist noch offen.

## Offene Abnahme

Die komplette Browser-Suite muss nach Installation der Abhaengigkeiten mit echter HTTP-Navigation in GitHub Actions oder lokal ausgefuehrt werden. Insbesondere Foto- und Sortierverhalten, Erhalt der Scrollposition und Formulardaten sowie der generische DOM-Abgleich sind noch nicht im Browser bestaetigt. Bei roten CI-Tests darf diese Version nicht ungeprueft als produktiv freigegeben werden.
