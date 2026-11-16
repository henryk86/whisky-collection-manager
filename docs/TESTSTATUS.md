# Teststatus - Whisky Collection Manager v1.3.0

**Stand:** 2026-11-16. **Status:** Vollstaendige Node- und lokale Chromium-DOM-Browsersuite fuer v1.3.0 erfolgreich; GitHub-CI mit echter Seitennavigation sowie ARM64-/Mobilgeraetepruefungen noch offen. Historische Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Version v1.3.0 samt SHA-256-Quellmanifest konsistent. |
| `npm run check` | **Erfolgreich** | Syntax, Imports, i18n, Markdown-Links, Widget-Listener und Quelltexttest-Budget geprueft. |
| `npm test` | **572/572 bestanden** | Vollstaendige Node-Unit-/Integrationstests einschliesslich Mutationsdeltas und ZIP-Upgrade-Datenschutz. |
| `npm run test:browser` | **91 bestanden, 0 fehlgeschlagen, 1 uebersprungen** | Chromium-DOM-Modus, seriell; der History-Fall benoetigt echte HTTP-Seitennavigation. |
| GitHub Actions / CI v1.3.0 | **Ausstehend** | Vollstaendige CI-Suite mit echter Navigation auf dem genauen Commit ausfuehren, bevor nach `main` gemergt wird. |
| Docker / ARM64 / WebGL auf Zielhardware / iOS / Android | **Nicht lokal ausgefuehrt** | Separat auf den Zielsystemen verifizieren. |

## Aenderungen v1.3.0

- B-1: Generischer DOM-Abgleich fuer alle regulaeren Seiten; zentrale Startseiten-/Kartenereignisse und getrennte Widget-Lebenszyklen bei Karte, Lager, SVG und 3D.
- B-2: Inkrementelle, revisionsgesicherte Mutationsantworten mit GET-Fallback nach Fremdaenderungen; unveraendertes Standard-API-Verhalten.
- B-5: Neue Integrations- und Browser-Verhaltenstests. Quelltext-Regex-Neuzugaenge durch CI-Budget verboten; vorhandene Altpruefungen nur mit gleichwertiger Abdeckung weiter abbauen.
- B-6: Kompaktindex fuer alte Testberichte, fachliche Dokumentationsbereinigung sowie SHA-256-Manifest zur sicheren Erkennung verwaister Module beim ZIP-Upgrade.
- Keine Aenderung an Sammlungsschema, Lagerdaten, Medien, Bestandsmigration oder Backupformat.

## Verbleibende Abnahmen und Legacy-Bestand

- Der Browser-History-Test wurde im verwalteten Chromium-DOM-Modus uebersprungen. Der regulare CI-Browserlauf ist daher weiterhin eine Freigabevoraussetzung.
- Alte Quelltext-Regex-Assertions sind nicht als Verhaltenstest zu betrachten. Neue sind untersagt; verbleibende werden bei der naechsten fachlichen Aenderung mit Browser-/Domain-Abdeckung ersetzt, statt ohne gleichwertige Pruefung geloescht.
- Freigabe nach `main` erst nach gruener CI. Separate Docker-/Pi-/Mobilgeraete-Abnahmen sind noch nicht behauptet.
