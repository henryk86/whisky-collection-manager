# Teststatus - Whisky Collection Manager v1.0.1

**Stand:** 2026-11-16. **Status:** Korrigiertes Schema-Upgrade und Wiederherstellung in Node-Integrationstests geprueft; vollstaendige Browserabnahme steht aus. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Versionsmetadaten v1.0.1 stimmen ueberein. |
| `npm run check` | **Erfolgreich** | Syntax, Abhaengigkeitsgrenzen, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **559/559 bestanden** | Vollstaendige Node-Unit-/Integrationstests, einschließlich Bestandsmigration und ZIP-Restore. |
| `npm run test:browser` | **Blockiert (kein Browserlauf)** | Der Start aller sechs Suites scheitert bereits am fehlenden Paket `playwright-core` (`ERR_MODULE_NOT_FOUND`). Keine Browser-Funktionspruefung moeglich; CI nach Push abwarten. |
| GitHub Actions / CI | **Nicht lokal ausgefuehrt** | Release und Browsertests nach dem Push auf GitHub pruefen. |
| Docker-Image-Build / ARM64-Live-Test / reale Mobilbrowser | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

## Aenderungen v1.0.1

- B-3: verlustfreie Schema-5-Migration aller Bestands- und Lagerdaten; ausschliesslich alte Verkostungsdaten entfallen

Zusatzpruefungen: Schema-4-Upgrade mit realen Flaschenfotos, PDF-Beleg und Lagerzuordnung, ungültige Migration ohne Dateiaenderung, Schema-3-JSON-Import mit Sample sowie altes Schema-4-ZIP-Backup mit Bild-, Dokument- und Lagerdaten.
