# Technische Schulden und offene Abnahmen

**Aktueller Stand:** Die Fehler- und Architekturpunkte des Reviews v0.28.6 wurden im aktuellen Entwicklungsstand bearbeitet. Diese Datei ist eine Bestandsaufnahme **offener Restrisiken**, keine zweite Release-Chronik. Einzelne historische Entscheidungen und ihre Versionsnummern stehen im [Changelog](../CHANGELOG.md). Verbindliche Testresultate stehen in [TESTSTATUS.md](TESTSTATUS.md).

## Urspruengliches Code-Review

| Befund | Umgesetzte Gegenmassnahme | Noch zu beachten |
| --- | --- | --- |
| A-1 Mehrfachuploads | Upload-Ereignisse zentral delegiert, Browser-Regression | Weitere neue Widgets duerfen keine Listener bei jeder Aktualisierung stapeln |
| A-2 Browser-Fehlschlaege | Browser-Fixtures und visuelle Regressionen korrigiert | Je Release vollstaendige GitHub-CI-Browser-Suite erforderlich |
| A-3 Verschluckte Fehler | Explizite Aktionsergebnisse, erfolgreiche Navigation nur nach bestaetigter Mutation | Fehler- und Retry-Pfade testen |
| A-4 Cache statischer Assets | HTTP-ETags, Last-Modified, 304 | Grosse Modellassets ohne stabilen Hashpfad bleiben revalidierungspflichtig |
| B-1 Uneinheitliches Rendering | Gemeinsamer DOM-Abgleich fuer Views, delegierte normale Ereignisse, Widget-Islands mit explizitem Neuaufbau | Karten-, Lager-, 3D- und Drag-Widgets brauchen ihre getrennten Browser-/Lebenszyklustests |
| B-2 Teure Datenabrufe | Validierte Store-Caches, HTTP-ETags, revisionsgebundene API-Mutationsdeltas und sicherer GET-Fallback | Mehrprozessschreiber sind nicht vorgesehen; grosse Bestandsdaten weiterhin auf Zielhardware messen |
| B-3 Alte Schemagenerationen | Schema 5, Originalbackup, Erhalt von Sammlung und Lager, nur alte Verkostungsdaten verfallen | Aeltere Clients duerfen neue Dateien nicht oeffnen |
| B-4 Server-Frontend-Abhaengigkeit | Gemeinsame DOM-freie `shared/`-Module und Importgrenzen in `npm run check` | Neue Shared-Module nur nach browserseitiger Freigabe ausliefern |
| B-5 Fragile Quelltexttests | Fachlich getrennte Browser-Suites, Verhaltenstests fuer DOM, Cache, Schema, Upgrade und berechnete Styles; Verbot neuer Regex-Quelltextassertions | Vorhandene Regex-Altpruefungen bleiben zunaechst als Bestand unter einem nur noch sinkenden Budget; sie ersetzen keine Browserabnahme |
| B-6 Releases und Altdateien | Kompakte Testhistorie, aktuelle Fachdokumentation, SHA-256-Quellmanifest und nichtdestruktive Upgrade-Audits | Versionsfreigabe erst nach gruenem CI-Lauf; Docker/Pi separat pruefen |

## Unabhaengige verbleibende Risiken

- **Browser-Abnahme:** Chromium-DOM-Modus prueft reale Module und API-Interaktionen, aber nicht History-Verhalten mit HTTP-Seitennavigation. GitHub Actions muss fuer den konkreten Commit gruen sein; WebGL und echte iOS-/Android-Geraete benoetigen eigene Abnahme.
- **Legacy-Regex-Tests:** Bestehende CSS-/Quelltext-Assertions stammen aus fruehen Versionen und pruefen teilweise Implementierungsdetails. `scripts/source-regex-budgets.json` und `scripts/check.js` verhindern neue bzw. zusaetzliche solche Assertions. Der verbleibende Bestand kann jeweils nur mit gleichwertigen Verhaltenstests reduziert werden, nicht durch blindes Loeschen.
- **Widget-Lebenszyklen:** Direkte Listener fuer kurzfristige SVG-, 3D-, Drag- und Dialoginteraktion sind bewusst isoliert und in `scripts/check.js` mengenmaessig begrenzt. Bei jeder Aenderung dieser Komponenten ist ein gezielter Browser-Test erforderlich.
- **Speichern ueber zwei JSON-Dateien:** Sammlung und Lager haben unabhaengige atomare Schreibwarteschlangen, aber keine gemeinsame Dateisystemtransaktion. Das Restore-Verfahren muss beide Dateien und Medien konsistent handhaben.
- **Sicherheit und Betrieb:** Keine oeffentliche Benutzeranmeldung, daher nur in vertrauenswuerdigen Netzen oder hinter expliziter Zugriffskontrolle betreiben. ARM64-, HTTPS-, WebGL- und Restore-Live-Abnahmen sind von CI-Unit-Tests getrennt.

## Verbindliche Freigabekette

1. `npm run check` und `npm test` einschliesslich Datenmigration und Backup-Restore.
2. `npm run release:check` einschliesslich Source-Manifest und Dateiversion.
3. `npm run test:browser` komplett mit echter Navigation in GitHub Actions, fuer **diesen** Commit.
4. Release-ZIP und Upgrade-Audit pruefen; Nutzdaten duerfen niemals in einem Quellcode-ZIP enthalten sein.
5. Pi-/Docker-/Mobilgeraete-Ergebnisse im [Teststatus](TESTSTATUS.md) gesondert dokumentieren.
