# Designsystem – aktueller Aufbau

Die Anwendung verwendet bestehende Farben und Typografie; das Designsystem vereinheitlicht **gemeinsame** Elemente, ohne Lager-, Radar-, Glas-, Karten- oder Bildeditor-Spezialdarstellungen gleichzusetzen.

## Verantwortlichkeiten

| Bereich | HTML/JS | Styles |
|---|---|---|
| Farben, Abstände, Typografie, Theme | – | `public/styles/tokens.css`, `themes.css` |
| Fachliche Farbpaletten (Flasche, Karte, Lager) | jeweilige Fachansicht | `public/styles/palette-bottle.css`, `palette-map.css`, `palette-warehouse.css` |
| Seitenbreite und Layouthelfer | – | `public/styles/layout.css` |
| Seiten- und Abschnittsüberschriften, Zurück-Navigation, Hilfeicons | `public/js/ui/headers.js` | `public/styles/headers.css` |
| Buttons und Formularfelder | `public/js/ui/buttons.js`, `fields.js` | `public/styles/controls.css` |
| Modals, Fokus, verschachtelte Dialoge | `public/js/ui/modal.js`, `modal-layout.js` | `public/styles/modals.css` |
| Panel/Card, DetailField/Grid, EmptyState, Divider, Toolbar, Dokumentliste | `public/js/ui/content.js` | `public/styles/content.css` |
| Spezialdarstellungen | jeweilige `views/` und `ui/` | `collection.css`, `bottle-details.css`, `analytics.css`, `warehouse.css`, weitere Fachstyles |

`public/style.css` ist der CSS-Einstiegspunkt. Die Reihenfolge ist Teil des bestehenden Kaskadenvertrags und darf nicht ohne Browser-/Screenshotprüfung geändert werden.

## Regeln

- Gemeinsame UI- und Statusfarben ausschließlich über semantische `--ds-color-*`-Tokens aus `tokens.css` beziehen. Hell- und Dunkelwerte derselben Bedeutung stehen beim selben Token; Standardoberflächen definieren keine eigenen Farbwerte. Die bestehenden `--navy`, `--gold`, `--paper`, `--ink` usw. bleiben kompatible Bestandsvariablen.
- Fachliche Farbwerte (z. B. Kartenmarker, Lagerholz und Whisky-Farbskala) gehören in die nach Domäne getrennten `palette-*.css`-Dateien und werden mit `--ds-map-*`, `--ds-warehouse-*` und `--ds-bottle-*` angesprochen. Nicht jede fachliche Materialfarbe ist ein globaler UI-Token.
- Visuell und semantisch gleichwertige Farben verwenden gemeinsame Palette-Tokens beziehungsweise Aliase. Ein geringer Farbunterschied allein genügt nicht zur Zusammenlegung: Hover-/Auswahlzustände, Kontrastrollen, Gradienten und materialbezogene Farben behalten bei Bedarf getrennte Werte. Aliase müssen in beiden Themes korrekt aufgelöst werden; `tests/unit/designsystem-palette-aliases.test.js` sichert diese Verträge ab.
- `npm run check` führt `scripts/check-css-colors.js` aus: harte Hex-, RGB-/HSL- und benannte Farbwerte außerhalb `tokens.css` und der drei Fachpaletten sind untersagt. Auch Fallbackfarben wie `var(--danger, #bb4848)` sind unzulässig. `transparent`, `currentColor` und dynamische `color-mix()`-Berechnungen mit Tokens bleiben erlaubt.
- Hauptseite/Seitengutter werden durch das gemeinsame Layout gesteuert (max. 1350 px; mobile Umbrüche u. a. bei 740 px). CSS Custom Properties sind **nicht** direkt in `@media`-Bedingungen einsetzbar.
- Standardaktionen über `actionButton()` aus `ui/buttons.js` erzeugen; dieser Renderer besitzt Größen, Varianten, Delegation, Icons und die sichere HTML-Attributausgabe. Fachliche Spezialsteuerelemente (z. B. Fotogalerie, 3D-Lager) dürfen ihre eigene DOM-Struktur behalten.
- `splitActionButton()` kombiniert eine unveränderte Hauptaktion mit einem separat aufklappbaren Bereich für sekundäre Aktionen. Nur die Auswahl im Menü löst die sekundäre Aktion aus; Escape, Fokuswechsel oder ein Klick außerhalb schließen das Menü. Die Abfüllungsdetailseite nutzt dies für die direkte Änderung des Bearbeitungsstatus.
- Oberflächenradien werden über `--ds-surface-radius` gesteuert; die zugehörigen Selektoren gehören in die CSS-Datei der jeweiligen Fachansicht statt in eine global nachgeladene Liste.
- Fach-CSS darf gemeinsame globale `.btn`, `.panel`, `.form-field` und Header-Basiselemente nicht neu definieren. Lokale, begründete Varianten mit eng begrenzten Selektoren sind möglich.
- Titel aus **Benutzerdaten** nicht dekorativ verändern: Abfüllungsnamen verwenden `pageHeader({ title: name, period: false })`. Pfeilsymbole gehören zum Renderer, nicht zum Übersetzungstext.
- Hilfeicons dürfen Zeilenhöhe und Überschriftenabstände nicht verändern. Bei Modals Größenvarianten explizit wählen; eine explizite Variante hat Vorrang vor generischem `wide`.
- Keine unnötigen verschachtelten Panels; fehlende optionale Inhalte als dezente Empty States anzeigen. Originaldaten, Reihenfolge und Datenbindungen beim Rendern beibehalten.
- Dynamische Fachwerte (z. B. 3D-Koordinaten, Radargeometrie, Bildtransformationen) dürfen individuelle Maße/Inline-Styles benutzen.

Konkrete Beispiele und Schnittstellen: [Entwicklungsleitfaden](DESIGNSYSTEM_ENTWICKLUNG.md). Regression: [Visuelle Tests](DESIGNSYSTEM_VISUELLE_TESTS.md).
