# Teststatus - Whisky Collection Manager v0.17.8

**Stand:** 13.11.2026. **Basis:** v0.17.7; nur die Aufteilung des Fotoeditors geändert. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben im Projekt stimmen überein. |
| `npm run check` | **Bestanden** | 220 JavaScript-Dateien, 928 referenzierte Übersetzungsschlüssel, 97 relative Markdown-Links geprüft. |
| `npm test` | **366/366 bestanden** | Unit- und Integrationstests. |
| Gezielte Chromium-Prüfung | **Bestanden** | Dialog bei 1366×900, 1366×768, 1152×648, 844×390, 390×844 und 320×568 geprüft. Bild-/Reglerhöhe auf Desktop gleich; Zoom/Vorher-Nachher im Vorschaufenster, Status und Buttons ohne Überdeckung. |
| `npm run test:browser` | **Nicht abgeschlossen** | Vollständige Browser-CI-Suite in dieser Umgebung nicht ausgeführt; bestehender Layout-Regressionstest aktualisiert. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Zielsystemprüfung nach Release offen. |

## Änderungen v0.17.8

- Gemeinsame Arbeitsbereichshöhe für Foto-Vorschau und rechte Tab-/Reglerspalte; bisherige überstehende 44 Pixel entfernt.
- Regler-Inhalt separat scrollbar; die Tab-Leiste selbst bleibt stehen.
- Statusmeldung kompakter, unterhalb der Spalten über volle Breite, und Aktionsleiste ohne unnötigen Leerraum.
- Kein Eingriff in Bildkorrekturen, Freistellung, Speicherformat oder Bildauflösung.

Die gezielte Chromium-Prüfung nutzte eine synthetische lokale Flaschenbilddatei; die vollständige Browser- und die ONNX-Erkennungsprüfung wurden nicht ausgeführt.
