# Architektur und Orientierung

**Stand:** Ein einheitlicher DOM-Abgleich, direkte Mutationsantworten mit Datenrevisionen, Shared-Module, HTTP-Caches und Schema 5. Dieses Dokument beschreibt die eingesetzten Module und ihre Verantwortlichkeiten. Frühere Release-Entscheidungen gehören in [CHANGELOG](../CHANGELOG.md), nicht in eine zweite Versionschronik.

## Grundprinzipien

- **Eine Anwendung:** Node.js-Server mit nativen Browser-ES-Modulen; kein Bundler, Frontend-Framework und keine Datenbank.
- **Zwei getrennte Datenmodelle:** `collection.json` (Schema 5) für die Sammlung und `warehouse.json` (Schema 1) für die physische Lageranordnung. Die Lagerzuordnung verweist mit stabilen Flaschen-/Fach-IDs auf die Sammlung.
- **Server entscheidet über Datenänderungen:** UI-Validierung hilft beim Ausfüllen, ersetzt aber keine serverseitigen Fachregeln. Schreiben ist serialisiert, validiert und atomar pro Datei.
- **Darstellung ist kein Datenmodell:** 2D-/3D-Geometrie und Statistikwerte werden abgeleitet; sie verändern die Quelldaten nicht.
- **Versionierte Datenformate:** Schema 5 ist inkompatibel zu älteren Programmen. Beim Upgrade werden bestehende Sammlungsdaten nach Validierung übernommen; alle Verkostungsdaten aus Schema 1 bis 4 entfallen, auch zuletzt angelegte. Ältere Programmversionen dürfen die migrierten Dateien nicht mehr öffnen.

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

### Verhaltenspruefungen der Oberflaeche

Bei Layout- und Navigationsaenderungen werden tatsaechliche Browser-Eigenschaften geprueft. `tests/browser/layout-runtime.test.js` und `tests/browser/b5-runtime-contracts.test.js` messen unter Chromium berechnete CSS-Stile, Abstaende, Fachgeometrie, Header-/Formularanordnung und Kartenfarben. Historische Tests, die den Anwendungs- oder CSS-Quelltext durchsuchen, wurden durch Verhaltenspruefungen ersetzt; `scripts/check.js` verbietet ihre Wiedereinfuehrung. Die deklarativen Docker-/GitHub-Konfigurationsvertraege prueft `scripts/check-deployment-config.js` separat, inklusive Negativtests. Siehe [TESTSTRATEGIE.md](TESTSTRATEGIE.md).

`scripts/check.js` sperrt native `alert`/`prompt`/`confirm`-Browserdialoge in der Anwendung. `scripts/check-docs.js` weist historische Versionsnummern in Ueberschriften der aktuellen Fachdokumente zurueck; Versionsgeschichte gehoert in `CHANGELOG.md`.

### Browser-Datenfluss

```text
Benutzeraktion
  -> public/js/events.js (delegierter Eventhandler)
  -> Feature-Controller / Lager-Controller
  -> public/js/api.js
  -> Server-API
  -> serverseitige Aenderungen mit Basis- und Zielrevision liefern
  -> lokalen Zustand nur bei passender Basisrevision fortschreiben, sonst sicher neu laden
  -> View mit generischem DOM-Abgleich aktualisieren
```

### Fehler- und DOM-Ereignislebenszyklus

Der DOM-Abgleich in `public/js/ui/dom-reconcile.js` verwendet Fotokachel-IDs nur fuer Elemente mit `data-photo-tile`. Aktionsschaltflaechen (`data-act`), auch wenn sie `data-photo-id` tragen, erhalten keinen Fotokachel-Key; sonst koennen mehrere Geschwister denselben Key bekommen und sich gegenseitig verdraengen. Der Verhaltenstest `dom-reconcile-photo.test.js` prueft diesen Fall.

`public/app.js` fuehrt Mutationen als explizite `{ok:true,value}` bzw. `{ok:false,error}` aus. Ein gescheiterter Aufruf darf keine Erfolgsmeldung, Navigation oder Dialogschliessung ausloesen; waehrend laufender Bestaetigungen werden doppelte Aktionen verhindert.

Alle regulaeren Views benutzen den zentralen DOM-Abgleich (`public/js/ui/dom-reconcile.js`). Er behaelt gleichartige, stabil adressierbare Elemente bei Aktualisierungen bei und verhindert damit Fokusverlust und Scrollspruenge. `events.js` delegiert die normalen Klick-, Eingabe- und Aenderungsereignisse. Startseite und Karte nutzen keine direkt am Render gebundenen Eventhandler mehr. Interaktive Karten-, 3D-, Pointer-/Drag- und kurzlebige Modal-Widgets deklarieren ihren eigenen Knoten mit `data-reconcile="replace"`: Beim Austausch wird ihr Widget-Lebenszyklus neu aufgebaut, ohne ihre alten Eventhandler an weiterverwendete Knoten zu haengen. Die verbleibenden lokalen Listener sind in `scripts/check.js` ausdruecklich begrenzt und muessen beim Refactoring erneut geprueft werden. Aktionsbuttons mit einer `data-photo-id` sind keine gleichartigen Schluessel wie Fotokacheln; das verhindert verlorene Editorbuttons.

### HTTP-Revalidierung statischer Dateien

`server/http/static-files.js` versieht statische Dateien mit `ETag` und `Last-Modified` und beantwortet bedingte Zugriffe mit `304 Not Modified`. Nicht eindeutig hashversionierte Assets bleiben revalidierungspflichtig. Auch `GET /api/collection` und `GET /api/warehouse` liefern ETags. Beide Stores halten validierte, gegen unbeabsichtigte Aenderungen isolierte Lesecaches; Schreibvorgaenge und Restore aktualisieren diese, extern ersetzte Dateien werden erkannt.

**Inkrementeller Mutationsdatenfluss (B-2):** Der Server sammelt mit `server/domain/mutation-tracker.js` alle Aenderungen eines HTTP-Schreibvorgangs in dessen asynchronem Kontext. Nur Clients, die `X-WCM-State-Delta: 1` senden, erhalten zusaetzlich zu ihrem fachlichen Ergebnis ID-basierte Aenderungen mit `before`-/`after`-Revision. Bestehende API-Clients ohne diesen Header erhalten unveraendert die bisherigen Antworten. `shared/resource-delta.js` rekonstruiert nur bekannte Felder und verifiziert Mengen und Reihenfolge. Der Browser uebernimmt diese Aenderungen ausschliesslich, wenn der letzte validierte Cache genau die erwartete `before`-Revision hat. Andernfalls wird der betroffene Cache verworfen und die vollstaendige Ressource erneut angefordert. Mutationen der Sammlung oder des Lagers aktualisieren so die jeweils betroffenen Ressourcen ohne pauschalen Komplett-GET. Die Lager-Flaschenprojektion wird nach einer Sammlungsaktualisierung aus den fachlichen Referenzen im Client neu abgeleitet, ohne `warehouse.json` zu veraendern. Bei externem Restore, Mehrprozessbetrieb oder abweichenden Revisionen geht Korrektheit vor Netzwerkeinsparung.

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

**Upgrade auf Schema 5:** Eine bestehende `collection.json` (Schema 1 bis 4) wird vor dem Schreiben im Arbeitsspeicher migriert und validiert. Die Originaldatei wird unveraendert unter `backups/pre-schema5-…json` gesichert. Abfuellungen, physische Flaschen samt IDs und Inventarnummern, Destillerien, Einstellungen, Foto- und Dateireferenzen bleiben erhalten. Saemtliche bisher gespeicherten Verkostungsdaten (`tastings`, `externalTastings`, `tastingFlights`, Bewertungen, `tastingNotes`, `flavorProfile` und `whiskyColor`) werden beim Upgrade **nicht** uebernommen, auch wenn sie unmittelbar vor dem Upgrade angelegt wurden. Dies ist eine bewusste Datenverlust-Entscheidung; es handelt sich nicht um eine verlustfreie Migration aller Daten. `warehouse.json` mit Raeumen, Moebeln, Faechern und Flaschenzuordnungen bleibt **bytegenau unveraendert**. Alte JSON-Importe und ZIP-Backups werden im Import-/Restore-Pfad auf Schema 5 angehoben; neuere unbekannte Schemata und ungueltige Daten werden abgelehnt, ohne Bestandsdateien zu ueberschreiben. Fotos und Belege liegen auf dem Datentraeger; eine reine Collection-JSON-Sicherung enthaelt sie **nicht**.

## Backup und Wiederherstellung

`shared/backup-zip.js` erzeugt und prüft die vollständigen ZIP-Dateien (WinZip AES-256/AE-2). Der direkte Download und der Worker nutzen denselben Archivcode. `server/services/backups.js` verwaltet Profile und Aufträge, `server/services/backup-recovery.js` prüft Archive vor einer bestätigten Wiederherstellung. Das komplette `data/`-Verzeichnis einschließlich `warehouse.json` ist Teil eines vollständigen Backups. Alte Restic-Archive bleiben nur für die Migration/Wiederherstellung unterstützt.

Die administrativen Backup-Endpunkte verlangen einen separaten Admin-Schlüssel und ein Backup-Passwort. Der übrige Webserver besitzt **keine allgemeine Benutzeranmeldung**; der Betrieb im offenen Internet ohne weitere Zugriffskontrolle ist nicht vorgesehen. [Betriebsanleitung](DOCKER_BACKUP.md)

## Internationalisierung

UI-Texte werden über `t(key, params)` aus `public/js/i18n/index.js` aufgelöst. Deutsch und Englisch werden statisch mit der Anwendung gebündelt; die aktive Sprache wird beim Start ausgewählt, zusätzliche Sprachkataloge können dynamisch geladen werden. Beide `public/locales/*.json`-Dateien verwenden identische, stabile Schlüssel; Benutzereingaben werden niemals automatisch übersetzt. Neue Texte erfordern **beide** Sprachdateien und einen Rendering-Test. HTTP-API-Fehler werden mit stabilen `api.errors.*`-Codes übertragen und lokalisiert; `field`/`other` enthalten sprachneutrale Feldschlüssel. Auch Backup-Worker-Aufträge speichern für neue Fehler strukturierte `backup.errors.*`-Codes statt deutschen Freitexts. Historische Job-Statusdateien können weiterhin Freitext enthalten, der bei unbekanntem Inhalt aus Sicherheitsgründen nur als generische Fehlermeldung erscheint.

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

**Trennung der Importzuständigkeiten:** `public/js/features/import/` enthält die generische Feldvorschau, die optionale lokale Bildübernahme, die Destillerie-Zuordnung und die Ereignissteuerung. Das gemeinsame Payload-Modul übernimmt Feld-Whitelist, Textvalidierung, Bild-Token und Normalisierung. Ein quellenspezifischer Adapter validiert die Kennung und URL, entscheidet über Dubletten und liefert die Feldbezeichnungen. `public/js/features/editor-controller.js` verwendet nur `fromImport`, `importReferencePhoto` und neutrale Import-Callbacks. HTML-Selektoren, CSS-Klassen und Übersetzungen für die Vorschau sind quellunabhängig.

Der Bild-Zwischenspeicher akzeptiert zusätzlich `source: null` für Bilder ohne besondere Quellenmarkierung; bestehende Erweiterungs-Uploads ohne `source`-Angabe behalten aus Kompatibilitätsgründen ihre bisherige Markierung. Persistierte Quell-IDs, Weblinks und Foto-Herkunftsangaben werden nicht umbenannt. Die HTTP-Endpunkte, Fragmentversion und das Datenschema bleiben unverändert.

Das Schema verlangt weiterhin einen gültigen Flaschennamen, eine passende WB-ID und den zugehörigen HTTPS-Quellenlink. WCM öffnet oder durchsucht dabei keine fremden Webseiten. Ein optionaler, kurzlebiger Bild-Token verweist ausschließlich auf ein zuvor lokal übergebenes Bild.

**Keine alten Importpfade:** Früher verwendete Fragmentnamen, Payload-Version 1 und der serverseitige HTML-Import-Endpunkt sind entfernt. Für die Übernahme ist eine Erweiterung erforderlich, die das neue Format selbst erstellt. Bereits gespeicherte Sammlungen, IDs, Links und Fotos werden unverändert weiterverwendet.

## Rendering und Cache

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

### Asynchrone Verkostungserstellung

Beim Anlegen einer neuen Verkostung sperrt der Editor seine Eingaben und Ruecknavigation vom Start des POST bis zum abgeschlossenen Sammlungs-Refresh. Dadurch kann die Liste nicht vor dem Update mit altem Zustand aufgebaut werden. Doppelte POSTs durch wiederholte Speicherklicks sind abgefangen. Bei einer fehlgeschlagenen Anfrage werden die Eingaben wieder freigegeben und bleiben erhalten. Eine zwischenzeitliche anderweitige Navigation wird nach dem Abschluss nicht ueberschrieben. Die Browser-Suite prueft diese Rennen mit kuenstlich verzoegerter Antwort und einem HTTP-500-Fehler.
