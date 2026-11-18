# Optionales Let's Encrypt mit Certbot und DNS-01

Die Standardinstallation **bleibt unverändert**: `app` liefert HTTPS mit einem lokal
signierten Zertifikat auf dem internen Port 3543 und veröffentlicht standardmäßig
Host-Port 3543. Das Zertifikat bleibt auch für den internen Backup-Prozess nötig.

Optional kann **ein zweiter HTTPS-Endpunkt** mit einem öffentlichen Zertifikat
über das Compose-Profil `letsencrypt` aktiviert werden. Dafür läuft NGINX als
separater TLS-Reverse-Proxy vor dem **weiterhin per TLS erreichbaren** App-Server.
Die Verbindung zwischen NGINX und `app` prüft den Namen `localhost` gegen das
bestehende lokale Zertifikat; `proxy_ssl_verify` bleibt aktiviert.
Certbot läuft ausschließlich für Ausstellung und Erneuerung als kurzlebiger
Docker-Container. Es benötigt weder eingehenden HTTP-/HTTPS-Traffic noch Port 80.

## Voraussetzungen

- Docker Engine mit Compose-Plugin, OpenSSL und ein eingerichteter Pi
  (`sh deploy/setup-pi.sh` wurde bereits ausgeführt).
- Eine **eigene, öffentlich registrierte Domain** wie `whisky.example.org` mit
  verwaltbarer DNS-Zone. DNS-01 kann keine Zertifikate für `.local`,
  `localhost` oder private IP-Adressen ausstellen.
- DNS-API-Zugriff. Unterstützt werden **netcup CloudDNS** (neue netcup-API),
  **netcup Legacy DNS** (CCP-API), **Cloudflare** (eingeschränkter API-Token
  mit `Zone:DNS:Edit`) und **RFC 2136** (Dynamic Update/TSIG). Die netcup-
  Unterstützung erfolgt über das Drittanbieter-Plugin
  [`certbot-dns-netcup`](https://github.com/coldfix/certbot-dns-netcup) v2.1.0.
- Für Zugriff nur im Heimnetz muss der Domainname im Heimnetz auf die private
  IP des Pi zeigen (z. B. interner DNS-Eintrag). Eine Weiterleitung von
  Router-Port 443 ins Internet ist **nicht** erforderlich und sollte ohne
  zusätzliche Authentifizierung **nicht** eingerichtet werden.

> Ein gültiges TLS-Zertifikat ist keine Zugangskontrolle. WCM hat keinen
> allgemeinen Login. Der Internetzugriff ohne VPN oder vorgelagerte
> Authentifizierung ist nicht vorgesehen.

## Konfiguration

Im Projektstamm `.env` ergänzen (echten DNS-Namen und E-Mail eintragen):

```dotenv
# Bisheriger Zugriff bleibt auf diesem Port bestehen (Standard: 3543).
HTTPS_PUBLIC_PORT=3543

# Optionaler zusätzlicher TLS-Endpunkt (Standard: 443).
LE_HTTPS_PUBLIC_PORT=443
LE_DOMAIN=whisky.example.org
LE_EMAIL=admin@example.org
LE_DNS_PROVIDER=netcup-clouddns
LE_DNS_PROPAGATION_SECONDS=900
```

**netcup CloudDNS (empfohlen für neue netcup-DNS-Zonen):** Im netcup Customer
Control Panel (CCP) unter **Stammdaten > API** einen API-Key der **neuen API**
erstellen (Abschnitt „API-Keys“, nicht „Legacy API-Keys“). Die Domain muss im
CCP unter einer Registerkarte „CloudDNS“ verwaltet werden. Dieser Key wird in
der Berechtigungsdatei verwendet; Kundennummer und altes API-Passwort werden
für CloudDNS **nicht** benötigt.

Die Datei
`${WCM_DATA_DIR}/secrets/letsencrypt/dns-credentials.ini` anlegen.
`${WCM_DATA_DIR}` bezeichnet den **absoluten** Datenpfad aus der projektweiten
`.env`; dieses Verzeichnis liegt außerhalb des Repositories. Beispielinhalt:

```ini
dns_netcup_api_v1_key = HIER_DEN_NEUEN_NETCUP_API_KEY_EINTRAGEN
```

Bei `LE_DNS_PROVIDER=netcup-legacy` stattdessen die Zugangsdaten der
**klassischen netcup CCP-API** im selben Dateipfad verwenden:

```ini
dns_netcup_customer_id = 123456
dns_netcup_api_key = HIER_DEN_LEGACY_API_KEY_EINTRAGEN
dns_netcup_api_password = HIER_DAS_LEGACY_API_PASSWORT_EINTRAGEN
```

Bei `LE_DNS_PROVIDER=cloudflare` stattdessen:

```ini
dns_cloudflare_api_token = HIER_DEN_API_TOKEN_EINTRAGEN
```

Bei `LE_DNS_PROVIDER=rfc2136` stattdessen das Certbot-RFC-2136-Format
verwenden (Beispiel; die Angaben müssen zum eigenen DNS-Server passen):

```ini
dns_rfc2136_server = ns1.example.org
dns_rfc2136_port = 53
dns_rfc2136_name = acme-update-key.
dns_rfc2136_secret = HIER_DEN_TSIG_SCHLUESSEL_EINTRAGEN
dns_rfc2136_algorithm = HMAC-SHA512
```

`LE_DNS_PROPAGATION_SECONDS` kann pro Anbieter angepasst werden. Für netcup
ist **900 Sekunden** der Standardwert, auch wenn die Variable fehlt;
mindestens 600 Sekunden werden vom Plugin empfohlen. Bei langsamer
DNS-Propagation können 1200 Sekunden erforderlich sein. Andere Provider
behalten ihre bisherigen plugin-spezifischen Defaults.

Die Datei darf nicht im Git-Checkout liegen und muss für andere Nutzer
unlesbar sein. Beispiel auf dem Pi (vorher `$WCM_DATA_DIR` passend setzen):

```bash
mkdir -p "$WCM_DATA_DIR/secrets/letsencrypt"
chmod 700 "$WCM_DATA_DIR/secrets/letsencrypt"
${EDITOR:-vi} "$WCM_DATA_DIR/secrets/letsencrypt/dns-credentials.ini"
chmod 600 "$WCM_DATA_DIR/secrets/letsencrypt/dns-credentials.ini"
```

Weder DNS-Token noch privater TLS-Schlüssel gehören in `.env`, den Git-Checkout
oder einen Commit. Certbot legt seine persistente Zertifikatsverwaltung unter
`${WCM_DATA_DIR}/secrets/letsencrypt/config` ab.

## Inbetriebnahme

```bash
sh deploy/letsencrypt.sh check     # Einstellungen und Berechtigungen prüfen
sh deploy/letsencrypt.sh issue     # Zertifikat über DNS-01 ausstellen
# Geänderte .env auch an den bereits laufenden app-Container übergeben:
docker compose up -d --force-recreate app
# Zusätzlichen HTTPS-Proxy nur bei Bedarf starten:
docker compose --profile letsencrypt up -d
```

**Erreichbarkeit:**

- bisher: `https://<IP-oder-lokaler-Name>:3543` (lokales Zertifikat),
- optional: `https://whisky.example.org` (Let's Encrypt auf Port 443).

Wird `LE_HTTPS_PUBLIC_PORT` beispielsweise auf `8443` gesetzt, lautet die URL
`https://whisky.example.org:8443`. In diesem Fall nach der Änderung
`docker compose --profile letsencrypt up -d --force-recreate letsencrypt-proxy`
ausführen. Die beiden externen Ports müssen verschieden sein. Auf dem Pi darf
der gewünschte Port nicht von einem anderen Dienst belegt sein.

**Auch ohne Let's Encrypt kann der bisherige Endpunkt Port 443 verwenden:**
Dazu `HTTPS_PUBLIC_PORT=443` setzen und
`docker compose up -d --force-recreate app` ausführen. Das ändert nur die
externe Portzuordnung, nicht das selbstsignierte Zertifikat. Ohne gültigen
DNS-Namen und öffentliche Zertifikatskette bleibt daher die Browserwarnung.

## Erneuerung

Einmalig den optionalen täglichen systemd-Benutzertimer einrichten:

```bash
sh deploy/letsencrypt.sh install-timer
sudo loginctl enable-linger "$(id -un)"
systemctl --user list-timers wcm-certbot.timer
```

Der Timer prüft täglich, ob Certbot das Zertifikat erneuern muss. Certbot
entscheidet über die Erneuerungsfrist. Ein unverändertes Zertifikat führt
**nicht** zu einem Proxy-Neuladen. Nach erfolgreicher Erneuerung wird das
vollständige Zertifikatspaar vor der Aktivierung geprüft, als gemeinsame
Version veröffentlicht und NGINX ohne App-Neustart neu geladen. **Bei einem
Fehler werden die bisher aktiven Zertifikate nicht gelöscht oder ersetzt.**

Manuelle Kontrolle und Erneuerung:

```bash
sh deploy/letsencrypt.sh status
sh deploy/letsencrypt.sh renew
systemctl --user status wcm-certbot.timer
journalctl --user -u wcm-certbot.service -n 50
```

`issue` und `renew` erfordern Internetzugang zur ACME-API und den DNS-Servern.
Die Anwendung selbst arbeitet weiterhin ohne diese Verbindungen. Die erstmalige
Zertifikatsausstellung und der Docker-Start müssen am Pi mit funktionierendem
DNS-API-Zugriff geprüft werden; sie können nicht in der normalen Unit-Test-Suite
simuliert werden.

Der für netcup verwendete Container
`coldfix/certbot-dns-netcup:v2.1.0` stellt einen
`linux/arm64`-Build bereit und verwendet Certbot mit `--authenticator
dns-netcup`. Das Skript ruft ihn als kurzlebigen Container auf; es installiert
keine zusätzlichen Python-Pakete im laufenden WhiskyCollectionManager.

## Deaktivieren und Fehlerfälle

Der öffentliche Endpunkt wird mit
`docker compose --profile letsencrypt stop letsencrypt-proxy` beendet. Die
Standard-App und der Backup-Prozess laufen unverändert weiter.

Bei fehlender oder abgelaufener öffentlicher Bescheinigung darf die Anwendung
weiter über den bisherigen privaten HTTPS-Port benutzt werden; es gibt **keinen
automatischen Rückfall auf ein öffentlich ungültiges Zertifikat**. Bei Fehlern
in der ACME-Erneuerung den Certbot-Log unter
`${WCM_DATA_DIR}/secrets/letsencrypt/logs` und den systemd-Journal-Eintrag
prüfen. Die DNS-Zugangsdaten dürfen niemals in Diagnoseausgaben geteilt werden.

Für das Proxy-Profil muss die App beim Start ein gültiges *lokales* Zertifikat
haben. Dieses wird weiterhin von `sh deploy/setup-pi.sh` erstellt und darf
nicht durch das Let's-Encrypt-Zertifikat ersetzt werden. Falls das lokale
Zertifikat erneuert wird, auch den Proxy neu starten bzw. neu laden, damit
die TLS-Vertrauensprüfung es übernimmt.
