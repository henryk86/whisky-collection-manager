# Teststatus - Whisky Collection Manager v1.2.0

**Stand:** 2026-11-16. **Status:** Node-Tests, Syntax-/Architektur- und Release-Pruefungen erfolgreich. Chromium-Browser-Suite im DOM-Modus **83 bestanden, 0 fehlgeschlagen, 1 uebersprungen**; regulaerer GitHub-CI-Browserlauf fuer v1.2.0 noch ausstehend. Vorherige Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Versionsmetadaten und Teststatus v1.2.0 konsistent. |
| `npm run check` | **Erfolgreich** | 316 JavaScript-Dateien, Modulgrenzen, 1096 Uebersetzungsreferenzen, 182 Dokumentationslinks. |
| `npm test` | **568/568 bestanden** | Vollstaendige Unit-/Integrationstests inklusive Release-Historienkomprimierung. Zwei Quelltext-Regex-Tests aus v1.1.0 wurden durch bestehende/erweiterte Browser-Laufzeitpruefungen ersetzt. |
| `npm run test:browser` | **83 bestanden, 0 fehlgeschlagen, 1 uebersprungen** | Chromium 144 im DOM-Modus (`WHISKY_BROWSER_DOM_ONLY=true`) mit lokaler Ersatz-Playwright-Laufzeit (v1.57 statt npm-pinned v1.65). Der eine History-Test ist im DOM-Modus nicht ausfuehrbar. Kein Ersatz fuer echte HTTP-Browsernavigation in CI. |
| Gezielte Chromium-DOM-Abnahme | **Bestanden** | Chromium 144 ueber Python-Playwright, isolierter echter Node-Testserver und Request-Weiterleitung: Computed-CSS-Raster, Identitaet der Verkostungsueberschrift beim Umschalten, Flight angelegt, 0 unnoetige Lager-GETs, keine JS-Fehler. Das ist kein Ersatz fuer die vollstaendige Suite. |
| GitHub Actions / CI fuer v1.2.0 | **Ausstehend** | Regulaerer Lauf mit echter HTTP-Seitennavigation und angepinnter Playwright-Version vor Merge nach main erforderlich. Fuer v1.1.0 wurde ein gruener CI-Lauf vom Anwender bestaetigt. |
| Docker / ARM64 / echte mobile Endgeraete | **Nicht lokal ausgeführt** | Auf den Zielsystemen separat pruefen. |

## Aenderungen v1.2.0

- B-1: Generischer DOM-Abgleich auf Verkostungsstart und -listen erweitert. Editor, Flight-Sortierung sowie Widget-Views bleiben ausgenommen, bis ihre Lebenszyklen gesondert gesichert sind.
- B-2: Nur sammlungsbezogene Revalidierung nach Verkostungs-/Flight-Aktionen und Foto-Reihenfolge; unveraendertes Lager bleibt lokal erhalten. Weiterhin keine vollstaendige inkrementelle Mutationsergebnis-Verarbeitung.
- B-5: Zwei CSS-Quelltext-Regex-Tests entfernt; Layoutpruefung mit `getComputedStyle()` in Chromium und neuer Browser-Regressionstest fuer DOM-Erhalt und redundante Requests.
- B-6: Alte Release-Testergebnisse werden kuenftig als kurze Ergebniszeile archiviert, statt den kompletten Report zu duplizieren. Vorhandene historische Eintraege bleiben erhalten.

## Offene Punkte

B-1: Direkte Widget-Lebenszyklen von Home/Map/Lager und Tasting-Editor/Flight weiter pruefen. B-2: Mutationsantworten kontrolliert in den Clientzustand uebernehmen. B-5: Weitere alte Regex-Tests abbauen. B-6: Bereits gewachsene Fachdokumentation/Testhistorie bereinigen. Keine Schema-5- oder Bestandsdatenmigration in diesem Release.

**Freigabe:** v1.2.0 erst nach vollstaendig gruenem Browser-CI-Lauf mergen; der letzte vom Anwender bestaetigte CI-Erfolg bezog sich auf v1.1.0.
