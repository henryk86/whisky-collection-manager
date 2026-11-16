# Teststatus - Whisky Collection Manager v0.28.6

**Stand:** 2026-11-16. **Status:** Unit-/Integrationstests und gezielte Chromium-Pruefungen erfolgreich; vollstaendige Browser-Suite sowie reale Mobilgeraete noch offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten v0.28.6 konsistent. |
| `npm run check` | **Erfolgreich** | JavaScript, Sprachkataloge und Dokumentationslinks. |
| `npm test` | **557/557 bestanden** | Vollstaendige Unit-/Integrationstests. |
| Chromium-DOM-Pruefung mit realer App | **Erfolgreich** | Acht Testfotos; Loeschen eines mittleren und des ersten Fotos sowie eines PDF-Nachweises: kein Sprung des Seiteninhalts, sofortige Scrollwiederherstellung. |
| `npm run test:browser` (vollstaendig) | **Nicht lokal ausgeführt** | Neuer Browser-Regressionstest vorhanden, vollstaendiger Runner steht noch aus. |
| Echte iOS-/Android-Geraete | **Nicht lokal ausgeführt** | Scroll-Lock auf Safari und anderen Mobilbrowsern separat pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf Zielsystem pruefen. |

## Aenderungen v0.28.6

- Bei Updates derselben Ansicht bleiben Header und modale Ebene bestehen. Die Abfuellungsdetailseite ersetzt nur veraenderte Abschnitte, statt das gesamte Dokument kurz zu entfernen.
- Bestaetigungsdialoge stellen die Scrollposition sofort wieder her, ohne die globale sanfte Scrollanimation auszuloesen.
- Bei einer neuen Titelfotografie bleibt die zuvor sichtbare Bildhoehe bis zum Laden des Ersatzfotos reserviert.
- Foto-Sortierung wird bei wiederverwendeten Galerieelementen nur einmal angebunden.
- Eine Browser-Regression gegen sichtbare Scrollspruenge beim Loeschen von Fotos und Nachweisen wurde ergaenzt.
