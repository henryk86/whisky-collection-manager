# Architektur

## Überblick

WhiskyCollectionManager besteht aus einem Node.js-Server und nativen Browser-ES-Modulen ohne Datenbank, Frontend-Framework oder Build-Schritt. Die Oberfläche verwendet gemeinsame UI-Renderer und CSS-Tokens. Darstellung, UI-Zustand, Fachregeln und Persistenz sind getrennt.

| Bereich | Zuständigkeit |
|---|---|
| `public/app.js`, `public/js/navigation/`, `public/js/events.js` | Browserstart, Routing, History, delegierte Aktionen |
| `public/js/views/` | Datenbindung und Komposition der Fachansichten |
| `public/templates/` | HTML- und SVG-Struktur der UI |
| `public/js/ui/`, `public/styles/` | Designsystem, Dialoge, Widgets, 3D-Renderer, Fachstyles |
| `public/js/domain/` | Abgeleitete Anzeige-/Analyseberechnungen |
| `public/locales/de.json`, `en.json` | Übersetzungsschlüssel und Sprachvarianten |
| `server/app.js`, `server/http/` | Zentraler HTTP-Einstieg, Sicherheitsprüfungen, Header, statische Dateien |
| `server/routes/` | Fachlich gruppierte HTTP-Endpunkte und gemeinsamer API-Dispatcher |
| `server/services/` | Server-Anwendungsfälle und Schreibabläufe |
| `server/domain/`, `shared/` | Validierung und DOM-freie Fachlogik |
| `server/storage/` | JSON-Dateien, atomare Schreibvorgänge, Migration beim Laden |
| `worker/` | Geplante Backups |
| `scripts/`, `tests/` | Setup, CI, Release, Unit-/Integration-/Browsertests |

## Backend-Routen und Vertrauensgrenzen

`server/app.js` prüft Host, Herkunft schreibender Anfragen und Sitzungsberechtigung vor der API-Weiterleitung. Version, Sitzungsstatus, Login und Logout sind wie dokumentiert öffentlich; der Passwortwechsel und die Benutzerverwaltung unterliegen ihren eigenen Sitzungsregeln. Die CORS-Ausnahme für den Bildimport umgeht die Loginpflicht nicht. Der interne Backup-Worker wird über seinen eigenen Token im Backup-Service autorisiert.

`server/routes/index.js` registriert die Fachmodule und führt die erste zu HTTP-Methode und Pfad passende Route aus. Literalpfade wie `/api/warehouse/furniture/bulk` stehen vor konkurrierenden ID-Pfaden. Die Routen sind nach Anwendungsfall aufgeteilt:

| Modul in `server/routes/` | Zuständigkeit |
|---|---|
| `system.js` | Version und Healthcheck |
| `auth.js` | Sitzungen, Passwörter, Benutzerverwaltung |
| `collection.js` | Sammlung, Abfüllungen, Flaschen, Fotos, Dokumente und JSON-/CSV-Transfer |
| `tastings.js` | Verkostungen, externe Verkostungen und Flights |
| `warehouse.js` | Räume, Möbel, Fächer, Raumtransfer und Flaschenzuweisungen |
| `distilleries.js` | Destillerieverzeichnis und Geokodierung |
| `settings.js` | Sammlungseinstellungen und gespeicherte Ansichten |
| `staged-images.js` | Temporärer Bildimport aus der Browser-Erweiterung |
| `backups.js` | Backup-Profile, Aufträge, ZIP-Export, Archivdownloads und interner Worker-Endpunkt |
| `recovery.js` | ZIP-Upload, Entsperren, Vorschau, Download und Wiederherstellung |

Die Fachmodule definieren Pfad, Methode, Metadaten und Serviceaufruf gemäß `contract.js`. Der Dispatcher verarbeitet JSON, lässt binäre Uploads direkt zum zuständigen Service durch, setzt ETags und State-Delta-Antworten und behandelt JSON-, Inline- und Download-Antworten einheitlich. Fachvalidierung, Berechtigungen für administrative Backup-/Kontenoperationen und Persistenz verbleiben in den Services und den darunterliegenden Schichten. Nur der Dispatcher liest Revisionskennungen direkt aus den Stores. Fachrouten schreiben keine Daten selbst. Services, Domain-, Storage- und HTTP-Hilfsmodule importieren keine Routen.

## Persistenz

- `collection.json`: **Schema 10**, Abfüllungen, physische Flaschen, Fotos/Nachweise als Metadaten, unabhängige `tastings[]`.
- `settings.json`, `tastingFlights.json`, `distilleries.json`: jeweils **Schema 1**; `externalTastings.json`: **Schema 2**. Sammlungseinstellungen, externe Verkostungen, Flights und Destillerien liegen in getrennten Dateien. Die API und der JSON-Export führen die fünf Dateien zu einer vollständigen Sammlung zusammen.
- `warehouse.json`: **Schema 1**, Räume, Möbel, Fächer und Zuweisungen anhand stabiler IDs; getrennt von der Sammlung.
- `user.json`: optionale Login- und Kontenverwaltung; nicht im Repository veröffentlichen.
- Fotos, Dokumente und lokale Modell-Dateien liegen in eigenen Verzeichnissen. Ein einfacher Collection-JSON-Export enthält keine Bildbytes; vollständige ZIP-Backups umfassen die gespeicherten Dateien.
- Schreibzugriffe werden validiert und serialisiert; Bestandsdateien werden über `shared/durable-files.js` atomar aktualisiert: temporäre Datei schreiben, Datei synchronisieren, veröffentlichen, Elternverzeichnis synchronisieren (POSIX). Referenzierte Medien werden vor den zugehörigen JSON-Metadaten veröffentlicht. Bei einer nachträglichen Synchronisationsstörung dürfen bereits referenzierte neue Dateien nicht gelöscht werden. API-Clients können ETags für Revalidierung und optionale State-Deltas verwenden (siehe [API](API.md)).

- Dateiübergreifende Sammlungsänderungen verwenden ein dauerhaftes Redo-Journal (`.collection-transaction.json`). Vor weiteren Zugriffen wird eine unterbrochene Veröffentlichung vollständig wiederholt. Fehlende oder widersprüchliche Teildateien werden nicht durch leere Daten ersetzt. Einzeldateiänderungen benötigen kein Journal. Ein bestätigter Daten-Commit bleibt auch bei fehlgeschlagener Journalbereinigung erfolgreich; fehlende Dauerhaftigkeit und ausstehende Veröffentlichung werden separat gemeldet.

- Die vollständige Wiederherstellung nutzt `restore-validation.js`, eine exklusive Anfrage-Sperre (`restore-gate.js`) und ein persistentes Zwei-Phasen-Protokoll (`restore-transaction.js`). Vor Initialisierung der Stores wird eine unterbrochene Transaktion entweder zurückgesetzt oder abgeschlossen. Der Commit-Marker wird erst nach Veröffentlichung und Synchronisation aller drei Datenverzeichnisse geschrieben. Die ursprünglichen Daten bleiben bis dahin erhalten. Voraussetzung ist ein lokales Dateisystem mit unterstütztem Verzeichnis-`fsync` und genau eine schreibende App-Instanz.

**Aktuelle Datenkompatibilität:** Schema 10 ist das gegenwärtige Format. Der Upgrader in `server/storage/migrations.js` unterstützt ältere Schemas. Bei Schema 1–4 werden frühere sensorische/Verkostungsdaten **nicht** in `tastings[]` übernommen; bei Schema 5 bis 9 bleiben vorhandene Verkostungen und Metadaten erhalten. Schema 9 lagert Destillerien aus. Schema 10 ergänzt die optionale Zusatzbezeichnung in Abfüllungen und externen Verkostungen. Schema 7 ergänzt `purchaseEvidence` als optionale Kennzeichnung von Kaufnachweisen. Der Quellstand enthält dazu Tests. Es gibt nach Projektvorgabe **keine erhaltenswerten produktiven Altbestände**, für die eine verlustfreie Migration von Schema 1–4 vorgesehen wäre. Bei späterer Produktivnutzung Datenmigration und Restore ausdrücklich neu bewerten.

## Browser und Datenfluss

Benutzeraktion → delegierte Events/UI-Zustand → `public/js/api.js` → HTTP-Routen → Services → Domain/Storage → API-Antwort → DOM-Abgleich. Ein Mutationsergebnis kann optional ein revisionsgebundenes State-Delta enthalten; bei nicht passender Revision lädt der Browser die Ressource erneut.

Die zentrale Modal-Verwaltung kontrolliert verschachtelte Dialoge, Fokus, Escape und die Hintergrund-Scrollposition. Fachansichten erhalten ihre jeweiligen Daten und Dialogaktionen, nicht eine zweite globale Modalverwaltung.

## Externe UI-Templates

HTML und SVG werden ausschließlich unter `public/templates/` gepflegt,
fachlich gruppiert (z. B. `backups/`, `warehouse/`, `components/`, `icons/`,
`dialogs/`). `public/index.html` bleibt der Einstiegspunkt. Neue
JavaScript-Strings mit Markup sind unzulässig. Der gemeinsame Loader
`public/js/ui/templates.js` löst relative Namen wie
`loadTemplates('backups/backups.html')` zentral auf und lädt die Fragmente
einmal pro Modul. Im Browser liefert ein Renderer einen unveränderlichen RenderPlan.
`composeMarkup` kombiniert RenderPläne, `materialize` klont die statische
DOM-Struktur und setzt Werte als Text, Attribute oder untergeordnete Nodes.
`replaceContent`, `appendContent` und `replaceElement` montieren die Nodes.
Die Dateien werden ohne Build-Schritt vom lokalen HTTP-Server ausgeliefert.

Ein Fragment beginnt mit `<!-- wcm-template:fragmentName -->` und endet mit
`<!-- /wcm-template -->`. `{{text:name}}` bindet Text, `{{t:domain.key}}`
eine Übersetzung. `{{content:name}}` fügt einen untergeordneten RenderPlan
oder einen skalaren Text ein. `{{attr:name}}` bindet einen skalaren Wert
in einem Attribut; `{{attrs:name}}` erwartet ein strukturiertes Objekt aus
Attributnamen und Werten. `{{tag:name}}` ist für validierte strukturelle
Tag-Varianten vorgesehen. Dynamische Daten werden nicht als HTML geparst.
Browser und Node erzeugen dieselben RenderPläne. Die Anwendung montiert ausschließlich native DOM-Knoten. UI-Assertions materialisieren RenderPläne mit dem produktiven Renderer in Chromium; DOM-Tests prüfen Elemente, Attribute, Textinhalte und Formulareigenschaften direkt. Isolierte Komponenten und Interaktionen werden asynchron in den Playwright-Browsertests geprüft, ohne HTML-Serialisierung oder synchronen Testworker. Reine Daten-, Zustands- und ViewModel-Tests bleiben browserfrei. Dynamische Text- und Attributwerte bleiben literal; nur statische HTML-Entitäten werden vom Browser geparst. Bindungen erhalten fachliche Namen.

Die Hauptansichten bereiten Auswahldaten, Filterergebnisse, Geometrie und
abgeleitete Kennzahlen in `public/js/views/models/` auf. ViewModels verändern
keine Quelldaten und erzeugen keine DOM-Knoten. Wiederverwendbare Fachlogik
verbleibt in den Domänenmodulen; `profile-model.js` bereitet den
Backup-Profildialog vor. Views formatieren und binden die vorbereiteten Werte.
Controller koordinieren Navigation, Ereignisse, API-Aufrufe und den Lebenszyklus
zustandsbehafteter Komponenten. Lagerverwaltung trennt Auswahl, Rauminteraktion,
WebGL-Szenen, Inspektionsdialoge und Speicheränderungen. Der Fotoeditor trennt
Entwurf, Vorschau, Werkzeuge, Bildquellen, Export und Speicherung innerhalb
seiner lokalen Sitzung. Modulgrenzen folgen fachlichen Verantwortlichkeiten,
nicht starren Datei- oder Funktionslängen.

`npm run format:html` formatiert die externen Templates mit LF-Zeilenenden.
`npm run check` prüft die Formatierung, HTML-freie JavaScript-Literale,
zentrale Ablage, ausgeglichene Tags, Bindungspositionen, Fragmentreferenzen,
Slot-Bindungen und Übersetzungsschlüssel.

## Sicherheit und Betrieb

Optionale Anmeldung mit Administrator-/Nutzerrollen und Passwörtern als scrypt-Hashes; Sitzungen über HTTP-Cookies. Host-/CSRF-Prüfungen und HTTPS schützen schreibende Operationen. `server/domain/login-attempts.js` reserviert die Kapazität für asynchrone Passwortprüfungen je Konto und direkter Peer-IP. Der Dispatcher prüft die Autorisierung nach dem JSON-Parsing erneut. Statische Dateien werden über kanonische Pfade auf ihren Auslieferungsbereich begrenzt; private Datenverzeichnisse bleiben von der öffentlichen Dateiauslieferung ausgeschlossen. Fotos werden ausschließlich als Rasterdateien mit privatem Cache ausgeliefert. WCM ist für privates LAN oder VPN vorgesehen, nicht für direkte Internetfreigaben. Backup-Schlüssel und Datenverzeichnis getrennt vom Checkout halten. Siehe [Anmeldung](ANMELDUNG.md), [Docker/Backup](DOCKER_BACKUP.md) und [Release-Workflow](RELEASE_WORKFLOW.md).

## Änderungen sicher einbauen

1. Datenformate: `shared/types.js`, `server/domain/validation.js`, Normalisierung, Export/Import und ggf. Migration gemeinsam prüfen.
2. Neue API: Routen, Services, Fehlercodes, deutsche/englische Übersetzungen und Integrations-/Browsertests abstimmen.
3. Neue UI: bestehende Renderer aus [Designsystem](DESIGNSYSTEM.md) nutzen; fachspezifische Geometrie lokal lassen.
4. Dokumentation des **aktuellen** Vertrags bei tatsächlicher Betroffenheit im gesamten PR aktualisieren; einzelne Commits benötigen keine eigene Dokumentationsänderung (siehe [Entwicklung](ENTWICKLUNG.md)).
