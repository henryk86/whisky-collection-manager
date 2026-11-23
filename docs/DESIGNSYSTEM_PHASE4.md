# Designsystem – Phase 4: Inhalts- und Detailkomponenten

**Ausgangsbasis:** ausschließlich `WCM_Phase3_CI_Fix_Projekt.zip` (Phase 3 einschließlich des Lager-Umlagerungsmodal-Hotfixes). **Projektversion:** weiterhin 1.12.0 gemäß `AGENTS.md` (kein Versionsbump auf `develop`). Keine Änderungen an API, Speicherformat, Geschäftslogik, externen Abhängigkeiten oder Frontend-Framework.

**Aktuelle Verwendung und reduzierte Schnittstellen:** [Designsystem-Entwicklung](DESIGNSYSTEM_ENTWICKLUNG.md). Diese Phase-4-Dokumentation ist eine historische Migrationsbeschreibung.

## Gestaltungsgrundsatz

Die **Sammlung** und **Abfüllungsdetails** bilden die visuelle Referenz. Gleichartige Inhalte teilen sich Rendering- und Stylinggrundlagen, aber nicht automatisch jede fachliche Geometrie. Insbesondere Verkostungsradare, Glencairn-Farb-/Bewertungssymbole, Fotoansichten, Lagerregale und analytische Grafiken bleiben in ihren bestehenden Fachstyles. Eine Standard-Panel-Komponente darf nicht als weiterer sichtbarer Kasten in ein bereits gerahmtes Panel eingesetzt werden.

## Abhängigkeiten und Eigentümerschaft

`public/style.css`: `tokens.css` → `layout.css` → `controls.css` → **`content.css`** → `core.css` → `headers.css` → `modals.css` → Fachstyles → `surfaces.css`. Neue Inhaltsgrundlagen werden **vor** Fachstyles geladen. Fachstyles dürfen notwendige, lokal beschränkte Raster, Abstände und Visualisierungen behalten. Es wurden keine `!important`-Regeln oder zusätzlichen JavaScript-Abhängigkeiten eingeführt.

- `public/js/ui/content.js`: **einzige gemeinsame HTML-Rendererfamilie** für Panel, DetailField, DetailGrid, EmptyState, Divider, ActionToolbar und DocumentList/DocumentItem.
- `public/styles/content.css`: gemeinsame Oberflächen-, Detailtypografie-, Trenner-, Toolbar- und Listenregeln. Bestehende Design-Tokens aus Phase 1 werden wiederverwendet.
- Fachstyles: nur bewusst andere Geometrien (`.bottle-entry-facts`-Breakpoints, `.tasting-readonly-notes`-Trennlinien, Fotokachel-/Datei-Vorschauaktionen, `.analytics-panel`-Layout, Lager-/Radar-Visualisierungen).

### Komponentenverträge

| Komponente | Interface | Varianten / Verantwortung |
|---|---|---|
| `panel({content,variant,tag,className})` | Bereits sicher gerendertes `content`, Überschrift ist Teil des Slots | `standard` (bestehende `.panel`), `analytics` (bestehende `.analytics-panel`), `plain` (ohne Rahmen); `div`/`section`/`article`. Keine zweite Rahmenebene. |
| `detailField({label,value,valueHtml,variant,className,labelClass,valueClass})` | Text standardmäßig HTML-escaped; `valueHtml=true` **nur** für bereits sicheres App-Markup | `definition` (`dt`/`dd`), `fact`, `readonly`, `note`, `preview`. Keine eigene `extra`-Zusatzzeile. |
| `detailGrid(content,{columns,tag,className})` | Gemeinsamer Rastermarker `data-ds-detail-grid=2\|3`; `div` oder `dl` | 2- und 3-spaltige Grundeinstellung ohne starre Mindestbreite. Fachliche Klassen/Media Queries haben Vorrang. Unklassifizierte neue Grids brechen bei ≤600px einspaltig um. |
| `emptyState({title,description,actions,variant,className})` | Titel/Beschreibung escaped; Aktionen als bereits gerendertes App-Markup | `collection` als eigenständiger Einführungszustand, `subtle` als dezenter Hinweis im Panel, `inline` für Analyse-ohne-Daten. |
| `divider({orientation,className})` | `<hr>` oder dekorativer `<span aria-hidden>` | `horizontal`/`vertical`; Randfarbe über `--ds-color-border`. |
| `actionToolbar(content,{className,variant})` | Keine Änderung vorhandener `data-act`-Delegation; `div` | `inline`, `filters`, `end`; vorhandene `.actions`/`.toolbar`-Kompatibilität. |
| `documentItem(content)` / `documentList(items)` | `<li>` und eine übergeordnete `<ul>` | Gemeinsam für Dateinamen, Größen, Vorschau-/Download-/Löschaktionen; keine Änderung der Dateiverwaltung oder Endpunkte. |

**Sicherheit und Semantik:** Werte werden per `escapeHtml` ausgegeben. Nur anwendungsintern kontrollierte HTML-Blöcke werden über `content`, `actions` oder `valueHtml` übergeben. `definition` verwendet `dt`/`dd` innerhalb eines `dl`; gespeicherte Notizen werden nicht fälschlich in Definitionslisten gezwungen. `data-ds-*` kennzeichnet den Komponentenvertrag; frühere Fachklassen bleiben dort erhalten, wo sich darauf Layout oder Browseraktionen stützen.

## Tatsächlich migrierte Strukturen

| Ansicht | Gemeinsame Darstellung | Bewusst erhaltene Fachvariante |
|---|---|---|
| Sammlung | Einführungs-/Filter-Empty-State | Große, gestrichelt eingerahmte Sammlungseinladung; keine Gleichsetzung mit kleinen Hinweisen. |
| Abfüllungsdetails | Standardpanel, Zwei-Spalten-Fakten mit `DetailField`, Horizontal-Divider, Verkostungsvorschaupanel, Vorschau-Notizfelder | Foto/Detail-Hauptlayout; Tasting-Radar; Vorschau ohne zusätzliche Trennlinien. |
| Physische Flaschendetails | Drei-Spalten-`DetailGrid` mit Definitionen, Datei-/Belegliste, dezenter „keine Anhänge“-Hinweis, Aktionsleiste | Kauf-/Lagerinfos; Foto-/Dokumentenvorschau und je nach Breite zwei Spalten; Felder benötigen unterschiedlich viel Platz. |
| Gespeicherte Verkostungen | Metadaten-DetailGrid, drei Notizfelder, Bewertungskommentar und Aktionen | Radar/Glencairn bleiben individuell; Notiztrennlinien wechseln bei ≤850px von vertikal auf horizontal. |
| Analysen | Standardrenderer mit Variante `analytics` für Analytics-Panels; Inline-Empty-State | Bisherige Innenabstände, Analysefarben und Diagrammgeometrie. |

Nicht alle vorhandenen `.panel`- oder `.analytics-panel`-Nutzungen werden in dieser Phase umgebaut: Der gemeinschaftliche CSS-Eigentümer deckt sie bereits ab. Ein vollständiger Austausch in sämtlichen Fachdateien wäre ein zusätzliches Risiko für Datenbindungen und Geometrien und gehört nicht zu einem maßschneiderten, optisch neutralen Refactoring.

## Entfernte Redundanzen / ersetzte Regeln

| Vorher | Nachher | Maßnahme |
|---|---|---|
| `styles/core.css` – `.panel` | `styles/content.css` – `.panel`, `[data-ds-panel="standard"]` | Oberflächen-/Rahmen-/Padding-/Shadow-Regel **verschoben**; Bestandswerte beibehalten. |
| `styles/core.css` – `.empty-state`, `.empty-state strong` | `styles/content.css` – `.empty-state`, `.empty-state strong` | Große Sammlungseinladung als explizite `collection`-Variante zentralisiert; keine generische schwere Empty-State-Optik. |
| `styles/core.css` – `.divider` | `styles/content.css` – `.divider`, `[data-ds-divider]` | Gleiche 24px-Abstände; Trennerfarbe zentral über `--ds-color-border`. |
| `styles/core.css` – `.actions` im gemeinsamen Selektor mit `.top-actions`, `.toolbar` | `styles/content.css` – `.actions` plus DS-Toolbarmarker | Gleiches flex-wrap/10px-Gap, zentrale Verantwortung; `top-actions` und `toolbar` in Fachkontext unverändert. |
| `styles/bottle-details.css` – `.document-list` / `.document-list li` | `styles/content.css` | Gleiche 7px-/8px-Gaps, Dateiliste wiederverwendbar; Vorschaubuttons bleiben fachlich. |
| `styles/bottle-details.css` – `.bottle-entry-facts dt/dd` | `styles/content.css` – `[data-ds-detail-field="definition"]` | 12px/14px-Schriften, 4px-Wertabstand und 650er Gewicht geteilt, drei Spalten des Fachrasters bleiben. |
| `styles/bottle-details.css` – `.tasting-summary-field-label` | `styles/content.css` – `[data-ds-detail-field="preview"]` | Gemeinsame dezente Vorschau-Beschriftung. |
| `styles/bottle-details.css` – `.tasting-readonly-label` und `.tasting-readonly-note` | `styles/content.css` – `[data-ds-detail-field="readonly"/"note"]` | Labeltypografie, Zeilenabstände und Umbruchverhalten zentralisiert; bewusst vertikale/horizontale Trenner bleiben fachlich. |
| `views/detail.js` – Inline-`font-size:12px`, `font-weight:650;margin-top:4px` | `content.css` – `[data-ds-detail-field="fact"]` | Zwei redundante Inline-Styles beseitigt und an vorhandene Tokens gebunden. |
| Fachmarkup für Sammlung/Analysen/Flaschendetails/Verkostungen | `ui/content.js` | Identische Strukturen über Renderer statt wiederholt erzeugter HTML-Strings. |
| Fachliche Randfarben der berührten Detailabschnitte | `--ds-color-border` | Vorhandener Farbwert/Theme-Alias statt neuer Farbe; keine Änderung der Linienstärke. |

Bewusst **nicht** entfernt: `.bottle-entry-facts`-Raster mit Breakpoints, `.tasting-readonly-notes`-Trennlinien, Spezialränder für Galerien, Analytics-/Lager-/Foto-/Radar-Styles. Sie sind kein unbeabsichtigtes Duplikat einer identischen Standardkomponente.

## Anwendungsregeln / offene künftige Arbeit

1. Für neue wiederholte Inhalte die Renderer aus `ui/content.js` verwenden; keine duplizierten Standardpanel-/Detail-/Empty-/Divider-Regeln anlegen.
2. Varianten nach **Bedeutung**, nicht nur nach optischer Ähnlichkeit auswählen. `emptyState({variant:'subtle'})` erzeugt keinen neuen Rahmen innerhalb vorhandener Panels.
3. Bei neuen mehrspaltigen Detailgruppen `columns=2/3` wählen; die größte realistische Textlänge und das Umbruchverhalten mit prüfen. Fachspezifische Breakpoints sind zulässig, wenn die Inhalte sich sonst überschneiden.
4. `valueHtml=true` ausschließlich bei bereits escaped oder vom Anwendungscode erzeugtem Markup einsetzen. Client-IDs und Aktionen müssen die bisherigen `data-act`-Verträge beibehalten.
5. Vor Entfernen einer alten Klassendefinition deren Verwendungen in allen Views und Modal-Templates durchsuchen und Browserregressionen ausführen; kein pauschales CSS-Clean-up ohne isolierten visuellen Vergleich.

**Qualitätssicherung:** siehe [Phase-4-Prüfbericht](DESIGNSYSTEM_PHASE4_PRUEFBERICHT.md). Die vollständige lokale Browsersuite war in dieser Umgebung nicht ausführbar; der reguläre CI-Lauf bleibt ein obligatorischer Abschluss.
