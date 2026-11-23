# Abschlussaudit: zentrales Designsystem – Qualitätssicherung

**Geprüfter Quellstand:** WhiskyCollectionManager `1.12.0`, exakt das **korrigierte Phase-5-Projekt-ZIP** als Basis. Dieser Abschluss ändert ausschließlich Tests, CI-Konfiguration und Dokumentation. **Keine Änderungen** an API, Collection-Schema, historischen Migrationen, Geschäftslogik, CSS oder Anwendungskomponenten.

## 1. Implementierte Komponenten / Eigentümerschaft

| Bereich | Gemeinsame Renderer | CSS-Verantwortung |
|---|---|---|
| Farben, Schrift, Abstände, Radien, Layoutbreiten | CSS Custom Properties in `styles/tokens.css` | `tokens.css`, `layout.css` |
| PageHeader / SectionHeader / BackNavigation / HeaderActions / HelpIconButton | `ui/headers.js` (seit der anschließenden Vereinfachung) | `headers.css` |
| Buttonvarianten / Formulare | `ui/buttons.js`, `ui/fields.js` | `controls.css` |
| Modals / Footer / Fokus-Stack | `ui/modal-layout.js`, `ui/modal.js` | `modals.css` |
| Panel/Card, DetailField, DetailGrid, EmptyState, Divider, ActionToolbar, DocumentList | `ui/content.js` | `content.css` |

**Migrierte Ansichten:** Sammlung (inklusive KPIs, leerer Sammlung und Detailkarten), Abfüllungs- und Flaschendetails, Verkostungsübersicht/-details und Notizen, Flight-Planung samt verschachtelter Hilfe, Lager-/Regalverwaltung, Analysen, Einstellungen/Backups, Hilfe und Karten-/Modal-Host. Die vorhandenen `data-act`-Verträge und Dialogzustände bleiben unverändert.

## 2. CSS-Bestand und technische Verbesserungen aus Phase 1–5

Das Audit der jetzigen Basis mit dem bisherigen statischen Auswerteskript ergibt **18 Stylesheets, 1.931 Regelblöcke und 6.361 Deklarationen**. Die Phase-5-Bereinigung reduzierte gegenüber Phase 4 **55 Regeln** und **137 Deklarationen**; die CSS-Quellbytes sanken um **4.039**. In derselben Selektor-/Media-Kombination waren danach keine widersprüchlichen Wiederholungen mehr nachgewiesen. Es existieren noch **11 wiederholte Selektoren**, deren Kaskaden im geprüften Kontext nicht widersprüchlich sind (mehrere Regeln mit getrennten Properties, getrennte Komponenten oder bewusste Overrides). Dies ist keine Aussage über alle semantisch überlappenden CSS-Selektoren.

**Bewusst verbleibende dynamische/öffentliche Klassen:** `ds-page-container`, `ds-page-stack`, `ds-section-stack`, `ds-inline-actions`, `ds-modal--photo` sowie die drei `warehouse-wall-pictogram--left/right/back`-Varianten. Sie sind durch Stringsuche allein nicht sicher als tot zu qualifizieren. Die unterschiedlichen Responsive-Breakpoints haben eigene Fachaufgaben; ihre Zusammenlegung wäre eine neue Designentscheidung, keine reine Bereinigung.

**Bewusst fachspezifisch:** 2D/3D-Lagerraum und Regalgeometrie, Flaschenbildeditor, Foto-/Dokumentvorschau, Whiskyfarbe und Glencairn-Füllstand, Radarprofil, Flight-Zusammenstellung, Landkartenmarker und Analyse-/SVG-Diagramme. Diese Werte dürfen dynamische Positionen, Größen und Farben besitzen; sie sollen zentrale Inhaltskomponenten nicht aus ihren Fachstyles überschreiben.

## 3. Abschluss-Testmatrix

| Anforderung | Prüfpfad | Status dieses lokalen Abschlusslaufs |
|---|---|---|
| Quellcode, Module, Übersetzungen, Dokumentationslinks, CI-Verträge | `npm run check` | bestanden |
| Unit- und HTTP-Integrationsprüfungen | `npm test` | **691 bestanden, 0 Fehler** |
| Header, Zurück-Pfeile, Übersetzungen, Hilfeicons, Geometrie | bisherige `tests/browser/designsystem-headers.test.js`; neu `designsystem-closure.test.js` | neue Playwright-Fälle für CI vorhanden; lokal nicht ausführbar wegen fehlender `playwright-core`-Installation |
| Buttons, Formularvalidierung, ARIA und Tastaturfokus | bisherige `designsystem-dialog-controls.test.js` und neuer Closure-Browsertest | Renderer/Unit vorhanden; Playwright-Teil noch durch CI zu prüfen |
| Modal-Stack, Flight-Hilfe, Scrollbar, Scrollposition, Escape, wiederholtes Öffnen | bisheriger Phase-3-Browsertest und neuer Closure-Test; zusätzlich direkter CDP-Interaktionscheck des visuellen Skripts | CDP-Lauf erfolgreich; vollständiger Playwright-Lauf offen |
| Panels, Detailfields, Empty States, lange Texte, fehlende Daten | vorhandene Phase-4/5-Browsertests, neue Closure-Tests, Screenshot-Szenarien | CDP-Messungen bestanden; Playwright-CI offen |
| Responsive und Hell/Dunkel, Deutsch/Englisch | `npm run test:visual` | **136 Bildschirmkombinationen erfolgreich** |
| Screenshot-/Differenz-Algorithmus | `tests/unit/designsystem-visual-png.test.js` | bestanden (einschließlich künstlicher 25-%-Abweichung) |
| Historische Phase-0-Referenzen | gesondertes, manuelles Vergleichspaket | 56 Bildpaar-Zuordnungen; **nicht** als automatischer Regressionstest geeignet |
| Firefox, Safari/WebKit, iOS/Android, reale Touch-Geräte, Screenreader | manuelle und gerätebasierte Abnahme | **offen** |
| Vollständige GitHub-PR-CI mit gepinntem Playwright-Chromium | `.github/workflows/check.yml` | **offen** bis PR-Lauf; kein fingierter CI-Erfolg |

Die neue visuelle Prüfung nutzt **17 Daten-/Navigationszustände × 4 Viewportbreiten (390/768/1024/1440 px) × 2 Themes**. Darunter sind leere Sammlung, unvollständige und vollständige Abfüllung, lange Bezeichnung, Verkostungsnotizen, Analysen, Einstellungen/Hilfe in Deutsch und Englisch, Lager, Verkostungsliste, neues/Edit-/Bestätigungsmodal und verschachtelte Flight-Hilfe. Für jeden Zustand werden Screenshot und Geometrie der Hauptbereiche erfasst. Es gibt **keinen horizontalen Überlauf** in den aktuellen 136 genehmigten Geometrie-Referenzen.

**Browserbedingungen:** Chromium via CDP mit festem 1100-px-Viewport, Device-Scale-Factor 1, festgelegten Testdaten, Arial-Fallback für deterministische UI-Snapshots, abgeschalteten Animationen/Transitionen und verborgenem Caret. Die CSS-Injektion ist **ausschließlich** im Snapshot-Lauf aktiv, nicht im Produktivcode. Die Browser-Testinfrastruktur verwendet einen lokalen isolierten Testserver und interceptet dessen HTTP-Antworten; reguläre Playwright-Navigation wird zusätzlich im normalen CI-Lauf geprüft.

Die Screenshot-Prüfung ist bewusst **mehrstufig**: pro Pixel wird ein RGB-Abstand von über 36 als Änderung gezählt, über 2 % geänderte Bildpixel führen zum Fehler; unabhängig davon führen Änderungen an relevanten DOM-Bounding-Boxes von über 2 px und horizontaler Überlauf zum Fehler. Die Toleranz gleicht kleine Browser-/Schriftrasterungsunterschiede aus, ersetzt aber keine Sichtprüfung. Hohe Änderungen erzeugen immer `actual/`, `diff/` und `report.json` im Ordner `test-artifacts/designsystem-visual/`.

## 4. Historische Phase-0-Referenzen

Die in Phase 0 erstellten Screenshots wurden **nicht stillschweigend ersetzt**. Für sieben zuordenbare Zustandsgruppen existieren 56 Vorher/Nachher-Differenzbilder im getrennten Abschluss-QA-Paket (Phase-0-Bilder der übrigen Zustände haben keine direkte Paarung mit identischem Fixture). Die Phase-0-Bilder sind teilweise **Full-Page-Screenshots** mit anderen synthetischen Daten, während die neuen CI-Goldens fest 1100 px hoch sind. Die Differenzprozente beinhalten also Daten- und Erfassungsunterschiede und sind *nicht* als Layoutregression zu interpretieren.

**Bekannte beabsichtigte Änderungen aus Phase 1–5:** einheitliches SVG-Zurück-Icon statt abweichender Pfeile, zentral ausgerichtete Hilfeicons, standardisierte Button-/Modal-Zustände und Fokusrahmen sowie konsolidierte Detailfeld-/Panelstruktur. Frühere nicht beabsichtigte Ungleichheiten dürfen nicht als neue Designvorgabe gelten. **Die Phase-5-Darstellung bildet den initialen automatisierten Referenzsatz**, nicht der unbereinigte Phase-0-Zustand.

## 5. CI und Baseline-Freigabe

Der bestehende Workflow `check.yml` prüft bereits Pushes auf `develop` und PRs nach `develop`/`main`. Für **Pull Requests** wird nun zusätzlich nach der bestehenden Playwright-Browserinstallation der visuelle Lauf gestartet. Reports werden mit `actions/upload-artifact@v4` als Artefakt hochgeladen, auch wenn der Test fehlschlägt. Der Browsersuite-Artefaktupload greift bei fehlerhaften PRs. Es gibt **keinen externen kostenpflichtigen Dienst**, kein Merge, keinen Bot-Commit und keine Referenzänderung durch CI.

- `npm run test:visual`: Referenzen ausschließlich lesen, auf Fehler mit Code 1 enden; `report.json` und PNG-Differenzbilder erzeugen.
- `npm run visual:update`: Referenzen **ausschließlich lokal und explizit** neu aufnehmen. Bei gesetztem `CI` wird der Befehl abgelehnt. Änderungen an Golden-PNGs und deren JSON müssen separat visuell geprüft und im PR freigegeben werden. Ein fehlgeschlagener Vergleich darf niemals automatisch zu einer Baseline-Aktualisierung führen.
- `WCM_VISUAL_BROWSER_PATH`: Pfad zur vorhandenen Chromium-Installation; CI bezieht ihn aus dem gepinnten `playwright-core`.
- `WCM_VISUAL_MAX_CHANGED_PERCENT`: optionaler Prüfgrenzwert (Standard: 2); Änderungen daran sind reviewpflichtig.

## 6. Offene Risiken und Empfehlungen

1. **CI-Goldens auf dem GitHub-Runner prüfen:** Hier wurde Chromium 144/Debian verwendet. GitHub installiert den zu `playwright-core@1.65.1` gehörenden Chromium-Build unter Ubuntu. Schriftmetriken können trotz Fallback und Schwelle abweichen. Das ist **offen**, bis die erste PR-CI die gesamte visuelle Matrix ausgeführt hat; Schwellen nicht blind hochsetzen, sondern tatsächliche Differenzen prüfen.
2. **Browserbreite vs. echtes Mobilgerät:** 390 px Chromium emuliert kein iOS Safari oder Android Chrome. Für Safe-Area, Virtual Keyboard, Touch und 200-%-Zoom sind manuelle Geräteprüfungen nötig.
3. **Accessibility:** Basisfunktionen, ARIA-Namen und Fokusnavigation werden geprüft; es fehlt eine qualifizierte WCAG-2.2-AA-Abnahme mit Screenreader und Kontrasttest für dynamische Diagramm-/Lagerfarben.
4. **Lange Inhalte:** Der lange Titel/Kommentar-Fall ist enthalten; weitere Übersetzungen (Extremlängen), lange Dateinamen und komplexe 3D-Raumpläne bleiben Stichprobenrisiken.
5. **Interaktionen und produktive Umgebung:** Playwright-Suite in CI ist weiterhin führend für HTTP-Navigation, Fotos, Datenimport und End-to-End-Formularinteraktionen. Der isolierte CDP-Test ersetzt sie nicht.
6. **Künftige UI-Entwicklung:** Renderer aus `public/js/ui/` wiederverwenden; `data-ds-*`-Verträge und `--ds-*`-Tokens nutzen; Fachausnahmen klar im zuständigen Stylesheet dokumentieren. Neue Seiten mit beiden Sprachen, Datenzuständen und vier Breiten in den visuellen Satz aufnehmen; Referenzänderungen im PR begründen.

**Versionierung:** weiterhin `1.12.0` gemäß `AGENTS.md` (kein Release-Bump für einzelne Develop-Änderungen).
