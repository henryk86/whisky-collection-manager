# Teststatus - Whisky Collection Manager v1.0.2

**Stand:** 2026-11-16. **Status:** Korrekturen zu sieben in GitHub Actions festgestellten Browserfehlern implementiert; die erneute vollständige Browserabnahme in CI steht noch aus. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Versionsmetadaten v1.0.2 stimmen ueberein. |
| `npm run check` | **Erfolgreich** | Syntax, Importgrenzen, Uebersetzungen, Dokumentationslinks. |
| `npm test` | **561/561 bestanden** | Alle Node-Tests inklusive neuem DOM-Regressions- und Schema-5-HTTP-Importtest. |
| `npm run test:browser` | **Blockiert (nicht lokal ausgeführt)** | `playwright-core` fehlt und die npm-Registry ist in dieser Umgebung nicht erreichbar. Dies ist **keine** Browserfreigabe. |
| GitHub Actions / Browsertests v1.0.1 | **75/82 bestanden, 7 fehlgeschlagen** | Vom Anwender bereitgestellter CI-Bericht: 3 Schema-5-Importfixtures, 3 Fotoeditor-Buttons, 1 Verkostungs-Loeschtest. |
| GitHub Actions / Browsertests v1.0.2 | **Ausstehend** | Vollstaendigen Lauf nach Push pruefen; v1.0.2 bis dahin nicht freigeben. |
| Docker-Image / ARM64-Live-Test / reale Mobilbrowser | **Nicht lokal ausgeführt** | Zielsystempruefung separat ausstehend. |

## Aenderungen v1.0.2

- Detail-DOM-Abgleich: Nur Foto-Kacheln werden ueber `data-photo-id` identifiziert. Bearbeiten-, Loeschen- und Verschieben-Buttons nutzen diesen Wert als Aktionsparameter, aber nicht als identischen DOM-Schluessel. Dadurch verschwindet die Editor-Schaltflaeche nach Aktualisierungen nicht mehr.
- Neuer echter DOM-Regressions-Unit-Test: Schlaegt gegen den bisherigen fehlerhaften Abgleich fehl und besteht mit der Korrektur; prueft auch den Erhalt des Editor-Button-Knotens.
- Sammlung-Browserfixtures an Schema 5 angepasst: `tastings: []` sowie bei physischen Flaschen `volumeType: 'standard'`. Der Server behaelt die strenge Schema-5-Validierung bei. Die Importfaelle 6, 75 und 450 wurden im HTTP-Integrationstest mit 200 bestaetigt.
- Neuer Browser-Loeschregressionstest wechselt wie die UI in den Bearbeitungsmodus, bevor er die Loeschschaltflaeche verwendet; das Verhalten bei HTTP 500 wird weiterhin geprueft.

**Freigaberegel:** Ein gruener Node-Testlauf ersetzt nicht die volle Browser-Suite. Die sieben gemeldeten CI-Fehler gelten erst nach erfolgreich erneutem Chromium-Lauf als abschliessend behoben.
