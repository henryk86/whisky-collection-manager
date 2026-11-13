# Teststatus - Whisky Collection Manager v0.16.17

**Stand:** 13.11.2026. **Basis:** v0.16.16 mit gezielter Korrektur der Radio- und Checkbox-Marker. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben in Paketdateien, README, Changelog und Teststatus stimmen überein. |
| `npm run check` | **Bestanden** | 213 JavaScript-Dateien, 906 referenzierte Übersetzungsschlüssel und 86 relative Dokumentationslinks geprüft. |
| `npm test` | **348/348 bestanden** | Unit- und Integrationstests einschließlich neuem CSS-Regressionstest. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Direkter Chromium-Versuch konnte hier nicht abgeschlossen werden; keine vollständige Browser-Prüfung. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach Veröffentlichung auf dem Raspberry Pi prüfen. |

## Änderungen v0.16.17

- Die nativen Radio-Markierungen im Lagerort-Zuordnungsdialog und die Checkboxen der Möbel-Mehrfachauswahl werden auf 18 × 18 Pixel begrenzt, einschließlich `min-height`, `padding` und `margin`.
- Die allgemeine Formularregel (`min-height: 44px`, `padding: 11px 12px`) beeinflusst diese beiden Auswahlmarkierungen nicht mehr.
- Sonstige Gestaltung, Kartenauswahl, Abstände, Ereignisverarbeitung, Datenmodell und Docker-Konfiguration unverändert.
