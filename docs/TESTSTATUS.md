# Teststatus - Whisky Collection Manager v1.1.0

**Stand:** 2026-11-16. **Status:** Node-Tests, Syntax-/Architektur- und Releasepruefungen erfolgreich. Die vollstaendige Browserpruefung fuer v1.1.0 ist noch **nicht ausgefuehrt** und bleibt vor einer Freigabe erforderlich. Historische Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | v1.1.0 in Paketdateien, README, Changelog und Teststatus konsistent. |
| `npm run check` | **Erfolgreich** | 316 JavaScript-Dateien, Modulgrenzen, 1096 Sprachreferenzen und 182 Dokumentationslinks geprueft. |
| `npm test` | **569/569 bestanden** | Gesamte Unit-/Integrationstestreihe inklusive gezieltem Refresh, sicherem ZIP-Upgrade-Audit und Datenisolation. |
| `npm run test:browser` (vollstaendige Suite) | **Blockiert (nicht lokal ausgeführt)** | Node-Modul `playwright-core` fehlt; npm-Registry ist aus der Umgebung nicht erreichbar (EAI_AGAIN). Die vollstaendige neue Suite wartet auf CI. |
| Gezielter Chromium-DOM-Test: Einstellungen und Hilfe | **2/2 bestanden** | Chromium 144 ueber Python-Playwright und echten isolierten HTTP-Testserver mit Request-Weiterleitung: Settings-Feld bleibt beim Speichern derselbe DOM-Knoten, Wert 2019 wird persistiert, kein ueberfluessiger Lager-GET, Hilfe-Navigation funktioniert, keine JS-Fehler. Kein Ersatz fuer echte HTTP-Hauptnavigation oder die volle Node-Browser-Suite. |
| GitHub Actions / v1.1.0 | **Ausstehend** | Den vollstaendigen Chromium-Lauf vor einer Freigabe pruefen. Die vom Anwender bestaetigten 82/82 Browsertests gelten fuer den vorherigen Stand v1.0.2. |
| Raspberry Pi / ARM64, Docker und mobile Endgeraete | **Nicht lokal ausgeführt** | Zielsystem- und Browserabnahmen stehen separat aus. |

## Aenderungen v1.1.0

- B-1 (Teilfortschritt): Generischer DOM-Regionenabgleich auch fuer Einstellungen und Hilfe; bestehende Widget-Views mit lokalen Listenern bleiben beim bisherigen Lebenszyklus.
- B-2 (Teilfortschritt): Sauber klassifizierte Medien- und Sammlungseinstellungs-Aktionen laden nur die veraenderte Sammlung; Erstaufrufe und unklassifizierte Mutationen laden vorsichtshalber beide Ressourcen. ETag-Revalidierung bleibt erhalten.
- B-5 (Teilfortschritt): Neue Verhaltenstests fuer Refresh-Scope, Fehlerfaelle, sichere Upgrade-Bereinigung und ein Browserfall fuer Formularidentitaet und redundante Warehouse-Requests.
- B-6 (Teilfortschritt): Upgrade-Audit fuer entfallene Quellcode-Module bei entpackten ZIPs, standardmaessig ohne Loeschung. `--prune` entfernt nur unveraenderte Altdateien; geaenderte Dateien, Symlinks und Datenordner bleiben unangetastet.

## Noch offene Review-Punkte

B-1: Generischen Abgleich erst nach expliziter Lifecycle-Pruefung weiterer Views ausdehnen. B-2: Mutationsergebnisse gezielt in Clientzustand uebernehmen, statt bei allen Aktionen vollstaendige Daten neu anzufordern. B-5: Aeltere reine Quelltext-Regex-Tests schrittweise durch Verhaltenstests ersetzen. B-6: Historische Fachdokumentation und lange Testhistorie gesondert bereinigen und Quellcode-ZIP-Upgrade-Ablauf weiter haerten. Keine Aenderung an Schema 5 oder den Bestandsdaten.

**Freigabe:** Die vollstaendige CI-Browser-Suite fuer v1.1.0 muss gruen sein; dieser Status meldet sie nicht vorzeitig als bestanden.
