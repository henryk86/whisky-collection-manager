# Teststrategie und B-5-Abnahme

## Grundsatz

Tests pruefen **beobachtbares Verhalten**, Fachregeln, persistierte Daten, HTTP-Antworten und das im Browser gerenderte Ergebnis. Ein Test, der lediglich den Quelltext einer CSS- oder Anwendungs-JavaScript-Datei nach einer bestimmten Schreibweise durchsucht, ist kein Verhaltenstest. Solche historischen Tests wurden im B-5-Umbau entfernt und durch die unten genannten Tests ersetzt.

Der normale Check (`npm run check`) verbietet neue Quellcode-Leseassertions in `tests/unit/` und `tests/integration/`. Die fruehere Obergrenze `scripts/source-regex-budgets.json` ist entfernt: Es gibt keinen erlaubten Restbestand an Quelltext-CSS/JS-Tests mehr. **Regex auf erzeugtem HTML, API-Ergebnissen, Fehlermeldungen oder normalisierten Daten sind dagegen weiterhin legitime Verhaltenstests.**

## Abdeckung nach Bereich

| Frueher als Quelltext getestete Eigenschaft | Pruefung des tatsaechlichen Verhaltens |
| --- | --- |
| Lagerwand: Fachhoehen, Scrollen, Markierung, unbenutzbare Faecher und Inset-Rand | `tests/browser/b5-runtime-contracts.test.js`, `tests/browser/warehouse.test.js`, `tests/unit/warehouse-room-wall.test.js` |
| Lager/3D: Moebelgeometrie, Drehung, Sichtbarkeit, Hervorhebung und Anwahl | `tests/unit/warehouse-3d.test.js` (echtes Geometriemodell und simulierte Mesh-Materialien), `tests/browser/warehouse.test.js` (Navigation und Sichtbarkeit) |
| Verkostungsformular: Spalten, Aktionen, responsives Verhalten | `tests/browser/b5-runtime-contracts.test.js`, `tests/browser/tastings.test.js`, die Renderer-/Fachtests in `tests/unit/` |
| Fotobearbeitung, Bildplatzhalter, Icons und Markenlogo | `tests/browser/photos.test.js`, `tests/browser/b5-runtime-contracts.test.js`, `tests/integration/icons.test.js` (HTTP und echte Bildbytes) |
| Responsive Header, Abstaende, Kartenfarben und Seitennavigation | `tests/browser/layout-runtime.test.js`, `tests/browser/map-analytics.test.js`, `tests/browser/b5-runtime-contracts.test.js` |
| Whiskybase-Auswahl, Importsteuerung und Sicherungsdialoge | `tests/browser/b5-runtime-contracts.test.js`, `tests/integration/api.test.js`, `tests/integration/backups.test.js` |
| Daten-, Cache-, Migrations-, Restore- und Sicherheitsregeln | Fach-Unit-Tests sowie HTTP-/Datei-Integrationstests; keine Suchen nach Implementierungszeilen |
| Release-, Docker-, HTTPS- und GitHub-Workflow-Vertraege | `scripts/check-deployment-config.js` in `npm run check`, Negativtests unter `tests/integration/deployment-contracts.test.js`; echter CI- und Image-Build bleiben separate Laufzeitpruefungen |

## Verbindlicher Ablauf

1. `npm run check` prueft Syntax, Modulgrenzen, Sprachdateien, Links, das Verbot neuer Quelltexttests und deklarative Deployment-Vertraege.
2. `npm test` prueft Fachregeln, Rendering-Ausgaben, API, Persistenz, Restore, Sicherheitsreaktionen und Negativfaelle.
3. `npm run test:browser` prueft die Anwendung und ihre CSS-Geometrie in Chromium. Im eingeschraenkten DOM-Modus ist der echte HTTP-History-Fall uebersprungen; ein solcher Lauf ist daher **keine vollstaendige CI-Freigabe**.
4. Ohne wirksame Free-Rulesets muss der Anwender den gruennen PR-Status vor dem Merge selbst kontrollieren; die Release-Action kontrolliert die PR-Herkunft erneut. Vor jedem Merge muss die GitHub-Actions-Browser-Suite fuer den freizugebenden Merge-Quellstand gruen sein; beim Merge nach `main` prueft die Release-Pipeline den Merge erneut und versioniert erst danach den Tag-Snapshot. Nach erfolgreichen Artefakt-Tests werden beide Branches atomar mit dessen Versionsmetadaten synchronisiert; bei konkurrierenden Metadaten-Aenderungen gibt es keinen automatischen Push. Docker-/ARM64-/WebGL-Hardware pruefen, wenn die betroffenen Laufzeitkomponenten veraendert werden.

Ein fehlgeschlagener Test darf nicht durch blosses Entfernen seiner Assertion behoben werden. Beim Ersatz einer Quelltextpruefung muss der Zweck in mindestens einem vorhandenen oder neu hinzugefuegten Verhaltens-/Deployment-Test wiederzufinden sein.
