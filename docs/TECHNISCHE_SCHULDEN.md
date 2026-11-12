# Technische Schulden und bewusste Grenzen

**Stand:** v0.15.12 (Wartung und Browser-Testkorrektur). Diese Liste ist kein Fehlerbericht: Sie trennt nachgewiesene Einschränkungen von möglichen künftigen Architekturmaßnahmen. In der reinen Wartungsversion wurden keine APIs, Datenmodelle oder Bedienabläufe geändert.

## In dieser Wartungsversion abgebaut

- **Server-Lagerdienst:** Eingabeprüfung, Normalisierung von Möbeln und Fachhöhen aus dem CRUD-Dienst nach `server/domain/warehouse-fields.js` ausgelagert. Der Dienst konzentriert sich auf Anwendungsfälle und Datenänderungen.
- **Browser-Lagerseite:** Render-Helfer für 2D-Grundriss, Fächer, Formulare und Texte in `public/js/views/warehouse-presentation.js` gekapselt; `views/warehouse.js` verwaltet weiterhin den Lebenszyklus der Seite, Events und API-Aktionen.
- **Möbeltypen:** Kanonische Typ-Liste in `public/js/domain/warehouse-compartments.js`; Eingabenormalisierung und Persistenzvalidierung verwenden dieselbe Definition. Eine verwaiste deutschsprachige Frontnamen-Tabelle wurde entfernt.
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

Eine Änderung an `collection.json`-Schema 4, `warehouse.json`-Schema 1, Inventarnummern-/Kapazitätsregeln, API-Endpunkten, UI-Semantik, CSS-Layout, Authentifizierung, Backupformat oder Deployment-Pfaden wäre **funktional** und braucht ein eigenes Ticket mit Migrations-/Kompatibilitätstests. Mehr Moduldateien sind für sich allein keine bessere Architektur; eine Trennung erfolgt nur bei klar unterscheidbarer Verantwortung.

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
