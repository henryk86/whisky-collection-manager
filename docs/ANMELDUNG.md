# Anmeldung und Nutzerverwaltung

## Aktivierung und erster Zugang

Die Loginpflicht ist bei Neuinstallationen und nach dem Upgrade zunächst **aus**. Auch ohne Login kann die Sammlung wie bisher genutzt werden. Die Nutzerverwaltung ist unabhängig davon geschützt.

Beim ersten Start legt der Server `admin` mit einem **einmaligen, zufällig generierten Startpasswort** an und protokolliert es genau einmal. Das Passwort steht in der Serverausgabe oder unter Docker in `docker compose logs app`. Beim ersten Login muss `admin` ein neues Passwort mit mindestens 12 Zeichen wählen. Das Startpasswort wird nicht in Dateien abgelegt und kann nicht nachträglich angezeigt werden.

Im Seitenmenü **Anmelden** wählen. Nach dem Passwortwechsel über **Einstellungen → Nutzerverwaltung** die Loginpflicht nach Bedarf einschalten oder ausschalten. Auch wenn sie ausgeschaltet ist, können nur authentifizierte Administratoren die Benutzerverwaltung betreten und die Sicherheitskonfiguration ändern. Eine Bestätigung erscheint als Anwendungsdialog.

## Konten und Berechtigungen

Der Administrator kann weitere Benutzer mit Namen (3–32 Zeichen: `a-z`, `0-9`, `.`, `_`, `-`) und einem temporären Passwort von mindestens 12 Zeichen anlegen. Neue Benutzer haben die Rolle `user`, dürfen alle bisherigen Sammlungsfunktionen verwenden und müssen ihr Passwort beim ersten Login ändern. Sie können weder Benutzer verwalten noch die Loginpflicht ändern. Neue Administratorenkonten und feinere Berechtigungsrollen werden derzeit nicht unterstützt.

Der Administrator kann Passwörter anderer Benutzer zurücksetzen oder Konten löschen; die betroffenen aktiven Sitzungen werden sofort ungültig. Jeder angemeldete Benutzer kann im Seitenmenü sein eigenes Passwort ändern und sich abmelden.

## Speicherung, Sicherung und Sicherheit

Die Konten und die Einstellung zur Loginpflicht liegen in `data/user.json` unter `WHISKY_DATA_DIR`, im Docker-Container unter `/srv/whisky/data/user.json` (auf dem Host unter `${WCM_DATA_DIR}/storage/data/user.json`). Die Datei wird atomar mit Dateirechten 0600 geschrieben und liegt nicht unter dem Webverzeichnis. Passwörter werden nicht verschlüsselt gespeichert, sondern als individuelle, gesalzene **scrypt-Hashes** (`N=131072`, `r=8`, `p=1`, 64-Byte-Ableitung). Damit sind sie nicht zurückentschlüsselbar.

Sitzungen verwenden zufällige 256-Bit-Tokens in **HttpOnly**, **SameSite=Strict**-Cookies, unter HTTPS zusätzlich **Secure**. Ein Login wird auf wenige Fehlversuche pro Konto/IP begrenzt. Sitzungen laufen nach 12 Stunden absolut oder 2 Stunden Inaktivität ab und gehen beim Server-Neustart verloren. Nach einer externen Änderung oder Wiederherstellung von `user.json` werden vorhandene Sitzungen ungültig. Die Authentifizierung ersetzt nicht HTTPS. Auch mit Login sollte ein öffentlich erreichbarer Server zusätzlich per Firewall/VPN geschützt werden.

Die bestehende AES-verschlüsselte ZIP-Sicherung enthält auch `data/user.json` mit den Passwort-Hashes. Bei einer Wiederherstellung können die damaligen Nutzer und Passwörter wieder aktiv werden. Backups daher nur verschlüsselt aufbewahren. Der bestehende Backup-Worker nutzt weiterhin seine eigene Administrator-/Worker-Authentifizierung.

**Whiskybase-Browsererweiterung:** Mit der separaten Extension ab **v0.16.11** funktioniert die Bildübernahme auch bei aktivierter Loginpflicht. Die Extension nutzt einen bestehenden oder neu geöffneten Collection-Manager-Tab für einen gleichursprünglichen Upload mit dessen Sitzung; Zugangsdaten und Sitzungscookie werden nicht in der Extension abgelegt. Der Benutzer muss im Manager angemeldet sein und den ersten Passwortwechsel abgeschlossen haben. Andernfalls den Manager-Tab öffnen, anmelden und den Import erneut auslösen. Die bisherige direkte Bildübertragung älterer Extensions bleibt bei erforderlicher Anmeldung ohne gültige Sitzung gesperrt. `EXTENSION_IDS` ist für den neuen Tab-basierten Upload nicht nötig.

## Administrator-Passwort vergessen

Für die Wiederherstellung ist Schreibzugriff auf das lokale Datenverzeichnis erforderlich. Das erzeugte Passwort erscheint nur im Terminal; der nächste Login erzwingt wieder einen Passwortwechsel. Andere Nutzer, Sammlungsdaten und der Login-Schalter bleiben erhalten.

Lokal im Projektverzeichnis:

```bash
npm run auth:reset-admin
```

Im Docker-Setup im Verzeichnis der `docker-compose.yml`:

```bash
docker compose exec app node scripts/reset-admin-password.js
```

Nach dem Zurücksetzen werden vorhandene Admin-Sitzungen beim nächsten Zugriff ungültig. `user.json` darf **nicht** gelöscht oder manuell umgeschrieben werden, um die Anmeldung zu umgehen. Eine beschädigte Datei verhindert den Serverstart; wenn sie im laufenden Betrieb fehlt, werden Zugriffe aus Sicherheitsgründen verweigert. Beim Neustart ohne Datei würde eine neue Ersteinrichtung beginnen und die Loginpflicht wäre zunächst deaktiviert. Deshalb `user.json` nicht löschen, sondern das Wiederherstellungsskript verwenden.
