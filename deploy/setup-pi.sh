#!/bin/sh
# Pi-Setup: vorhandene Daten/Secrets niemals überschreiben; Zertifikate nur mit --renew-cert erneuern.
set -eu
case "${1:-}" in
    '') RENEW_CERT=false ;;
    --renew-cert) RENEW_CERT=true ;;
    *) echo 'Verwendung: sh deploy/setup-pi.sh [--renew-cert]' >&2; exit 2 ;;
esac
cd "$(dirname "$0")"
command -v openssl >/dev/null || { echo 'openssl fehlt' >&2; exit 1; }
command -v awk >/dev/null || { echo 'awk fehlt' >&2; exit 1; }
umask 077

# Dieselbe .env wie Docker Compose verwenden (Projektstamm, nicht deploy/).
# Eine ältere deploy/.env bei Bedarf einmalig übernehmen, ohne sie zu verändern.
if [ ! -e ../.env ]; then
    if [ -f .env ]; then
        cp .env ../.env
    else
        cp .env.example ../.env
    fi
    chmod 600 ../.env
    echo 'Konfiguration im Projektstamm unter .env angelegt.'
fi
config_file=$(cd .. && pwd -P)/.env

# Persistente Host-Daten muessen ausserhalb des Git-Checkouts liegen.
# Absoluter Pfad in der Compose-.env; keine Shell-Auswertung der Datei.
if ! grep -Eq '^[[:space:]]*WCM_DATA_DIR[[:space:]]*=' "$config_file"; then
    printf '\n# Persistente Laufzeitdaten (ausserhalb des Git-Repositories)\nWCM_DATA_DIR=%s/whisky-collection-manager-data\n' "$HOME" >> "$config_file"
fi


# Bestehende .env-Dateien vorsichtig um neue Optionen ergänzen.
if ! grep -Eq '^[[:space:]]*CERT_DNS_NAMES[[:space:]]*=' "$config_file"; then
    printf '\n# DNS-Namen im selbstsignierten HTTPS-Zertifikat (kommagetrennt)\nCERT_DNS_NAMES=home-pi,home-pi.local,whisky-pi.local,raspberrypi.local,localhost\n' >> "$config_file"
fi
if ! grep -Eq '^[[:space:]]*CERT_IP_ADDRESSES[[:space:]]*=' "$config_file"; then
    printf '# IPv4-Adressen im HTTPS-Zertifikat (auf die LAN-IP des Pi anpassen)\nCERT_IP_ADDRESSES=127.0.0.1,192.168.178.40\n' >> "$config_file"
fi

# KEIN ". $config_file" oder eval: .env darf keine Shell-Befehle ausführen.
read_config_value() {
    awk -v wanted="$1" '
        /^[[:space:]]*#/ { next }
        {
            row=$0
            sub(/^[[:space:]]*/, "", row)
            eq=index(row, "=")
            if (!eq) next
            key=substr(row, 1, eq-1)
            sub(/[[:space:]]*$/, "", key)
            if (key != wanted) next
            value=substr(row, eq+1)
            sub(/^[[:space:]]*/, "", value)
            sub(/[[:space:]]*$/, "", value)
        }
        END { print value }
    ' "$config_file"
}

data_dir=$(read_config_value WCM_DATA_DIR)
# Docker Compose darf keine relative oder dynamische Pfadangabe erhalten.
case "$data_dir" in
    /*) ;;
    *) echo 'WCM_DATA_DIR muss ein absoluter Pfad sein.' >&2; exit 1 ;;
esac
case "$data_dir" in
    /|*/../*|*/..|*/./*|*/.|*'${'*|*'$('*|*'`'*|*:* )
        echo 'Unsicherer WCM_DATA_DIR-Wert.' >&2; exit 1 ;;
esac
project_root=$(cd .. && pwd -P)
case "$data_dir/" in
    "$project_root/"* ) echo 'WCM_DATA_DIR darf nicht innerhalb des Git-Repositories liegen.' >&2; exit 1 ;;
esac
case "$project_root/" in
    "$data_dir/"* ) echo 'WCM_DATA_DIR darf das Git-Repositories nicht enthalten.' >&2; exit 1 ;;
esac

# Kein Migrationscode: Altverzeichnisse werden weder kopiert noch entfernt.
# Neues Setup verwendet ausschliesslich WCM_DATA_DIR ausserhalb des Checkouts.
mkdir -p "$data_dir"

# Alle weiteren Dateizugriffe beziehen sich auf den externen Datenstamm.
cd "$data_dir"
configured_dns=$(read_config_value CERT_DNS_NAMES)
configured_ips=$(read_config_value CERT_IP_ADDRESSES)
# Optionale Umgebungsvariablen gehen vor der Datei; Legacy-Aufruf WHISKY_LAN_IP bleibt möglich.
if [ "${CERT_DNS_NAMES+x}" = x ]; then configured_dns=$CERT_DNS_NAMES; fi
if [ "${CERT_IP_ADDRESSES+x}" = x ]; then configured_ips=$CERT_IP_ADDRESSES; fi
case "$configured_dns" in
    \"*\") configured_dns=${configured_dns#\"}; configured_dns=${configured_dns%\"} ;;
    \'*\') configured_dns=${configured_dns#\'}; configured_dns=${configured_dns%\'} ;;
esac
case "$configured_ips" in
    \"*\") configured_ips=${configured_ips#\"}; configured_ips=${configured_ips%\"} ;;
    \'*\') configured_ips=${configured_ips#\'}; configured_ips=${configured_ips%\'} ;;
esac

fail() { echo "Zertifikat-Konfiguration: $*" >&2; exit 1; }
trim_item() { printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'; }

dns_seen=localhost
ip_seen=127.0.0.1
alt='DNS:localhost,IP:127.0.0.1'

append_dns() {
    dns_candidate=$(trim_item "$1")
    [ -n "$dns_candidate" ] || fail 'Leerer Eintrag in CERT_DNS_NAMES'
    printf '%s\n' "$dns_candidate" | LC_ALL=C awk -F '[.]' '
        length($0) > 253 { exit 1 }
        {
            for (i=1; i<=NF; i++) {
                if (length($i) < 1 || length($i) > 63 || $i !~ /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/) exit 1
            }
        }
    ' || fail "Ungültiger DNS-Name: $dns_candidate"
    case ",$dns_seen," in *,"$dns_candidate",*) return ;; esac
    dns_seen="$dns_seen,$dns_candidate"
    alt="$alt,DNS:$dns_candidate"
}
append_ip() {
    ip_candidate=$(trim_item "$1")
    [ -n "$ip_candidate" ] || fail 'Leerer Eintrag in CERT_IP_ADDRESSES'
    printf '%s\n' "$ip_candidate" | LC_ALL=C awk -F '[.]' '
        NF != 4 { exit 1 }
        {
            for (i=1; i<=4; i++) {
                if ($i !~ /^[0-9]+$/ || length($i) > 3 || $i+0 > 255 || (length($i) > 1 && $i ~ /^0/)) exit 1
            }
        }
    ' || fail "Ungültige IPv4-Adresse: $ip_candidate"
    case ",$ip_seen," in *,"$ip_candidate",*) return ;; esac
    ip_seen="$ip_seen,$ip_candidate"
    alt="$alt,IP:$ip_candidate"
}

[ -n "$configured_dns" ] || fail 'CERT_DNS_NAMES darf nicht leer sein'
[ -n "$configured_ips" ] || fail 'CERT_IP_ADDRESSES darf nicht leer sein'
case "$configured_dns" in ,*|*,|*,,*) fail 'CERT_DNS_NAMES enthält einen leeren Eintrag' ;; esac
case "$configured_ips" in ,*|*,|*,,*) fail 'CERT_IP_ADDRESSES enthält einen leeren Eintrag' ;; esac

pending_dns=$configured_dns
while :; do
    case "$pending_dns" in
        *,*) current_dns=${pending_dns%%,*}; pending_dns=${pending_dns#*,} ;;
        *) current_dns=$pending_dns; pending_dns='' ;;
    esac
    append_dns "$current_dns"
    [ -n "$pending_dns" ] || break
done
pending_ips=$configured_ips
while :; do
    case "$pending_ips" in
        *,*) current_ip=${pending_ips%%,*}; pending_ips=${pending_ips#*,} ;;
        *) current_ip=$pending_ips; pending_ips='' ;;
    esac
    append_ip "$current_ip"
    [ -n "$pending_ips" ] || break
done
if [ -n "${WHISKY_LAN_IP:-}" ]; then append_ip "$WHISKY_LAN_IP"; fi

mkdir -p storage/data storage/images storage/documents storage/backups backup-control/jobs backup-control/staging backup-control/restores backup-control/home backup-targets rclone secrets/certs secrets/ssh
for name in backup-admin-token backup-worker-token restic-password; do
    if [ ! -f "secrets/$name" ]; then openssl rand -hex 32 > "secrets/$name"; fi
    chmod 600 "secrets/$name"
done
if [ ! -e rclone/rclone.conf ]; then : > rclone/rclone.conf; chmod 600 rclone/rclone.conf; fi
cert=secrets/certs/server-cert.pem
key=secrets/certs/server-key.pem
if { [ -e "$cert" ] && [ ! -e "$key" ]; } || { [ ! -e "$cert" ] && [ -e "$key" ]; }; then
    echo 'Nur ein Teil des Zertifikatspaars vorhanden. Bitte manuell prüfen.' >&2
    exit 1
fi
if [ "$RENEW_CERT" = true ] || [ ! -f "$cert" ]; then
    # Private temporäre Dateien. Bei OpenSSL-Fehler bleibt das aktive Zertifikat unverändert.
    temp_dir=$(mktemp -d secrets/certs/.new-cert.XXXXXXXX)
    trap 'rm -rf "$temp_dir"' 0
    openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 825 \
      -keyout "$temp_dir/server-key.pem" -out "$temp_dir/server-cert.pem" \
      -subj '/CN=WhiskyCollectionManager' -addext "subjectAltName=$alt"
    pending_dns=$dns_seen
    while :; do
        case "$pending_dns" in
            *,*) current_dns=${pending_dns%%,*}; pending_dns=${pending_dns#*,} ;;
            *) current_dns=$pending_dns; pending_dns='' ;;
        esac
        openssl x509 -in "$temp_dir/server-cert.pem" -noout -checkhost "$current_dns" | grep -q 'does match' || fail "DNS-SAN fehlt: $current_dns"
        [ -n "$pending_dns" ] || break
    done
    pending_ips=$ip_seen
    while :; do
        case "$pending_ips" in
            *,*) current_ip=${pending_ips%%,*}; pending_ips=${pending_ips#*,} ;;
            *) current_ip=$pending_ips; pending_ips='' ;;
        esac
        openssl x509 -in "$temp_dir/server-cert.pem" -noout -checkip "$current_ip" | grep -q 'does match' || fail "IP-SAN fehlt: $current_ip"
        [ -n "$pending_ips" ] || break
    done
    chmod 600 "$temp_dir/server-cert.pem" "$temp_dir/server-key.pem"
    if [ -f "$cert" ]; then
        backup_dir=$(mktemp -d secrets/certs/previous.XXXXXXXX)
        cp -p "$cert" "$backup_dir/server-cert.pem"
        cp -p "$key" "$backup_dir/server-key.pem"
        chmod 600 "$backup_dir/server-cert.pem" "$backup_dir/server-key.pem"
        echo "Vorheriges Zertifikat gesichert: $data_dir/$backup_dir"
    fi
    mv -f "$temp_dir/server-key.pem" "$key"
    mv -f "$temp_dir/server-cert.pem" "$cert"
    echo "HTTPS-Zertifikat erstellt mit SAN: $alt"
else
    echo 'Vorhandenes HTTPS-Zertifikat unverändert. Änderungen an .env mit --renew-cert übernehmen.'
fi
# UID/GID 1000: node user in the combined image (Pi-Standardkonto i.d.R. 1000).
if [ "$(id -u)" != 1000 ]; then
    echo 'Hinweis: Host-Benutzer-UID ist nicht 1000. Besitz der persistenten Daten muss im Container auf UID 1000 passen.' >&2
fi
printf '\nKonfiguration: .env (Projektstamm); Persistente Daten: %s\n' "$data_dir"
printf 'Restic-Passwort und Worker-Schlüssel wurden gespeichert, nicht ausgegeben.\n'
printf 'Docker Compose im Projektstamm starten; Image ist ghcr.io/henryk86/whisky-collection-manager:latest.\n'
