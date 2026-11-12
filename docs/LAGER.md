# Lagerverwaltung: Räume, Möbel und Fächer

Der Bereich **Lager** im rechten Hauptmenü bildet die physische Lagerung der Whisky-Sammlung ab. Er ist ausdrücklich **getrennt von der eigentlichen Sammlung**: Die strukturierten Lagerdaten stehen in `data/warehouse.json` unter dem konfigurierten Datenverzeichnis (`WHISKY_DATA_DIR`); die Abfüllungen und Flaschen bleiben ausschließlich in `data/collection.json`. Das bestehende Sammlungsschema bleibt unverändert.

Die Seite verwendet denselben Kopfbereich und dieselbe responsive Unternavigation wie der Analysebereich. Die aktive Lager-Unterseite wird auch auf schmalen Displays innerhalb der Tab-Leiste sichtbar gehalten.

**Raumvorschau in der Übersicht:** Jede Raumkachel zeigt **neben dem Raumtext** eine kleine statische 3D-Darstellung der zugehörigen Möbel im Raum. Sie entsteht aus demselben Three.js-Geometriemodell wie der interaktive 3D-Raumplan (fester Kamerawinkel Nordwest) und ist kein zweiter Editor. Sichtbare Kacheln werden bei Bedarf mit einem gemeinsam genutzten, anschließend freigegebenen WebGL-Renderer als Vorschaubild erzeugt und für unveränderte Raumdaten und unverändertes Theme zwischengespeichert. Auch leere Räume erhalten ein Bild ihrer leeren Bodenfläche. Ohne verfügbares WebGL bleibt die Raumkachel bedienbar und zeigt einen Hinweis statt des Bildes. Light- und Darkmode werden berücksichtigt.

## Hierarchie und Bedienung

1. Unter **Lager → Übersicht** einen Raum anlegen (Name, Breite und Tiefe in Metern).
2. Unter **Raumpläne** Lagermöbel platzieren. Unterstützt werden Regale, **Hängeregale**, Vitrinen, Schränke, Kommoden/Schubladen, Kisten und sonstige Lagermöbel. Position X/Y, Breite, Tiefe, Drehung sowie **Unterkante über Boden** und **Möbelhöhe** (jeweils Meter) sind einstellbar. Möbel lassen sich im 2D-Raumplan ziehen; die Änderung wird serverseitig gespeichert. Möbel dürfen nicht außerhalb der Raumgrenzen liegen oder andere Möbel im selben Höhenbereich schneiden. Das gilt für Neuanlage, Bearbeitung, Mehrfachbearbeitung und direktes Verschieben. Berühren von Kanten ist zulässig. Im 2D-Raumplan gibt es eine 10-cm-Rasterunterteilung mit deutlich sichtbaren 50-cm- und 1-m-Linien; die Positionsgenauigkeit bleibt 1 cm (kein automatisches Einrasten). Die Auswahl „Planebene“ trennt in 2D Bodenmöbel und erhöht platzierte Möbel, damit übereinanderliegende Möbel einzeln erreichbar sind. Die Raumpläne öffnen sich standardmäßig als interaktive 3D-Ansicht; die 2D-Ansicht mit Verschiebefunktion kann jederzeit ausgewählt werden.
3. Unter **Regale & Fächer** ein Möbel wählen und beliebige Fächer anlegen. **Gemischte Möbel:** Jedes Fach besitzt unabhängig vom Möbeltyp eine Frontart: Standard des Möbeltyps, **offen**, **Holztür**, **Glastür** oder **Schublade**. So lassen sich unten kleine Holztüren, darüber offene Regalböden und oben Glastüren in **einem Möbel** kombinieren. Die Fächer werden von **unten nach oben** gespeichert, aber von **oben nach unten** in der Oberfläche angezeigt; die Pfeile ↑/↓ ändern ihre reale Reihenfolge. Für jedes Fach lässt sich eine optionale Höhe in **Zentimetern** festlegen (5–500 cm). Ohne Höhenangabe verteilt sich die nach festen Fachhöhen verbleibende Möbelhöhe gleichmäßig auf die automatischen Fächer. Die Summe festgelegter Fachhöhen darf die Möbelhöhe nicht überschreiten. Sind alle Fachhöhen festgelegt, darf oben ein freier Rest verbleiben; er wird angezeigt und kein Fach künstlich vergrößert. Optional kann pro Fach eine maximale Flaschenzahl angegeben werden (leer = unbegrenzt, 0 = keine Flaschen erlaubt). Eine visuelle Regal-Vorderansicht zeigt die zugeordneten Flaschen mit ihren vorhandenen Fotos, falls vorhanden, sonst als Flaschensymbole. Bilder stammen aus den bereits lokal gespeicherten Fotos der jeweiligen physischen Flasche; es werden keine zusätzlichen Bilder kopiert.
4. In der Regalansicht kann ein einzelnes Fach mit **Kopieren** in dasselbe oder ein anderes Möbel kopiert werden (Name, Kapazität, Fachhöhe und Fronttyp ohne Flaschenzuordnung). Über **Kopieren** am Möbel lässt sich ein Regal oder eine Vitrine wahlweise **mit sämtlichen Fächern** oder **ohne Fächer** im gleichen oder einem anderen Raum duplizieren. Das System sucht einen freien Standort im Raumplan; falls kein Platz vorhanden ist, wird nichts geändert und eine Fehlermeldung angezeigt. Kopien erhalten eigene IDs und übernehmen **niemals** Flaschenzuordnungen.
5. Unter **Flaschen finden** nach Abfüllung, Inventarnummer oder Lagerort suchen, auf „Nur ohne Lagerort“ eingrenzen und eine physische Flasche einem Fach zuordnen. Auf der Abfüllungsdetailseite zeigt jede Flasche den Lagerort sowie den Button **Lagerort** zum Zuordnen/Umlagern.

**Möbelauswahl und Scrollverhalten:** In den Bereichen **Raumpläne** sowie **Regale & Fächer** steht nur eine gemeinsame Möbelliste für Auswahl, Mehrfachaktionen und die Navigation zur Fachansicht zur Verfügung. Die separate nummerierte 3D-Legende ist entfallen. Im Raumplan wählt ein einzelner Klick ein Möbel und scrollt zu dessen Fachansicht, ohne über die Seiten-Navigation an den Anfang der Seite zu springen. Ein Doppelklick öffnet die Möbelbearbeitung. Im 3D-Raumplan befinden sich die **kompakten Möbelkacheln direkt neben dem 3D-Plan** (Desktop); die Liste scrollt bei vielen Möbeln innerhalb einer eigenen Seitenleiste, statt unter dem 3D-Plan große Kacheln aufzubauen. Bei schmalen Bildschirmen befindet sich ein seitlich verschiebbarer Möbelstreifen unmittelbar unter dem verkleinerten 3D-Plan; die Mehrfachaktionen sind weiterhin sichtbar. Das **größere Augen-Icon** mit unveränderter 44 × 44 px Klickfläche und 27 px Symbolgröße schaltet die Sichtbarkeit jedes Möbels unabhängig ein und aus (offenes Auge = sichtbar, durchgestrichenes Auge = ausgeblendet). Der Button **Alle einblenden** setzt alle unsichtbaren Möbel des aktuell gewählten Raums zurück. Er ist deaktiviert, wenn dort nichts ausgeblendet ist. Mehrere Möbel können gleichzeitig verborgen bleiben; ein erneuter Klick blendet genau dieses Möbel wieder ein. Dies ändert weder Kameraausrichtung noch Checkbox-Auswahl, und die Einstellung wird für die Dauer der Sitzung beim Umschalten von 3D nach 2D beibehalten; ein normaler Klick auf den Möbelnamen zeigt stattdessen die Fächer. Beim Hover oder Tastaturfokus auf eine Möbelkachel wird genau dieses Möbelstück im 3D- bzw. 2D-Raumplan hervorgehoben. Das Öffnen der Fächer ändert keine Checkbox und erzeugt keine Mehrfachauswahl-Markierung. Unter **Regale & Fächer** bleibt die Raumauswahl bestehen, aber die Aktionen „+ Raum“, „Raum bearbeiten“ und „Raum löschen“ werden ausschließlich unter **Raumpläne** angeboten.

**Mehrfachbearbeitung:** In **Raumpläne** und **Regale & Fächer** mehrere Möbel mit den Auswahlkästchen markieren. Der gemeinsame Bearbeitungsdialog kann Drehung (0°, 90°, 180°, 270°), Unterkante, Möbelhöhe, Breite und Tiefe selektiv auf alle markierten Möbel anwenden. Nicht ausgefüllte Eigenschaften bleiben unverändert. Zusätzlich können linke und rechte Seitenwand sowie Rückwand einzeln als vorhanden/nicht vorhanden gesetzt werden. Die Auswahl kann über den eigenen Button **Möbel löschen** nach Bestätigung komplett gelöscht werden. Enthält eines der Möbel Flaschen, wird keines gelöscht. Die API validiert alle Zielmöbel, inklusive bereits festgelegter Fachhöhen und Kollisionen der geplanten Endpositionen, und speichert atomar; eine ungültige Änderung verwirft die gesamte Mehrfachbearbeitung. Möbel- und Fachkopien enthalten keine bestehenden Flaschenzuordnungen.

**Wände am Lagermöbel:** Beim Anlegen/Bearbeiten eines Möbels lassen sich linke Seitenwand, rechte Seitenwand und Rückwand unabhängig aktivieren. Auch die gemeinsame Bearbeitung kann diese Optionen setzen oder unverändert lassen. Alle drei Wände werden in der 3D-Darstellung mit dem Möbel gedreht; ältere Datensätze ohne Wandattribute bleiben ohne zusätzliche Wände.

**Türkonfiguration auf Möbelstück-Ebene und durchgehende Türen:** Möbelstandards für Türflügelzahl und Glasrahmen gelten für alle Fächer, sofern keine Fach-Overrides gesetzt sind. Zusätzlich lassen sich im Möbel-Bearbeitungsdialog mehrere **Türbereiche** von Fachnummer bis Fachnummer definieren (Nummerierung von unten nach oben, z. B. 1–2 Holztür, 3–5 Glastür). Ein Türbereich verdeckt mehrere Fächer mit **einer durchgehenden Front**, statt pro Fach eine Tür zu zeichnen. Pro Bereich sind Türflügelzahl und Glasrahmen wählbar; die Möbelstandards bleiben als Fallback erhalten. Überlappende oder außerhalb der Möbel-Fächer liegende Bereiche werden abgewiesen. Bei Kopien mit Fächern bleiben Bereiche erhalten; das Löschen eines Fachs passt Bereichsgrenzen an. Fachangaben bleiben unter den Türbereichen gespeichert, so dass sie wieder gelten, wenn der Bereich entfernt wird. Fächer mit Kapazität 0 zeigen keinen Leerstandshinweis und keine Flaschenbelegungszahl.

**Türvarianten pro Fach:** Holz- und Glastüren lassen sich ein- oder zweiflügelig gestalten. Für Glastüren ist ein sichtbarer Rahmen pro Flügel optional. Nicht konfigurierte Bestandsdaten behalten die bisherigen Standardformen: Holztüren zweiflügelig, Glastüren einflügelig ohne Rahmen. Die Einstellungen gelten pro Fach und werden beim Kopieren übernommen.

**3D-Ansicht gemischter Möbel:** Die Fronten und individuellen Fachhöhen werden als echte 3D-Bauteile auf derselben Möbelgrundfläche abgebildet; offene Fächer bleiben auch bei einem Möbel vom Typ „Schrank“ offen. Holztüren und Glastüren liegen an der durch die Möbeldrehung bestimmten Vorderseite; 90° und 270° werden ebenso berücksichtigt wie 0° und 180°. Die bisherige 2D-Raumansicht und das Sammlungsschema bleiben unverändert.

**Raumkapazität:** Auf der Lagerübersicht wird für jeden Raum und für alle Räume zusammen die Summe der eingetragenen Fachkapazitäten in **Flaschenplätzen** angezeigt. Daneben steht die tatsächliche Zahl zugeordneter physischer Flaschen. Bei Fächern ohne Höchstzahl wird deren Kapazität **nicht erfunden**: die Anzeige nennt die bekannte Kapazität als Mindestwert und die Zahl der Fächer ohne Limit. Die Kapazität ist damit keine Schätzung des realen Platzbedarfs und keine Volumenberechnung.

**Schrank mit darüberliegendem Hängeregal:** Lege zwei getrennte Lagermöbel an, beispielsweise einen Schrank mit Unterkante 0 m und Höhe 1,8 m sowie ein Hängeregal mit Unterkante 1,9 m und Höhe 0,4 m. Beide dürfen dieselben X/Y-Koordinaten haben. Über die Planebenen-Umschaltung kann jedes Möbel einzeln angezeigt und ausgewählt werden. Bei Kopien wird ein freier Standort nach **Grundfläche und Höhenbereich** gesucht. Die 3D-Kollisionsprüfung berücksichtigt sowohl die gedrehte Grundfläche als auch den Höhenbereich (Unterkante bis Unterkante + Möbelhöhe). Ein Möbel darf im Grundriss über einem anderen liegen, wenn ihre Höhenbereiche sich nicht überschneiden. Zwei Flächen dürfen sich an Kanten berühren. Das gilt auch beim Drag-and-drop, inklusive schnellen Mausbewegungen; die API prüft die Endposition erneut. Bereits bestehende Überlagerungen werden nicht automatisch verschoben und reine Metadatenänderungen bleiben möglich. Die Raumhöhe (Deckenhöhe) wird weiterhin nicht erfasst.

**Flaschen im Fach:** Ein Klick oder Tastatur-Enter auf eine Flasche im geöffneten Regal zeigt ein modales, schreibgeschütztes Detailfenster mit Foto (oder Platzhalter), Inventarnummer, Status, Flaschentyp, Füllmenge und Lagerort. Wenn verfügbar, erscheinen auch Alter, Alkoholgehalt und flaschenspezifische Angaben wie Kaufdatum/-preis, Händler, Bewertung und Kommentar. Über **Zur Detailseite** öffnet sich die zugehörige Abfüllungs-Detailseite; die angeklickte physische Flasche wird dort gezielt hervorgehoben. **Umlagern** bleibt im Modal als eigene Aktion verfügbar. Das Modal verändert keine Lagerdaten und benutzt die bereits vorhandenen Sammlungs-/Lagerinformationen, ohne einen neuen API-Endpunkt.

Ein Lagerort bezieht sich auf **eine physische Flasche**, nicht auf eine Abfüllung. Zwei Flaschen derselben Abfüllung können in verschiedenen Fächern liegen. Der bestehende Inventarscanner führt zur jeweiligen Flasche; von dort ist deren Lagerort erreichbar.

## Raumplan-Bedienung

Im Bereich **Raumpläne** stehen der Raumname (groß), die Raummaße und die Kapazitäts-/Belegungszahlen in **einer gemeinsamen Kopfzeile**. Der 2D/3D-Switch, die vier Blickachsen und der 3D-Zoom teilen sich eine kompakte Werkzeugleiste oberhalb des Plans; in schmalen Ansichten dürfen die Bedienelemente in eine weitere Zeile umbrechen. Die Mehrfachaktionen in der Möbel-Seitenleiste sind gleich hoch.

Im Einzel-Möbeleditor werden linke Seitenwand, rechte Seitenwand und Rückwand als drei gleichartige, tastaturbedienbare Schalter mit schematischer Seitenkennzeichnung und sichtbarem Status angeboten. Diese drei Einstellungen bleiben unabhängig und werden weiterhin als `leftSidePanel`, `rightSidePanel` und `backPanel` gespeichert. In der Mehrfachbearbeitung bedeuten leere Wandfelder weiterhin **unverändert**, damit nicht versehentlich alle Möbel geändert werden.

## 3D-Raumansicht

Unter **Lager → Raumpläne** ist **3D voreingestellt**. Zur Platzierung und zum Verschieben kann auf **2D** umgeschaltet werden.

### Three.js-Geometrie und Interaktion

Die 3D-Ansicht basiert nun auf **Three.js/WebGL2** und verwendet aus den bestehenden Lagerdaten echte dreidimensionale Bauteile. Der frühere SVG-/2,5D-Renderer, seine selbst implementierte Projektion und sämtliche Bildschirm-Verdeckungsmasken wurden entfernt. Die GPU prüft die räumliche Verdeckung über den Tiefenpuffer. Leere Zwischenräume von Regalen bleiben dabei physikalisch korrekt durchsichtig; ein höher montiertes Brett verdeckt nur die Geometrie, die von der aktuellen Kamera tatsächlich dahinter liegt.

- **Regal:** Vier dünne Eckstützen, echte horizontale Fachböden und keine geschlossenen Seitenflächen. Die Anzahl der Fächer stammt aus `warehouse.json`.
- **Hängeregal:** Flache Bretter auf der gespeicherten Unterkantenhöhe, mit schematischen Halterungen, ohne Bodenstützen. Es darf über einem anderen Möbel liegen.
- **Schrank, Kommode, Vitrine:** Unterscheidbare Korpusse, Schranktüren, Schubladen beziehungsweise transparentes Glas.
- **Blickwinkel:** Nordwest, Nordost, Südost, Südwest sowie frei drehbare OrbitControls-Kamera mit Touch-/Maussteuerung. 100/150/200 % sind Zoom-Voreinstellungen.
- **Interaktion:** Einfaches Anklicken eines Möbels öffnet seine Fachansicht mit gezieltem Scrollen; Doppelklick öffnet den Möbeleditor. Die gemeinsame Möbelliste hat ein großes Augen-Icon zum unabhängigen Ein-/Ausblenden jedes Möbels statt der früheren Freistellungsfunktion oder einer nummerierten Liste. Beim Hover über die Möbelkachel wird das Möbel im 3D-Modell hervorgehoben, ohne die Checkbox-Auswahl zu ändern.
- **Performance:** Einfachste Grundkörper und flache Materialien ohne Echtzeitschatten. Die Bibliothek wird erst bei sichtbaren Raum-Miniaturen oder beim Öffnen der 3D-Ansicht lokal von `/vendor/three...` aus `node_modules` geladen; keine CDN-Abhängigkeit.
- **Fallback:** Wenn WebGL2 oder die installierte Three.js-Abhängigkeit fehlen, zeigt der 3D-Bereich eine verständliche Fehlermeldung. Die vollständige Lagerverwaltung und der 2D-Plan bleiben nutzbar.

Die 3D-Szene ist nur eine Darstellung der vorhandenen Lagerorte. Sie speichert keine weiteren 3D-Objekte und verändert weder `warehouse.json` noch `collection.json`. Die 2D-Ansicht bleibt für das Positionieren/Verschieben maßgeblich.

## Datenmodell

```json
{
  "schemaVersion": 1,
  "rooms": [
    {
      "id": "uuid",
      "name": "Whiskyzimmer",
      "width": 5,
      "height": 4,
      "furniture": [
        {
          "id": "uuid",
          "name": "Regal A",
          "type": "regal",
          "x": 0.4,
          "y": 0.2,
          "width": 1.8,
          "depth": 0.5,
          "rotation": 0,
          "elevation": 0,
          "itemHeight": 1.8,
          "shelves": [
            { "id": "uuid", "name": "Fach 1", "capacity": null }
          ]
        }
      ]
    }
  ],
  "assignments": {
    "bottle-uuid": "shelf-uuid"
  }
}
```

- Stabile IDs statt Namen als Referenzen; Namen können geändert werden.
- Raumkoordinaten in Metern, ausgehend von der linken oberen Ecke des 2D-Plans. `elevation` beschreibt die Unterkante über dem Boden, `itemHeight` die physische Höhe des Möbelstücks, ebenfalls in Metern. Ein Hängeregal lässt sich darüber mit anderer Unterkante am selben X/Y-Platz führen. Die 2D-Raumdarstellung besitzt getrennte Sicht-Ebenen; die zusätzliche isometrische 3D-Darstellung projiziert dieselben Koordinaten und Höhen, ohne sie zu verändern.
- Ältere Möbel ohne `elevation` oder `itemHeight` bleiben gültig: sie werden als bodenstehend (`elevation: 0`) mit einer Standardhöhe (1,8 m, beim Typ Hängeregal 0,4 m) behandelt. Erst beim Bearbeiten werden diese Standardwerte in den Datensatz geschrieben.
- Fachkapazitäten sind **optionale Stückzahlgrenzen**, keine volumetrische Platzberechnung. Samples und Standardflaschen beanspruchen innerhalb dieser Zählung jeweils einen Platz.
- Belegte Räume, Möbel und Fächer können erst gelöscht werden, nachdem die zugehörigen Flaschen umgelagert bzw. entkoppelt wurden. Die Kapazität darf nicht unter die aktuelle Belegung sinken.
- Gelöschte physische Flaschen werden in der Lagerübersicht nicht mehr angezeigt. Verwaiste Zuordnungen werden bei der nächsten Zuordnung bzw. beim Entfernen eines betroffenen Lagerorts bereinigt.
- Kopieroperationen erhalten Struktur, Maße, Drehung, Unterkante, Möbelhöhe und gegebenenfalls Fachkapazitäten; die Flaschenbelegung bleibt ausschließlich an den ursprünglichen Fach-IDs hängen. Fotopfade werden für die Anzeige aus `collection.json` gelesen, aber nicht in `warehouse.json` persistiert.
- Alle Änderungen an `warehouse.json` erfolgen serialisiert und per atomarem Dateiersatz. Fehlgeschlagene Validierungen schreiben keine teilweisen Daten.

## Sicherung und Wiederherstellung

**Vollständige** ZIP-Backups (manuell, zeitgesteuert oder als Sicherheitsbackup vor Restore) sichern rekursiv den kompletten `data`-Ordner und enthalten somit `data/warehouse.json` sowie `data/collection.json`, Bilder und Dokumente. Die Lagerdatei liegt damit auch auf dem Raspberry Pi im persistenten, vom Git-Checkout getrennten Datenverzeichnis.

**Achtung:** Der reine JSON-Collection-Export (`/api/export/json`) enthält *keine* Lagerdaten. Auch der Import einer einzelnen `collection.json` ersetzt nur die Sammlungsdaten und übernimmt keine Lagerorte. Nach einem solchen Import können alte Lagerzuordnungen nicht mehr auf vorhandene Flaschen passen. Für einen vollständigen Umzug das verschlüsselte ZIP-Backup verwenden.

Bei einer vollständigen Wiederherstellung einer **älteren** ZIP-Sicherung ohne `warehouse.json` wird die damalige Datenbasis wiederhergestellt und anschließend eine leere Lagerdatei erzeugt. Dies ist kein Migrationsmechanismus für alte Lagerorte; vorhandene Lagerdaten müssen vorher durch ein aktuelles vollständiges Backup gesichert werden.

## Grenzen

Der Raumplan besteht aus einem bedienbaren **2D-Lagerabbild** und einer **interaktiven minimalistischen Three.js-3D-Darstellung**. Beide werden nicht automatisch mit Änderungen im physischen Raum synchronisiert. Exakte Positionen einzelner Flaschen *innerhalb* eines Fachs, fotorealistisches Rendering, Umzugsprotokolle und sensorbasierte Erfassung sind nicht implementiert.

Die native Browser-Suite einschließlich Drag-and-drop auf echten Mobilgeräten muss separat in CI und auf iOS/Android getestet werden. Layout-/API-Tests allein sind dafür kein Ersatz.

## Optionale Möbel- und Fachfelder in `warehouse.json`

Pro Fach (`shelves[]`) gibt es zwei **optionale** Eigenschaften:

```json
{
  "id": "fach-id",
  "name": "Unteres Fach",
  "capacity": 6,
  "front": "door",
  "heightCm": 60
}
```

`front`: `open`, `door` (Holztür), `glass` (Glastür), `drawer` (Schublade) oder `null`/fehlend (Frontstandard des Möbeltyps). `heightCm`: Zahl zwischen 5 und 500 oder `null`/fehlend (automatische Höhe). Fächer stehen im Array von **unten nach oben**. Die Summe fester Höhen darf die Möbelhöhe (`itemHeight` in Metern) nicht übersteigen. Bei ungültigen Kombinationen wird die Änderung abgelehnt. Eine Migration bestehender Lagerdateien ist nicht erforderlich; ältere Fächer behalten ihre bisherige Front und gleichmäßige Höhe. Die Trennung von `collection.json` bleibt bestehen.

Bei der Mehrfachbearbeitung ausgewählter Möbel werden nur ausgefüllte Werte übernommen. Leere Eingaben lassen die jeweilige Eigenschaft unverändert; zusätzliche Aktivierungs-Checkboxen sind nicht erforderlich.

## 2D-Raumplanraster

Der 2D-Raumplan zeigt ein nicht-interaktives Raster mit Linien im Abstand von 0,1 m, leichter hervorgehobenen 0,5-m-Linien und stärker betonten Metern. Die Linien sind nur eine Orientierungshilfe, kein Positions-Snapping (Eingabe in 1-cm-Schritten bleibt möglich). Die Teilung folgt den echten Raummaßen und liegt unter den verschiebbaren Möbelelementen.

**Layout:** Die Seite nutzt die volle Inhaltsbreite des gemeinsamen `main` (wie Sammlung, Einstellungen und Landkarte) ohne zusätzliche horizontale Seitenränder im `.analytics-page`-Wrapper.

## Code-Zuständigkeiten

- `public/js/views/warehouse.js`: Seitenzustand, Auswahl, Modale, Formularspeichern und 2D-Drag.
- `public/js/views/warehouse-presentation.js`: reine HTML- und SVG-Darstellung einschließlich Fachlisten und Grundriss.
- `public/js/domain/warehouse-compartments.js` und `warehouse-placement.js`: gemeinsame browserunabhängige Fachhöhen-, Möbeltyp- und Kollisionsregeln für Browser und Server.
- `server/domain/warehouse-fields.js`: Normalisierung und Prüfung eingehender Fach- und Möbelwerte.
- `server/services/warehouse.js`: atomare Anwendungsfälle für Raum-, Möbel-, Fach- und Flaschenzuordnungen.
- `server/storage/warehouse-store.js`: Validierung und persistenter Dateiersatz.
- `public/js/domain/warehouse-3d-model.js` und `public/js/ui/warehouse-three-scene.js`: 3D-Modell beziehungsweise Three.js-Renderer.

Die Modulgrenzen und ihr Datenfluss sind auch in [ARCHITEKTUR.md](ARCHITEKTUR.md) dokumentiert.
