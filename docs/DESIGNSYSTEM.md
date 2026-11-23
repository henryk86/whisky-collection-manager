# Zentrales Designsystem – Phase 1

**Quellstand:** WhiskyCollectionManager `1.12.0`, Ausgangs-ZIP `whisky-collection-manager-develop(2).zip` (SHA-256 `10f70703020bba0896c6f98ae4b140282f8e5ec7e28d94f90faae72f44f067a5`). **Status:** Phase 1 implementiert; Phase 2 (gemeinsame Überschriften und Navigation) ist ebenfalls implementiert, siehe [Phase-2-Architektur](DESIGNSYSTEM_PHASE2.md). Keine Änderung an API, Schema, Geschäftslogik oder JS-Renderer.

## Verbindliche Lade- und Verantwortungsreihenfolge

`public/style.css` ist der einzige Einstiegspunkt für Styles:

1. `styles/tokens.css` – bestehende Theme-Farbwerte, semantische `--ds-*`-Aliasse, Typografie-, Größen-, Abstands- und Geometrietokens; Light- und Dark-Definitionen.
2. `styles/layout.css` – niedrig spezifische gemeinsame Seitenbreite (`main`, `.header-inner`, `.ds-page-container`) und opt-in Layouthelfer.
3. `styles/core.css` – bestehende UI-Grundelemente und weiterhin enthaltene, historisch gewachsene Fachregeln.
4. `styles/headers.css` – gemeinsame Page-/SectionHeader, BackNavigation, HeaderActions und HelpIconButton (Phase 2).
5. Unveränderte Fachreihenfolge: `collection.css`, `themes.css`, `scanner.css`, `bottle-details.css`, `pagination.css`, `settings.css`, `map.css`, `analytics.css`, `warehouse.css`.
6. `styles/surfaces.css` – bisheriger letzter Form-Override; bleibt als **Legacy-Sicherungsregel** bis zur Komponenten-Migration aktiv.

**Nicht umsortieren:** `themes.css` enthält weiterhin konkrete Dark-Komponentenregeln, `analytics.css` enthält den fachübergreifenden `section-workspace`. Da das Quell-CSS historisch über die Reihenfolge wirkt, wurde in Phase 1 bewusst **kein** `@layer` eingeführt. Neue Fach-CSS-Dateien dürfen Design-Tokens konsumieren, nicht global redefinieren. Ausnahmen werden auf der Komponentenebene dokumentiert.

## Design-Tokens und beobachtete Werte

Tokenwerte sind aus dem Ist-CSS übernommen, nicht neu gestaltet. In `tokens.css` liegen die zehn bisherigen Light-/Dark-Werte `--navy`, `--navy-deep`, `--blue`, `--gold`, `--gold-light`, `--cream`, `--paper`, `--ink`, `--muted`, `--line` und die beiden Schriftfamilien `--serif` / `--sans`. Diese bisherigen Variablennamen bleiben für bestehende Fachstyles **kompatibel**.

| Semantischer Token | Bedeutung | Abbildung auf Bestandswerte |
|---|---|---|
| `--ds-color-page`, `--ds-color-surface` | Seiten- und Panelflächen | `--cream`, `--paper` |
| `--ds-color-text`, `--ds-color-text-subtle` | primärer / zurückgenommener Text | `--ink`, `--muted` |
| `--ds-color-border` | Trennlinien / Rahmen | `--line` |
| `--ds-color-accent`, `--ds-color-accent-soft` | Goldakzent / heller Akzent | `--gold`, `--gold-light` |
| `--ds-color-interactive` | interaktive Textfarbe | `--navy` (ist in Dark hell) |
| `--ds-color-link`, `--ds-color-link-hover` | reguläre Links | Hell `#285a83`; Dunkel `#dcb981` / Hover `#f3d8aa` |
| `--ds-color-header-*` | Headerfläche, -text, -rahmen und Buttons | Hell `#092039`, Weiß, `#ffffff22`; Dunkel `#091724`, Weiß, `#334251` |
| `--ds-color-button-*` | Standard/Primary/Hover/Danger-Buttons | bisherige `.btn`-Werte aus `core.css` und `themes.css` |
| `--ds-color-control-*` | Input-Oberfläche, Border, Text, Fokus | Hell `#fffefa`, `#d8d8d2`, `--ink`, `#c7ab7b`; Dunkel `#111e2b`, `#485867`, `#e6edf4` |
| `--ds-font-ui`, `--ds-font-display` | UI- und dekorative Überschriftenschrift | `--sans`, `--serif` |

**Typografie:** `--ds-type-ui-xs=11px`, `sm=12px`, `md=13px`, `body=14px`, `panel-heading=18px`, `page-heading=clamp(26px,3vw,36px)`, `page-heading-mobile=27px`. Diese Rollen sind ein vorhandenes Maßinventar, **kein** globales Zurücksetzen aller Überschriften.

**Abstände:** `--ds-space-1 … 11 = 4 / 8 / 10 / 12 / 14 / 16 / 20 / 22 / 23 / 26 / 30px`. Die unregelmäßigen Schritte sind absichtlich beibehalten. `--ds-layout-stack-gap=26px` und `--ds-layout-section-gap=20px` sind nutzbare Defaults für neue Layouthelfer; sie ändern keine existierende Ansicht.

**Rahmen und Maße:** `--ds-surface-radius=0px`, `--ds-control-radius=2px`, Legacy-Aliasse `--surface-corner`, `--field-corner`; Buttonhöhe 43px, kleiner Button 34px, Feld 44px, Standard-Panelpadding 23px, Analyse-Panelpadding 22px, Dialog-Maxima 650/860px. Für die entsprechenden Innenabstände gibt es `--ds-field-padding-*`, `--ds-button-padding-*` und `--ds-button-small-padding-*`.

**Layout:** `--ds-layout-max=1350px` ist das gemeinsame Maximum von `main`, Header-Innenbereich und `.ds-page-container`. Footer **absichtlich separat** `--ds-layout-footer-max=1290px`. `--ds-page-gutter=30px`, ab `max-width:740px` 14px; `--ds-page-padding-bottom=20px`, mobil 17px. Spezialabstände des Headers bleiben wegen seiner existierenden Responsivität vorerst in den Legacy-Overrides.

### Breakpoints sind keine CSS-Variablen

CSS Custom Properties sind **nicht in `@media`-Bedingungen einsetzbar**. Deshalb wurden keine irreführenden `--ds-breakpoint-*`-Tokens angelegt. Stattdessen sind die relevanten *tatsächlich existierenden* Schwellen inventarisiert: Sammlung 1020 / 740 / 380px, Header 1020 / 960 / 740 / 450 / 380px, `section-workspace` 980px sowie weitere fachbezogene Schwellen in Fotoeditor, Lager und Karte. Vor Änderungen an Breakpoints müssen die betroffenen Ansichten separat freigegeben werden. Neue Ansichten verwenden für den **äußeren Seitenrahmen** zunächst die etablierte 740px-Schwelle; fachliche Gridumbrüche bleiben Komponentenentscheidungen.

## Verfügbare Layout-Primitiven

| Klasse / bestehender Selektor | Vertragsumfang |
|---|---|
| `main`, `.header-inner` | gemeinsame Seitenbreite von 1350px in `layout.css`, bereits aktiv |
| `.ds-page-container` | opt-in Wrapper mit derselben Maximalbreite und mobil angepasstem horizontalem Gutter |
| `.ds-page-stack` | opt-in vertikaler Grid-Stack mit 26px Abstand |
| `.ds-section-stack` | opt-in Grid-Stack für Inhaltsabschnitte mit 20px Abstand |
| `.ds-inline-actions` | opt-in flexible Aktionszeile mit 10px Gap |

Primitiven setzen **keine Fachnavigation und keine Business-Logik** voraus. Zurzeit gibt es bewusst noch keine Migration bestehender JS-Templates zu diesen Klassen.

## Zulässige fachspezifische Abweichungen

Eine Fachkomponente darf **lokal** abweichen, wenn die Abweichung an eine fachliche Rolle gebunden ist (z. B. Fotoeditor, Drag-Shelf, 3D-Viewport, Whiskyglas, Radar, Charts, komplexe Filterraster, mobil gestapelte Modals), die Werte mit dem vorhandenen Viewportverhalten übereinstimmen und ein lokaler Selektor bzw. ein Komponenten-Token die Ausnahme beschreibt. **Nicht zulässig** sind neue globale Definitionen von `.btn`, `main`, `.panel`, `input` oder `:root --ds-*` in Fachstyles, rein kosmetische Abweichungen ohne Vergleich zur Sammlung/Abfüllungsdetails und das pauschale Aufheben der Kaskade durch `!important`.

Bewusst **noch nicht** bereinigt: fachspezifische Dark-Overrides, `surfaces.css` mit langer Legacy-Selektorliste, überschreibende Scanner-/Foto-/Glas-Regeln, zusätzliche Radiuswerte bei Status-, Karten- und 3D-Elementen, Abstände in `section-workspace`. Das sind Phase-2/3-Migrationspunkte, keine Einladung, die zuletzt wirksamen Werte als universellen Standard zu übernehmen.

## Phasenabnahme

Phase 1 muss das Erscheinungsbild der Sammlung und der Abfüllungsdetails, die CSS-Ladereihenfolge sowie das vor CSS-Laden gesetzte `data-theme` unverändert erhalten. Es wurden keine HTML-/JS-Produktivdateien verändert. Browser-Vergleiche sind für 390/768/1024/1440px jeweils hell/dunkel durchzuführen; mobile Grenzfälle, verschachtelte Modals, WebGL, Scanner und echte Geräte bleiben für spätere Phasen als zusätzliche Freigabepunkte relevant. Neue CSS-Tokens müssen in den beiden Themes die zuvor tatsächlich berechneten Werte ergeben. Bei einer unbeabsichtigten visuellen Abweichung ist die entsprechende Änderung zurückzunehmen.

**Release-Regel:** Nach `AGENTS.md` erhalten Einzeländerungen auf `develop` *keine* Versionsänderung. Die Version in `package.json` bleibt daher `1.12.0`. Ein späterer Release wird ausschließlich durch den festgelegten Merge-/Tag-Workflow versioniert.

Die konkreten Prüfresultate und die getrennt dokumentierten Ausgangsstand-Fehlschläge stehen im [Phase-1-Prüfbericht](DESIGNSYSTEM_PHASE1_PRUEFBERICHT.md).
