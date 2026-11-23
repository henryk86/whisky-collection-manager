# Designsystem Phase 5 – Prüfbericht

## Verifizierter Ausgangsstand

Die Implementierung nutzt ausschließlich das zuletzt freigegebene `WCM_Phase4_Projekt.zip` als Ausgangsstand. Frühere ZIPs oder Patches wurden nicht als Basis eingesetzt. Der Auslieferungspatch wird gegen dessen unveränderte Dateien geprüft.

## Code- und Komponententests

- `npm run check`: **bestanden** (zuletzt vollständige Ausführung vor Erstellung des Dokumentationsnachtrags). Syntax/Importgraph, Übersetzungen, relative Dokumentationslinks und Deployment-Kontrakte wurden geprüft.
- Vollständige Unit-/Integrationssuite **vor** der abschließenden zusätzlichen Startseitenmigration und den Phase-5-Tests: **686 von 686 bestanden**, 0 fehlgeschlagen.
- Finale isolierte Unit-Suite einschließlich drei neuer Phase-5-Tests: **515 von 515 bestanden**, 0 fehlgeschlagen.
- Die letzte erneute vollständige Integrationssuite wurde nach **170 erfolgreichen Fällen** durch das Ausführungslimit der Testumgebung beendet. Das ist **keine** vollständige grüne Schlussausführung. Die zuvor erfolgreiche Integrationssuite umfasste 174 Fälle; die späteren Änderungen betreffen nur den Sammlungsrenderer, CSS-Quellen und UI-Regressionstests.
- `tests/unit/designsystem-phase5.test.js`: Komponentenvertrag der Sammlungskarten, Analyse-KPIs und Lagerfach-Toolbar geprüft.
- `tests/browser/designsystem-phase5.test.js`: **drei neue Browser-Regressionstests ergänzt**, lokal nicht als Playwright-Suite ausgeführt (gepinntes `playwright-core` in dieser Umgebung nicht installiert). Sie prüfen tatsächlich DOM-Geometrie, gemeinsame Oberflächen-Tokens, Dateiimport-Abstände und Fotokachelgrößen bei mehreren Viewports. Normale GitHub-CI muss diese Tests ausführen.

## Visuelle Regression

- Automatisierte Chromium-DOM-Läufe mit dem unveränderten Phase-4-Stand und der Phase-5-Fassung, identischen synthetischen Daten und real geladenem Projekt-CSS.
- 9 Ansichten/Zustände: leere Sammlung; teilweise und vollständige Abfüllungsdetails; gespeicherte Verkostung; Analysen; Einstellungen; Hilfe; Lagerübersicht; Verkostungsliste.
- Vier Viewports **390 / 768 / 1024 / 1440 px**, jeweils **Hell / Dunkel**: **72 Vorher/Nachher-Paare**.
- **65/72 pixelidentisch** im zuletzt ausgewerteten Vergleich. Weitere fünf Paare zeigen nur sehr kleine Rasterungsabweichungen (jeweils maximal 0,00612 % der Bildpixel). Zwei Lageransichten unterscheiden sich in größeren gleichförmigen Farbflächen in der Rasterung, ohne dass sich die gemessene Geometrie ändert (bei 768 px maximal 1 RGB-Stufe, bei 390 px maximal 10 RGB-Stufen, fast alle Differenzen 1 Stufe).
- In **allen 72** Vergleichen übereinstimmende Breiten, Spalten und Abstände. Bei acht Einstellungsseiten erhält die neue, aktuell eingeklappte Importkomponente zusätzlich einen Klassennamen; das automatisch protokollierte `samples`-Array ist deshalb nicht mehr zeichenweise identisch, während alle existierenden geometrischen Einträge unverändert sind.
- **0 px horizontaler Dokumentüberlauf** in allen 72 Nachher-Referenzen.
- Ein letzter Wiederholungslauf der 72 Screenshots wurde nach 24 abgeschlossenen Aufnahmen durch das Zeitlimit unterbrochen. Der vollständige dokumentierte Vergleich stammt vom davor abgeschlossenen Lauf, in dem nachträglich nur die Startseitenstatistiken auf den bereits für Analysen genutzten Panelrenderer umgestellt wurden. Die ersten acht erneut erfassten Sammlungsbilder bestätigen unveränderte Panelabmessungen.
- **Nicht geprüft:** interaktiver 3D-Lagerraum auf echter GPU, mobile Safari/Android WebView, vollständiges Browser-Testprogramm, GPU-spezifische Zeichenwege und optische Kameraerkennung.

## Statische CSS-Qualität

- 18 CSS-Dateien vor und nach der Bereinigung.
- 1.986 → 1.931 Regelblöcke (−55); 6.498 → 6.361 Deklarationen (−137); 239.767 → 235.728 CSS-Bytes (−4.039).
- 13 → 0 widersprüchliche Wiederholungen gleicher Selektoren unter gleicher Bedingung (heuristische, textbasierte Kaskadenprüfung).
- 28 → 8 heuristisch unreferenzierte Klassennamen; die verbliebenen acht sind bewusst dynamische oder öffentliche Layoutklassen.
- 85 → 77 Vorkommen von `style=`/`.style.` in Anwendungs-JS. Die verbleibenden dynamischen Fachvisualisierungen sind begründet.
- 42 unterschiedliche Media-Bedingungen vor und nach der Bereinigung – keine riskante Zusammenlegung.

## Grenzen und Freigabeempfehlung

- **Keine** Änderungen an API, Collection-Schema, Datenmigration, Persistenz oder Geschäftslogik.
- Die ursprüngliche, vollständige Browser-CI ist im Projekt auf regulär installiertem Playwright erforderlich; besonders Fotoverwaltung, Raster-/3D-Lager, Modals, Karten und Verkostungsflight sollten grün sein.
- Kein eigenständiger Versionsbump auf `develop`: 1.12.0 bleibt erhalten.

## Reproduzierbare Projektprüfungen

```powershell
npm run check
npm test
npm run test:browser
```
