# Code-Review-Befunde v0.15.9: Umsetzung in v0.15.10

Ausgangsbasis: Review `code-review-WCM-v0.15.9.md` und der Quellstand v0.15.9.
Die IDs werden beibehalten, damit die Korrekturen nachverfolgbar bleiben.

| Befund | Stand | Umsetzung und Nachweis |
| --- | --- | --- |
| SEC-1 (CSRF) | Umgesetzt | JSON-Endpunkte verlangen `application/json` (415); fremde Origin-/Fetch-Metadata-Schreibzugriffe auf `/api/*` werden mit 403 abgewiesen. Erweiterungs-Stage bleibt eine gezielte Ausnahme. Integrationstests. |
| SEC-2 (DNS-Rebinding) | Umgesetzt | HTTP Host-Allowlist mit Loopback, Zertifikatsnamen/-IPs und optional `ALLOWED_HOSTS`. 421 bei unbekanntem Host. Docker und lokale TLS-Erstellung geben die Zertifikats-SANs weiter. Integrationstest. |
| SEC-3 (Sicherheitsheader) | Umgesetzt; Browserabnahme offen | CSP mit SHA-256-Hashes der tatsaechlichen Inline-Skripte, Frame-Schutz und Referrer-Policy. Integrationstest. Scanner, WebGL, Kartenkacheln mit echter Browsernavigation noch pruefen. |
| SEC-4 (CSV-Formeln) | Umgesetzt | Gefahrliche String-Anfaenge erhalten ein fuehrendes Apostroph; numerische negative Werte bleiben Zahlen. Unit-Test. |
| SEC-5 (Extension-CORS) | Umgesetzt, opt-in | `EXTENSION_IDS` kann die erlaubten IDs einschraenken. Leer behaelt aus Kompatibilitaetsgruenden bisheriges Verhalten bei. Unit-Test. |
| BUG-1 (ungueltige URL) | Umgesetzt | Fehlerhafte Prozentkodierung gibt 400 statt 500; Integrationstest. |
| BUG-2 (Streamfehler) | Umgesetzt | `stream.pipeline()` statt unbeaufsichtigtem `.pipe()` bei allen statischen Dateien/Vendor-Dateien; simulierter Lesefehler getestet. |
| PERF-1 (Lagerzuweisung) | Umgesetzt | `physicalBottles()` nur einmal pro `assignBottle`-Mutation; Set-Lookups statt wiederholtem Laden/Validieren. Bestehende Lagertests. |
| PERF-2 (Healthcheck) | Umgesetzt | Docker Healthcheck ruft `/api/version` statt `/api/collection` ab; Loopback bleibt erlaubt. |
| TEST-1 (Scrollbar-Test) | Test korrigiert; Ausfuehrung offen | Gesonderter Chromium-Prozess ohne `--hide-scrollbars`, erzwungener Negativfall mit `scrollbar-gutter: auto`; expliziter Skip, wenn klassische Scrollbars nicht messbar sind. Browser-Test konnte lokal nicht ausgefuehrt werden. |
| UI-1 (Gutter-Nebenwirkungen) | Offen: visuelle Verifikation | Header/Modal-Backdrop auf Windows Chrome/Edge und Firefox mit sichtbaren klassischen Scrollbars pruefen. Ohne gesicherte Beobachtung keine CSS-Aenderung. |
| MAINT-1 (`t()` und HTML) | Hilfsfunktion umgesetzt; Migration fortlaufend | `tHtml()` escaped String-Parameter fuer HTML-Templates; exemplarisch in Backup-View verwendet, Test mit HTML-Angriffsstring. `t()` bleibt fuer Textkontexte unveraendert. Andere Aufrufstellen weiterhin sorgfaeltig pruefen. |
| MAINT-2 (Geocoding-UA) | Umgesetzt | User-Agent nutzt die aktuelle Version aus `package.json`, inklusive Projekt-URL. |
| MAINT-3 (gemischte AES-ZIPs) | Bewusst unveraendert | Strengere Restore-Regeln koennten alte Archive unlesbar machen. Erst Altarchiv-Fixtures und Migrationsentscheidung, dann gegebenenfalls ein gesondertes Release. |

## Wichtige Abweichung vom Review-Vorschlag

`Referrer-Policy: no-referrer` wurde **nicht** uebernommen, da `tile.openstreetmap.org`
fuer Browser-Kachelanfragen einen gueltigen Referer verlangt. Stattdessen gilt
`strict-origin-when-cross-origin`: bei externen Kacheln wird nur die Origin, nicht der
komplette Pfad uebertragen. Quelle: https://operations.osmfoundation.org/policies/tiles/

## Deployment und Kompatibilitaet

- Die Sammlungs- und Lagerdaten, API-Pfade und das Backupformat bleiben unveraendert.
- `CERT_DNS_NAMES` und `CERT_IP_ADDRESSES` aus der Compose-`.env` werden an den Server
  durchgereicht und bilden zusammen mit Loopback die Standard-Host-Allowlist.
- Weitere Hostnamen (z. B. ein Reverse-Proxy-Name) muessen explizit unter
  `ALLOWED_HOSTS` ergaenzt werden; DNS-Rebinding-Schutz niemals per `*` deaktivieren.
- Die Browser-Erweiterung funktioniert ohne `EXTENSION_IDS` weiter wie zuvor.
  Zur Einschraenkung die ID unter `chrome://extensions` ablesen und konfigurieren.
- Die CSP kann technische Konflikte auf echten Browsern sichtbar machen. Karte,
  Scanner und Three.js muessen nach dem Deploy getestet werden.
- Kein allgemeiner Benutzerlogin: die Anwendung weiterhin nur im sicheren LAN/VPN betreiben.

Aktuelle Ergebnisse und ausstehende Tests: [TESTSTATUS.md](TESTSTATUS.md).
