# Lokale HTTP-API

Basisadresse im Standardbetrieb: `https://<SERVER-IP>:3543` (z. B. Raspberry Pi 4). Die API arbeitet mit `schemaVersion: 4`; Abfüllungen können mehreren Destillerien zugeordnet sein, während Fotos, Nachweise und Flaschentyp an physischen Flaschen liegen. Für die Sammlung gibt es **keinen allgemeinen Benutzerlogin**. Nur administrative Backup-Operationen verlangen einen separaten Schlüssel. Die Anwendung darf nicht ohne zusätzliche Zugriffskontrolle öffentlich erreichbar sein.

POST/PATCH: `Content-Type: application/json` und ein JSON-Objekt. Maximal 26 MiB Anfrageinhalt. Ungültiges JSON und Nicht-Objekte werden mit 400 abgewiesen. Fehlerantwort: `{ "error": "Beschreibung" }`. Bekannte Konflikte verwenden 409, nicht gefundene Ressourcen 404. Einzelheiten und beschreibbare Felder stehen in `server/routes.js` und `server/domain/normalization.js`.

| Methode | Pfad | Ergebnis |
| --- | --- | --- |
| GET | `/api/collection` | Vollständige Sammlung, Schema 4, einschließlich optionaler `settings.establishedYear` |
| PATCH | `/api/settings` | Gründungsjahr als `{ "establishedYear": 1992 }` speichern oder mit `null` entfernen; ganze Zahl von 1600 bis zum aktuellen Jahr |
| GET | `/api/suggest-number` | `{ "number": "000001" }` als Vorschlag; noch nicht reserviert |
| POST | `/api/bottlings` | Abfüllung mit erster physischer Flasche, Status 201 |
| PATCH | `/api/bottlings/:id` | Aktualisierte Abfüllung |
| DELETE | `/api/bottlings/:id` | Nur ohne enthaltene Flaschen möglich |
| POST | `/api/bottles` | Neue physische Flasche, Status 201 |
| PATCH | `/api/bottles/:id` | Aktualisierte Flasche |
| DELETE | `/api/bottles/:id` | Flasche entfernt; Inventarnummer bleibt im Verlauf (kein Auto-Vorschlag), darf manuell erneut vergeben werden, wenn frei |
| POST | `/api/bottles/:id/photos` | Foto angehängt, Status 201 |
| PUT | `/api/bottles/:id/photos/order` | Reihenfolge als `{ "photoIds": ["uuid", ...] }`; exakt dieselben Foto-IDs erforderlich |
| POST | `/api/import-image/stage` | Optionales Bild (Data-URL) für 15 Minuten im Arbeitsspeicher hinterlegen, liefert `{ "token", "expiresInSeconds" }` |
| GET | `/api/import-image/stage/:token` | Temporäre Bildvorschau; nicht Teil der Sammlung |
| POST | `/api/bottles/:id/photos/from-stage` | Kopiert das zuvor übertragene Bild als eigene Datei zur angegebenen Flasche, JSON `{ "token": "uuid" }` |
| DELETE | `/api/bottles/:id/photos/:photoId` | Einzelnes Foto entfernt |
| POST | `/api/bottles/:id/files` | Anhang zu einer physischen Flasche, Status 201 |
| GET | `/api/bottles/:id/files/:fileId` | Anhang als Datei herunterladen, nicht inline anzeigen |
| DELETE | `/api/bottles/:id/files/:fileId` | Anhang entfernen und zugehörige Datei löschen |
| POST | `/api/distilleries` | Neue Destillerie, Status 201 |
| PATCH | `/api/distilleries/:id` | Destillerie-Stammdaten (Name, Status, Herkunft, Koordinaten) aktualisieren |
| GET | `/api/export/json` | JSON-Download |
| GET | `/api/export/csv` | UTF-8-CSV mit BOM und Semikolon |
| GET | `/api/export/zip` | AES-256-verschlüsseltes ZIP mit Sammlung, Lager, Fotos und Dokumenten; Admin-Token erforderlich |
| POST | `/api/import/json` | Ersetzt Sammlung, erhält reservierte Nummern; Bilder und Nachweise separat |

## Schreibschutz und Anfrageformat (ab v0.15.10)

- Jeder JSON-POST/PATCH/PUT erwartet `Content-Type: application/json`
  (optionales `; charset=utf-8` erlaubt); sonst HTTP 415.
- Schreibzugriffe auf `/api/*` mit fremdem `Origin` bzw. fremder
  `Sec-Fetch-Site` werden mit HTTP 403 abgelehnt. Die explizit zugelassene
  Chrome-Extension darf nur `/api/import-image/stage` von externem Origin aufrufen.
- Unbekannte HTTP-Hosts werden vor der Routenverarbeitung mit 421 abgewiesen.
  `ALLOWED_HOSTS` kann zusaetzliche erlaubte Namen hinzufuegen.
- `/internal/backup/*` behaelt die Token-Absicherung; ZIP-Binaeruploads bleiben
  vom JSON-Medientyp-Check unberuehrt.
- Statische HTML-Antworten besitzen CSP, `X-Frame-Options` und
  `Referrer-Policy: strict-origin-when-cross-origin`.

## Einheitliche ZIP-Backups

`GET /api/export/zip` erzeugt ein AES-256-geschütztes ZIP und benötigt kein Backup-Profil, aber den Header `X-Backup-Admin-Token` mit dem Schlüssel aus `${WCM_DATA_DIR}/secrets/backup-admin-token`. Zuvor muss über `POST /api/backups/password` das gemeinsame Backup-Passwort konfiguriert werden. Das Passwort wird nie in einer API-Antwort ausgegeben. Die Passwort-Payload enthält `password`, `confirm` und bei einer Änderung `previous`. Alte Archive werden bei der Rotation nicht umgeschlüsselt.

| Methode | Pfad | Funktion |
| --- | --- | --- |
| GET | `/api/version` | Installierte App-Version (aus package.json) |
| GET | `/api/backups` | Backup-Profile, Laufwerke, Worker-Status, `passwordConfigured` und Aufträge |
| POST | `/api/backups/password` | Gemeinsames ZIP-Passwort festlegen oder mit altem Passwort ändern |
| POST | `/api/backups` | Neues ZIP-Profil (USB/NAS/Rclone) anlegen |
| PUT | `/api/backups/:id` | Profil oder Zeitplan ändern |
| DELETE | `/api/backups/:id` | Nur Profil löschen; Archive bleiben erhalten |
| POST | `/api/backups/:id/run` | Sofort-Sicherung anstoßen |
| POST | `/api/backups/:id/test` | Backup-Ziel auf Schreibzugriff prüfen |
| POST | `/api/backups/:id/snapshots` | Gespeicherte Stände laden |
| POST | `/api/backups/:id/check` | Sicherungsstände auf Integrität prüfen |
| GET | `/api/backups/:id/files/:dateiname` | Ein lokales ZIP aus markiertem Backup-Ziel herunterladen |
| POST | `/api/backups/:id/prepare` | Gespeicherten ZIP-Stand oder alten Restic-Stand zur Vorschau vorbereiten (`snapshotId`) |
| POST | `/api/backups/import-zip` | ZIP-Upload als `application/zip` zur Prüfung (streamed); Passwort URL-kodiert im Header `X-Backup-Zip-Password` |
| POST | `/api/backups/import-zip/:id/unlock` | Vorbereitete Sicherung mit `{ "password": "..." }` entschlüsseln und Vorschau erstellen |
| GET | `/api/backups/import-zip/:id` | Geprüfte Vorschau mit Sammlungszahlen |
| GET | `/api/backups/import-zip/:id/download` | Vorbereitetes ZIP herunterladen (auch aus altem Restic) |
| POST | `/api/backups/import-zip/:id/apply` | Nach `{ "acknowledge": true, "password": "..." }` geprüft wiederherstellen |

Das AES-256-geschützte ZIP ist mit geeignetem ZIP-Entpacker und Passwort lesbar (Sammlung, `data/warehouse.json`, Bilder und Dokumente). Archivdateien und die Rückfallkopie werden nicht in der Sammlungs-JSON gespeichert. Das alte JSON-Importformat bleibt für Datenmigrationen erhalten, ist jedoch **keine vollständige Wiederherstellung**, weil Medien nicht enthalten sind. Neue Sicherungsprofile speichern ausschließlich ZIPs; alte Restic-Profile erzeugen keine neuen Restic-Backups mehr.

## Abfüllung erstellen

```json
{
  "name": "Meine Abfüllung",
  "whiskyType": "blended_malt",
  "distilleryIds": [],
  "compositionComplete": false,
  "abv": 46,
  "volumeMl": 700,
  "firstBottle": {
    "inventoryNumber": "000123",
    "status": "closed",
    "volumeType": "standard",
    "volumeMl": 700
  }
}
```

Antwort: `{ "bottling": { ... }, "bottle": { ... } }`. Die separate `bottle` in dieser Antwort ist eine praktische Referenz für nachfolgende Uploads; **in der gespeicherten JSON-Datei** liegt sie nur unter `bottlings[].bottles[]`.

## Weitere Flasche und Foto

`POST /api/bottles` erwartet `bottlingId` sowie die individuellen Flaschendaten. `bottlingId` ist ein API-Zuordnungsparameter und wird nicht in der verschachtelten Flasche gespeichert. PATCH auf eine Flasche ändert keine Abfüllungsdaten.

Der Foto-Endpunkt akzeptiert `{ "image": "data:image/jpeg;base64,..." }`. Das ist nur das Uploadformat: Auf dem Datenträger entsteht eine separate Bilddatei, im JSON lediglich `{ "id", "path", "createdAt" }`. Unterstützte Bildtypen: JPEG, PNG, WebP, GIF. Base64-Bilddaten werden nicht in der Sammlung gespeichert. Die Reihenfolge entspricht der Reihenfolge des `photos[]`-Arrays; bei Umordnung bleiben IDs und relative Pfade unverändert. Ein extern übergebenes Foto kann als fremdes Referenzbild gekennzeichnet sein; diese Information wird bei bestehenden Fotos beibehalten. Das temporäre Server-Staging liegt nur im Arbeitsspeicher, verfällt nach 15 Minuten und ist kein persistenter externer Link.

## Dateien & Nachweise

`POST /api/bottles/:id/files` benötigt ein JSON-Objekt mit `filename` (Originaldateiname) und `data` (Data-URL mit Base64-Kodierung, beispielsweise `data:application/pdf;base64,...`). Das Uploadformat ist **nicht** das Speicherformat. Die Datei liegt nach der Übertragung als normale Binärdatei in `documents/<bottleId>/`, in `collection.json` bleibt nur eine Referenz (`id`, `name`, `path`, `size`, `mimeType`, `sha256`, `uploadedAt`). Maximal 15 MiB pro Datei, bis 26 MiB JSON-Anfragegröße. Unterstützte Dateitypen: PDF, JPG/JPEG, PNG, WebP, GIF, HEIC/HEIF, TXT, CSV, EML, DOCX, XLSX, ODT und ODS. Der Server prüft Dateiname, Erweiterung und grundlegende Dateisignaturen.

Nur Dateien, die genau dieser physischen Flasche zugeordnet sind, können über den Download-Endpunkt geladen werden. Sie werden mit `Content-Disposition: attachment` und `application/octet-stream` ausgeliefert, nicht als öffentliches statisches HTML. Nach erfolgreichem Löschen wird die Datei vom Dateisystem entfernt. Beim Löschen der gesamten Flasche bleiben die Dateien aus Gründen der Wiederherstellbarkeit wie Fotos vorerst auf dem Datenträger, aber ohne aktiven JSON-Verweis.

`volumeType` gehört zu `POST /api/bottles`, `PATCH /api/bottles/:id` und der `firstBottle`-Eigenschaft beim Erstellen einer Abfüllung. Erlaubt sind `standard` und `sample`. `volumeMl` beschreibt bei einer physischen Flasche ihre tatsächliche Größe in ml; unabhängig davon kann die Abfüllung eine Hersteller-Nennfüllmenge (`bottlings[].volumeMl`) speichern. `PATCH /api/bottlings/:id` akzeptiert keinen `volumeType` mehr.

## Kompatibilität

Inventarnummern sind Strings, nicht Zahlen. Veraltetes `labelCode` wird bei neuen API-Anfragen abgewiesen. `labelType` gehört nicht zu den beschreibbaren Feldern. Alte Sammlungen werden beim Import/Start einschließlich Schema 3 durch den Migrationspfad auf Schema 4 angehoben; neue Daten verwenden ausschließlich `inventoryNumber`.

## Kartenseite und Destilleriestandorte

Die vorhandenen Endpunkte `GET /api/collection`, `POST /api/distilleries` und `PATCH /api/distilleries/:id` unterstützen bei Destillerien **optionale numerische Felder** `latitude` (-90 bis 90) und `longitude` (-180 bis 180). Beide müssen zusammen gesetzt oder mit `null` gelöscht werden. Namen und IDs bleiben unverändert; ältere Sammlungen und ZIP-Backups ohne Koordinaten bleiben kompatibel.

`POST /api/map/find-distillery` mit `{ "name": "Kilchoman" }` startet **nur nach Benutzeraktion** eine externe OpenStreetMap-Nominatim-Suche und gibt bis zu fünf Kandidaten der Form `{ "name": "…", "latitude": 55.7869, "longitude": -6.4308 }` zurück. Dies verändert die Sammlung **nicht**: Erst nach Auswahl und separatem `PATCH /api/distilleries/:id` werden Koordinaten gespeichert. Die Suche ist auf eine Anfrage pro 1,2 Sekunden begrenzt, cached Ergebnisse 24 Stunden und kann bei Nichtverfügbarkeit `503`, bei zu rascher Folge `429` liefern. OSM-Nutzungsbedingungen: https://operations.osmfoundation.org/policies/nominatim/.

## Analyse und Datumsfilter

Die Analyse hat **keine eigenen persistierenden API-Endpunkte**. Sie liest `GET /api/collection` und berechnet die 38 Kennzahlen vollständig im Browser (`public/js/domain/analytics.js`). Die globalen Analysefilter werden in die Navigations-URL übernommen; die **Datumsgrenzen** (`YYYY-MM-DD`) sind UI-Zustand für die Zeitdiagramme und werden vor der Monats-/Jahresaggregation angewandt. Es werden keine Abfüllungs- oder Flaschenfelder durch diese Auswertung geschrieben.


## Lager-API

Die Lagerdaten werden unabhängig von der Sammlung gespeichert. Alle Ressourcen liegen unter `/api/warehouse`. Raum-/Möbel-/Fach-IDs und Flaschen-IDs werden unverändert als stabile Referenzen genutzt.

| Methode | Pfad | Funktion |
|---|---|---|
| GET | `/api/warehouse` | Räume, Möbel, Fächer, gültige Zuordnungen und lesbare Flaschenliste (mit optionalem `photoPath` zum bereits vorhandenen lokalen Flaschenfoto) |
| POST / PATCH / DELETE | `/api/warehouse/rooms` bzw. `/api/warehouse/rooms/:id` | Raum anlegen, bearbeiten, entfernen |
| POST | `/api/warehouse/rooms/:id/furniture` | Lagermöbel im Raum erstellen |
| PATCH / DELETE | `/api/warehouse/furniture/:id` | Lagermöbel bearbeiten/entfernen |
| PATCH | `/api/warehouse/furniture/bulk` | Ausgewählte Eigenschaften mehrerer Möbel atomar ändern (`ids`, `changes`) |
| POST | `/api/warehouse/furniture/bulk/delete` | Mehrere ausgewählte Möbel atomar löschen (`ids`); belegte Möbel verhindern die gesamte Löschung |
| POST | `/api/warehouse/furniture/:id/copy` | Möbel (optional in anderem Raum) kopieren. Body `{ "roomId": "zielraum", "name": "...", "withShelves": true }` (alles optional); neue IDs, keine Zuordnungen. Bei fehlendem Platz 409 |
| POST | `/api/warehouse/furniture/:id/shelves` | Fach anlegen |
| PATCH / DELETE | `/api/warehouse/shelves/:id` | Fach bearbeiten/entfernen |
| POST | `/api/warehouse/shelves/:id/copy` | Fach (optional in anderes Möbel) kopieren. Body `{ "furnitureId": "zielmoebel", "name": "..." }` (optional), Kapazität wird übernommen, keine Zuordnungen |
| PUT | `/api/warehouse/bottles/:id` | Einzelne physische Flasche zuordnen, Body `{ "shelfId": "fach-id" }`, oder mit `null` entkoppeln |

Lagermöbel-POST/-PATCH erlauben zusätzlich `elevation` (Unterkante über Boden, 0–10 m) und `itemHeight` (Möbelhöhe, 0,1–5 m). Beide Felder sind für Bestandsdaten optional. Der Typ `haengeregal` ist zulässig; die Kopierfunktion berücksichtigt getrennte Höhenbereiche bei gleichen Grundflächen. Die Gesamtkapazität pro Raum wird clientseitig aus den vorhandenen Fachkapazitäten ermittelt, nicht als redundantes Datenfeld gespeichert.

Validierungsfehler liefern HTTP 400; unbekannte IDs 404, ein volles Fach oder eine versuchte Löschung belegter Orte 409. Eine Lageroperation verändert nie `collection.json`. JSON-Collection-Export/Import enthält die Lagerdaten **nicht**; die vollständigen ZIP-Backups enthalten `data/warehouse.json`. [Details](LAGER.md).

## Gemischte Lagerfächer und Mehrfachbearbeitung

- `POST /api/warehouse/furniture/:id/shelves` / `PATCH /api/warehouse/shelves/:id`: Fachname, `capacity`, optional `front` (`open`, `door`, `glass`, `drawer`, `null`) und `heightCm` (5–500 cm oder `null`). Ohne Angabe gelten Frontstandard und automatische Höhenverteilung.
- `PATCH /api/warehouse/shelves/:id/move` mit `{"direction":"up"}` bzw. `{"direction":"down"}` ändert die Reihenfolge von unten nach oben; IDs und Flaschenzuordnungen bleiben erhalten.
- `POST /api/warehouse/shelves/:id/copy` und `POST /api/warehouse/furniture/:id/copy` übernehmen auch Fachfronten und Höhen, aber **keine** Flaschenzuordnungen. Wird die Möbelhöhe überschritten, antwortet die API mit HTTP 409.
- `PATCH /api/warehouse/furniture/bulk` mit `{"ids":["..."],"changes":{"rotation":90,"elevation":1}}` ändert ausgewählte Eigenschaften bei allen Möbeln atomar. Unterstützt `rotation`, `elevation`, `itemHeight`, `width`, `depth`, `leftSidePanel`, `rightSidePanel`, `backPanel`, `doorLeaves` und `glassFrame`. Sind Maße/Positionen oder bereits definierte Fachhöhen ungültig, wird nichts gespeichert.

Möbel bieten außerdem optionale Seitenwände, Rückwand, Türflügel und Glasrahmen. Zusammenhängende `doorRanges` legen Fronten über fortlaufende Fachnummern fest (von unten nach oben, keine Überlappungen). Leere Fachkapazität (`null`) ist unbegrenzt; `0` verbietet jede Flaschenzuordnung.

`warehouse.json` behält `schemaVersion: 1` und ist rückwärtskompatibel. Das Collection-JSON wird nicht durch Lagerbefehle verändert.

## Optionale Foto-Freistellung (v0.16.0)

- `PUT /api/bottles/:bottleId/photos/:photoId/cutout` – `{ "image": "data:image/png;base64,..." }` speichert eine neue transparente Ableitung und wählt sie zur Anzeige aus; ersetzt eine vorherige Ableitung nach erfolgreicher Transaktion.
- `PATCH /api/bottles/:bottleId/photos/:photoId/cutout` – `{ "selected": true|false }` wechselt die Anzeige zwischen Freistellung und unverändertem Original.
- `DELETE /api/bottles/:bottleId/photos/:photoId/cutout` – entfernt ausschließlich die Ableitung; das Original bleibt erhalten.

Alle drei Endpunkte sind normale schreibende JSON-/Origin-geschützte APIs. Die bestehenden Foto-IDs und Sammlungsrouten ändern sich nicht. Das optionale Feld `photos[].cutout` wird in der Sammlung zurückgegeben und bei Backup/Restore erhalten. Einzelheiten: [PHOTO_FREISTELLUNG.md](PHOTO_FREISTELLUNG.md).
