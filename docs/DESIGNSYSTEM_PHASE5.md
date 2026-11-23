# Zentrales Designsystem – Phase 5: Konsolidierung der Fachstyles

**Codebasis:** WhiskyCollectionManager 1.12.0, unverändertes, freigegebenes Phase-4-Projekt-ZIP. Dieses Dokument beschreibt Änderungen gegenüber genau diesem Stand und ist kein neues Layoutkonzept.

## Ziel und Entscheidungskriterien

1. Gemeinsame Renderer und Design-Tokens behalten die Eigentümerschaft an ihren allgemeinen HTML-/CSS-Verträgen. Fachstyles dürfen sie nicht grundlegend neu definieren, sondern nur begründete Fachvarianten ergänzen.
2. Nur Regeln löschen, wenn die konkrete Klasse im aktuellen Renderpfad und in dynamisch erzeugtem Markup nicht benutzt wird oder die gleiche Kaskade sie nachweislich überschreibt. Vorher-/Nachher-Layouts müssen vergleichbar bleiben.
3. Dynamisch berechnete Größen, Positionen und Farbwiedergaben von Lagerplan, Karte, Radar, Glencairn und Diagrammen sind **kein** Kandidat für pauschales Tokenisieren.
4. Aus der CSS-Ladereihenfolge darf keine versteckte Zuständigkeit zwischen fachlich fremden Ansichten entstehen.
5. Kein Umbau der API, Persistenz, Berechnungen, Übersetzungen oder Datenbindungen. Die fachlichen View-Funktionen behalten ihre Ein-/Ausgaben und `data-act`-Verträge.

## Vergleich vor/nach Phase 5

Die Auswertung umfasst `public/style.css` und sämtliche 17 Dateien unter `public/styles/`.

| Statische Kennzahl | Phase 4 | Phase 5 | Änderung |
|---|---:|---:|---:|
| CSS-Dateien | 18 | 18 | 0 |
| Regelblöcke (inkl. Media-Regeln) | 1.986 | 1.931 | **−55** |
| CSS-Deklarationen | 6.498 | 6.361 | **−137** |
| CSS-Bytes (Summe) | 239.767 | 235.728 | **−4.039** |
| Widersprechende Wiederholungen gleicher Selektoren im gleichen Kontext (statische Prüfung) | 13 | 0 | **−13** |
| Heuristisch nicht referenzierte Klassennamen | 28 | 8 | −20 |
| `style=` / `.style.`-Vorkommen in Anwendungs-JS (grobe Metrik) | 85 | 77 | **−8** |
| Verschiedene Media-Bedingungen (vereinfachte Textinventur) | 42 | 42 | 0 |

Die Wiederholungsprüfung vergleicht dieselbe Selektorzeichenfolge innerhalb derselben Media-/Supports-Bedingung. Sie erkennt keine semantisch überlappenden unterschiedlichen Selektoren; „0“ bedeutet **nicht**, dass es keine beabsichtigten CSS-Overrides gibt. Der Zähler für Inline-Styles erfasst auch nötige dynamische DOM-Style-Zuweisungen und ist **keine** allgemeine Fehlerzahl. Nicht referenzierte Namen sind Kandidaten, keine Laufzeit-Beweise für die Unbenutztheit.

## Zentralisierung und tatsächlich entfernte Regeln

### Fachlich getrennte Eigentümerschaft

- **Fotokacheln:** `.bottle-photos`, `.photo-tile`, `.photo-open`, Fotosteuerung und -aktionen gehören nun ausschließlich nach `styles/bottle-details.css`. Die früheren Überschneidungen mit `styles/collection.css` sind entfernt; die tatsächlich wirksamen Kachelmaße (102 × 137 px, Öffnungsfläche 107 px) bleiben erhalten. Damit beeinflusst der Sammlungsstil die Galerie physischer Flaschen nicht mehr.
- **Branding:** Gemeinsame `.brand-logo`- und `.brand-emblem`-Regeln liegen in `styles/core.css`. Überschreibungen aus `collection.css` entfallen; der tatsächlich wirksame SVG-Zustand bleibt erhalten.
- **Abschnittstitel:** Die bestehende fachliche `min-width:0`-Regel der Verkostungsüberschrift ist zu den zentralen Headerregeln gewandert.
- **Gemeinsame Panels:** Die vier Kennzahlen der Sammlung und die Kennzahlen der Analyse verwenden nun den vorhandenen `panel()`-Renderer (`data-ds-panel`), **ohne zusätzliche Panelverschachtelung**. Die bisherigen Klassen `.panel.stat` bzw. `.panel.stat.analytics-metric` und ihr wirksames Layout bleiben erhalten.
- **Aktionen im Lagerfach:** Die vorhandene Aktionsgruppe verwendet jetzt den zentralen `actionToolbar()`-Renderer; die Fachklasse und `data-act`-Attribute bleiben bestehen.

### Redundanzen entfernt oder zusammengeführt

- **Verkostung:** widersprechende doppelte Basiswerte für `.tasting-rating`, `.tasting-glasses`, `.tasting-glass` und die Notizblöcke bereinigt; bestehende Fachvarianten und Media-Breakpoints bleiben erhalten.
- **Buttons/Formulare:** redundante `.form-field`-Farbe entfernt; semantischer Formulartoken ist die gemeinsame Quelle.
- **Modals:** doppelte `.overlay`- und `.dialog`-Deklarationsblöcke zusammengeführt. Bestehende `max-height`, Scroll- und Verschachtelungsregeln sind erhalten.
- **Toolbar, Hilfe und Scanner:** redundante Regeln für `.toolbar select`, `.help-section`, `.scan-reader` und dessen Video vereinigt; die bisher tatsächlich wirksamen Werte bleiben bestehen.
- **Karte:** doppelte `.map-marker.selected`-Regel zusammengeführt; Karten-Positionsberechnungen bleiben unberührt.
- **Lagerverwaltung:** redundante Regeln für Möbelpanel, Flaschensymbol, Silhouetten, Seitennavigation und Detailfakten zusammengeführt. Die tatsächlich verwendete `grab`-Interaktion ist erhalten.
- **Veraltete, statisch unbenutzte Komponenten:** u. a. `.analytics-tabs`, `.bottle-meta`, ehemalige SVG-Gläserhilfsregeln, `.tasting-history-list`, `.scan-preview`, `.kbd`, `.import-results`, `.import-result`, frühere Backup-Wrapper, alte Lager-Such-/Ansichts-Toolbars, Lagerraum-Kapazitätsbadge und nicht mehr genutzte Lager-Fachhilfen gelöscht.
- **Inline-Abstände:** feste `style`-Attribute aus den alten Import-, Scanner-, Einstellungs- und Lagertür-Formularblöcken durch benannte Fachklassen mit exakt denselben Abständen ersetzt. Die Regeln liegen in `core.css`, `scanner.css`, `settings.css` bzw. `warehouse.css`.
- **Feste Werte:** ein bestehender, nachweislich gleicher 44-px-Standard für Analyse-Controls nutzt nun `--ds-control-height`. Spezialmaße anderer Kontrollen bleiben erhalten.
- **Theme-Overrides:** veraltete `.kbd`- und Import-Selektoren aus dem Dunkelmodus entfernt; vorhandene aktive Themewerte bleiben bestehen.

## Migrierte Views / Komponenten

| View/Modul | Verwendung der gemeinsamen Grundlage | Fachliche Ausnahme |
|---|---|---|
| `views/home.js` | `panel()` für vier Sammlungs-KPIs | Sammlungskarten, Galerieansicht, Filter und Hero bleiben eigenständig |
| `views/analytics.js` | `panel()` für Kennzahlen | Diagramme, Kennzahlenraster und chart-spezifische Typografie |
| `views/warehouse-shelf-details.js` | `actionToolbar()` für Lagerfach-Aktionen | Regal-/Fachlayout und Zuordnungsaktionen |
| `views/settings.js` | Klassenbasierter Importabstand | Backup-/Transfer-Arbeitsabläufe |
| `features/import/controller.js` | Klassenbasierte Preview-Aktion | Import-Vorschau / Datenverarbeitung |
| `features/scanner/controller.js` | Klassenbasierte manuelle Felder/Aktionen | Kamera- und Scanner-UI |
| `views/warehouse.js` | Klassenbasierte Türbereich-Geometrie | 2D/3D-Plan, Möbel-/Regalpositionen |
| `bottle-details.css` | Eigenständiger Eigentümer der Fotokacheln | Fotobearbeitung und Drag-and-drop |
| `core.css` / `headers.css` | Gemeinsames Branding und Header-Basissizing | Spezialtitel behalten ihre fachlichen Breakpoints |

## Bewusst verbleibende Designabweichungen

- **Lager (2D/3D):** positionierte und drehbare Möbel, Lagerfächer, Kapazität, Symbole und Piktogramme müssen eigene Maße und Inline-Koordinaten behalten.
- **Whiskyfarbe/Glencairn:** Flüssigkeitsfüllstand, Transparenz und Sonderfarben sind datengetriebene Visualisierung und keine normalen Oberflächen-Tokens.
- **Radar- und Analysediagramme:** SVG-/Canvas-Koordinaten, Datenskalen und Farblegenden behalten ihre Fachwerte. Analysestandard-Controls nutzen die gemeinsamen Formulartokens.
- **Tasting-Flights und Verkostungsnotizen:** semantische Unterteilung und gruppenabhängige Spalten bleiben fachlich; `DetailField` und `DetailGrid` werden dort genutzt, wo der Feldtyp übereinstimmt.
- **Karten:** Markerkoordinaten, Auswahlzustände und Pan/Zoom bleiben innerhalb des Kartenmoduls.
- **Bildeditor:** feste Bearbeitungsfläche, Checkerboard, Zoom-/Crop-Transformationen und Fokuszustände bleiben spezialisiert.
- **Media-Queries:** die 42 unterscheidbaren Bedingungen wurden nicht künstlich zusammengelegt: ihre unterschiedliche Viewport-/Fachfunktion ist kein Nachweis von Redundanz.
- **Dynamische/Künftige Klassen:** `ds-page-container`, `ds-page-stack`, `ds-section-stack`, `ds-inline-actions` sind die öffentliche Layout-API; `ds-modal--photo` wird dynamisch aus Modalgrößen gebildet; `warehouse-wall-pictogram--left/right/back` bezeichnet richtungsabhängige SVG-Grafiken. Diese Namen bleiben trotz fehlender direkter Stringreferenz im statischen JS erhalten.
- **Unterschiedliche Panels:** Charts oder Lager-Detailbereiche bleiben keine künstlich standardisierten Panels. Fachspezifische Überschreibungen dürfen nur Fachklassen adressieren und den globalen `.panel`-Vertrag nicht neu definieren.

## Regeln für Folgeänderungen

1. `panel()`, `actionToolbar()`, `DetailField`, `DetailGrid` und `EmptyState` aus `public/js/ui/content.js` bevorzugen, wenn Semantik, Interaktion und Design übereinstimmen.
2. Keine globalen gemeinsamen Selektoren aus einer Fachansicht überschreiben. Varianten durch explizite Fachklasse oder Designsystem-Variante dokumentieren.
3. Keine CSS-Regel allein aufgrund von Stringsuche löschen, wenn der Klassenname dynamisch zusammengebaut oder aus Browser-Templates erzeugt werden kann.
4. Statische `style`-Attribute vermeiden; dynamisch berechnete Darstellung bleibt dort zulässig, wo sie aus Zustandsdaten stammt.
5. Neue Responsive-Regeln anhand 390/768/1024/1440 px in Hell/Dunkel prüfen; fachliche Ausnahmen dokumentieren.
6. Neue Designwerte nur dort durch Tokens ersetzen, wo die semantische Gleichheit tatsächlich besteht, nicht nur zufällig dieselbe Pixelzahl.

**Version:** unverändert 1.12.0 gemäß `AGENTS.md` (Release-Versionierung ausschließlich beim genehmigten Release).
