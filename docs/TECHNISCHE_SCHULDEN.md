# Technische Schulden und bewusste Grenzen

**Stand:** v1.2.1. Das historische Wartungsreview v0.15.12 steht weiter unten. Aktuelle, noch nicht behobene Risiken aus dem Code-Review v0.28.6 sind hier nach Dringlichkeit dokumentiert.

## Code-Review v0.28.6: umgesetzte und offene Befunde (Stand v0.28.9)

**In v0.28.8 erledigt:** A-1 (Upload-Mehrfachlistener durch delegierte Eingaben ersetzt, Browser-Regressionstest), A-2 (Browser-Testannahmen und unbewertete Flight-Eintraege korrigiert, DOM-Chromium 80 bestanden, 1 History-Test uebersprungen), B-2.1 (Flight-Referenzen per Map validiert). Die echten CI-Browserlaeufe sind noch zu bestaetigen.

**In v0.28.9 erledigt:**

- **A-3 / Fehlerbehandlung:** `action()` gibt `{ok,value}` oder `{ok:false,error}` zurueck. Bestätigungsaktionen, Editorformulare, Import, Einstellungen, Fotoeditor und Uploads pruefen den Erfolg vor Folgeaktionen. Bei fehlgeschlagenem DELETE bleibt die betroffene Verkostung sichtbar und die Bestaetigung kann erneut versucht oder abgebrochen werden. Unit-Tests und ein Chromium-Regressionstest sind vorhanden (Browserausfuehrung noch offen).
- **A-4 / Statische Dateien:** `ETag` (Dateigroesse und Aenderungszeit), `Last-Modified` und bedingte GETs (304 ohne Body) fuer statische Seiten, Medien, Vendor-Module und KI-Dateien. Nicht versionierte `/ai/`-URLs bleiben `no-cache`; ausschliesslich eindeutig versionierte/hashbasierte AI-Pfade duerfen immutable sein. HTTP-Integrationstest vorhanden.
- **B-1.1 / Neue Direktlistener:** `scripts/check.js` schlaegt bei neu hinzugefuegten `addEventListener`-Aufrufen in Views fehl. Bereits vorhandene view-lokale Bindungen in `home.js`, `map.js`, `warehouse.js` und `warehouse-room-transfer.js` sind als begrenzte, explizite Ausnahmen erfasst. Keine pauschale Behauptung, alle Listener seien bereits delegiert.
- **CI-Teststatus:** Der Regressionsfehler des Tests `teststatus.test.js` aus v0.28.8 ist behoben: Auch der Status `80 bestanden, 0 fehlgeschlagen, 1 uebersprungen` wird als eindeutig positives Browserresultat erkannt.

**Weiterhin pruefen:** Bereits zugelassene Direktlistener und deren Lebenszyklen bei kommenden Rendering-Umbauten; Lauf der Browser-Regressionstests und reale GitHub Actions. Der spaetere Wegfall der Ausnahmeliste ist Teil von B-1.2.

**In v1.0.0 eingefuehrt, B-3 in v1.0.1 korrigiert (inkompatibles Schema-Release):**

- **B-4 – Shared-Module:** Wiederverwendbare Fachlogik liegt in `shared/`; Importgrenzen sind in `scripts/check.js` verankert. Der HTTP-Server erlaubt nur Browser-safe-Shared-Dateien.
- **B-2.2/3 – Lesecaches und API-ETags:** Sammlung und Lager werden im Arbeitsspeicher gehalten; jede Ausgabe ist eine eigene Kopie. Schreibvorgaenge und Restore invalidieren Revisionen; geaenderte Dateien werden erkannt. HTTP 304 vermeidet erneute Transfers, wenn sich die Ressource nicht geaendert hat.
- **B-3 – Schema 5 (v1.0.1 korrigiert):** Eigene Verkostungen liegen nur noch in `bottlings[].tastings[]`; alte abgeleitete Bewertungsspalten und `legacyTastings` entfallen. Bestehende Sammlungsdaten aus Schema 1 bis 4 werden nach einem Original-Backup migriert, mit vollstaendigem Erhalt der Flaschen, Abfuellungen, Destillerien, Inventar- und Medienreferenzen. Das Lager wird nicht geloescht oder umgeschrieben. Nur die alten Verkostungsdaten werden ausgelassen; auch alte JSON-Importe und ZIP-Wiederherstellungen werden validiert migriert.
- **B-1.2 – Generischer Detailabgleich:** Die Detailseite nutzt eine wiederverwendbare DOM-Regionenabgleich-Funktion mit stabilen Schluesseln und ohne den alten `outerHTML`-Vergleich. Andere Seiten bleiben bis zur Browserabnahme beim Komplettaustausch.
- **B-5 – Browserstruktur:** Fachsuiten statt einer einzigen grossen `app.test.js`, gemeinsamer Browser-Helper; Cache-/Schema-Integrationstests ergaenzt.

**v1.0.2 / CI:** Nach sieben Fehlern in v1.0.1 wurden die Browser-Fixtures und der Foto-DOM-Abgleich korrigiert; fuer v1.0.2 hat der Anwender einen komplett gruenen CI-Testlauf gemeldet (82/82). Das ist ein bestaetigter Verlauf, kein lokaler Browsertest.

**B-1, B-2 und B-6 (v1.1.0 in Bearbeitung):** Der generische DOM-Abgleich wurde auf Settings und Hilfe ausgeweitet. Sammlungsbezogene Medien- und Einstellungsmutationen vermeiden jetzt die redundante Lager-Anforderung (mit Fallback auf einen vollstaendigen Erstabruf). Das neue Upgrade-Audit meldet verwaiste Quellcodedateien und entfernt mit `--prune` ausschliesslich hashidentische Altmodule, niemals Daten oder lokal geaenderten Code. Diese Schritte schliessen B-1, B-2 und B-6 **noch nicht vollstaendig** ab.

**v1.2.0 – Weiterer Abbau:** Der DOM-Abgleich umfasst jetzt auch Verkostungsstart und -listen (nicht den Editor oder interaktive Flight-Sortierung). Verkostungs-Mutationen und Foto-Reihenfolge laden nur die Sammlung; die Datenpersistenz und Schema 5 bleiben unveraendert. Die alten CSS-Quelltext-Regex-Pruefungen aus `grid-layout.test.js` wurden durch bestehende/erweiterte Chromium-Laufzeitpruefungen ersetzt. Der Release-Bump archiviert kuenftig kompakte Testergebnisse statt vollstaendiger Teststatus-Duplikate. Bestehende historische Berichte bleiben als Git-/Dokumentenarchiv erhalten.

**v1.2.1 / CI-Regression:** Der bislang gelegentlich instabile Browserfall fuer mehrfach datierte Verkostungen deckte ein echtes Rennen auf: Klick auf Ruecknavigation konnte vor dem Ende des asynchronen Speicherns die alte Liste anzeigen. Der Editor blockiert jetzt seine Bedienelemente bis zum Abschluss; fehlgeschlagene Speichervorgaenge geben sie wieder frei. Die neue Browserpruefung mit angehaltenem POST scheitert gegen v1.2.0 und besteht gegen die Korrektur. Die urspruengliche Listenpruefung wartet jetzt explizit auf den zweiten Eintrag.

**Weiterhin offen:** Die komplette Browser-Suite muss fuer den naechsten Release in einer geeigneten Chromium-/CI-Umgebung laufen. Die alten zahlreichen Quelltext-Regex-Tests sollen schrittweise durch Verhaltenspruefungen ersetzt werden; das ist noch **nicht** vollstaendig erledigt. Weitere Direktlistener in bestehenden Widget-Views werden bei spaeteren Teilrendern gesondert geprueft. B-6 (Bereinigung bereits gewachsener historischer Fachdokumente und Verwaist-Dateien bei Bestandsinstallationen) ist noch teilweise offen.

## Historischer Wartungsstand v0.15.12

## In dieser Wartungsversion abgebaut

- **Server-Lagerdienst:** Eingabeprüfung, Normalisierung von Möbeln und Fachhöhen aus dem CRUD-Dienst nach `server/domain/warehouse-fields.js` ausgelagert. Der Dienst konzentriert sich auf Anwendungsfälle und Datenänderungen.
- **Browser-Lagerseite:** Render-Helfer für 2D-Grundriss, Fächer, Formulare und Texte in `public/js/views/warehouse-presentation.js` gekapselt; `views/warehouse.js` verwaltet weiterhin den Lebenszyklus der Seite, Events und API-Aktionen.
- **Möbeltypen:** Kanonische Typ-Liste in `shared/warehouse-compartments.js`; Eingabenormalisierung und Persistenzvalidierung verwenden dieselbe Definition. Eine verwaiste deutschsprachige Frontnamen-Tabelle wurde entfernt.
- **Dokumentation:** README als Einstieg und Übersicht, ARCHITEKTUR als aktuelle Modulreferenz, Funktions- und Betriebsdetails in den jeweiligen Fachdokumenten. Ein neuer Link-Check schützt lokale Markdown-Verweise.
- **Tests:** Bestehende Lager-, API- und i18n-Regressionen wurden nach jedem Modulschritt erneut ausgeführt; reine Wartungsänderungen erhalten eigene Domain-Tests.

## Bewusst offen geblieben

| Bereich | Beobachtung / Risiko | Für eine spätere Änderung |
| --- | --- | --- |
| **Gemeinsame Lagergeometrie** | Browser und Server importieren reine Logik aus `public/js/domain/`. Das ist technisch gültig, aber der Verzeichnispfad vermittelt eine falsche Schichtzugehörigkeit. | In ein vom Webserver gezielt auslieferbares Shared-Paket umziehen; Importpfade und Zugriffsschutz sorgfältig testen. |
| **UI-Ereignisse** | `public/js/events.js` verwaltet viele Delegationsfälle zentral; weitere Features machen die Datei schwerer zu lesen. | Handler nach Fachmodulen gruppieren, bei unverändertem `data-act`-Vertrag und Event-Reihenfolge. |
| **Lager-Controller** | `views/warehouse.js` ist trotz der Render-Auslagerung noch für mehrere Formulare, Drag-and-drop und Auswahl zuständig. | Form-/Drag-Lebenszyklen separat testen und in kleine Controller verschieben. |
| **Persistenz über zwei Dateien** | Sammlung und Lager haben je eine atomare Schreibwarteschlange, aber keine gemeinsame Transaktion über beide Dateien. | Nur mit explizitem Wiederherstellungs-/Konsistenzkonzept umbauen; kein stiller Schemawechsel. |
| **Fehlerlokalisierung** | Backend-Fehler sind deutsche Texte statt stabiler API-Fehlercodes. | Versionierten Fehlercode zusätzlich zu bestehenden Meldungen einführen und UI pro Sprache lokalisieren. |
| **Testabdeckung im Browser** | Node-Tests sichern Domain-/API-Fälle sehr gut ab; DOM-Modus ersetzt keinen vollständigen HTTP-Browserlauf. | GitHub-Actions-Browser-Suite, WebGL/GPU-Abnahme und echte mobile Geräte separat protokollieren. |
| **Statische Codequalität** | `npm run check` validiert Syntax, Importzyklen, i18n und Dokumentationslinks; es ist kein vollständiger Typechecker oder Linter. | Optional ESLint/TypeScript-JSDoc in einem eigenen, risikobewussten Schritt einführen. |
| **Historische Datensicherung** | Alte Restic-Profile und frühere ZIP-Versionen bleiben absichtlich lesbar. | Nicht entfernen, bevor eine explizite Migration mit realen Bestandsarchiven getestet wurde. |

## Nicht Teil eines reinen Refactorings

Weitere inkompatible Aenderungen an Schema 5, Lager-Schema 1, API, Inventarnummern oder Deployment-Pfaden brauchen explizite Versionsanhebung und neue Verhaltenstests. Historische Bestandsdaten werden migriert, bisherige Verkostungsdaten dagegen bewusst nicht. Eine Schema-Migration ohne Sicherung und Erhalt der vorhandenen Lagerdaten ist nicht zulaessig. Mehr Moduldateien sind für sich allein keine bessere Architektur; eine Trennung erfolgt nur bei klar unterscheidbarer Verantwortung.

## Prüfverfahren

1. `npm run check` – Syntax, Imports, i18n- und Markdown-Verweise.
2. `npm test` – vollständige Unit-/Integrationstests.
3. `npm run release:check` – Release-Metadaten.
4. `npm run test:browser` – separater echter Browserlauf, sofern Chromium vorhanden und lokale HTTP-Navigation erlaubt.
5. WebGL-, iOS-/Android- und Docker-Checks **explizit offen** lassen, bis sie tatsächlich durchgeführt wurden.

Der tatsächliche Durchführungsstand steht ausschließlich in [TESTSTATUS.md](TESTSTATUS.md); die früheren Ergebnisse im [TESTHISTORIE.md](TESTHISTORIE.md).

## Nachpruefung v0.15.10: im Patch v0.15.11 geklaert

- **NEU-1:** Ablehnungen durch die Host-Allowlist sind im Start-/Warn-Log
  sichtbar; Upgrade-Anleitung fuer bestehende LAN-Namen und IPs ergaenzt.
- **NEU-2:** HTTP-Upstream hinter einem TLS-terminierenden Proxy bleibt bewusst
  nicht unterstuetzt; nur HTTPS bis zum Backend mit erhaltenem `Host`.
- **NEU-3:** Abgebrochene Downloads erzeugen keine erwarteten
  Verbindungsabbruch-Stacktraces mehr; echte Dateilesefehler bleiben sichtbar.
- **NEU-4:** Historischer Teststand v0.15.9/v0.15.10 nachgetragen.
- **NEU-5:** Hinweise zur doppelten HTML-Maskierung bei `tHtml()` ergaenzt.

## Review v0.15.9: absichtlich nicht ohne weitere Tests geaendert

- **UI-1:** Der reservierte Scrollbar-Gutter koennte in einigen Windows-/Firefox-
  Konfigurationen einen hellen Streifen neben Header oder Modal erzeugen.
  Optisch auf echten Browsern pruefen, bevor das Layout geaendert wird.
- **MAINT-1:** `tHtml()` ist vorhanden, aber nicht alle bisherigen HTML-Templates
  sind darauf umgestellt. Aufrufstellen mit dynamischen Benutzerdaten pruefen.
- **MAINT-3:** Gemischt verschluesselte ZIPs bleiben lesbar, damit historische
  Sicherungen nicht ausgesperrt werden. Striktere Regeln erst mit echten
  Legacy-Archivtests und ausdruecklicher Kompatibilitaetsentscheidung.
- **SEC-3/TEST-1:** CSP und die reparierte Scrollbar-Wirkungspruefung benoetigen
  noch echte Chromium-/Firefox-/WebGL-/Scanner-Abnahme.

Details: [CODE_REVIEW_0159.md](CODE_REVIEW_0159.md).
