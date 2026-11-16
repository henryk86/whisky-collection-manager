# Architektur und Orientierung

**Stand:** v1.2.1 (Shared-Module, HTTP-Cache, Schema 5 und gepruefte DOM-Regionen). Dieses Dokument beschreibt die eingesetzten Module und ihre Verantwortlichkeiten. Frühere Release-Entscheidungen gehören in [CHANGELOG](../CHANGELOG.md), nicht in eine zweite Versionschronik.

## Grundprinzipien

- **Eine Anwendung:** Node.js-Server mit nativen Browser-ES-Modulen; kein Bundler, Frontend-Framework und keine Datenbank.
- **Zwei getrennte Datenmodelle:** `collection.json` (Schema 5) für die Sammlung und `warehouse.json` (Schema 1) für die physische Lageranordnung. Die Lagerzuordnung verweist mit stabilen Flaschen-/Fach-IDs auf die Sammlung.
- **Server entscheidet über Datenänderungen:** UI-Validierung hilft beim Ausfüllen, ersetzt aber keine serverseitigen Fachregeln. Schreiben ist serialisiert, validiert und atomar pro Datei.
- **Darstellung ist kein Datenmodell:** 2D-/3D-Geometrie und Statistikwerte werden abgeleitet; sie verändern die Quelldaten nicht.
- **Versionierte Datenformate:** Schema 5 ist inkompatibel zu älteren Programmen. Beim Upgrade werden bestehende Sammlungsdaten nach Validierung übernommen; nur historische Verkostungsdaten entfallen. Ältere Programmversionen dürfen die migrierten Dateien nicht mehr öffnen.

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
  storage/                    JSON-Dateien, atomare Writes und Lesecaches
  http/                       Request-/Response- und Static-File-Helfer
worker/                        Zeitgesteuerte Backup-Aufträge
shared/                        DOM-freie Fachlogik, Validierung und Backup-Format
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

### Fehler- und DOM-Ereignislebenszyklus

Der DOM-Abgleich in `public/js/ui/dom-reconcile.js` verwendet Fotokachel-IDs nur fuer Elemente mit `data-photo-tile`. Aktionsschaltflaechen (`data-act`), auch wenn sie `data-photo-id` tragen, erhalten keinen Fotokachel-Key; sonst koennen mehrere Geschwister denselben Key bekommen und sich gegenseitig verdraengen. Der Verhaltenstest `dom-reconcile-photo.test.js` prueft diesen Fall.

`public/app.js` ruft Mutationen ueber `ui/action-result.js` auf und liefert ausdruecklich `{ok:true,value}` bzw. `{ok:false,error}`. Eine erfolgreiche Mutation muss die Sammlung und das Lager erneut laden koennen, bevor eine View navigiert, ein Modal schliesst oder einen Erfolg meldet. Bei API- oder Ladefehlern wird der Fehler angezeigt und die aufrufende Funktion prueft `ok` statt einem falsy API-Ergebnis zu vertrauen. Destruktive Bestaetigungen bleiben bei Fehlschlag offen; `events.js` verhindert Mehrfachausloesung waehrend laufender Bestaetigung.

Normale DOM-Eingaben werden auf dem stabilen Root in `events.js` delegiert. `scripts/check.js` lehnt neue Direktlistener in `views/` ab, sofern sie nicht explizit geprueft und der Ausnahmeliste hinzugefuegt werden. Fuer `home.js`, `map.js` und die Lager-Views bestehen begruendete Alt-Ausnahmen mit lokalem Widget-/Modal-Lebenszyklus. `detail.js` bindet keine Upload-Listener direkt an bei Teilrendern erhaltene Elemente. Die Detailseite sowie die Einstellungen, Hilfe und Verkostungsuebersichten nutzen `ui/dom-reconcile.js` anstelle des alten `outerHTML`-Sonderabgleichs. Nur Ansichten mit delegierten Bedienelementen nehmen daran teil. Die Verkostungseditoren und Flight-Drag-Oberflaechen sowie Startseite, Karte und Lager behalten vorerst ihren lokalen Render-/Widget-Lebenszyklus; ein opt-in ohne gesonderte Browserpruefung ist nicht zulaessig.

### HTTP-Revalidierung statischer Dateien

`server/http/static-files.js` setzt Dateivalidatoren (`ETag`, `Last-Modified`). Bei passenden `If-None-Match`-/`If-Modified-Since`-Bedingungen antwortet der Server mit `304 Not Modified` ohne erneute Dateiunterschiebung. Nicht versionierte statische Dateien (insbesondere die derzeitigen `/ai/vendor/`- und `/ai/models/`-URLs) verwenden `Cache-Control: no-cache` und muessen vor Wiederverwendung revalidiert werden. Fuer eindeutig hash- oder versionierte `/ai/`-Pfade ist eine immutable Langzeitablage moeglich. Die API liefert fuer `GET /api/collection` und `GET /api/warehouse` revidierte ETags und `304` auf passende `If-None-Match`-Header. Der Browser laedt nach Mutationen erneut, nutzt aber bei unveraenderten Versionen seinen JSON-Cache. Verkostungsaktionen und Fotoreihenfolge aktualisieren nur die Sammlung, ohne den unveraenderten Lager-Cache ueber HTTP anzufordern; nicht klassifizierte Mutationen laden weiterhin beide Ressourcen. Beide Stores halten validierte Kopien im Arbeitsspeicher und erkennen extern ersetzte Dateien; Restore invalidiert beide Caches.

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

**Gemeinsame Fachbibliothek:** Wiederverwendbare Domainmodule liegen unter `shared/`: Tasting-Logik, Farb-/Geschmacksprofile, Bildvalidierung und Lagerberechnungen. Browser-Module importieren dieselben ES-Module wie der Server. Der HTTP-Server liefert nur explizit erlaubte `/shared/*.js`-Module aus; Backup- und Node-only-Module bleiben privat. `scripts/check.js` verbietet Server-/Worker-Importe aus `public/js` sowie Shared-Importe aus `public/` und DOM-Zugriffe aus Shared-Modulen. Die Foto-Adjustment-Validierung ist von der Uebersetzung der Editor-Oberflaeche getrennt.

## Persistente Daten und Dateigrenzen

```text
${WCM_DATA_DIR}/storage/
  data/collection.json         Sammlung, schemaVersion 5
  data/warehouse.json          Räume/Fächer/Zuordnungen, schemaVersion 1
  images/                      Fotos je physischer Flasche
  documents/                   Download-geschützte Anhänge je Flasche
  backups/                     Sicherheitskopien vor Restore
```

Inventarnummern sind Strings (führende Nullen bleiben erhalten). In der Collection liegen `bottlings[].bottles[]`, in der Lagerdatei verweist `assignments[bottleId]` auf eine `shelfId`. Namen sind **keine** IDs. Die genaue Feldsemantik steht in [ANFORDERUNGEN](ANFORDERUNGEN.md), [LAGER](LAGER.md) und [API](API.md).

**Upgrade auf Schema 5:** Eine bestehende `collection.json` (Schema 1 bis 4) wird vor dem Schreiben im Arbeitsspeicher migriert und validiert. Die Originaldatei wird unveraendert unter `backups/pre-schema5-…json` gesichert. Abfuellungen, physische Flaschen samt IDs und Inventarnummern, Destillerien, Einstellungen, Foto- und Dateireferenzen bleiben erhalten. Ausschliesslich die bisherigen Verkostungsdaten (`tastings`, `externalTastings`, `tastingFlights`, Legacy-Bewertungen und Bewertungszusammenfassungen) werden beim Upgrade nicht uebernommen. `warehouse.json` mit Raeumen, Moebeln, Faechern und Flaschenzuordnungen bleibt **bytegenau unveraendert**. Alte JSON-Importe und ZIP-Backups werden im Import-/Restore-Pfad auf Schema 5 angehoben; neuere unbekannte Schemata und ungueltige Daten werden abgelehnt, ohne Bestandsdateien zu ueberschreiben. Fotos und Belege liegen auf dem Datentraeger; eine reine Collection-JSON-Sicherung enthaelt sie **nicht**.

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

Die optionalen `photos[].cutout`-Daten werden zusammen mit den bestehenden physischen Flaschen in Schema 5 gespeichert. Modell-Ausführung, Originalbild-Vorschau und transparente Ausgabe liegen in `public/js/features/cutout/`; die Freistellungs-API liegt in `server/services/bottles.js` und unterliegt der normalen Persistenzvalidierung. Bilddateien bleiben in `storage/images`. Das Docker-Image stellt ONNX/WASM lokal aus `public/ai` bereit (siehe [PHOTO_FREISTELLUNG.md](PHOTO_FREISTELLUNG.md)); das Backend führt kein KI-Modell aus.

## Externe Importdaten

Das öffentliche WCM-Projekt enthält weder eine Browser-Erweiterung noch einen HTML-Parser für fremde Katalogseiten. Es stellt nur eine vom Benutzer aktivierbare Vorschau für bereits gelieferte Datensätze bereit.

**Einzige unterstützte Übergabe:** `#wcm-import=<URL-kodiertes JSON>` mit einem Objekt der Form `{ "version": 2, "source": "external", "fields": { ... } }`. Die Daten werden anhand erlaubter Felder geprüft. Das URL-Fragment wird unmittelbar nach Empfang aus der Adressleiste entfernt. Ein bestehender Bearbeitungsdialog wird nicht ohne Bestätigung verworfen.

**Trennung der Importzuständigkeiten (ab v0.17.11):** `public/js/features/import/` enthält die generische Feldvorschau, die optionale lokale Bildübernahme, die Destillerie-Zuordnung und die Ereignissteuerung. Das gemeinsame Payload-Modul übernimmt Feld-Whitelist, Textvalidierung, Bild-Token und Normalisierung. Ein quellenspezifischer Adapter validiert die Kennung und URL, entscheidet über Dubletten und liefert die Feldbezeichnungen. `public/js/features/editor-controller.js` verwendet nur `fromImport`, `importReferencePhoto` und neutrale Import-Callbacks. HTML-Selektoren, CSS-Klassen und Übersetzungen für die Vorschau sind quellunabhängig.

Der Bild-Zwischenspeicher akzeptiert zusätzlich `source: null` für Bilder ohne besondere Quellenmarkierung; bestehende Erweiterungs-Uploads ohne `source`-Angabe behalten aus Kompatibilitätsgründen ihre bisherige Markierung. Persistierte Quell-IDs, Weblinks und Foto-Herkunftsangaben werden nicht umbenannt. Die HTTP-Endpunkte, Fragmentversion und das Datenschema bleiben unverändert.

Das Schema verlangt weiterhin einen gültigen Flaschennamen, eine passende WB-ID und den zugehörigen HTTPS-Quellenlink. WCM öffnet oder durchsucht dabei keine fremden Webseiten. Ein optionaler, kurzlebiger Bild-Token verweist ausschließlich auf ein zuvor lokal übergebenes Bild.

**Keine alten Importpfade:** Früher verwendete Fragmentnamen, Payload-Version 1 und der serverseitige HTML-Import-Endpunkt sind entfernt. Für die Übernahme ist eine Erweiterung erforderlich, die das neue Format selbst erstellt. Bereits gespeicherte Sammlungen, IDs, Links und Fotos werden unverändert weiterverwendet.

## Schrittweise Rendering- und Cache-Verbesserungen (ab v1.1.0)

`public/js/ui/dom-reconcile.js` gleicht explizit freigegebene Seitenbereiche
statt pauschaler `innerHTML`-Ersetzung ab. Detailseite, Einstellungen und Hilfe
haben keine direkt an die zu erhaltenden Seitenknoten gebundenen View-Listener
und koennen den gemeinsamen Abgleich nutzen. Startseite, Karte, Lager und
interaktive Verkostungseditoren behalten vorlaeufig ihre bisherige Lebenszyklussteuerung;
diese Ausnahmen sind **nicht** als abgeschlossener B-1-Umbau zu interpretieren.

Clientseitige Mutationen nutzen weiter standardmaessig `refresh('all')` mit
bedingten HTTP-Requests. Nur ausdruecklich als sammlungsbezogen markierte
Operationen (Medienuploads/-loeschungen und Sammlungseinstellungen) verwenden
`refresh('collection')` und lassen das unveraenderte Lagerobjekt bestehen.
`public/js/ui/refresh-resources.js` fordert beide Ressourcen beim ersten Laden
und bei unbekanntem Zustand sicherheitshalber an. Die vollstaendige Aufloesung
aller Mutationen durch inkrementelle Objektupdates ist eine spaetere B-2-Aufgabe.

Ein nicht destruktiver Quellcode-Abgleich (`scripts/upgrade-audit.js`) erkennt
verwaiste, nicht modifizierte Module zwischen entpacktem altem und neuem Release.
Datenverzeichnisse werden niemals angeruehrt. Der Dateiabgleich ist ein
zusätzlicher Upgrade-Schutz, kein Ersatz fuer Backups oder Docker-Releases.

### Asynchrone Verkostungserstellung (v1.2.1)

Beim Anlegen einer neuen Verkostung sperrt der Editor seine Eingaben und Ruecknavigation vom Start des POST bis zum abgeschlossenen Sammlungs-Refresh. Dadurch kann die Liste nicht vor dem Update mit altem Zustand aufgebaut werden. Doppelte POSTs durch wiederholte Speicherklicks sind abgefangen. Bei einer fehlgeschlagenen Anfrage werden die Eingaben wieder freigegeben und bleiben erhalten. Eine zwischenzeitliche anderweitige Navigation wird nach dem Abschluss nicht ueberschrieben. Die Browser-Suite prueft diese Rennen mit kuenstlich verzoegerter Antwort und einem HTTP-500-Fehler.
