# Offline-Releases und langfristige Wiederherstellung

Der GitHub-Release-Workflow erstellt neben dem normalen Quellcode-ZIP und dem GHCR-Image drei zusätzliche Artefakte. Sie können **ohne Zugriff auf npm, Hugging Face oder Docker Hub** wiederhergestellt werden, wenn die Dateien vorher archiviert wurden.

| Release-Artefakt | Inhalt | Verwendung |
| --- | --- | --- |
| `whisky-collection-manager-vX.Y.Z-offline.zip` | Projektquellcode, vollständiger npm-Paketcache für die im Lockfile aufgeführten Pakete (einschließlich Dev-Abhängigkeiten), U²-Netp-Modell, ONNX-JavaScript- und WASM-Dateien, Lizenzen, SHA-256-Manifest | Offline-Installation mit bereits vorhandenem Node.js (26+, Release-Build: Node.js 26) und npm |
| `whisky-collection-manager-vX.Y.Z-linux-arm64.tar.gz` | Vollständiges ARM64-Containerimage einschließlich Node.js, Webanwendung, KI-Dateien, Restic, Rclone und SSH-Client | Raspberry Pi OS 64 Bit |
| `whisky-collection-manager-vX.Y.Z-linux-amd64.tar.gz` | Dasselbe Containerimage für AMD64 | Linux-Server / x86_64 |

Jedes Artefakt erhält eine separate `.sha256`-Datei. Diese Dateien **zusammen mit den Archiven** aufbewahren und deren Herkunft bei der erstmaligen Übernahme überprüfen. Die SHA-256-Datei schützt gegen Beschädigung, ersetzt aber ohne eine authentifizierte Herkunft keine Signatur.

## Offline-Installation aus dem ZIP

1. Offline-ZIP und passende `.sha256` bereits vor einem Ausfall der Onlinequellen herunterladen und sicher archivieren.
2. Auf dem Zielgerät eine kompatible Node.js-/npm-Laufzeit installieren bzw. behalten; **das ZIP enthält keine Node.js-Binärdatei**.
3. Checksumme prüfen, ZIP entpacken und in das entpackte Verzeichnis wechseln.
4. `npm start` ausführen. Bei fehlenden Paketen startet automatisch `npm ci --offline` mit einer **temporären Kopie** des versiegelten npm-Caches. Die KI-Dateien werden ausschließlich geprüft, nicht heruntergeladen.

Auf Linux im Verzeichnis mit den heruntergeladenen Dateien:

```sh
sha256sum -c whisky-collection-manager-vX.Y.Z-offline.zip.sha256
unzip whisky-collection-manager-vX.Y.Z-offline.zip -d whisky-offline
cd whisky-offline
node scripts/offline-bundle.js verify
npm start
```

`npm run offline:verify` prüft sowohl die im Manifest gespeicherten Dateihashes als auch das ONNX-Modell und die erforderlichen WASM-Dateien. Ein fehlendes oder verändertes Asset beendet den Start, **ohne** still auf einen Download zurückzufallen. Der versiegelte Cache wird beim Installieren nicht verändert. Der Server benötigt auf dem Zielrechner weiterhin ein funktionsfähiges HTTPS-Zertifikat oder eine lokale OpenSSL-/mkcert-Installation zur erstmaligen Zertifikatserzeugung. Bereits vorhandene Daten und Zertifikate gehören **nicht** zum Release-Archiv.

## Docker-Archiv ohne Registry wiederherstellen

**Voraussetzung:** Docker Engine und das Compose-Plugin sind auf dem Zielgerät noch installiert. Diese Komponenten sind nicht Teil des Images. Beispiel für den Raspberry Pi 4 (64-Bit):

```sh
sha256sum -c whisky-collection-manager-vX.Y.Z-linux-arm64.tar.gz.sha256
gzip -dc whisky-collection-manager-vX.Y.Z-linux-arm64.tar.gz | docker load
```

Im bestehenden Deployment-Verzeichnis die bisherige `.env` und die getrennt gespeicherten Sammlungsdaten beibehalten. Danach:

```sh
# In der Compose-.env: IMAGE_TAG=vX.Y.Z setzen
# Vorhandenes WCM_DATA_DIR und die übrigen Einstellungen unverändert lassen.
docker compose up -d --pull never --no-build --force-recreate app
docker compose ps
```

**Wichtig:** Nicht `docker compose pull`, `docker compose down -v` oder `deploy/setup-pi.sh` ausführen, wenn diese Aktionen in der Offline-Situation neue Downloads/Installationen auslösen könnten. Auch `docker compose`-Abhängigkeiten auf dem Host müssen vorhanden sein. Das Tag im geladenen Image muss zum `IMAGE_TAG` passen. Für AMD64 das entsprechende AMD64-Archiv verwenden.

## Erstellung und Prüfung in GitHub Actions

Der Release-Workflow nimmt für das Offline-ZIP ausschließlich die über `git archive` freigegebenen Quellcodedateien, lädt beim **Release-Build** die festgelegten npm-Paketversionen aus `package-lock.json` und die KI-Dateien aus den bestehenden Quellen und prüft die Modell-Prüfsumme. Danach erzeugt `scripts/offline-bundle.js seal` SHA-256-Werte für sämtliche verpackten npm-Cache-Dateien sowie die KI-/Lizenzdateien.

In einem **frisch entpackten ZIP** läuft `prepareStartup` mit `npm_config_offline=true` und einem erzwungenen Offline-npm-Cache. Dieser Schritt muss erfolgreich sein, bevor das Paket veröffentlicht wird. Externe Downloads sind für den **Build** noch nötig, nicht für die spätere Wiederherstellung. Außerdem werden beide Docker-Architekturen nach `docker pull` separat als Image-TAR gespeichert und mit `docker load` sowie `--network none` geprüft. `latest` wird erst nach erfolgreicher Erstellung aller Artefakte veröffentlicht.

Falls npm, Modellserver oder Registry zum Zeitpunkt des **Release-Builds** nicht erreichbar sind, schlägt das Release bewusst fehl. Vorher veröffentlichte Offline-Releases bleiben davon unabhängig.

## Auf USB oder NAS archivieren

Die bestehende Backupverwaltung sichert Sammlungsdaten verschlüsselt. Ein mehrere hundert Megabyte großes Docker-Image sollte nicht in **jedem** täglichen Sammlungsbackup erneut stecken. Deshalb werden die **Installationsarchive separat pro Release** neben den bestehenden Backups auf demselben USB-/NAS-Ziel abgelegt. Der Kopiervorgang ist bewusst manuell, weil die Backupverwaltung keinen automatischen GitHub-Release-Download ausführt.

Die drei Artefakte und ihre `.sha256`-Dateien gemeinsam in ein lokales Downloadverzeichnis legen. Dann auf dem Raspberry Pi:

```sh
sh deploy/save-offline-release.sh /pfad/zu/downloads /pfad/zum/gemounteten/backupziel
```

Das Ziel muss eine vorhandene `.whisky-backup-target`-Markerdatei besitzen (analog zu den konfigurierten USB-/NAS-Backupzielen). **Vorher überprüfen, dass der Datenträger tatsächlich eingehängt ist.** Die Dateien werden unter `whisky-releases/vX.Y.Z/` archiviert, nach dem Kopieren anhand SHA-256 geprüft und niemals stillschweigend mit anderem Inhalt überschrieben. Der Vorgang löscht oder ändert keine Sammlungsdaten und legt keine Zugangsdaten in den Releases ab.

Diese Release-Archivierung ist **separat** von den geplanten AES-ZIP-Sammlungsbackups. Für eine vollständige Wiederherstellung werden sowohl ein Offline-Release als auch ein aktuelles **verschlüsseltes Datenbackup und dessen Passwort** benötigt. Bei Wiederherstellung des Backupziels dessen unveränderte Archive beachten.

## Grenzen und Lizenzen

- OpenStreetMap-Kartenkacheln und andere externe Dienste werden nicht vollständig gespiegelt. Ihre Onlinefunktionen bleiben vom Netz abhängig.
- Das Offline-ZIP enthält keine Node.js-Installer, keinen Chromium-Browser und keine systemweiten Betriebssystempakete. Das Containerimage enthält die Anwendungen, aber **nicht** Docker Engine oder ein Betriebssystem.
- Das ONNX-Modell `u2netp.onnx` wird gemäß Modellkarte unter Apache-2.0 verteilt. ONNX Runtime Web ist MIT-lizenziert, Three.js MIT-lizenziert; alle relevanten mitgelieferten Lizenzhinweise und npm-Paketarchive müssen bei Weitergabe erhalten bleiben.
- Ein Image ist architekturabhängig. `linux/arm64` ist für einen 64-Bit-Pi, nicht für Raspberry Pi OS 32 Bit.
- Offizielle Releases sind erst dann als vollständig offline geprüft anzusehen, wenn der GitHub-Workflow für die jeweilige Version erfolgreich war. Ein lokaler Node-Test allein belegt keine tatsächliche Download- und Docker-Testausführung.

Siehe auch [Release-Workflow](RELEASE_WORKFLOW.md), [Docker und Backups](DOCKER_BACKUP.md) und [Entwicklung](ENTWICKLUNG.md).
