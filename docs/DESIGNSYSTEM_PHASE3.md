# Designsystem – Phase 3: Buttons, Modals und Formulare

**Ausgangsbasis:** `WCM_Phase2_Projekt.zip` (unveränderter Phase-2-Projektstand), weiterhin Version **1.12.0** gemäß `AGENTS.md`. Phase 3 baut auf den Tokens und Headern aus Phase 1/2 auf. API, Collection-Schema, Persistenz, fachliche Berechnungen und Frontend-Framework bleiben unverändert.

## Verantwortlichkeiten und Ladereihenfolge

`public/style.css` lädt: `tokens.css` → `layout.css` → **`controls.css`** → `core.css` → `headers.css` → **`modals.css`** → die vorhandenen Fachstyles → `surfaces.css`.

- `styles/tokens.css`: unveränderte Bestandsmaße, semantische Button-/Feld-/Dialogfarben, explizite Dialogbreiten, Checkbox- und Ladegrößen. Hell/Dunkel bleiben am bestehenden `data-theme`-Attribut.
- `styles/controls.css`: **alle grundlegenden Button-, Formular-, Feld- und Zustandsregeln**, einschließlich der vor den Komponenten geltenden `font: inherit`-Grundlage. Deren Reihenfolge ist wichtig: Die explizite `font-size`-Deklaration für Felder muss danach greifen, sonst werden Eingaben im Flight-Modal größer.
- `styles/core.css`: allgemeine Seiten-/Anwendungsstruktur; keine zweite globale `.btn`, `.form-field` oder `.dialog`-Definition.
- `styles/headers.css`: weiterhin alleiniger Eigentümer der in Phase 2 eingeführten Header-Geometrie.
- `styles/modals.css`: Overlay, Dialograhmen, Scroll-/Touch-Verhalten, Größen, Modal-Header-Sonderabstände, Footer und responsive Regeln. Fachstyles definieren **keine** allgemeinen Dialogbreiten.
- Fachstyles (`bottle-details.css`, `warehouse.css` usw.): nur benannte und lokal beschränkte Speziallayouts; die bisherigen `:has()`-basierten **Breiten-/Padding-Ausnahmen** für Fotoansicht, Fotoeditor und Lagerzuweisung sind durch explizite Modalvarianten ersetzt.

Es werden keine CSS-Layers oder neuen Abhängigkeiten eingeführt. Bestehende `.btn`, `.btn.primary`, `.btn.danger`, `.btn.small`, `.form-field`, `.dialog`, `.dialog.wide` und `.actions` bleiben als Kompatibilitätsklassen gültig.

## Komponentenverträge

| Komponente | Modul / CSS | Schnittstelle und Verhalten |
|---|---|---|
| `ActionButton` | `public/js/ui/buttons.js`, `controls.css` | `actionButton({label,action,variant='secondary',size='default',type='button',icon='',iconOnly=false,disabled=false,loading=false,className='',attributes=''})`. `variant`: `primary`, `secondary`, `destructive`, `text`, `icon`; `size`: `small`, `default`, `large`. Liefert ein `<button>` mit `data-act`-Vertrag; `loading` deaktiviert die Aktion und setzt `aria-busy`. |
| `ModalFrame` | `public/js/ui/modal-layout.js`, `modals.css` | `modalFrame({title,content,wide=false,variant='',headingAction='',closeLabel})`. Kombiniert bestehenden `SectionHeader`, gemeinsamen Schließen-Button, `role=dialog`, `aria-modal`, benannte Titelrelation und Body-Slot. `title` wird escaped; `content` und `headingAction` müssen bereits sicher gerendertes **Anwendungs-HTML** sein. |
| `ModalFooter` | `modal-layout.js`, `modals.css` | `modalFooter(actions,{className=''})` und `destructiveFooter({cancelLabel,acceptLabel,acceptAction,className=''})`. Gemeinsame Flex-Geometrie; bleibt innerhalb eines bestehenden Formulars, sodass `submit` und Formvalidierung unverändert funktionieren. |
| `ModalController` | `public/js/ui/modal.js` | `showModal(title,content,wide=false,nested=true,headingAction='',variant='')`, `renderModal()`, `closeModal(all=false)`, `updateContent(content)`, `confirm(...)`, `choose(...)`. Bestehende Signatur bleibt erhalten; das letzte Argument ist eine optionale Variante. |
| `FormFields` | `public/js/ui/fields.js`, `controls.css` | `textInput(label,name,value?,options?)`, `selectInput(label,name,items,value?,config?)`, `areaInput(label,name,value?,options?)`, neu `checkboxInput(label,name,checked?,options?)`. Einheitliche Labels, Hilfetexte/Fehler, `required`, `disabled`, `aria-invalid`, `aria-describedby`. |

**Sicherheitsgrenze:** `label`, `action`, `title`, Feldnamen/-werte, Beschreibungen und Fehler werden escaped. `icon`, `content`, `headingAction` sowie `actionButton.attributes` sind ausschließlich für **vertrauenswürdiges, vom Programm erzeugtes** Markup gedacht; niemals Rohtext aus Dateien oder Benutzerdaten ungeprüft übergeben. `data-act` bleibt Sache der bestehenden Eventdelegation. Formmodelle, HTTP-Anfragen und Übersetzungs-Keys sind unverändert.

## Standardvarianten und bereits vorhandene Maße

- Button: bisherige Standardhöhe **43px**, klein **34px**, vorhandene Standard- und Klein-Paddings aus Phase 1; primär Gold, sekundär Papier/Navytöne, destruktiv Rotton mit Rahmen. Neu **opt-in groß 48px**; Text-/Icon-Schaltflächen sind **opt-in**. Kein bestehender Button wurde wegen dieser neuen Größenvariante automatisch verändert.
- Zustände: `:hover`, `:focus-visible`, `:disabled`, `[aria-disabled=true]`, `[aria-busy=true]` bzw. `[data-loading=true]` in `controls.css`; Ladeindikator, `pointer-events:none` und `prefers-reduced-motion`. Deaktivierte native `button` werden nicht fokussierbar und nicht ausgelöst.
- Felder: vorhandene **44px** Mindesthöhe, bisheriges Padding, **2px** Radius, `form-field`-Abstand **7px**, Grid-Abstand **14px**; Hilfetext gedämpft, Fehler mit `role=alert` und `aria-invalid`. Nativer Date-/Select-Stil bleibt. Checkbox erhält eine benannte Größe **18px**; eigene Fach-Schieberegler/Radar-/Lagerfeldlayouts bleiben bestehen.
- Modal: Standard maximal **650px**, `wide` **860px**, Fotobetrachter **1100px**, Fotoeditor **1120px**, Lager-Zuweisung **740px**; Breite jeweils `min(token,100%)`. Eine explizite Größenvariante hat Vorrang vor dem älteren `wide`-Flag, damit sich die Klassen nicht gegenseitig übersteuern. Overlaypadding **15px**, Dialogpadding **28px** bzw. mobil **18px**, maximale Höhe `min(94dvh,94vh)` mit internem Scrolling. Gezielte Foto- und Lagerpadings erhalten die ursprünglichen Fachwerte.
- Footer: Standard-Flexabstand **10px**, `margin-top` **22px**; dokumentierte Abstandsmodifikatoren `--form` (23px), `--compact` (18px), `--spaced` (20px) und `--flush` (0). Die Werte stammen aus bestehenden Form-/Dialogvarianten. Für neue Formulare nur benannte Varianten einsetzen, keine unkoordinierten Inline-Margins.

## Modal-Interaktionsvertrag

1. **Nur eine aktive Overlay-Ebene.** Beim Öffnen eines untergeordneten Dialogs wird das **unveränderte DOM-Element** des übergeordneten Dialogs samt Eingabewerten, Fokusreferenz, FileList, Scrollstand und Listenern ausgehängt und auf einem Stack gehalten.
2. Beim Schließen des Unterdialogs wird genau dieses DOM zurückgesetzt, nicht aus `state.modal.content` rekonstruiert; Fokus kehrt zum auslösenden Element zurück. Schließen des letzten Dialogs entsperrt den Hintergrund und stellt die ursprünglich fokussierte Schaltfläche wieder her (`focus({preventScroll:true})`).
3. Die Hintergrundseite wird durch Fixieren des Body am bisherigen `window.scrollY` gesperrt. Ein reservierter klassischer Scrollbar-Track und unveränderte `main`-Breite verhindern horizontales Springen. Schließen stellt Body-/HTML-Styles und den ursprünglichen Scrollstand sofort wieder her. `inert` nimmt die übrigen App-Elemente währenddessen aus Fokus- und Accessibility-Interaktionen.
4. `Tab`/`Shift+Tab` bleiben im Vordergrunddialog, `Escape` schließt **nur die oberste Ebene**; klickt man auf den Backdrop, schließt ebenfalls nur diese Ebene. Der Dialog trägt eine referenzierte Titel-ID und wird initial auf das erste passende Eingabefeld bzw. den ersten Button fokussiert.
5. Native `alert`, `confirm` und `prompt` werden für Anwendungsentscheidungen nicht verwendet. `confirm`/`choose` bleiben Promises am zentralen Modal-Host; Abbruch löst `false`/`cancel` aus, ohne die darunterliegenden Formularwerte zu überschreiben. Undo/Redo-/Fachzustände werden nicht angepasst.
6. Wenn im Hintergrund ein globaler Render läuft, wird ein bereits offenes Modal **nicht** noch einmal neu gebaut. `updateContent` tauscht nur den Body-Inhalt des aktuell sichtbaren Dialogs aus.

## Migration / Ausnahmen

| Bereich | Änderung / bestehende Fachausnahme |
|---|---|
| Gemeinsamer Modalhost und Standard-CRUD | Einheitlicher Rahmen, Größen, Titel/Schließen, DOM-/Fokusverwaltung, Bestätigungs- und Auswahldialoge; bestehende `data-act`-Konvention und Eventverarbeitung bleiben bestehen. |
| Flaschen-/Abfüllungsformulare | Gemeinsame Footer-Abstände; die fachliche Aufteilung und validierten Felder bleiben erhalten. |
| Flight-Planung und Flight-Hilfe | Bestehendes Formular und dessen Renderer bleiben fachlich; Unterdialog wird auf dem DOM-Stack suspensiert und beim Zurückkehren identisch wiederhergestellt. Die Hilfeschaltfläche stammt weiterhin aus Phase 2. |
| Fotoansicht / Fotoeditor | Explizite Modalvarianten `photo`/`editor` statt `:has(.photo-lightbox)` und `:has(.photo-editor)` für Rahmen und Breite; Bildbearbeitung, Zoom und Undo unangetastet. |
| Lagerverwaltung / Zuweisung | Explizite Variante `assignment` statt `:has(.warehouse-assignment-form)`; destruktive Lager-Bestätigungen verwenden `destructiveFooter`. Raum-/Möbel-3D bleibt fachlich. |
| Datei-/Dokumentvorschau | Gemeinsamer Footer für den Download; PDF-iframe, Bild-Blob-URL und gesicherte Klartextvorschau sowie Berechtigungen unverändert. |
| Einstellungen, Backup, Authentifizierung | Gemeinsame benannte Formular-Footer-Varianten statt verstreuter Inline-Margins. |

**Bewusst verblieben:** Der HTML-Inhalt zahlreicher älterer Formulare wird weiterhin unmittelbar in vorhandenen JS-Views aufgebaut, enthält aber die zentralen CSS- und Modalverträge. Fach-Sonderfelder, 3D/2D-Lagertools, Fotobearbeitungscontrols, Verkostungs-Slider und Drag-and-Drop sind ausdrücklich **keine Standardformularfelder**. Eine Umstellung ihrer Markup-Generierung wäre ein eigenes, stärker funktionales Refactoring und wurde in Phase 3 vermieden.

## Qualität und Grenzen

Projektprüfung, Unit-/Integrationstests, gezielte Browsertests und 48 visuelle Vorher/Nachher-Paare bei **390/768/1024/1440px**, **Hell/Dunkel**, mit denselben synthetischen Testdaten siehe [Phase-3-Prüfbericht](DESIGNSYSTEM_PHASE3_PRUEFBERICHT.md). Die anfänglich ermittelte Abweichung von 6px Modalhöhe bei Flight wurde durch Wiederherstellung der originalen CSS-Font-Reihenfolge behoben; geprüfte Eingabe- und Modalgeometrie ist seither identisch. Eine vollständig grüne Browsersuite wurde lokal nicht erreicht, weil der größere Lauf am Umgebungszeitlimit endete; die gezielten Regressionstests sind grün. Kein Ersatz für reguläre CI, reale iOS-/Android-Prüfung oder eine vollständige WebGL-/3D-Abnahme.
