# Architektur

## Überblick

WhiskyCollectionManager besteht aus einem Node.js-Server und nativen Browser-ES-Modulen ohne Datenbank, Frontend-Framework oder Build-Schritt. Die Oberfläche verwendet gemeinsame UI-Renderer und CSS-Tokens. Darstellung, UI-Zustand, Fachregeln und Persistenz sind getrennt.

| Bereich | Zuständigkeit |
|---|---|
| `public/app.js`, `public/js/navigation/`, `public/js/events.js` | Browserstart, Routing, History, delegierte Aktionen |
| `public/js/views/` | Fachansichten und gerendertes HTML |
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

## Sicherheit und Betrieb

Optionale Anmeldung mit Administrator-/Nutzerrollen und Passwörtern als scrypt-Hashes; Sitzungen über HTTP-Cookies. Host-/CSRF-Prüfungen und HTTPS schützen schreibende Operationen. Backup-Schlüssel und Datenverzeichnis getrennt vom Checkout halten. Siehe [Anmeldung](ANMELDUNG.md), [Docker/Backup](DOCKER_BACKUP.md) und [Release-Workflow](RELEASE_WORKFLOW.md).

## Änderungen sicher einbauen

1. Datenformate: `shared/types.js`, `server/domain/validation.js`, Normalisierung, Export/Import und ggf. Migration gemeinsam prüfen.
2. Neue API: Routen, Services, Fehlercodes, deutsche/englische Übersetzungen und Integrations-/Browsertests abstimmen.
3. Neue UI: bestehende Renderer aus [Designsystem](DESIGNSYSTEM.md) nutzen; fachspezifische Geometrie lokal lassen.
4. Dokumentation des **aktuellen** Vertrags bei tatsächlicher Betroffenheit im gesamten PR aktualisieren; einzelne Commits benötigen keine eigene Dokumentationsänderung (siehe [Entwicklung](ENTWICKLUNG.md)).
