# Raspberry Pi: Docker, HTTPS und Datensicherung

## Bereitschaftspruefung des Containers

Sowohl der Docker-Healthcheck als auch der interne Supervisor pruefen
`https://127.0.0.1:3543/api/version`. Dadurch muss beim Start und bei
regelmaessigen Gesundheitspruefungen nicht die gesamte `collection.json`
gelesen werden. Die Sammlung und die Backupdaten bleiben unveraendert.

## Konzept

Der WhiskyCollectionManager verwendet **einen Docker-Service `app`** mit HTTPS auf Port **3543**. Der Webserver und der zeitgesteuerte Backup-Prozess laufen im selben Container. Port 3100 ist deaktiviert; kein SSH-Tunnel und kein zusätzlicher Backup-Container sind nötig.

Alle neuen Backups verwenden **ein einziges passwortgeschütztes ZIP-Format mit AES-256 (WinZip AE-2)**, unabhängig davon, ob sie manuell oder per Zeitplan auf USB, NAS oder Cloud erstellt werden. Das ZIP enthält den vollständigen `data/`-Ordner mit `collection.json` und `warehouse.json`, Bilder in `images/` und Dokumente in `documents/`. Die Inhalte sind verschlüsselt, Dateinamen im ZIP jedoch sichtbar. Zum Öffnen auf Windows/macOS/Linux z. B. **7-Zip** oder ein anderes WinZip-AES-kompatibles Programm verwenden. Alte unverschlüsselte ZIP-Archive können weiterhin eingespielt werden, werden aber nicht nachträglich verschlüsselt.

**Sicherheit:** Die Anwendung hat noch keinen allgemeinen Login. Nur im vertrauenswürdigen Heimnetz betreiben, keine Router-Portfreigabe und keine öffentliche Bereitstellung ohne zusätzliche Zugriffskontrolle.

## Installation und Update

Seit v0.16.6 basiert das Container-Image auf `node:22-bookworm-slim` statt
`node:22-alpine`. Hintergrund: Auf einem Raspberry Pi 4 mit 64-Bit-OS
(`aarch64`) stuerzte `node --version` im vorherigen ARM64-Image unmittelbar
mit Signal 11 (Exit 139) ab; die Debian-Variante startete dagegen erfolgreich.
Restic, Rclone und der SSH-Client bleiben im Container vorhanden.

Zum gezielten Pruefen eines neu geladenen Images:

```sh
docker compose pull app
docker compose run --rm --no-deps --entrypoint node app --version
docker compose up -d --force-recreate app
docker compose ps
```

Ein erfolgreicher Node-Versionsaufruf allein ersetzt keinen Start-/HTTPS-Test
auf dem Pi. `docker compose pull` laedt identische Image-Layer nicht erneut.

Benötigt Raspberry Pi OS 64 Bit, Docker Engine, Docker Compose, Git und OpenSSL. Repository über SSH auschecken, wenn es privat ist. Bei privatem GHCR-Package muss Docker mit einem GitHub-Token (classic, `read:packages`) angemeldet sein.

```sh
git clone --branch main git@github.com:henryk86/whisky-collection-manager.git
cd whisky-collection-manager
cp deploy/.env.example .env
nano .env
sh deploy/setup-pi.sh
docker compose config
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
```

Beispiel `.env` im Projektstamm:

```dotenv
IMAGE_TAG=latest
TZ=Europe/Berlin
CERT_DNS_NAMES=home-pi,home-pi.local,localhost
CERT_IP_ADDRESSES=127.0.0.1,192.168.178.40
```

Das Image ist `ghcr.io/henryk86/whisky-collection-manager:${IMAGE_TAG:-latest}`. Für reproduzierbare Installationen lieber einen festen Tag (z. B. `v0.15.10`) verwenden. `latest` wird erst nach erfolgreicher Veröffentlichung eines neuen Releases aktualisiert. Bei Updates auf `main` bleiben die externen Daten erhalten: `git pull --ff-only && docker compose pull && docker compose up -d --remove-orphans`. Speicherverzeichnisse nicht löschen und keine Volumes mit `down -v` entfernen.

Der Zugriff erfolgt unter `https://home-pi.local:3543` oder `https://192.168.178.40:3543`, sofern Name beziehungsweise IP im Zertifikat enthalten sind. Eigene DNS-Namen und IPs über `.env` anpassen und bei vorhandenem Zertifikat `sh deploy/setup-pi.sh --renew-cert && docker compose restart app` ausführen. Das neue öffentliche Zertifikat auf dem PC erneut importieren; den privaten Schlüssel nie kopieren.

### Host-Allowlist, CSRF und Browser-Sicherheit (ab v0.15.10)

Der Server akzeptiert als HTTP-Host standardmaessig `localhost`, `127.0.0.1`,
`::1` und die Werte aus `CERT_DNS_NAMES` und `CERT_IP_ADDRESSES`.
`docker-compose.yml` gibt beide Zertifikatslisten an den Container weiter.
Weitere Namen (z. B. eine interne Reverse-Proxy-Adresse) in der Compose-`.env`
als `ALLOWED_HOSTS=name1,192.168.1.40` eintragen und dann
`docker compose up -d` ausfuehren. Ein unbekannter Host liefert HTTP 421.
Die `ALLOWED_HOSTS`-Liste ergaenzt die Zertifikatsnamen und erlaubt keine Wildcards.

**Vor einem Upgrade bestehender Installationen:** In `.env` die tatsaechlich
benutzten IP-Adressen und DNS-/Router-Namen (z. B. `whisky.fritz.box`)
mit `CERT_IP_ADDRESSES`, `CERT_DNS_NAMES` und `ALLOWED_HOSTS` vergleichen.
Aeltere lokale Installationen besitzen moeglicherweise noch keine `CERT_*`-Variablen.
Die Beispieladresse `192.168.178.40` kann durch DHCP bereits veraltet sein.
Ein neuer Host muss vor dem Update ausdruecklich eingetragen werden, sonst
antwortet der Server mit **HTTP 421**. Beim Start steht die aktive Allowlist
im Log (`docker compose logs app`); ein unbekannter Host wird einmalig
mit dem Hinweis auf `ALLOWED_HOSTS` protokolliert. Nach `.env`-Aenderungen
`docker compose up -d --force-recreate app` ausfuehren, damit die neuen
Umgebungsvariablen wirken. Bei neuen SAN-Adressen das Zertifikat mit
`sh deploy/setup-pi.sh --renew-cert` erneuern; `ALLOWED_HOSTS` allein
aktualisiert **kein** Zertifikat.

**Reverse Proxy:** Unterstuetzt wird ein Proxy, der auch **zum Backend
HTTPS** verwendet und den vom Browser aufgerufenen `Host`-Header unveraendert
durchreicht. Dieser Name muss unter `CERT_DNS_NAMES` oder `ALLOWED_HOSTS`
erlaubt sein. Ein Proxy, der TLS nur auf seiner oeffentlichen Seite beendet
und per HTTP zum WCM weiterleitet, verursacht fuer Browser-Schreibzugriffe
**403** (Origin `https:` vs. Backend `http:`). `X-Forwarded-Proto` wird
aus Sicherheitsgruenden nicht ausgewertet. Das Backend-Zertifikat muss vom
Proxy vertraut werden; unsichere TLS-Pruefung ist keine Ersatzloesung.

Schreibzugriffe von fremden Webseiten werden per Origin/Fetch Metadata verweigert.
JSON-Endpunkte erfordern `Content-Type: application/json` und liefern sonst 415.
Die Browser-Erweiterung kann fuer das lokale Foto-Staging ueber
`EXTENSION_IDS=<32-stellige-id>[,<weitere-id>]` eingeschraenkt werden.
Ohne gesetzte Variable bleibt die bisherige Chrome/Edge-Extension-Kompatibilitaet erhalten.

HTML-Antworten besitzen CSP/Frame-Schutz. Der Referrer enthaelt bei Kachelabrufen
von `tile.openstreetmap.org` nur die Herkunft (OSM verlangt einen gueltigen Referer).
**Nach der Aktualisierung** die Landkarte, den Scanner und den 3D-Raumplan im
Browser pruefen. Der Docker-Healthcheck ruft `/api/version` auf und laedt
nicht mehr alle Flaschen.

### Persistente Daten bewusst außerhalb des Checkouts

`sh deploy/setup-pi.sh` erstellt bzw. ergänzt `WCM_DATA_DIR` in der projektweiten `.env` als **absoluten Pfad außerhalb des Git-Repositories**. Vorgabe: `$HOME/whisky-collection-manager-data`. Die Compose-Bind-Mounts verweisen auf `storage/`, `backup-control/`, `backup-targets/`, `rclone/` und `secrets/` **unter diesem Verzeichnis**, nicht unter `deploy/`. Das Setup migriert keine alten Laufzeitordner; Backups vor Änderungen separat prüfen. Zertifikate liegen unter `${WCM_DATA_DIR}/secrets/certs`, der Admin-Token unter `${WCM_DATA_DIR}/secrets/backup-admin-token`.

## 1. Sofort-Backup erstellen und herunterladen

1. Anwendung öffnen → **Einstellungen & Datensicherung → Datensicherung** und mit dem Backup-Admin-Schlüssel entsperren (Schlüssel liegt unter `${WCM_DATA_DIR}/secrets/backup-admin-token`).
2. **Einmalig ein Backup-Passwort (mindestens 14 Zeichen) festlegen**, zweimal bestätigen und offline sichern. Es wird unter `${WCM_DATA_DIR}/backup-control/backup-zip-password` gespeichert und gilt für manuelle und geplante Sicherungen.
3. **Geschütztes Backup herunterladen** anklicken, die ZIP auf dem Rechner speichern und testweise mit **7-Zip und diesem Passwort** öffnen.

Kein USB-Stick, kein Backup-Profil und kein Restic-Passwort nötig. Bei fehlendem Backup-Passwort wird die Erstellung verweigert, statt unverschlüsselt zu sichern. Das ZIP wird vom gleichen Archivgenerator erstellt wie die automatischen Backups. Der Download enthält Sammlung, Lagerdatei, Fotos und Anhänge. ZIP32 hat eine technische Maximalgröße von knapp 4 GiB; bei größeren Beständen ist eine Archiv-Erweiterung erforderlich.

## 2. Zeitgesteuerte Backups: USB/NAS/Cloud

### USB-Test ohne dauerhaftes Einbinden

1. USB-Stick anstecken. Nicht formatieren; vorhandene Dateien bleiben erhalten.
2. Auf dem Pi einmal ausführen:

```sh
cd ~/whisky-collection-manager
sh deploy/setup-usb.sh
```

Das Skript zeigt die verfügbaren Laufwerke und fragt die UUID ab. Alternativ die **aktuelle UUID des tatsächlich angeschlossenen** Sticks als Argument übergeben, etwa `sh deploy/setup-usb.sh <USB-UUID>`. Keine UUID aus einer früheren Installation ungeprüft wiederverwenden. Das Skript verwendet `sudo mount` nur auf dem Pi, nicht im Container, trägt **nichts in `/etc/fstab` ein**, markiert das eingehängte Medium und startet den App-Container mit dem sichtbaren Mount neu. Der Container selbst erhält keine Mount- oder Administratorrechte. Nach dem nächsten Pi-Neustart muss der temporäre Mount erneut erfolgen.

Im Browser die Backup-Verwaltung mit dem Schlüssel aus `${WCM_DATA_DIR}/secrets/backup-admin-token` öffnen. **Backup-Ziel einrichten → USB-Stick** wählen, den Zeitplan für einen Test deaktivieren, speichern und **Jetzt sichern** klicken. Anschließend **Sicherungen anzeigen**; die ZIP-Datei ist auf dem Stick und kann im Browser heruntergeladen werden. Sie kann auf einem PC mit 7-Zip und dem Backup-Passwort geöffnet werden.

Der Marker `.whisky-backup-target` auf dem Laufwerk schützt davor, bei abgezogenem Stick still auf die SD-Karte zu sichern. Trotzdem vor jedem Test prüfen, ob der Stick tatsächlich eingehängt ist. Den Stick niemals während einer laufenden Sicherung abziehen; anschließend Container stoppen oder neu starten und das Dateisystem sicher aushängen.

### NAS / weitere lokale Ziele

Ein NAS-Mount muss vom Host unter `${WCM_DATA_DIR}/backup-targets/<name>` bereitgestellt werden. Ein Profil verwendet danach einen Unterordner wie `<name>/whisky-zip`. Der Marker muss im gemounteten Wurzelordner liegen, nicht auf der SD-Karte. Erstelle ihn **nur nach erfolgreicher Mountprüfung**. Für dauerhafte Backups empfiehlt sich ein stabiler `systemd`-Mount oder `/etc/fstab` auf dem Host; der Container bekommt weiterhin keine Mount-Berechtigung.

### Dropbox / OneDrive / Google Drive / SFTP / S3 / WebDAV

Für Cloud-Ziele wird Rclone als Transport verwendet; **auch dort wird dasselbe ZIP gespeichert**. Rclone muss einmalig mit dem Anbieter verbunden werden:

```sh
docker compose exec app rclone config
```

Danach den Remote-Namen im Backup-Profil auswählen/eintragen, einen Unterordner angeben und den Zeitplan aktivieren. Bei Cloud-OAuth auf dem Pi ohne Browser den Anweisungen von Rclone zur Autorisierung auf einem anderen Rechner folgen. Rclone-Konfiguration bleibt persistent unter `${WCM_DATA_DIR}/rclone/rclone.conf`.

### Zeitplan und Aufbewahrung

Pro Ziel sind stündliche, tägliche oder wöchentliche Backups möglich. Aufbewahrung nach Tages-, Wochen- und Monatsständen wird pro Ziel verwaltet; der letzte erfolgreich geschriebene Stand bleibt erhalten. Die Anwendung prüft neue ZIPs einschließlich **AES-HMAC-Authentifizierung** vor dem Veröffentlichen. Der Backup-Dienst arbeitet unabhängig vom Browser und benötigt keine offenen Tabs.

**Hinweis:** Sämtliche **neu erzeugten Backup-ZIPs** sind mit AES-256 passwortgeschützt. Das Passwort selbst ist für die Entschlüsselung zwingend notwendig; es wird nicht auf USB oder in der Cloud hinterlegt. Nur Dateinamen innerhalb des ZIPs bleiben sichtbar. Backup-Administrator-Schlüssel und Rclone-Zugangsdaten ebenfalls geheim halten.

## 3. Backup wiederherstellen

1. **Datensicherung → Backup einspielen** öffnen und eine Whisky-ZIP-Datei auswählen. Alternativ bei einem gespeicherten USB-/Cloud-Stand **Einspielen** klicken.
2. **Passwort des jeweiligen ZIPs** eingeben. Der Server prüft ZIP-Struktur und AES-Authentifizierung, entschlüsselt die Sicherung zunächst in einen geschützten Prüfbereich und validiert `collection.json`. Die laufende Sammlung bleibt unverändert. Für alte, unverschlüsselte Archive bleibt das Passwortfeld leer.
3. Die App zeigt Abfüllungen, Flaschen, Destillerien und Dateianzahl als Vorschau. Erst nach einer zusätzlichen Bestätigung wird die vollständige Sammlung einschließlich Bildern und Dokumenten übernommen.
4. Zuvor erstellt die Anwendung automatisch ein AES-256-geschütztes Sicherheits-ZIP unter `${WCM_DATA_DIR}/storage/backups/pre-restore-*.zip`. Bei einem Fehler beim Dateiaustausch wird der vorherige Zustand wiederhergestellt.

Für die Wiederherstellung ist der Backup-Administrator-Schlüssel erforderlich. Dieser steht bei der Pi-Installation unter `${WCM_DATA_DIR}/secrets/backup-admin-token`; er wird nur im Speicher der aktuellen Browserseite gehalten. Große Backups brauchen Platz unter `${WCM_DATA_DIR}/backup-control/imports/` und für das Sicherheits-ZIP unter `${WCM_DATA_DIR}/storage/backups/`.

### Bestehende Restic-Backups aus älteren Versionen

Alte Restic-Profile werden **nicht gelöscht oder überschrieben**. Die automatische Erstellung neuer Restic-Backups ist deaktiviert. Über „Sicherungen anzeigen → Einspielen“ oder „Altes Backup einspielen“ wird ein alter Snapshot mit dem vorhandenen Restic-Schlüssel aus `${WCM_DATA_DIR}/secrets/restic-password` wiederhergestellt und in **dasselbe passwortgeschützte ZIP-Format** umgewandelt. Danach kann man die ZIP herunterladen oder die Vorschau bestätigen und die Sammlung übernehmen.

Vor der Umstellung eines bestehenden Restic-Profils auf ZIP schlägt die App ausdrücklich einen **neuen Ordner** vor, damit das alte Repository unangetastet bleibt. Für bisherige verschlüsselte Backups den Restic-Schlüssel **unbedingt separat/offline aufbewahren**; ohne ihn sind sie nicht lesbar. Neue ZIPs benötigen ihn nicht.

## Datenverzeichnisse und Sicherheitsgrenzen

```text
${WCM_DATA_DIR}/storage/data/collection.json     Sammlungsdaten
${WCM_DATA_DIR}/storage/images/                  Fotos
${WCM_DATA_DIR}/storage/documents/               Anhänge
${WCM_DATA_DIR}/storage/backups/                 Sicherheits-ZIPs und historische Migrationen
${WCM_DATA_DIR}/backup-control/                  Profile, Backup-Passwort, Aufträge, Prüfbereiche und ZIP-Uploads
${WCM_DATA_DIR}/backup-targets/                  USB-/NAS-Mounts
${WCM_DATA_DIR}/rclone/rclone.conf                Cloud-Verbindungen
${WCM_DATA_DIR}/secrets/                          Zertifikat, Schlüssel und Backup-Tokens
```

Die App erstellt nicht mehr parallel zu den konfigurierten Backups täglich eine zweite JSON-Sicherung beim Start. Vor Schema-Migrationen und vor einer vollständigen ZIP-Wiederherstellung bleiben Sicherheitskopien weiterhin erhalten. Bei einem Release-Wechsel werden alle Daten und Secrets in den persistierten Bind-Mounts beibehalten.

Der Wechsel auf ZIP wurde funktional getestet, aber ein tatsächlicher Container-Start mit deinem USB-Stick und einem echten Cloud-Konto muss auf dem Pi überprüft werden. FAT32 begrenzt einzelne ZIP-Dateien auf unter 4 GiB; für größere Bestände empfiehlt sich ein anderes Dateisystem zusammen mit einer späteren ZIP64-Erweiterung.

## Fehler `ERR_INVALID_PACKAGE_CONFIG` beim Containerstart

Wenn Node `/app/package.json` nicht lesen kann, den Container nicht endlos
neustarten lassen. Der Fehler kann an einer falschen Image-Version, einer
ungueltigen Paketdatei im veroeffentlichten Image oder einer zusaetzlichen
Compose-Konfiguration liegen. Zuerst auf dem Pi ermitteln, welches Image
wirklich konfiguriert ist und was dieses enthaelt:

```bash
cd ~/whisky-collection-manager
docker compose config --images
docker run --rm --entrypoint cat \
  ghcr.io/henryk86/whisky-collection-manager:v0.6.41 \
  /app/package.json
```

Die Datei muss gueltiges JSON enthalten. Zum Test einer bereits gezogenen
Version ist auch `docker run --rm --entrypoint node IMAGE -p
'require("/app/package.json").version'` moeglich.

Ab v0.6.42 prueft der Release-Workflow die Paketdatei auch im
tatsaechlich publizierten Image fuer AMD64 und ARM64, bevor `latest`
umgestellt wird. Dieser Check laeuft auf GitHub und konnte hier ohne
Docker-Engine nicht lokal ausgefuehrt werden.


## Lagerverwaltung im Backup

`$WCM_DATA_DIR/storage/data/warehouse.json` liegt auf dem Host neben `collection.json` **außerhalb des Git-Checkouts** (im Container unter `/srv/whisky/data/warehouse.json`). Der bestehende Docker-Bind-Mount auf das persistente Datenverzeichnis ist ausreichend; **kein zusätzlicher Container-Mount** ist erforderlich. Beim ersten Start erzeugt die Anwendung die leere Lagerdatei.

Ein vollständiges verschlüsseltes ZIP sichert den gesamten `data/`-Ordner einschließlich `warehouse.json`. JSON-Einzelexporte enthalten dagegen ausschließlich die Sammlung. Wird eine ältere vollständige Sicherung ohne Lagerdatei zurückgespielt, entsteht beim nächsten Start ein leeres Lager. Ein aktuelles Vollbackup vor Restore ist deshalb erforderlich. Siehe [LAGER.md](LAGER.md).

## KI-Freistellung (lokale Modell-Dateien)

Beim Build des GHCR-Containers werden ONNX Runtime Web und U²-Netp einmalig heruntergeladen und im Image unter `public/ai/` abgelegt. Während des normalen Raspberry-Pi-Betriebs gibt es **keine** KI-Netzwerkanfragen und keine Modell-Berechnung auf dem Pi; es werden nur HTML/JS/Modell-Dateien ausgeliefert. Die persistenten `storage/images/`-Dateien enthalten Originale und freigestellte Ableitungen. Beide werden im vorhandenen ZIP-Backup gesichert. Siehe [Freistellungs-Dokumentation](PHOTO_FREISTELLUNG.md).
