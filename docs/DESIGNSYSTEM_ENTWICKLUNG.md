# Designsystem verwenden

## Änderungsstelle finden

| Änderung | Zuständig |
|---|---|
| Überschrift, Zurück-Navigation, Hilfeicon, Abschnittsaktionen | `public/js/ui/headers.js` + `public/styles/headers.css` |
| Standardbuttons, Fokus-, Lade- und Disabled-Zustände | `public/js/ui/buttons.js` + `public/styles/controls.css` |
| Eingaben, Labels, Validierungstext | `public/js/ui/fields.js` + `public/styles/controls.css` |
| Modalinhalt, Größen, Footer, Fokus/Scroll | `public/js/ui/modal-layout.js`, `modal.js`, `public/styles/modals.css` |
| Panel, Detailwerte, Empty State, Trennlinie, Aktionen, Dateien | `public/js/ui/content.js` + `public/styles/content.css` |
| Farben, Größen, allgemeines Seitenlayout | `public/styles/tokens.css`, `layout.css` |
| Lager 2D/3D, Radar, Glencairn, Flight, Karte, Bildeditor | zugehörige Fachmodule und Fachstyles |

## Beispiele

```js
import { pageHeader, backNavigation, sectionHeader } from '../ui/headers.js';
import { panel, detailField } from '../ui/content.js';

const header = pageHeader({ title: t('navigation.analytics') });
// Benutzernamen und Abfüllungsnamen niemals mit automatisch angehängtem Punkt:
const bottlingHeader = pageHeader({ title: bottling.name, period: false });
const details = panel({ content: detailField({ label: t('bottle.age'), value: ageText }) });
```

Nur übersetzte Texte, **keine** Pfeilzeichen, an die Back-Navigation geben. Eine gemeinsame Komponente nicht ausschließlich für eine einzige Fachausnahme ausweiten; Fachgeometrie lokal belassen. Optionen nur ergänzen, wenn ein realer, testbarer Wiederverwendungsfall existiert.

## Vor einem UI-Commit

`npm run check`, `npm test`, `npm run test:browser` und bei Layout `npm run test:visual` prüfen. Referenzbilder nur nach bewusster visueller Freigabe mit `npm run visual:update` aktualisieren. Dokumentationswirkung prüfen: [Entwicklung](ENTWICKLUNG.md).

## Farb- und Theme-Regeln

Standardfarben für Buttons, Texte, Status, Panels, Formulare und Hinweise
werden in `public/styles/tokens.css` zentral definiert. Fachpaletten für
Flaschen/Whisky, Karte und Lager stehen in `palette-bottle.css`,
`palette-map.css` und `palette-warehouse.css`. Die Fachansichten verwenden
ausschließlich diese Variablen; ihre bisherigen Farbwerte bleiben erhalten.

Bei neuen Zuständen einen semantischen Token wählen und seine benötigten
Hell-/Dunkelwerte im jeweiligen Palette-Modul definieren. Niemals eine
Fallback-Hexfarbe in der Fachregel ergänzen. Die statische Prüfung
`node scripts/check-css-colors.js` läuft verbindlich über `npm run check`.
