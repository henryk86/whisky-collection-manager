# Designsystem Phase 4 – lokaler Prüfbericht

**Ausgangsstand:** unverändertes `WCM_Phase3_CI_Fix_Projekt.zip` mit Phase-3-Lager-Modal-Hotfix, Version 1.12.0. Änderungen betreffen ausschließlich UI-Renderer, gemeinsame CSS-Regeln, komponentenspezifische Tests und diese Dokumentation. Kein neuer API-, Schema- oder Persistenzcode.

## Testmatrix

| Prüfung | Ergebnis | Einschränkung |
|---|---|---|
| `npm run check` | **Bestanden** | Prüft statische Projektregeln, Imports und Dokumentation. |
| Unit: `node --test tests/unit/*.test.js` | **512/512 bestanden**, 0 Fehler | Einschließlich **5 neuer** Phase-4-Komponententests. |
| Integration: `node --test tests/integration/*.test.js` | **174/174 bestanden**, 0 Fehler | Für die begrenzte Laufzeit in fünf Teilmengen ausgeführt: 36+44+43+24+27; ein früherer Gesamtlauf wurde nach 160 fehlerfreien Tests am Laufzeitlimit beendet und wird nicht als bestanden gewertet. |
| Zusammen Unit + Integration | **686/686 bestanden** | Summe der vollständig abgeschlossenen Läufe. |
| Neue Browser-Regressionen | **4 Tests hinzugefügt, nicht ausgeführt** | Benötigen `playwright-core` 1.65.1. `npm ci` scheiterte am Laufzeit-/Netzzugriff; es wird kein grünes Ergebnis behauptet. |
| Echter Chromium-Visualvergleich | **26/32 Screenshots pixelidentisch**, **32/32 DOM-Geometriemessungen identisch** | Per Chromium DevTools Protocol mit lokal abgefangenen echten Projektressourcen/API-Antworten, ohne Playwright; vier Zustände, vier Breiten, zwei Themes. |
| Horizontaler Überlauf | **0 px** in allen 32 Referenzen | Desktop 1440/1024, Tablet 768, Mobil 390, jeweils Light/Dark. |
| Gesamte reguläre Browser-CI | **Offen** | Muss vom Projekt-CI-System nach Patchanwendung ausgeführt werden. |

## Geprüfte visuelle Zustände

Die Phase-3-Hotfix-Basis und Phase 4 wurden jeweils mit **denselben synthetischen Daten und demselben Chromium** gerendert. Verglichen wurden tatsächliche PNG-Pixel und DOM-Bounding-Boxes/CSS-Messwerte (Panel-Padding, Detailraster, Linksposition/Breite, Scrollbreite):

1. **Leere Sammlung:** Einführungs-Empty-State mit Aktionsbutton.
2. **Teilweise gefüllte Abfüllungsdetails:** fehlende optionale Werte und Dateiliste-Hinweis, unveränderte Header/Panels.
3. **Vollständige Abfüllungs-/Flaschendetails:** Detailfelder, mehrere Datenbereiche, Dokument-/Verkostungsinformationen.
4. **Gespeicherte Verkostung mit Notizen:** Notizlabel, Radar-/Farb-/Bewertungsumfeld, responsive Detailtrennlinien.

Für jeden Zustand wurden 390, 768, 1024 und 1440 px in beiden Themes geprüft: **32 Vergleichspaare**. Ergebnis: **26 von 32 pixelgenau identisch**, **32 von 32 identische Geometriemessungen**; kein horizontaler Dokumentüberlauf. Die sechs weiteren Screenshots zeigen sehr kleine Text-/Antialiasing-Abweichungen (maximal **0,313 %** der Bildpixel, keine Positions-/Größenänderung); sie werden **nicht** als pixelidentisch ausgewiesen. Es wurde keine Layoutänderung als neue Norm übernommen.

## Was die Browser-Screenshots nicht beweisen

Die optische Prüfung ist ein isolierter Chromium-DOM-Lauf mit projektinternem Testserver. Native iOS-/Android-Geräte, Screenreader, native Softkeyboard-Effekte, WebGL-Lagerregale und sämtliche interaktiven Datei-/Dokumentenaktionen wurden damit **nicht** vollumfänglich abgenommen. Die zusätzlichen Browser-Tests prüfen Quellcode-seitig Layout/Leere/Datei-Hinweis/gespeicherte Notizen, müssen aber noch unter der Projekt-CI durchlaufen. Der Browser kann in der lokalen Laufzeit nicht regulär `127.0.0.1` navigieren; alternative DOM-Route ist ausdrücklich nur visuelle Regression, keine vollständige Browser-CI.

## Erwartete Ausführung in regulärer CI

```sh
npm ci
npm run check
npm test
npm run test:browser
```

Bei fehlgeschlagenen Browserfällen bitte Name, Testlauf und konkretes Fehlerprotokoll prüfen, bevor Erwartungen verändert werden. Für Architektur und bewusst erhaltene Fachvarianten siehe [Phase-4-Dokumentation](DESIGNSYSTEM_PHASE4.md).
