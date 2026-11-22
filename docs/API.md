# Lokale HTTP-API

Basisadresse im Standardbetrieb: `https://<SERVER-IP>:3543` (z. B. Raspberry Pi 4). Die API arbeitet mit `schemaVersion: 6`; Abfüllungen können mehreren Destillerien zugeordnet sein, während Fotos, Nachweise und Flaschentyp an physischen Flaschen liegen. Die **optionale Loginpflicht** kann ein Administrator in der Nutzerverwaltung aktivieren. Dann benötigen Sammlungs-API, Bilder und Downloads eine gültige Sitzung; administrative Backup-Operationen behalten ihre separate Sicherheitsprüfung. Bei Internetzugriff sind HTTPS, Loginpflicht und vorzugsweise zusätzliche Netzabsicherung erforderlich.

POST/PATCH: `Content-Type: application/json` und ein JSON-Objekt. Maximal 26 MiB Anfrageinhalt. Ungültiges JSON und Nicht-Objekte werden mit 400 abgewiesen. Fehlerantwort für bekannte Fehler: `{ "error": "Invalid path.", "errorCode": "api.errors.invalidPath" }`; der `error`-Text ist als sicherer, englischer Fallback gedacht. Der Browser übersetzt `errorCode` mittels der Sprachkataloge `public/locales/de.json` und `en.json`. Bei bestimmten dynamischen Validierungen kann zusätzlich `errorParams` (z. B. `{ "field": "abv" }`) mitgeliefert werden. Für unbekannte Fehler liefert die API ausschließlich eine neutrale englische Meldung einschließlich HTTP-Status, ohne interne Fehlermeldungen offenzulegen. Bekannte Konflikte verwenden 409, nicht gefundene Ressourcen 404. Einzelheiten und beschreibbare Felder stehen in `server/routes.js` und `server/domain/normalization.js`.

### Anmeldung und Nutzerverwaltung

- `GET /api/auth/session`: öffentlich; Status `{required, user, canManageUsers}` (ohne Passwort-Hashes)
- `POST /api/auth/login`: JSON `{username, password}`; setzt HttpOnly-/SameSite-Cookie, Secure bei HTTPS
- `POST /api/auth/logout`: beendet die Sitzung; kein JSON-Body erforderlich
- `POST /api/auth/password`: angemeldet, JSON `{currentPassword, newPassword}`; erzwingt nach Erstlogin einen Passwortwechsel und rotiert das Sitzungstoken
- `GET /api/auth/users`: Administrator; gibt nur öffentliche Nutzerinformationen zurück
- `POST /api/auth/users`: Administrator, JSON `{username, password}`; neuer Nutzer mit Rolle `user` und verpflichtendem Passwortwechsel
- `POST /api/auth/users/:id/reset-password`: Administrator, JSON `{password}`; widerruft Sitzungen des Nutzers
- `DELETE /api/auth/users/:id`: Administrator; kann das eigene Administratorkonto nicht löschen
- `PATCH /api/auth/config`: Administrator, JSON `{required: true|false}`; schaltet die Loginpflicht um

Bei aktiver Loginpflicht antworten geschützte Endpunkte ohne Sitzung mit 401. Bei erzwungenem Passwortwechsel sind sie bis zur Änderung mit 403 gesperrt. `GET /api/version` bleibt für den Docker-Healthcheck öffentlich; interne Backup-Routen behalten ihre eigene Token-Authentifizierung. Weitere Einzelheiten: [Anmeldung](ANMELDUNG.md).

### Revisionsgebundene Mutationsantworten

Der Browser kann bei `POST`, `PUT`, `PATCH` und `DELETE` den optionalen Header `X-WCM-State-Delta: 1` senden. Wenn der Schreibvorgang die Sammlung oder das Lager veraendert, enthaelt die erfolgreiche JSON-Antwort statt des fachlichen Ergebnisses allein einen Umschlag:

```json
{
  "__wcmStateDelta": 1,
  "result": {"id": "example"},
  "updates": [{"before":"W/\"collection-old\"","after":"W/\"collection-new\"",
    "delta":{"kind":"collection","values":{},"arrays":{"bottlings":{"upsert":[],"remove":[]}}}}]
}
```

`result` enthaelt unveraendert die bisherige API-Antwort. `updates[]` beschreibt ausschliesslich geaenderte Werte und ID-basierte Eintraege; die konkrete Reihenfolge einer geaenderten Liste wird bei Bedarf als `order` mitgeliefert. Fuer `warehouse` wird als Vergleichsrevision die Antwortkopfzeile `X-WCM-Store-ETag` von `GET /api/warehouse` verwendet, waehrend dessen normales HTTP-`ETag` auch die Sammlung einbezieht. Der Client uebernimmt eine Aenderung **nur bei passender Ausgangsrevision**; andernfalls laedt er die betroffene Ressource erneut. Externe API-Clients ohne diesen Header erhalten **genau das bisherige Antwortformat**. Gescheiterte Mutationen liefern keine vermeintlich erfolgreichen Zustandsdeltas.

| Methode | Pfad | Ergebnis |
| --- | --- | --- |
| GET | `/api/collection` | Vollständige Sammlung, Schema 6, einschließlich optionaler `settings.establishedYear`; `ETag`, `If-None-Match` → HTTP 304 |
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
| PUT | `/api/bottles/:id/photos/:photoId/adjustments` | Nicht-destruktive Bildkorrektur als WebP-Derivat und Zahlenwerte speichern |
| DELETE | `/api/bottles/:id/photos/:photoId/adjustments` | Bildkorrektur entfernen; Original und Freistellung behalten |
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

### Eigenständige Verkostungen je Abfüllung

Eine Abfüllung kann 0–n unabhängige Verkostungen in `bottlings[].tastings[]`
führen (`schemaVersion: 6`). Dieses Array ist Pflicht; historische
Verkostungsformate werden weder angenommen noch migriert.

| Methode | Endpunkt | Funktion |
| --- | --- | --- |
| GET | `/api/bottlings/:id/tastings` | Verkostungen nach Datum absteigend |
| GET | `/api/bottlings/:id/tastings/:tastingId` | Einzelner Eintrag, Status 404 bei falscher Zuordnung |
| POST | `/api/bottlings/:id/tastings` | Eintrag erstellen (Status 201) |
| PATCH | `/api/bottlings/:id/tastings/:tastingId` | Nur angegebene editierbare Felder ändern |
| DELETE | `/api/bottlings/:id/tastings/:tastingId` | Eintrag löschen |

**POST-Beispiel** (der Server vergibt `id`, `createdAt`, `updatedAt`):

```json
{
  "tastedOn": "2026-11-15",
  "title": "Vergleichsverkostung",
  "flavorProfile": null,
  "tastingNotes": {"nose": "Vanille", "palate": "", "finish": ""},
  "whiskyColor": "butter",
  "rating": 87.5
}
```

`tastedOn` ist ein gültiges ISO-Kalenderdatum (`YYYY-MM-DD`, erforderlich),
`title` ein optionaler String mit maximal 120 Zeichen. Alle übrigen Felder
sind optional: Bewertung `null` oder 0–100, Farbe aus dem festen Farbkatalog oder als geprüftes `custom:#rrggbb` (warme Whiskyfarben inklusive Rot und Rosé; Grün und Blau unzulässig),
Geschmacksprofil `null` oder zehn Achsen im Bereich 0–10 sowie die drei
Notizfelder. Nicht freigegebene Felder und ungültige Eingaben werden abgelehnt.

Die aktuelle Bewertung ist diejenige der Verkostung mit dem jüngsten Datum;
bei Gleichstand entscheidet `createdAt` und danach die ID. **Eine letzte
Verkostung ohne Bewertung bleibt unbewertet**, auch wenn ältere Bewertungen
existieren. Die Felder `rating`, `flavorProfile`, `whiskyColor` und `tastingNotes` existieren
auf Abfüllungsebene nicht mehr. Diese Werte werden ausschließlich aus der
jüngsten `tastings[]`-Verkostung abgeleitet, niemals redundant gespeichert.
Ein `legacyTastings`-Archiv gibt es nicht mehr.

JSON- und vollständige ZIP-Sicherungen enthalten alle `tastings[]`-Datensätze;
CSV bleibt beim bisherigen Abfüllungs-/Flaschenexport.

### Verkostungsstartseite und nicht besessene Whiskys

Die Hauptnavigation enthält **Verkostungsnotizen** (`/?view=tastings`) mit einer
übergreifenden, nach Verkostungsdatum sortierten Liste. Eine neue Verkostung
wird entweder mit einer Abfüllung aus der Sammlung verknüpft (0–n Verkostungen)
oder als eigenständiger, nicht bestandswirksamer Eintrag angelegt. Die
Abfüllungsdetailseite und der globale App-Header bleiben unverändert.

Die zweite Variante erzeugt **keine externe Abfüllung** und erlaubt keine
Mehrfachverkostungen zu einem externen Whisky. Alle Informationen stehen in
**einem** `externalTastings[]`-Eintrag (weiterhin `schemaVersion: 6`):
Tasting-Felder (Datum, Titel, Farbe, Profil, Nase, Geschmack, Abgang, Bewertung),
`id`, `createdAt`, `updatedAt` und ein eingebettetes `bottling`-Objekt mit
`name` (Pflicht), optional `distillery`, `bottler`, `ageYears`, `abv`,
`releaseYear`. Keine separate Erfassung oder Verwaltung einer externen Flasche.

| Methode | Endpunkt | Funktion |
| --- | --- | --- |
| GET | `/api/external-tastings` | Eigenständige Verkostungen auflisten |
| GET | `/api/external-tastings/:id` | Einzelne Verkostung abrufen |
| POST | `/api/external-tastings` | Eigenständige Verkostung mit eingebetteten Abfüllungsangaben erstellen |
| PATCH | `/api/external-tastings/:id` | Verkostung und/oder Abfüllungsangaben bearbeiten |
| DELETE | `/api/external-tastings/:id` | Einzelne Verkostung löschen |
| POST | `/api/external-tastings/:id/assign` | Externe Verkostung einer vorhandenen Abfüllung zuordnen (`{"bottlingId":"..."}`); Eintrag wird atomar verschoben, nicht kopiert |

`POST` erwartet beispielsweise
`{"tastedOn":"2026-11-15","bottling":{"name":"Beispielwhisky","abv":46},"rating":85}`.
Beim `PATCH` bleiben nicht genannte Felder erhalten. Für den Namen sind 1–180
Zeichen erlaubt; `distillery` und `bottler` sind optionale Freitexte (bis 140
Zeichen), `ageYears` (0–200), `abv` (0–100), `releaseYear` (1800–2200)
optionale Zahlen. Ungültige Werte werden abgewiesen. Eine eigenständige
Verkostung erscheint weder in `bottlings[]`, noch in Sammlungs- und
Bestandsanalysen, wird aber in JSON-/ZIP-Sicherungen vollständig gespeichert.
Keine Migration oder Altformat-Unterstützung für `tastingBottlings[]`.

Auf der Verkostungsübersicht und der einzelnen Verkostung einer Sammlungsabfüllung
stehen die verfügbaren Angaben **Alter, Fasstyp, Alkoholgehalt** unter dem
Abfüllungsnamen. Unbekannte Angaben werden ausgelassen. „Profil zurücksetzen“
speichert `flavorProfile: null`, wiederherstellbar über Rückgängig.

## Tasting-Flights

Tasting-Flights sind optionale, nur für die Verkostungsorganisation verwendete
Gruppen in `collection.json`. Sie verändern weder Sammlungsbestand noch
Bewertungszusammenfassungen. Die Daten liegen in `schemaVersion: 6`.

| Methode | Endpunkt | Wirkung |
| --- | --- | --- |
| GET | `/api/tasting-flights` | Alle Flights anzeigen |
| POST | `/api/tasting-flights` | Flight mit `{name,date,notes}` erstellen |
| GET | `/api/tasting-flights/:id` | Flight abrufen |
| PATCH | `/api/tasting-flights/:id` | Name, Datum und/oder gemeinsame Notiz aktualisieren |
| DELETE | `/api/tasting-flights/:id` | Nur Flight löschen, **nicht** seine einzelnen Verkostungen |
| PUT | `/api/tasting-flights/:id/tastings` | Zugehörigkeit und Reihenfolge atomar setzen: `{ "tastingIds": ["id1", "id2"] }` |
| POST | `/api/tasting-flights/:id/tastings` | Neue Verkostung samt Flight-Zuordnung **atomar** speichern |

Der letzte `POST` erwartet für eine eigene Abfüllung `bottlingId` sowie die
gewöhnlichen Verkostungsfelder; bei einer externen Abfüllung stattdessen das
gewohnte eingebettete `bottling`-Objekt. Antwort: `{record,bottlingId}`.
Ein Flight darf bis zu 100 unterschiedliche vorhandene Verkostungs-IDs enthalten;
dieselbe ID darf in **höchstens einem** Flight vorkommen. Eine zweite Zuordnung
antwortet mit HTTP 409. Ungültige, verwaiste, mehrdeutige oder doppelte IDs
werden abgewiesen, ohne die Datei teilweise zu ändern. Nach dem Verschieben
einer externen Notiz zur Sammlung bleibt ihre Flight-Referenz erhalten. Beim
Löschen einzelner Verkostungen bzw. ganzer Abfüllungen werden nur die zugehörigen
Referenzen bereinigt.

Direkte URL: `/?view=tasting-flight&flight=<id>`. Eine neue oder vorhandene
Einzelverkostung kann beim Öffnen aus einem Flight zusätzlich `flight=<id>`
in der URL mitführen. Bestehende URLs bleiben unverändert funktionsfähig.

## Lagerraum löschen

- `DELETE /api/warehouse/rooms/:id` löscht nur Räume ohne zugeordnete Flaschen; bei Belegung antwortet die API mit **409** und speichert keine Teillöschung.
- `DELETE /api/warehouse/rooms/:id?unassignBottles=true` ist der ausdrücklich bestätigte Weg für belegte Räume. Er entfernt sämtliche Zuordnungen zu den Fächern dieses Raums (auch verwaiste Zuordnungen) und löscht den Raum mitsamt Möbeln und Fächern **atomar** aus `warehouse.json`.
- Physische Flaschen und Abfüllungen in `collection.json` sowie Fotos und Anhänge werden **nicht** gelöscht. Andere Raum- und Flaschenzuordnungen bleiben erhalten. Ungültige Werte für `unassignBottles` werden mit **400** abgewiesen.

## Portabler Raumtransfer (ab v0.19.0)

| Methode | Pfad | Funktion |
| --- | --- | --- |
| POST | `/api/warehouse/rooms/export` | `{ "roomIds": "all" | ["room-id", ...], "includeAssignments": true | false }` → JSON-Dokument mit einem, mehreren oder allen ausgewählten Räumen und optionalen Flaschenreferenzen |
| POST | `/api/warehouse/rooms/import/preview` | `{ "document": <Raumtransfer-Datei>, "includeAssignments": true | false, "conflictPolicy": "skip" | "replace" }` → Vorschau der möglichen Auswirkungen, **ohne zu speichern** |
| POST | `/api/warehouse/rooms/import` | Dieselbe Payload wie die Vorschau; prüft erneut gegen den aktuellen Lagerstand und schreibt **atomar** oder gar nicht |

Die JSON-Datei benutzt `format: "wcm-room-transfer"` und `formatVersion: 1`; die exportierten `rooms[]` enthalten Raumgeometrie, Möbel und Fächer, `assignments[]` optional `{ "bottleId": "...", "shelfId": "...", "inventoryNumber": "..." }`. Flaschenstammdaten und Medien gehören nicht zum Raumtransfer. Im Ziel erhalten neue Räume, Möbel und Fächer neue IDs; Zuordnungen erfolgen nur für bereits existierende, über ID oder eindeutige Inventarnummer erkannte physische Flaschen. Bestehende Flaschenzuordnungen werden nicht überschrieben. Konflikte werden standardmäßig übersprungen; `replace` ersetzt nur Räume ohne zugeordnete Flaschen, andernfalls HTTP 409 ohne Teilschreibvorgang. Die Antwort enthält Zählwerte für übernommene, fehlende, mehrdeutige, belegte und kapazitätsbedingt verworfene Flaschenzuordnungen. Die Vorschau und der Import akzeptieren maximal 200 Räume sowie Dateien bis 12 MiB.

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

## Bildkorrekturen

`PUT /api/bottles/:id/photos/:photoId/adjustments` erwartet `{ "image": "data:image/webp;base64,...", "settings": { "exposure": 0.5, "contrast": 12, "highlights": -20, "shadows": 20, "temperature": 0, "tint": 0, "saturation": 0, "clarity": 10, "sharpen": 10 } }`. Die neun Zahlen werden begrenzt und geprüft (Belichtung −2..+2; Lichter/Tiefen, Kontrast, Temperatur, Tönung, Sättigung, Klarheit jeweils −100..100; Schärfe 0..100). Unbekannte Felder und ungültige Daten werden abgelehnt. Das WebP darf maximal 10 MB groß sein. Quelle, Pfad, Bild-ID und Datenträgerverzeichnisse werden ausschließlich serverseitig bestimmt. Ein abgeschlossener PUT löscht die alte Ableitung, nie das Original. `DELETE` entfernt nur die Ableitung der **aktiven** Variante. Original und Freistellung können eigene Bearbeitungssätze besitzen (`photo.adjustment` und `photo.cutout.adjustment`); bei alten Sammlungen bleibt ein einzelnes `adjustment` mit `sourcePath` zur Freistellung lesbar. Alle Derivate werden im vollständigen Backup berücksichtigt.

## Dateien & Nachweise

`POST /api/bottles/:id/files` benötigt ein JSON-Objekt mit `filename` (Originaldateiname) und `data` (Data-URL mit Base64-Kodierung, beispielsweise `data:application/pdf;base64,...`). Das Uploadformat ist **nicht** das Speicherformat. Die Datei liegt nach der Übertragung als normale Binärdatei in `documents/<bottleId>/`, in `collection.json` bleibt nur eine Referenz (`id`, `name`, `path`, `size`, `mimeType`, `sha256`, `uploadedAt`). Maximal 15 MiB pro Datei, bis 26 MiB JSON-Anfragegröße. Unterstützte Dateitypen: PDF, JPG/JPEG, PNG, WebP, GIF, HEIC/HEIF, TXT, CSV, EML, DOCX, XLSX, ODT und ODS. Der Server prüft Dateiname, Erweiterung und grundlegende Dateisignaturen.

Nur Dateien, die genau dieser physischen Flasche zugeordnet sind, können über den Download-Endpunkt geladen werden. Sie werden mit `Content-Disposition: attachment` und `application/octet-stream` ausgeliefert, nicht als öffentliches statisches HTML. Nach erfolgreichem Löschen wird die Datei vom Dateisystem entfernt. Beim Löschen der gesamten Flasche bleiben die Dateien aus Gründen der Wiederherstellbarkeit wie Fotos vorerst auf dem Datenträger, aber ohne aktiven JSON-Verweis.

`volumeType` gehört zu `POST /api/bottles`, `PATCH /api/bottles/:id` und der `firstBottle`-Eigenschaft beim Erstellen einer Abfüllung. Erlaubt sind `standard` und `sample`. `volumeMl` beschreibt bei einer physischen Flasche ihre tatsächliche Größe in ml; unabhängig davon kann die Abfüllung eine Hersteller-Nennfüllmenge (`bottlings[].volumeMl`) speichern. `PATCH /api/bottlings/:id` akzeptiert keinen `volumeType` mehr.

## Kompatibilität

Inventarnummern sind Strings, nicht Zahlen. Veraltetes `labelCode` wird bei neuen API-Anfragen abgewiesen. `labelType` gehört nicht zu den beschreibbaren Feldern. Alte Sammlungen werden beim Import/Start einschließlich Schema 3 durch den Migrationspfad auf Schema 6 angehoben; neue Daten verwenden ausschließlich `inventoryNumber`.

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
| POST | `/api/warehouse/furniture/:id/photos` | Möbelbild hinzufügen (JSON `{ "image": "data:image/...;base64,..." }`), Rückgabe Foto-ID und Bildpfad |
| PUT | `/api/warehouse/furniture/:id/photos/order` | Möbelfotos umsortieren, Body `{ "photoIds": ["..."] }` |
| DELETE | `/api/warehouse/furniture/:id/photos/:photoId` | Möbelbild einschließlich Bilddatei löschen |
| POST | `/api/warehouse/furniture/:id/shelves` | Fach anlegen |
| PATCH / DELETE | `/api/warehouse/shelves/:id` | Fach bearbeiten/entfernen |
| POST | `/api/warehouse/shelves/:id/copy` | Fach (optional in anderes Möbel) kopieren. Body `{ "furnitureId": "zielmoebel", "name": "..." }` (optional), Kapazität wird übernommen, keine Zuordnungen |
| PUT | `/api/warehouse/bottles/:id` | Einzelne physische Flasche zuordnen, Body `{ "shelfId": "fach-id" }`, oder mit `null` entkoppeln; bei bestaetigter Ueberbelegung optional `increaseCapacityTo` als maximal genehmigte neue Kapazitaet |
| POST | `/api/warehouse/bottles/bulk` | Bis zu 500 verschiedene physische Flaschen gemeinsam zuordnen: `{ "ids": ["id1", "id2"], "shelfId": "fach-id" }`; `null` hebt die Zuordnung auf. Kapazitaetspruefung und Speicherung atomar; bei Platzmangel HTTP 409 ohne Teilzuordnung, es sei denn `increaseCapacityTo` ist nach Benutzerbestaetigung ausreichend |

Lagermöbel-POST/-PATCH erlauben zusätzlich `elevation` (Unterkante über Boden, 0–10 m) und `itemHeight` (Möbelhöhe, 0,1–5 m). Beide Felder sind für Bestandsdaten optional. Der Typ `haengeregal` ist zulässig; die Kopierfunktion berücksichtigt getrennte Höhenbereiche bei gleichen Grundflächen. Die Gesamtkapazität pro Raum wird clientseitig aus den vorhandenen Fachkapazitäten ermittelt, nicht als redundantes Datenfeld gespeichert.

Validierungsfehler liefern HTTP 400; unbekannte IDs 404, ein volles Fach oder eine versuchte Löschung belegter Orte 409. Eine Lageroperation verändert nie `collection.json`. JSON-Collection-Export/Import enthält die Lagerdaten **nicht**; die vollständigen ZIP-Backups enthalten `data/warehouse.json`. [Details](LAGER.md).

## Gemischte Lagerfächer und Mehrfachbearbeitung

- `POST /api/bottlings` / `PATCH /api/bottlings/:id`: Ein `flavorProfile` wird auf Abfüllungsebene abgelehnt. Es gehört ausschließlich zu einer eigenen oder externen Verkostung. Dort sind zehn Achsen zulässig; die bisherigen acht Felder bleiben für ältere Clients weiterhin gültig. Die zwei neuen Achsen `smoky`, `medicinal` sind bei älteren Profilen `null` (nicht erfasst). Zwischenzeitliche elf-Achsen-Profile mit `fiery` können noch eingelesen werden; `fiery` wird beim Normalisieren verworfen.
- Möbelfotos werden in `warehouse.json` als sortiertes `photos`-Array zugeordnet. Maximal 24 Bilder pro Möbel; vollständige ZIP-Backups umfassen das Bildverzeichnis und die Zuordnungen.
- `POST /api/warehouse/furniture/:id/shelves` / `PATCH /api/warehouse/shelves/:id`: Fachname, `capacity`, optional `front` (`open`, `door`, `glass`, `drawer`, `null`) und `heightCm` (5–500 cm oder `null`). Ohne Angabe gelten Frontstandard und automatische Höhenverteilung.
- `PATCH /api/warehouse/shelves/:id/move` mit `{"direction":"up"}` bzw. `{"direction":"down"}` ändert die Reihenfolge von unten nach oben; IDs und Flaschenzuordnungen bleiben erhalten.
- `POST /api/warehouse/shelves/:id/copy` und `POST /api/warehouse/furniture/:id/copy` übernehmen auch Fachfronten und Höhen, aber **keine** Flaschenzuordnungen. Wird die Möbelhöhe überschritten, antwortet die API mit HTTP 409.
- `PATCH /api/warehouse/furniture/bulk` mit `{"ids":["..."],"changes":{"rotation":90,"elevation":1}}` ändert ausgewählte Eigenschaften bei allen Möbeln atomar. Unterstützt `rotation`, `elevation`, `itemHeight`, `width`, `depth`, `leftSidePanel`, `rightSidePanel`, `backPanel`, `doorLeaves` und `glassFrame`. Sind Maße/Positionen oder bereits definierte Fachhöhen ungültig, wird nichts gespeichert.

Möbel bieten außerdem optionale Seitenwände, Rückwand, Türflügel und Glasrahmen. Zusammenhängende `doorRanges` legen Fronten über fortlaufende Fachnummern fest (von unten nach oben, keine Überlappungen). Leere Fachkapazität (`null`) ist unbegrenzt; `0` verbietet jede Flaschenzuordnung. Fuer positive, zu kleine Kapazitaeten kann das Frontend nach einer ausdruecklichen Rueckfrage `increaseCapacityTo` (ganze Zahl bis 10000) mitsenden. Der Server erhoeht die Fachkapazitaet **nur auf den tatsaechlich benoetigten Wert** und fuehrt die Zuordnungen im selben atomaren Vorgang durch. Ist der Bedarf hoeher als der genehmigte Wert, bleibt alles unveraendert (HTTP 409). Fuer Kapazitaet 0 ist diese Freigabe gesperrt.

`warehouse.json` behält `schemaVersion: 1` und ist rückwärtskompatibel. Das Collection-JSON wird nicht durch Lagerbefehle verändert.

## Optionale Foto-Freistellung (v0.16.0)

- `PUT /api/bottles/:bottleId/photos/:photoId/cutout` – `{ "image": "data:image/png;base64,..." }` speichert eine neue transparente Ableitung. Optional erlaubt der Request zusätzlich `{ "adjustment": { "image": "data:image/webp;base64,...", "settings": { "exposure": 0.5 } } }`, um die korrigierte Vorschau **atomar zusammen mit der Freistellung** abzulegen. Die Basismaske ist uneditiert; die aktuelle Korrektur wird nur einmal auf das freigestellte Bild angewendet. Vorhandene Korrekturen des Originalbilds werden nicht gelöscht. Der Server entscheidet über Quellpfade und Dateinamen.
- `PATCH /api/bottles/:bottleId/photos/:photoId/cutout` – `{ "selected": true|false }` wechselt die Anzeige zwischen Freistellung und unverändertem Original.
- `DELETE /api/bottles/:bottleId/photos/:photoId/cutout` – entfernt ausschließlich die Ableitung; das Original bleibt erhalten.

Alle drei Endpunkte sind normale schreibende JSON-/Origin-geschützte APIs. Die bestehenden Foto-IDs und Sammlungsrouten ändern sich nicht. Das optionale Feld `photos[].cutout` wird in der Sammlung zurückgegeben und bei Backup/Restore erhalten. Einzelheiten: [PHOTO_FREISTELLUNG.md](PHOTO_FREISTELLUNG.md).

### Schema-Upgrade 5 → 6

Beim Laden und beim JSON-/ZIP-Import werden Collection-Dateien aus Schema 5 nach Schema 6 angehoben.
Dabei bleiben alle Verkostungen, externen Verkostungen, Flights und bereits gespeicherten `ratingComment`-Felder erhalten.
Das optionale Textfeld `ratingComment` darf bei eigenen und externen Verkostungen bis zu 10.000 Zeichen enthalten.
Vor einer automatischen Migration wird eine Originalkopie unter `backups/pre-schema6-…json` abgelegt; unbekannte neuere Schemata werden weiterhin abgewiesen.
