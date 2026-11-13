# Architektur und Orientierung

**Stand:** v0.15.7. Dieses Dokument beschreibt die tatsächlich eingesetzten Module und ihre Verantwortlichkeiten. Frühere Release-Entscheidungen gehören in [CHANGELOG](../CHANGELOG.md), nicht in eine zweite Versionschronik.

## Grundprinzipien

- **Eine Anwendung:** Node.js-Server mit nativen Browser-ES-Modulen; kein Bundler, Frontend-Framework und keine Datenbank.
- **Zwei getrennte Datenmodelle:** `collection.json` (Schema 4) für die Sammlung und `warehouse.json` (Schema 1) für die physische Lageranordnung. Die Lagerzuordnung verweist mit stabilen Flaschen-/Fach-IDs auf die Sammlung.
- **Server entscheidet über Datenänderungen:** UI-Validierung hilft beim Ausfüllen, ersetzt aber keine serverseitigen Fachregeln. Schreiben ist serialisiert, validiert und atomar pro Datei.
- **Darstellung ist kein Datenmodell:** 2D-/3D-Geometrie und Statistikwerte werden abgeleitet; sie verändern die Quelldaten nicht.
- **Sicherheit und Kompatibilität:** Keine Änderung an API, JSON-Schemata, Laufzeitpfaden oder vorhandenen Migrationen allein durch eine interne Umstrukturierung.

## Repository im Überblick

```text
public/
  app.js                      Browser-Einstieg / Controller-Verkabelung
  js/
    api.js, state.js, events.js   API-Zugriff, UI-Zustand, Event-Delegation
    navigation/                Routing, Seitenzustand und History/Scroll
    domain/                    Reine Berechnungen für UI und Geometrie
    features/                  Editoren, Scanner, Backups, Karte, Importvorschau
    views/                     HTML-Erzeugung pro Hauptseite
      warehouse.js             Lagerseiten-Controller, Interaktionen
      warehouse-presentation.js Lager-HTML/SVG und Anzeigehelfer
    ui/                        Dialoge, 3D-Renderer, Widgets, Shell
    i18n/                      Schlüsselbasierte Übersetzung
  locales/                     de.json, en.json und Sprachindex
  styles/                      Gemeinsames Layout und Seiten-CSS
server/
  index.js, app.js, routes.js  Serverstart, HTTP und Routen
  domain/                     Validierung und fachliche Regeln
    warehouse-fields.js       Reine Lager-Eingabenormalisierung und -prüfungen
  services/                   CRUD-Anwendungsfälle und Integrationen
  storage/                    JSON-Dateien, Medien, Migrationen
  http/                       Request-/Response- und Static-File-Helfer
worker/                        Zeitgesteuerte Backup-Aufträge
shared/                        Backup-Format, Passwort-/Modellkontrakte
(separates privates Repository)  Optionale Browser-Erweiterung, nicht im WCM-Release
scripts/                       Qualitäts-, Release- und Setup-Skripte
tests/                         Unit-, Integration- und Browserprüfungen
docs/                          Anforderungen, Betrieb und Fachthemen
```

### Browser-Datenfluss

```text
Benutzeraktion
  -> public/js/events.js (delegierter Eventhandler)
  -> Feature-Controller / Lager-Controller
  -> public/js/api.js
  -> Server-API
  -> UI-Zustand aktualisieren / Daten erneut laden
  -> passende View rendern
```

`public/js/state.js` hält den flüchtigen Zustand (Route, Auswahl, Filter, Dialoge). Der Router in `public/js/navigation/` trennt URL/History, Seitenwechsel und Scrollverhalten. Views generieren HTML und rufen keine persistenten JSON-Schreibvorgänge auf.

Für das Lager gelten drei unterschiedliche Aufgaben: `views/warehouse.js` steuert Auswahl, Formular- und Klickabläufe; `views/warehouse-presentation.js` erzeugt rein darstellende HTML-/SVG-Fragmente; `ui/warehouse-three-scene.js` verwaltet den WebGL-Lebenszyklus. `ui/warehouse-room-previews.js` erzeugt kleine Raumbilder. Die Geometrie stammt aus `domain/warehouse-3d-model.js`, nicht aus dem Controller.

Die Abfüllungs-/Flaschenübersicht wird in `domain/collection-overview.js` aus dem Sammlungsmodell abgeleitet. Eine Flaschenkarte verweist auf ihre konkrete physische Flasche; Filter und Sortierung passieren vor der Pagination. Die Analysen werden in `domain/analytics.js` berechnet, die Karte in `domain/distillery-map.js` und ihren spezialisierten Helfern. Keine dieser Ableitungen wird als zusätzliche Datenquelle persistiert.

### Server-Datenfluss

```text
HTTP(S)-Anfrage
  -> server/app.js (gemeinsamer HTTP-Einstieg und Fehlerbehandlung)
  -> server/routes.js (Methode/Pfad)
  -> server/services/<fachbereich>.js (Anwendungsfall)
  -> server/domain/ (Normalisierung/Validierung)
  -> server/storage/ (serialisierter atomarer Dateiersatz)
```

`server/storage/collection-store.js` besitzt die zentrale Schreibwarteschlange für die Sammlung. `server/storage/warehouse-store.js` besitzt eine **eigene** Warteschlange und Lager-Dateivalidierung. `services/warehouse.js` koordiniert Raum-, Möbel-, Fach- und Flaschenzuordnungen, die reinen Normalisierungsfunktionen sind in `domain/warehouse-fields.js`. Validierungsfehler müssen eine Transaktion vollständig verwerfen. Das garantiert Konsistenz innerhalb **eines Serverprozesses**; parallele Serverprozesse auf demselben Datenverzeichnis sind nicht vorgesehen.

**Bewusste gemeinsame Fachbibliothek:** `public/js/domain/warehouse-compartments.js` und `warehouse-placement.js` enthalten **browserunabhängige** Fachhöhen-, Möbeltypen- und Kollisionsregeln. Browser und Node-Server importieren diese Module direkt, damit 2D-Drag, 3D-Modell und API dieselben Berechnungen verwenden. Trotz ihres Pfades unter `public/` enthalten sie weder DOM- noch Netzwerkzugriffe. Ein späterer Umzug in ein separates shared-Modulpaket erfordert eine entsprechende Browser-Import-/Static-File-Lösung und ist **nicht** Teil dieser kompatiblen Wartungsversion.

## Persistente Daten und Dateigrenzen

```text
${WCM_DATA_DIR}/storage/
  data/collection.json         Sammlung, schemaVersion 4
  data/warehouse.json          Räume/Fächer/Zuordnungen, schemaVersion 1
  images/                      Fotos je physischer Flasche
  documents/                   Download-geschützte Anhänge je Flasche
  backups/                     Sicherheitskopien vor Restore
```

Inventarnummern sind Strings (führende Nullen bleiben erhalten). In der Collection liegen `bottlings[].bottles[]`, in der Lagerdatei verweist `assignments[bottleId]` auf eine `shelfId`. Namen sind **keine** IDs. Die genaue Feldsemantik steht in [ANFORDERUNGEN](ANFORDERUNGEN.md), [LAGER](LAGER.md) und [API](API.md).

Migrationen der Sammlung liegen in `server/storage/migrations.js`. Die Erweiterung vorhandener Daten darf Werte nicht still überschreiben. Die JSON-Datei wird nach Validierung atomar ersetzt; bei einer Migration wird das Original vorher gesichert. Fotos und Belege liegen auf dem Datenträger; eine bloße Collection-JSON-Sicherung erfasst diese **nicht**.

## Backup und Wiederherstellung

`shared/backup-zip.js` erzeugt und prüft die vollständigen ZIP-Dateien (WinZip AES-256/AE-2). Der direkte Download und der Worker nutzen denselben Archivcode. `server/services/backups.js` verwaltet Profile und Aufträge, `server/services/backup-recovery.js` prüft Archive vor einer bestätigten Wiederherstellung. Das komplette `data/`-Verzeichnis einschließlich `warehouse.json` ist Teil eines vollständigen Backups. Alte Restic-Archive bleiben nur für die Migration/Wiederherstellung unterstützt.

Die administrativen Backup-Endpunkte verlangen einen separaten Admin-Schlüssel und ein Backup-Passwort. Der übrige Webserver besitzt **keine allgemeine Benutzeranmeldung**; der Betrieb im offenen Internet ohne weitere Zugriffskontrolle ist nicht vorgesehen. [Betriebsanleitung](DOCKER_BACKUP.md)

## Internationalisierung

UI-Texte werden über `t(key, params)` aus `public/js/i18n/index.js` aufgelöst. Deutsch wird als Basiskatalog mitgeliefert, Englisch nach Auswahl geladen. Beide `public/locales/*.json`-Dateien verwenden identische, stabile Schlüssel; Benutzereingaben werden niemals automatisch übersetzt. Neue Texte erfordern **beide** Sprachdateien und einen Rendering-Test. API-Fehlermeldungen sind derzeit noch keine vollständig sprachneutralen Fehlercodes.

## Änderungsleitfaden

| Änderung | Zuerst ansehen | Tests |
| --- | --- | --- |
| REST-Endpunkt | `server/routes.js`, zuständiger `server/services/`-Dienst | `tests/integration/` |
| Sammlungsdaten / Inventarnummern | `server/domain/`, `server/storage/`, `shared/types.js` | Migration, API, Inventar |
| Lagerformular / 2D-Plan | `views/warehouse.js`, `views/warehouse-presentation.js` | `warehouse-ui`, Browser |
| Fachhöhe / Möbeltyp / Kollision | `domain/warehouse-fields.js`, `public/js/domain/warehouse-*` | Lager-Integration, Platzierung, 3D |
| Three.js / Vorschau | `ui/warehouse-three-scene.js`, `warehouse-room-previews.js` | Geometrie, Browser/WebGL |
| Übersetzung | `public/locales/`, `public/js/i18n/index.js` | `npm run check`, englisches Rendering |
| Backups | `shared/backup-zip.js`, `server/services/backups.js`, `worker/` | Backup/Restore und Docker |
| Deployment / Release | `docker/`, `deploy/`, `.github/workflows/` | CI, Release-Metadaten |

Änderungen zuerst auf `develop`, dann über den dokumentierten [Release-Workflow](RELEASE_WORKFLOW.md) nach `main` bringen. Die jeweils **aktuelle** Testaussage steht ausschließlich in [TESTSTATUS](TESTSTATUS.md); historische Berichte in [TESTHISTORIE](TESTHISTORIE.md). Nicht abgeschlossene Qualitätsschritte sind als offen zu kennzeichnen.

## Lokale Foto-Freistellung

Die optionalen `photos[].cutout`-Daten werden zusammen mit den bestehenden physischen Flaschen in Schema 4 gespeichert. Modell-Ausführung, Originalbild-Vorschau und transparente Ausgabe liegen in `public/js/features/cutout/`; die Freistellungs-API liegt in `server/services/bottles.js` und unterliegt der normalen Persistenzvalidierung. Bilddateien bleiben in `storage/images`. Das Docker-Image stellt ONNX/WASM lokal aus `public/ai` bereit (siehe [PHOTO_FREISTELLUNG.md](PHOTO_FREISTELLUNG.md)); das Backend führt kein KI-Modell aus.

## Externe Importdaten

Das öffentliche WCM-Projekt enthält weder eine Browser-Erweiterung noch einen HTML-Parser für fremde Katalogseiten. Es stellt nur eine vom Benutzer aktivierbare Vorschau für bereits gelieferte Datensätze bereit.

**Einzige unterstützte Übergabe:** `#wcm-import=<URL-kodiertes JSON>` mit einem Objekt der Form `{ "version": 2, "source": "external", "fields": { ... } }`. Die Daten werden anhand erlaubter Felder geprüft. Das URL-Fragment wird unmittelbar nach Empfang aus der Adressleiste entfernt. Ein bestehender Bearbeitungsdialog wird nicht ohne Bestätigung verworfen.

**Trennung der Importzuständigkeiten (ab v0.17.11):** `public/js/features/import/` enthält die generische Feldvorschau, die optionale lokale Bildübernahme, die Destillerie-Zuordnung und die Ereignissteuerung. Das gemeinsame Payload-Modul übernimmt Feld-Whitelist, Textvalidierung, Bild-Token und Normalisierung. Ein quellenspezifischer Adapter validiert die Kennung und URL, entscheidet über Dubletten und liefert die Feldbezeichnungen. `public/js/features/editor-controller.js` verwendet nur `fromImport`, `importReferencePhoto` und neutrale Import-Callbacks. HTML-Selektoren, CSS-Klassen und Übersetzungen für die Vorschau sind quellunabhängig.

Der Bild-Zwischenspeicher akzeptiert zusätzlich `source: null` für Bilder ohne besondere Quellenmarkierung; bestehende Erweiterungs-Uploads ohne `source`-Angabe behalten aus Kompatibilitätsgründen ihre bisherige Markierung. Persistierte Quell-IDs, Weblinks und Foto-Herkunftsangaben werden nicht umbenannt. Die HTTP-Endpunkte, Fragmentversion und das Datenschema bleiben unverändert.

Das Schema verlangt weiterhin einen gültigen Flaschennamen, eine passende WB-ID und den zugehörigen HTTPS-Quellenlink. WCM öffnet oder durchsucht dabei keine fremden Webseiten. Ein optionaler, kurzlebiger Bild-Token verweist ausschließlich auf ein zuvor lokal übergebenes Bild.

**Keine alten Importpfade:** Früher verwendete Fragmentnamen, Payload-Version 1 und der serverseitige HTML-Import-Endpunkt sind entfernt. Für die Übernahme ist eine Erweiterung erforderlich, die das neue Format selbst erstellt. Bereits gespeicherte Sammlungen, IDs, Links und Fotos werden unverändert weiterverwendet.
