# Designsystem – aktueller Aufbau

Die Anwendung verwendet bestehende Farben und Typografie; das Designsystem vereinheitlicht **gemeinsame** Elemente, ohne Lager-, Radar-, Glas-, Karten- oder Bildeditor-Spezialdarstellungen gleichzusetzen.

## Verantwortlichkeiten

| Bereich | HTML/JS | Styles |
|---|---|---|
| Farben, Abstände, Typografie, Theme | – | `public/styles/tokens.css`, `themes.css` |
| Seitenbreite und Layouthelfer | – | `public/styles/layout.css` |
| Seiten- und Abschnittsüberschriften, Zurück-Navigation, Hilfeicons | `public/js/ui/headers.js` | `public/styles/headers.css` |
| Buttons und Formularfelder | `public/js/ui/buttons.js`, `fields.js` | `public/styles/controls.css` |
| Modals, Fokus, verschachtelte Dialoge | `public/js/ui/modal.js`, `modal-layout.js` | `public/styles/modals.css` |
| Panel/Card, DetailField/Grid, EmptyState, Divider, Toolbar, Dokumentliste | `public/js/ui/content.js` | `public/styles/content.css` |
| Spezialdarstellungen | jeweilige `views/` und `ui/` | `collection.css`, `bottle-details.css`, `analytics.css`, `warehouse.css`, weitere Fachstyles |

`public/style.css` ist der CSS-Einstiegspunkt. Die Reihenfolge ist Teil des bestehenden Kaskadenvertrags und darf nicht ohne Browser-/Screenshotprüfung geändert werden.

## Regeln

- Bestehende `--ds-*`-Tokens für gemeinsame Farben, Flächen, Rahmen, Typografie, Abstände, Radien und Maße nutzen. Die weiterhin vorhandenen `--navy`, `--gold`, `--paper`, `--ink` usw. sind kompatible Bestandsvariablen.
- Hauptseite/Seitengutter werden durch das gemeinsame Layout gesteuert (max. 1350 px; mobile Umbrüche u. a. bei 740 px). CSS Custom Properties sind **nicht** direkt in `@media`-Bedingungen einsetzbar.
- Standardaktionen über `actionButton()` aus `ui/buttons.js` erzeugen; dieser Renderer besitzt Größen, Varianten, Delegation, Icons und die sichere HTML-Attributausgabe. Fachliche Spezialsteuerelemente (z. B. Fotogalerie, 3D-Lager) dürfen ihre eigene DOM-Struktur behalten.
- Oberflächenradien werden über `--ds-surface-radius` gesteuert; die zugehörigen Selektoren gehören in die CSS-Datei der jeweiligen Fachansicht statt in eine global nachgeladene Liste.
- Fach-CSS darf gemeinsame globale `.btn`, `.panel`, `.form-field` und Header-Basiselemente nicht neu definieren. Lokale, begründete Varianten mit eng begrenzten Selektoren sind möglich.
- Titel aus **Benutzerdaten** nicht dekorativ verändern: Abfüllungsnamen verwenden `pageHeader({ title: name, period: false })`. Pfeilsymbole gehören zum Renderer, nicht zum Übersetzungstext.
- Hilfeicons dürfen Zeilenhöhe und Überschriftenabstände nicht verändern. Bei Modals Größenvarianten explizit wählen; eine explizite Variante hat Vorrang vor generischem `wide`.
- Keine unnötigen verschachtelten Panels; fehlende optionale Inhalte als dezente Empty States anzeigen. Originaldaten, Reihenfolge und Datenbindungen beim Rendern beibehalten.
- Dynamische Fachwerte (z. B. 3D-Koordinaten, Radargeometrie, Bildtransformationen) dürfen individuelle Maße/Inline-Styles benutzen.

Konkrete Beispiele und Schnittstellen: [Entwicklungsleitfaden](DESIGNSYSTEM_ENTWICKLUNG.md). Regression: [Visuelle Tests](DESIGNSYSTEM_VISUELLE_TESTS.md).
