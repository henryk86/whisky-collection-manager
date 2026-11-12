#!/bin/sh
# Temporäres USB-Backup-Ziel ohne Formatierung und ohne /etc/fstab.
# Vom normalen Pi-Benutzer aufrufen: sh deploy/setup-usb.sh [UUID]
set -eu
cd "$(dirname "$0")/.."
command -v lsblk >/dev/null || { echo 'lsblk fehlt' >&2; exit 1; }
command -v findmnt >/dev/null || { echo 'findmnt fehlt' >&2; exit 1; }
command -v docker >/dev/null || { echo 'Docker fehlt' >&2; exit 1; }

UUID=${1:-}
if [ -z "$UUID" ]; then
    printf 'USB-Geräte (UUID der Partition mit USB-Stick auswählen):\n'
    lsblk -o NAME,SIZE,FSTYPE,LABEL,UUID,MOUNTPOINTS
    printf '\nUUID des USB-Sticks (ohne /dev/...): '
    read -r UUID
fi
case "$UUID" in
    ''|*[!a-zA-Z0-9-]*) echo 'Ungültige UUID' >&2; exit 2 ;;
esac
DEVICE="/dev/disk/by-uuid/$UUID"
if [ ! -e "$DEVICE" ]; then echo "Kein Laufwerk mit UUID $UUID gefunden." >&2; exit 1; fi
FS=$(lsblk -no FSTYPE "$DEVICE" | sed -n '1p' | tr -d '[:space:]')
case "$FS" in
    vfat|exfat|ext4) ;;
    *) echo "Nicht unterstütztes Dateisystem: $FS. Unterstützt: FAT32, exFAT, ext4. Nichts formatiert." >&2; exit 1 ;;
esac
# WCM_DATA_DIR aus der Compose-.env ohne Ausführung von Shell-Code lesen.
[ -f .env ] || { echo 'Zuerst sh deploy/setup-pi.sh ausführen.' >&2; exit 1; }
DATA_DIR=$(awk -F= '$1 == "WCM_DATA_DIR" {print substr($0,index($0,"=")+1)}' .env | tail -n 1)
case "$DATA_DIR" in /*) ;; *) echo 'WCM_DATA_DIR fehlt oder ist nicht absolut.' >&2; exit 1 ;; esac
TARGET="$DATA_DIR/backup-targets/usb"
mkdir -p "$TARGET"
if mountpoint -q "$TARGET"; then
    # Do not mount another stick over an existing mount.
    MOUNTED=$(findmnt -n -o UUID --target "$TARGET" || true)
    if [ "$MOUNTED" != "$UUID" ]; then
        echo "Unter $TARGET ist bereits ein anderes Laufwerk eingehängt ($MOUNTED)." >&2
        exit 1
    fi
    echo "USB-Stick $UUID ist bereits eingebunden."
else
    if [ -n "$(ls -A "$TARGET")" ]; then
        echo "Ziel $TARGET ist ohne Mount nicht leer. Bitte zuerst Inhalt prüfen; keine Dateien werden überschrieben." >&2
        exit 1
    fi
    # The Pi needs host mount privileges. The application container stays unprivileged.
    if [ "$FS" = ext4 ]; then
        sudo mount -t ext4 -o rw,nosuid,nodev "$DEVICE" "$TARGET"
        sudo chown "$(id -u):$(id -g)" "$TARGET"
    else
        sudo mount -t "$FS" -o "rw,nosuid,nodev,uid=$(id -u),gid=$(id -g),umask=0077" "$DEVICE" "$TARGET"
    fi
fi
mountpoint -q "$TARGET" || { echo 'Mount ist fehlgeschlagen' >&2; exit 1; }
# A marker ON the USB filesystem prevents silently writing to the Pi SD card.
touch "$TARGET/.whisky-backup-target"
mkdir -p "$TARGET/whisky-zip"
if [ ! -w "$TARGET/whisky-zip" ]; then
    echo 'Der USB-Backup-Ordner ist nicht beschreibbar. Bitte Besitzer/Rechte des Sticks prüfen.' >&2
    exit 1
fi
printf '\nUSB-Stick eingebunden: %s\n' "$TARGET"
printf 'Verfügbarer Speicherplatz:\n'
df -h "$TARGET"
printf '\nContainer wird neu erstellt, damit der USB-Mount sichtbar ist ...\n'
docker compose up -d --force-recreate app
printf '\nBereit. Im Browser: Verwaltung & Datensicherung > Datensicherung > Backup-Ziel einrichten.\n'
printf 'USB-Stick auswaehlen, Profil speichern und Jetzt sichern anklicken.\n'
printf 'Hinweis: Mount ist nur temporär; nach Neustart erneut dieses Skript verwenden.\n'
