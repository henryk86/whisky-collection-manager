#!/bin/sh
# Optional ACME DNS-01 provisioning (netcup, Cloudflare, RFC 2136) for the public
# reverse proxy. The application's existing private HTTPS cert is untouched.
set -eu
umask 077

usage() {
    echo 'Verwendung: sh deploy/letsencrypt.sh {check|issue|renew|status|install-timer}' >&2
    exit 2
}
[ "$#" -eq 1 ] || usage
command=$1
case "$command" in check|issue|renew|status|install-timer) ;; *) usage ;; esac
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
config_file=$project_dir/.env
[ -f "$config_file" ] || { echo 'Zuerst sh deploy/setup-pi.sh ausfuehren.' >&2; exit 1; }

# Parse key=value entries as data, never execute .env as shell source.
read_value() {
    awk -v wanted="$1" '
        /^[[:space:]]*#/ { next }
        {
            line=$0; sub(/^[[:space:]]*/, "", line)
            eq=index(line, "="); if (!eq) next
            key=substr(line, 1, eq-1); sub(/[[:space:]]*$/, "", key)
            if (key != wanted) next
            value=substr(line, eq+1)
            sub(/^[[:space:]]*/, "", value); sub(/[[:space:]]*$/, "", value)
            if (value ~ /^".*"$/ || value ~ /^\047.*\047$/) value=substr(value,2,length(value)-2)
        }
        END { print value }
    ' "$config_file"
}
setting() {
    # An explicit process environment value takes priority (also an empty value).
    if env_value=$(printenv "$1" 2>/dev/null); then
        printf '%s' "$env_value"
    else
        read_value "$1"
    fi
}
fail() { echo "Let's Encrypt: $*" >&2; exit 1; }

root=$(setting WCM_DATA_DIR)
case "$root" in /*) ;; *) fail 'WCM_DATA_DIR muss ein absoluter Pfad sein.' ;; esac
case "$root" in /|*'/../'*|*'/..'|*'/./'*|*'/.'|*'${'*|*'$('*|*'`'*|*:) fail 'Unsicherer WCM_DATA_DIR.' ;; esac
case "$root/" in "$project_dir/"*) fail 'WCM_DATA_DIR darf nicht im Repository liegen.' ;; esac
case "$project_dir/" in "$root/"*) fail 'WCM_DATA_DIR darf nicht das Repository enthalten.' ;; esac
case "$root" in *:*) fail 'WCM_DATA_DIR darf keinen Doppelpunkt enthalten (Docker-Mount).' ;; esac

hostname=$(setting LE_DOMAIN)
email=$(setting LE_EMAIL)
provider=$(setting LE_DNS_PROVIDER)
propagation=$(setting LE_DNS_PROPAGATION_SECONDS)

# ACME issuance only works for externally registrable DNS names; no local IPs.
[ -n "$hostname" ] || fail 'LE_DOMAIN fehlt in .env.'
printf '%s\n' "$hostname" | LC_ALL=C awk -F '.' '
    NF < 2 || length($0) > 253 || $NF !~ /[A-Za-z]/ { exit 1 }
    {
        for (i=1;i<=NF;i++) if(length($i)<1 || length($i)>63 ||
            $i !~ /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/) exit 1
    }
' || fail 'LE_DOMAIN muss ein gueltiger, vollstaendiger DNS-Name sein.'
case "$hostname" in *.local|*.localhost|*.invalid|*.test|*.example) fail 'Keine oeffentlichen Zertifikate fuer lokale/reservierte DNS-Namen.' ;; esac

# The optional proxy is an additional endpoint; two listeners cannot bind
# the same host port. Avoid a partially configured first deployment.
if [ "$command" = issue ] || [ "$command" = check ]; then
    original_port=$(setting HTTPS_PUBLIC_PORT)
    public_port=$(setting LE_HTTPS_PUBLIC_PORT)
    original_port=${original_port:-3543}
    public_port=${public_port:-443}
    for candidate in "$original_port" "$public_port"; do
        case "$candidate" in *[!0-9]*|'') fail 'HTTPS-Ports muessen ganze Zahlen sein.' ;; esac
        [ "$candidate" -ge 1 ] && [ "$candidate" -le 65535 ] || fail 'HTTPS-Port ausserhalb von 1..65535.'
    done
    [ "$original_port" != "$public_port" ] || fail 'HTTPS_PUBLIC_PORT und LE_HTTPS_PUBLIC_PORT duerfen nicht gleich sein.'
fi

case "$provider" in
    netcup-clouddns|netcup-legacy)
        # 2.1.0 supports both the new netcup CloudDNS API and the legacy CCP API.
        # Unlike certbot's own plugin images this image has /usr/bin/env as its
        # entrypoint, so the 'certbot' executable must be passed explicitly.
        image=coldfix/certbot-dns-netcup:v2.1.0
        plugin=dns-netcup
        propagation=${propagation:-900}
        ;;
    cloudflare)
        image=certbot/dns-cloudflare:latest
        plugin=dns-cloudflare
        ;;
    rfc2136)
        image=certbot/dns-rfc2136:latest
        plugin=dns-rfc2136
        ;;
    *) fail 'LE_DNS_PROVIDER muss netcup-clouddns, netcup-legacy, cloudflare oder rfc2136 sein.' ;;
esac
if [ -n "$propagation" ]; then
    case "$propagation" in *[!0-9]*|'') fail 'LE_DNS_PROPAGATION_SECONDS muss eine positive Zahl sein.' ;; esac
    [ "$propagation" -ge 10 ] && [ "$propagation" -le 3600 ] || fail 'LE_DNS_PROPAGATION_SECONDS muss zwischen 10 und 3600 liegen.'
fi

le_dir=$root/secrets/letsencrypt
credentials=$le_dir/dns-credentials.ini
live=$le_dir/config/live/$hostname
published=$le_dir/published

if [ "$command" = status ]; then
    echo "Domain: $hostname, DNS-Plugin: $provider"
    if [ -r "$published/current/fullchain.pem" ]; then
        openssl x509 -in "$published/current/fullchain.pem" -noout -subject -enddate
    else
        echo 'Noch kein veroeffentlichtes Zertifikat vorhanden.'
    fi
    exit 0
fi

if [ "$command" = install-timer ]; then
    command -v systemctl >/dev/null || fail 'systemctl fehlt (systemd erforderlich).'
    user_units=${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user
    mkdir -p "$user_units"
    # Avoid systemd specifier expansion and malformed ExecStart directives.
    case "$project_dir" in *'%'*|*'"'*|*'\'*|*'
'*) fail 'Projektpfad enthaelt fuer systemd ungeeignete Zeichen.' ;; esac
    cat > "$user_units/wcm-certbot.service" <<SERVICE
[Unit]
Description=WhiskyCollectionManager Certbot DNS-01 renewal
[Service]
Type=oneshot
ExecStart=/bin/sh "$project_dir/deploy/letsencrypt.sh" renew
SERVICE
    cat > "$user_units/wcm-certbot.timer" <<'TIMER'
[Unit]
Description=Check WhiskyCollectionManager Let's Encrypt certificate daily
[Timer]
OnCalendar=*-*-* 04:15:00
RandomizedDelaySec=2h
Persistent=true
Unit=wcm-certbot.service
[Install]
WantedBy=timers.target
TIMER
    systemctl --user daemon-reload
    systemctl --user enable --now wcm-certbot.timer
    echo 'Systemd-Benutzertimer aktiviert (taegliche Erneuerungspruefung).'
    echo 'Einmalig fuer Betrieb ohne Login: sudo loginctl enable-linger "$(id -un)"'
    exit 0
fi

[ -f "$credentials" ] && [ ! -L "$credentials" ] || fail "DNS-Zugangsdaten fehlen: $credentials"
if find "$credentials" -perm /077 -print | grep -q .; then
    fail 'DNS-Zugangsdaten muessen Modus 600 haben: chmod 600 <Datei>'
fi
[ -r "$credentials" ] || fail 'DNS-Zugangsdaten nicht lesbar.'
# Detect accidental mixing of CloudDNS and legacy API credentials before
# requesting a certificate. Never print credential contents to diagnostics.
has_credentials_key() {
    awk -F '=' -v wanted="$1" '
        /^[[:space:]]*[#;]/ { next }
        NF >= 2 {
            key=$1; gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
            value=substr($0, index($0, "=")+1)
            gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
            if (key == wanted && length(value) > 0) found=1
        }
        END { exit !found }
    ' "$credentials"
}
case "$provider" in
    netcup-clouddns)
        has_credentials_key dns_netcup_api_v1_key || fail 'netcup CloudDNS: dns_netcup_api_v1_key fehlt in dns-credentials.ini.'
        ;;
    netcup-legacy)
        for key in dns_netcup_customer_id dns_netcup_api_key dns_netcup_api_password; do
            has_credentials_key "$key" || fail "netcup Legacy: $key fehlt in dns-credentials.ini."
        done
        ;;
esac
command -v docker >/dev/null || fail 'Docker CLI fehlt.'
command -v openssl >/dev/null || fail 'OpenSSL fehlt.'
if [ "$command" = issue ]; then
    case "$email" in *@*.*) ;; *) fail 'LE_EMAIL muss eine gueltige Kontaktadresse enthalten.' ;; esac
fi
if [ "$command" = renew ] && [ ! -f "$live/fullchain.pem" ]; then
    fail 'Noch kein Zertifikat vorhanden. Zuerst issue ausfuehren.'
fi
if [ "$command" = check ]; then
    echo "Konfiguration gueltig: $hostname, $provider, DNS-01 mit Certbot."
    echo 'Kein Zertifikat angefordert und kein Docker-Container gestartet.'
    exit 0
fi

mkdir -p "$le_dir/config" "$le_dir/work" "$le_dir/logs" "$published"
chmod 700 "$le_dir" "$le_dir/config" "$le_dir/work" "$le_dir/logs" "$published"

# Run Certbot as the invoking Pi user so keys never become inaccessible
# root-owned files on the bind-mounted host filesystem.
set -- docker run --rm --user "$(id -u):$(id -g)" \
    -v "$le_dir/config:/etc/letsencrypt" \
    -v "$le_dir/work:/var/lib/letsencrypt" \
    -v "$le_dir/logs:/var/log/letsencrypt" \
    -v "$credentials:/run/secrets/dns.ini:ro" \
    "$image"
case "$provider" in netcup-clouddns|netcup-legacy) set -- "$@" certbot ;; esac
if [ "$command" = issue ]; then
    set -- "$@" certonly --non-interactive --agree-tos --email "$email" \
        --cert-name "$hostname" -d "$hostname"
    if [ "$plugin" = dns-netcup ]; then
        set -- "$@" --authenticator dns-netcup --dns-netcup-credentials /run/secrets/dns.ini
    else
        set -- "$@" "--$plugin" "--$plugin-credentials" /run/secrets/dns.ini
    fi
    if [ -n "$propagation" ]; then set -- "$@" "--$plugin-propagation-seconds" "$propagation"; fi
else
    set -- "$@" renew --non-interactive
fi
"$@"

cert=$live/fullchain.pem
key=$live/privkey.pem
[ -r "$cert" ] && [ -r "$key" ] || fail 'Certbot hat kein lesbares Zertifikatspaar geliefert.'
openssl x509 -in "$cert" -noout -checkhost "$hostname" | grep -q 'does match' || fail "Zertifikat gilt nicht fuer $hostname."
openssl x509 -in "$cert" -noout -checkend 86400 >/dev/null || fail 'Zertifikat ist bereits abgelaufen oder fast abgelaufen.'
cert_pub=$(openssl x509 -in "$cert" -pubkey -noout | openssl pkey -pubin -outform DER 2>/dev/null | openssl dgst -sha256)
key_pub=$(openssl pkey -in "$key" -pubout -outform DER 2>/dev/null | openssl dgst -sha256)
[ -n "$cert_pub" ] && [ "$cert_pub" = "$key_pub" ] || fail 'Zertifikat und Schluessel stimmen nicht ueberein.'

if [ -r "$published/current/fullchain.pem" ] && cmp -s "$cert" "$published/current/fullchain.pem" && cmp -s "$key" "$published/current/privkey.pem"; then
    echo 'Zertifikat unveraendert; kein Proxy-Neuladen erforderlich.'
    exit 0
fi

# Publish a complete, verified pair atomically. No partial update of the files
# currently consumed by NGINX. Existing connections keep their old cert.
staging=$(mktemp -d "$published/release.XXXXXXXX")
trap 'rm -rf "$staging" "$published/.current.$$"' EXIT
trap 'exit 1' HUP INT TERM
cp "$cert" "$staging/fullchain.pem"
cp "$key" "$staging/privkey.pem"
chmod 644 "$staging/fullchain.pem"
chmod 600 "$staging/privkey.pem"
ln -s "${staging##*/}" "$published/.current.$$"
mv -Tf "$published/.current.$$" "$published/current"
trap - EXIT HUP INT TERM
printf 'Zertifikat fuer %s veroeffentlicht.\n' "$hostname"

cd "$project_dir"
if docker compose --profile letsencrypt ps --status running --services 2>/dev/null | grep -qx letsencrypt-proxy; then
    docker compose --profile letsencrypt exec -T letsencrypt-proxy nginx -t
    docker compose --profile letsencrypt exec -T letsencrypt-proxy nginx -s reload
    echo 'Oeffentlichen HTTPS-Proxy neu geladen.'
else
    echo 'Optionalen Proxy starten: docker compose --profile letsencrypt up -d'
fi
