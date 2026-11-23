# Zentrales Designsystem – Phase 2: Überschriften und Navigation

**Ausgangsbasis:** Das ausschließlich für Phase 2 verwendete Phase-1-Projekt-ZIP `WCM_Phase1_Projekt.zip`; Version `1.12.0` (keine Release-Anhebung für Einzeländerungen auf `develop` gemäß `AGENTS.md`). **Umfang:** ausschließlich HTML-Renderer, CSS-Kaskade und UI-Übersetzungslabels sowie Regressionstests; keine Änderungen an API, Datenmodell, Speicherung oder Geschäftslogik.

## Verantwortung und Einbindung

`public/style.css` lädt **Tokens → Layout → Core → Headers → Fachstyles → Surfaces**. `public/styles/headers.css` ist alleiniger Eigentümer gemeinsamer Header-, Zurück- und Hilfeicon-Geometrie. Fachstyles dürfen nur klar begründete, lokal begrenzte Varianten definieren (beispielsweise die mobilen Aktionsspalten in den Abfüllungsdetails). Sie dürfen keine allgemeinen Selektoren wie `.section-head`, `.ds-back-button` oder `.ds-help-icon-button` neu definieren.

| Komponente / Modul | DOM-Vertrag und Zuständigkeit | Schnittstelle |
|---|---|---|
| `PageHeader` – `public/js/ui/page-header.js` | Ein `<header class="section-head ds-page-header ...">`, eine `h2`, optionale Eyebrow/Intro/Metainformation und Aktions-Slot. Nutzt die bestehenden Seitentitelmaße. | `pageHeader({title, eyebrow?, intro?, className?, preTitle?, actions?, copyClass?, period?})` |
| `SectionHeader` – `public/js/ui/section-header.js` | Gemeinsame Abschnittsstruktur mit `h3` oder `h2`; Varianten `section-head`, `tasting-panel-heading`, `dialog-head`. Liefert `ds-section-header`, unterstützt optionale Beschreibung und Aktionsbereich. | `sectionHeader({title, level?, layout?, className?, titleClass?, titleId?, description?, descriptionClass?, copyClass?, actions?, actionsClass?, actionsBare?, trailingAction?})` |
| `headingTitle` – gleiches Modul | Einheitliche, HTML-escapte `h2`/`h3` für Überschriften **ohne** äußeren Aktionscontainer; `ds-heading-with-action` nur mit integrierter Aktion. | `headingTitle({title, level?, className?, id?, period?, trailingAction?})` |
| `BackNavigation` – `public/js/ui/back-navigation.js` | Eine `nav`, ein semantischer `button`, **genau ein** SVG-Pfeil aus `action-icons.js`, ausschließlich Text in `span`. Behält bestehende Inline- und Buttonvarianten bei. | `backNavigation(action, label, region = '', variant = 'inline')` mit `variant='inline'` oder `'page-action'` |
| `HeaderActions` – `public/js/ui/header-actions.js` | Wrapper `.actions.ds-header-actions` um bereits von der Ansicht bereitgestellte Buttons; kein eigenes Dispatching. | `headerActions(content, {className?})` |
| `HelpIconButton` – `public/js/ui/help-icon-button.js` | Genau ein SVG-Hilfeicon und ein Button mit `aria-label`, `title`, `data-act`; states `hover`, `focus-visible`, `disabled` über `headers.css`. | `helpIconButton({label, action?, disabled?})` |

**Daten-/HTML-Grenze:** `title`, `label`, `eyebrow`, `intro`, Klassenbezeichnungen und IDs werden HTML-escaped. Slots `preTitle`, `actions` und `trailingAction` sind **ausschließlich vertrauenswürdiges, zuvor gerendertes Anwendung-HTML**; niemals Rohwerte aus Benutzer- oder Sammlungsdaten unescaped übergeben. Vorhandene `data-act`-Verträge bleiben verantwortlich in den Views, nicht in den Designkomponenten.

## Verbindliche Geometrie aus dem Bestand

- Standard-PageHeader: `margin-top:20px`, `margin-bottom:12px`, Flex-Gap `14px`; Titel `clamp(26px,3vw,36px)`, Georgia, Line-height `1.25`, mobil bis `740px` **27px**. Diese Werte sind bereits in Phase 1 als Tokens erfasst.
- Inline-BackNavigation: `padding-top:8px`, `margin-bottom:18px`, SVG `18×18px`, Text/Icon-Abstand `6px`, Baseline vertikal zentriert. Seitenbreite und Abstand zum globalen Header bleiben erhalten.
- Page-Action-BackNavigation: vorhandener sekundärer `.btn` mit einem SVG `18×18px`; auf schmalen Viewports wird die etablierte kompakte Aktionsbreite (`99px`) beibehalten, damit sich Überschriften nicht ungewollt umbrechen.
- HelpIconButton: `20×20px` Klickfläche, `15×15px` Symbol, `position:absolute; top:50%`; das `h2`/`h3` erhält nur `padding-right:26px`, die Aktion verändert **weder Zeilenhöhe noch äußere Margins oder Baseline**.
- Modal-Überschrift: `dialog-head`, bestehende 22px unterer Abstand, 17px Innenabstand, 1px Trennlinie; `h2` 24px bzw. 21px mobil.
- Panel-Überschrift: `tasting-panel-heading` behält den bisherigen 20px unteren Abstand und 10px Gap. Fachlayouts bestimmen weiter, ob Aktionen als gemeinsamer Wrapper oder direkter Button gerendert werden.

**Priorität bei Varianten:** Der zentrale Selektor `.section-head` liefert die Defaultwerte. Die fachliche Variante `.detail-page-head.ds-page-header` behält die existierenden vertikalen Ausrichtungen und mobilen **12px** Abstand, damit die später geladene zentrale Basis die Besonderheit nicht überschreibt. Das ist eine gezielte, dokumentierte Ausnahme, keine allgemeine Spezifitätserhöhung.

## Migration der Ansichten

| Bereich | Migration / erhaltene Besonderheit |
|---|---|
| Sammlung (`home.js`) | PageHeader mit Archiv-Eyebrow, Titelschmuck und Modus-Umschalter; Hero bleibt eigenständig. |
| Abfüllungsdetails (`detail.js`) | Inline BackNavigation, PageHeader mit Abfüllungsstatus und Bearbeitungsaktionen, SectionHeader für Verkostungsnotizen und physische Flaschen, zentrale schlichte Feld-/Abschnitttitel. |
| Verkostungen (`tastings.js`) | Einheitliche PageHeader aller Unterseiten, Inline-Rücksprünge, SectionHeader für Journal, Flight-Listen, Bewertungs- und Geschmacksabschnitte; Flight-Hilfe als HelpIconButton. Einige fachliche Kompositüberschriften mit Datum/Metadaten bleiben bewusst als interne Spezialblöcke bestehen. |
| Flight-Hilfe (`flight-planning-help.js`) | Abschnittsüberschriften über `headingTitle`, Formeln und Strategieabschnitte unverändert. |
| Dialoge (`modal.js`) | Der Modal-Host verwendet SectionHeader (`dialog-head`) mit HelpIconButton und Schließen-Aktion; der vorhandene verschachtelte Modal-Stack und Formular-DOM bleiben erhalten. |
| Lager (`warehouse.js`) | PageHeader und zentrale h2/h3-Unterabschnitte sowie Aktionszeilen; Raumplan, Regaldarstellung und 3D-Geometrie bleiben fachlich. |
| Analysen (`analytics.js`) | PageHeader, Statistik- und Abschnittsüberschriften über `headingTitle`; Visualisierung/Tabellen bleiben fachlich. |
| Einstellungen (`settings.js`) | PageHeader, gemeinsame Page-Action-Zurücknavigation; Bereichs- und Feldtitel über zentrale Überschriften. |
| Hilfe (`help.js`) | PageHeader, zentrale Hilfebereichsüberschriften, gemeinsamer Zurück-Button. |
| Karte (`map.js`) | PageHeader und gemeinsamer Zurück-Button. |
| Datensicherung (`backups.js`) | Überschriften über `headingTitle`; der `backup-head`-Sondercontainer bleibt wegen des Dashboard-Layouts erhalten. |

## Lokalisierung und Verhalten

`common.navigation.backToCollection` enthält in **deutsch und englisch ausschließlich Wörter**, keine Unicode-Pfeilzeichen. Der Renderer erzeugt den Pfeil stets selbst; bei historischen Labels werden führende Pfeilzeichen defensiv entfernt. Die lokalisierte Beschriftung bleibt im sichtbaren `<span>` und in der `nav`-Bezeichnung erhalten. Der Button besitzt keinen zusätzlichen textlichen Pfeil. Fokus und Disabled verwenden die bestehenden semantischen Farb-/Focus-Tokens. Die Buttons ändern keine Navigationsevents, Dialogaktionen oder `data-act`-IDs.

## Nachprüfungen und Grenzen

- `npm run check`, `npm test`, neue Unit-Komponentenprüfungen, neue Chromium-Browsertests mit echten Bounding-Boxes für 390/768/1024/1440px und Hell/Dunkel, plus deutscher/englischer Rückbeschriftung.
- Visueller Vergleich gegen die **Phase-1-Basis** und gegen die verfügbaren **Phase-0-Referenzen** mit synthetischen Testdaten (40 von 44 neuen Aufnahmen haben passende Phase-0-Gegenstücke; für Hilfe fehlen vier). Unterschiedliche SVG-Pfeil-Renderingpixel sind **beabsichtigt**. Erste mobile Abfüllungsabweichung durch Ladereihenfolge (`gap:14` statt fachlicher `gap:12`) wurde behoben; letzte Abfüllungsaufnahmen wieder pixelidentisch.
- Reale iOS-/Android-Geräte, WebGL-Lagerraummodell und alle Bestandsmodals außerhalb des getesteten Flight-Dialogs bleiben **nicht abschließend visuell abgenommen**. Die fachliche `tasting-panel-heading`-Kombination mit Metadaten bleibt bewusst eine Variante, keine neue allgemeine Header-Regel.

Siehe [Phase-2-Prüfbericht](DESIGNSYSTEM_PHASE2_PRUEFBERICHT.md) und [Phase-1-Grundlage](DESIGNSYSTEM.md).
