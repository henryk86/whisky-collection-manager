# Nachpruefung des Security-Reviews v0.15.10: Umsetzung v0.15.11

Die Nachpruefung (`code-review-WCM-v0.15.10-nachpruefung.md`) bestaetigt die
SEC-/BUG-/PERF-Korrekturen aus v0.15.10. Die neuen Befunde wurden wie folgt
bearbeitet. Alle Massnahmen erhalten bestehende JSON-Schemas, API-Pfade und
historische Backupformate.

| ID | Befund | Umsetzung in v0.15.11 |
| --- | --- | --- |
| **NEU-1** | Unklare Host-421-Fehler nach Update | Bei Start aktive `ALLOWED_HOSTS`-Liste ausgeben; abgelehnten Host maximal einmal je Name warnen (hoechstens 20 verschiedene Namen, Zeichen/laenge begrenzt), 421 mit Konfigurationshinweis. Upgrade-Anleitung fuer Pi und lokale Nutzung in README/Docker-Doku. Integrationstest fuer wiederholte Ablehnung. |
| **NEU-2** | TLS-Terminierung am Proxy mit HTTP-Upstream wird als fremder Origin abgewiesen | Bewusst **Variante A** gewaehlt: nur HTTPS bis zum WCM-Backend, `Host`-Header erhalten. Keine `TRUST_PROXY`-Option und kein Vertrauen in `X-Forwarded-Proto` (kein zusaetzlicher Angriffsweg). In README/Docker/.env dokumentiert; Integrationstest fuer die unveraenderte 403-Ablehnung. |
| **NEU-3** | Stacktraces bei vom Client abgebrochenem Download | `ERR_STREAM_PREMATURE_CLOSE`, `ECONNRESET`, `EPIPE` bei bereits gesendeten Headern ohne erwartbaren Logeintrag behandeln. Sonstige Lesefehler bleiben sichtbar. Integrationstest mit abgebrochenem Bildstream, vorhandener Lesefehler-Unit-Test unveraendert. |
| **NEU-4** | Fehlende Testhistorie, veraltete Schuldenliste | v0.15.9 und v0.15.10 in `TESTHISTORIE.md` nachgetragen, irrefuehrende Wirkungsmessung des alten Scrollbar-Tests explizit korrigiert. `TECHNISCHE_SCHULDEN.md` auf v0.15.11 aktualisiert. |
| **NEU-5** | Doppelte HTML-Maskierung bei Migration auf `tHtml()` | Dokumentationsregel in `ENTWICKLUNG.md`: bei Umstellung altes inneres Escaping gleichzeitig entfernen. Unit-Test fuer genau einmal kodiertes Ampersand. Keine pauschale Migration bestehender Views. |

## Nicht als bestanden gewertet

- Vollstaendige HTTP-/Chromium-Browser-Suite inkl. Scrollbar-Wirkungstest.
- CSP-Abnahme auf Karte, Kamera/Scanner, WebGL-Lager und Bildimport.
- Windows-Chrome/Edge-/Firefox-Pruefung von Header-Gutter und Modal-Backdrop.
- Realer Raspberry-Pi-Containerstart und Zugriff ueber dessen tatsaechliche LAN-Namen.

Siehe [TESTSTATUS.md](TESTSTATUS.md) fuer die **aktuelle** Ausfuehrung und
[CODE_REVIEW_0159.md](CODE_REVIEW_0159.md) fuer die Ursprungskorrekturen.
