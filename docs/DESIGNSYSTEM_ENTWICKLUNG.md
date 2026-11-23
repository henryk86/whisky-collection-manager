# Designsystem: Wo ändere ich was?

**Aktueller Einstieg (Develop, 1.12.0).** Diese Anleitung ersetzt die während der Migration entstandenen, teils über mehrere Dateien verteilten Einstiegspunkte. Die Berichte zu Phase 1–5 bleiben als Änderungshistorie erhalten.

## Erst die Verantwortlichkeit bestimmen

| Änderung | Zuständige Stelle | Nicht ändern |
|---|---|---|
| Seitenüberschrift, Zurück-Link, Hilfeicon, Abschnittstitel | `public/js/ui/headers.js` (HTML), `public/styles/headers.css` (Geometrie) | Nicht pro Fachansicht SVG, `h2`-Abstände oder Hilfeicon-Styling duplizieren |
| Standard-Button, Lade-/Fokus-/Disabled-Zustand | `public/js/ui/buttons.js`, `public/styles/controls.css` | Keine globale `.btn`-Definition im Fachstyle |
| Modalbreite, Header, Schließen- und Footer-Aktion | `public/js/ui/modal-layout.js`, `public/js/ui/modal.js`, `public/styles/modals.css` | Keine zweite Modal-Verwaltung, kein `window.confirm()` |
| Formularfeld und Fehlertext | `public/js/ui/fields.js`, `public/styles/controls.css` | Keine eigenständige globale `.form-field`-Basis |
| Panel, Detailfeld/-grid, Empty State, Divider, Toolbar, Dokumentliste | `public/js/ui/content.js`, `public/styles/content.css` | Kein zusätzlicher Panel-Rahmen um bestehende Panels |
| Farbe, Abstand, Schrift, Radius | `public/styles/tokens.css`, `themes.css`, `layout.css` | Keine neuen freien Werte ohne belegte Fachanforderung |
| Lager 2D/3D, Glencairn, Radar, Flight, Karte, Bildeditor | Jeweilige Fachmodule und Fachstyles | Nicht in ein allgemeines Raster oder generische Komponenten pressen |

`public/style.css` legt die Ladereihenfolge fest. Dort nichts umsortieren, ohne zuvor die Browser- und Screenshottests zu vergleichen.

## Die häufigsten Änderungen

**Seitenkopf und Rücksprung:**

```js
import { pageHeader, backNavigation } from '../ui/headers.js';

const html = `${backNavigation('goto-home', t('common.navigation.backToCollection'))}
  ${pageHeader({ title: t('navigation.analytics'), eyebrow: t('analytics.summary.eyebrow') })}`;
```

Nur Übersetzungstext übergeben, **keinen Pfeil**. Für Hilfeicons `helpIconButton({label, action})` und `sectionHeader({title, trailingAction})` nutzen; die Überschrift behält ihre Zeilenhöhe.

**Abfüllungs- und Flaschendetails:**

```js
import { detailField, detailGrid, emptyState } from '../ui/content.js';

const facts = detailGrid(
  detailField({ label: t('forms.bottle.type'), value: category }),
  { columns: 2, className: 'forms' }
);
const noData = emptyState({ description: t('detail.empty.noAttachments') });
```

`detailField` escaped standardmäßig Werte. `valueHtml: true` ausschließlich für bereits escaped/rendered HTML aus der Anwendung. `panel({content, variant, tag, className})` rendert die vorhandenen Oberflächen. Die zugelassenen Tags `div`, `section` und `article` bleiben nötig: Analysen nutzen semantische `section`-Elemente. Panels erzeugen **keine** automatische Überschrift; diese gehört in `content` bzw. `sectionHeader`.

**Standardaktion und Modals:**

```js
import { actionButton } from '../ui/buttons.js';
import { modalFooter } from '../ui/modal-layout.js';

const save = actionButton({ label: t('common.actions.save'), type: 'submit', variant: 'primary' });
const footer = modalFooter(save);
```

Die zentrale Modal-Verwaltung aus `ui/modal.js` besitzt Fokus, Escape, Stack, Scrollposition und Rückkehr zum vorherigen Formular. Für modale Bestätigungen die vorhandenen Anwendungsdialoge verwenden, niemals Browser-`confirm`/`alert`/`prompt`. In produktiven Spezialvorlagen dürfen weiterhin direkte Buttons mit der gemeinsamen `.btn`-Basis stehen, wenn ein generischer Renderer nur neue Sonderparameter erzeugen würde. Klickaktionen bleiben per `data-act` delegiert; Formulare werden weiterhin mit einem echten `type: 'submit'` im Formular abgesendet.

## So klein wie möglich abstrahieren

- Neue gemeinsame Komponente nur für wiederholte Struktur oder wichtige globale Interaktion. **Nicht** pro Helferfunktion eine neue Datei anlegen.
- Echte Fachvarianten über vorhandene `variant`/`layout`-Werte; keine pro Seite erfundene Kombination globaler Klassen.
- `pageHeader` hat feste Titelinterpunktion. `sectionHeader`-Optionen (`actionsBare`, `copyClass`, `actionsClass`) bleiben erhalten, weil sie in bestehenden Ansichten unterschiedliche DOM-Geometrie abbilden.
- Die reinen Test-/Demo-Optionen `panel.title`, `detailField.extra`, `actionToolbar.tag` sowie individuelle Klassen für Dokumentlistenelemente wurden entfernt. Titel bei Panels als explizites HTML rendern, statt den Panel-Renderer damit zu vergrößern.
- Bestehende Klassen wie `.panel`, `.btn`, `.actions` sind **aktive** Kompatibilitätsanker für direkt generiertes HTML, nicht tote CSS-Reste. Erst entfernen, wenn alle tatsächlichen Verwendungen und die visuelle Regression geprüft sind.
- HTML-Slots (`content`, `actions`, `trailingAction`) sind nur für bereits sicheres, anwendungsintern generiertes Markup. Benutzer- und Sammlungsdaten müssen escaped werden.

## Vor einem Commit

```sh
npm run check
npm test
npm run test:browser
npm run test:visual
```

Prüfe bei UI-Änderungen Deutsch/Englisch, 390/768/1024/1440 px, Hell/Dunkel, Modal-Fokus und Scrollposition. `npm run visual:update` nur mit ausdrücklich genehmigten Änderungen an den Referenzen; CI darf Baselines nicht automatisch aktualisieren.
