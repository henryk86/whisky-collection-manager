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
| `server/routes.js`, `server/http/` | HTTP-Routen, Header, Sicherheit, statische Dateien |
| `server/services/` | Server-Anwendungsfälle und Schreibabläufe |
| `server/domain/`, `shared/` | Validierung und DOM-freie Fachlogik |
| `server/storage/` | JSON-Dateien, atomare Schreibvorgänge, Migration beim Laden |
| `worker/` | Geplante Backups |
| `scripts/`, `tests/` | Setup, CI, Release, Unit-/Integration-/Browsertests |

## Persistenz

- `collection.json`: **Schema 6**, Abfüllungen, physische Flaschen, Fotos/Nachweise als Metadaten, unabhängige `tastings[]`, externe Verkostungen und Tasting-Flights.
- `warehouse.json`: **Schema 1**, Räume, Möbel, Fächer und Zuweisungen anhand stabiler IDs; getrennt von der Sammlung.
- `user.json`: optionale Login- und Kontenverwaltung; nicht im Repository veröffentlichen.
- Fotos, Dokumente und lokale Modell-Dateien liegen in eigenen Verzeichnissen. Ein einfacher Collection-JSON-Export enthält keine Bildbytes; vollständige ZIP-Backups umfassen die gespeicherten Dateien.
- Schreibzugriffe werden validiert und serialisiert; Bestandsdateien werden atomar aktualisiert. API-Clients können ETags für Revalidierung und optionale State-Deltas verwenden (siehe [API](API.md)).

**Aktuelle Datenkompatibilität:** Schema 6 ist das gegenwärtige Format. Der Upgrader in `server/storage/migrations.js` unterstützt ältere Schemas. Bei Schema 1–4 werden frühere sensorische/Verkostungsdaten **nicht** in `tastings[]` übernommen; bei Schema 5 bleiben vorhandene Verkostungen erhalten. Der Quellstand enthält dazu Tests. Es gibt nach Projektvorgabe **keine erhaltenswerten produktiven Altbestände**, für die eine verlustfreie Migration von Schema 1–4 vorgesehen wäre. Bei späterer Produktivnutzung Datenmigration und Restore ausdrücklich neu bewerten.

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
Browser und Node erzeugen dieselben RenderPläne. Die Anwendung montiert ausschließlich native DOM-Knoten. UI-Assertions materialisieren RenderPläne mit dem produktiven Renderer in Chromium; historische Text-Assertions verwenden nur eine testinterne Vergleichsdarstellung, deren DOM gegen das native Ergebnis geprüft wird. Neue DOM-Tests prüfen Elemente, Attribute und Textinhalte direkt. Bindungen erhalten fachliche Namen.

Die Hauptansichten bereiten Auswahldaten und abgeleitete Werte in
`public/js/views/models/` auf. Fachlogik verbleibt in den Domänenmodulen;
`profile-model.js` bereitet den Backup-Profildialog vor. Views montieren
Templates und koordinieren Ereignisse und Zustandsänderungen.

`npm run format:html` formatiert die externen Templates mit LF-Zeilenenden.
`npm run check` prüft die Formatierung, HTML-freie JavaScript-Literale,
zentrale Ablage, ausgeglichene Tags, Bindungspositionen, Fragmentreferenzen,
Slot-Bindungen und Übersetzungsschlüssel.

## Sicherheit und Betrieb

Optionale Anmeldung mit Administrator-/Nutzerrollen und Passwörtern als scrypt-Hashes; Sitzungen über HTTP-Cookies. Host-/CSRF-Prüfungen und HTTPS schützen schreibende Operationen. Backup-Schlüssel und Datenverzeichnis getrennt vom Checkout halten. Siehe [Anmeldung](ANMELDUNG.md), [Docker/Backup](DOCKER_BACKUP.md) und [Release-Workflow](RELEASE_WORKFLOW.md).

## Änderungen sicher einbauen

1. Datenformate: `shared/types.js`, `server/domain/validation.js`, Normalisierung, Export/Import und ggf. Migration gemeinsam prüfen.
2. Neue API: Routen, Services, Fehlercodes, deutsche/englische Übersetzungen und Integrations-/Browsertests abstimmen.
3. Neue UI: bestehende Renderer aus [Designsystem](DESIGNSYSTEM.md) nutzen; fachspezifische Geometrie lokal lassen.
4. Dokumentation des **aktuellen** Vertrags bei tatsächlicher Betroffenheit im gesamten PR aktualisieren; einzelne Commits benötigen keine eigene Dokumentationsänderung (siehe [Entwicklung](ENTWICKLUNG.md)).
