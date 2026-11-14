# Lagerverwaltung: Räume, Möbel und Fächer

Der Bereich **Lager** im rechten Hauptmenü bildet die physische Lagerung der Whisky-Sammlung ab. Er ist ausdrücklich **getrennt von der eigentlichen Sammlung**: Die strukturierten Lagerdaten stehen in `data/warehouse.json` unter dem konfigurierten Datenverzeichnis (`WHISKY_DATA_DIR`); die Abfüllungen und Flaschen bleiben ausschließlich in `data/collection.json`. Das bestehende Sammlungsschema bleibt unverändert.

Die Seite verwendet denselben Kopfbereich und dieselbe responsive Unternavigation wie der Analysebereich. Die aktive Lager-Unterseite wird auch auf schmalen Displays innerhalb der Tab-Leiste sichtbar gehalten.

**Raumvorschau in der Übersicht:** Jede Raumkachel zeigt **neben dem Raumtext** eine kleine statische 3D-Darstellung der zugehörigen Möbel im Raum. Sie entsteht aus demselben Three.js-Geometriemodell wie der interaktive 3D-Raumplan (fester Kamerawinkel Nordwest) und ist kein zweiter Editor. Sichtbare Kacheln werden bei Bedarf mit einem gemeinsam genutzten, anschließend freigegebenen WebGL-Renderer als Vorschaubild erzeugt und für unveränderte Raumdaten und unverändertes Theme zwischengespeichert. Auch leere Räume erhalten ein Bild ihrer leeren Bodenfläche. Ohne verfügbares WebGL bleibt die Raumkachel bedienbar und zeigt einen Hinweis statt des Bildes. Light- und Darkmode werden berücksichtigt.

## Hierarchie und Bedienung

1. Unter **Lager → Übersicht** einen Raum anlegen (Name, Breite und Tiefe in Metern).
2. Unter **Raumpläne** Räume verwalten und die Positionen vorhandener Lagermöbel im Grundriss bearbeiten. Möbel werden unter **Regale & Fächer** angelegt und konfiguriert. Unterstützt werden Regale, **Hängeregale**, Vitrinen, Schränke, Kommoden/Schubladen, Kisten und sonstige Lagermöbel. Position X/Y, Breite, Tiefe, Drehung sowie **Unterkante über Boden** und **Möbelhöhe** (jeweils Meter) sind einstellbar. Möbel lassen sich im 2D-Raumplan ziehen; die Änderung wird serverseitig gespeichert. Möbel dürfen nicht außerhalb der Raumgrenzen liegen oder andere Möbel im selben Höhenbereich schneiden. Das gilt für Neuanlage, Bearbeitung, Mehrfachbearbeitung und direktes Verschieben. Berühren von Kanten ist zulässig. Im 2D-Raumplan gibt es eine 10-cm-Rasterunterteilung mit deutlich sichtbaren 50-cm- und 1-m-Linien; die Positionsgenauigkeit bleibt 1 cm (kein automatisches Einrasten). Die Auswahl „Planebene“ trennt in 2D Bodenmöbel und erhöht platzierte Möbel, damit übereinanderliegende Möbel einzeln erreichbar sind. Die Raumpläne öffnen sich standardmäßig als interaktive 3D-Ansicht; die 2D-Ansicht mit Verschiebefunktion kann jederzeit ausgewählt werden.
3. Unter **Regale & Fächer** Möbel anlegen, einzeln oder mehrfach bearbeiten und beliebige Fächer hinzufügen. **Gemischte Möbel:** Jedes Fach besitzt unabhängig vom Möbeltyp eine Frontart: Standard des Möbeltyps, **offen**, **Holztür**, **Glastür** oder **Schublade**. So lassen sich unten kleine Holztüren, darüber offene Regalböden und oben Glastüren in **einem Möbel** kombinieren. Die Fächer werden von **unten nach oben** gespeichert, aber von **oben nach unten** in der Oberfläche angezeigt; die Pfeile ↑/↓ ändern ihre reale Reihenfolge. Für jedes Fach lässt sich eine optionale Höhe in **Zentimetern** festlegen (5–500 cm). Ohne Höhenangabe verteilt sich die nach festen Fachhöhen verbleibende Möbelhöhe gleichmäßig auf die automatischen Fächer. Die Summe festgelegter Fachhöhen darf die Möbelhöhe nicht überschreiten. Sind alle Fachhöhen festgelegt, darf oben ein freier Rest verbleiben; er wird angezeigt und kein Fach künstlich vergrößert. Optional kann pro Fach eine maximale Flaschenzahl angegeben werden (leer = unbegrenzt, 0 = keine Flaschen erlaubt). Eine visuelle Regal-Vorderansicht zeigt die zugeordneten Flaschen mit ihren vorhandenen Fotos, falls vorhanden, sonst als Flaschensymbole. Bilder stammen aus den bereits lokal gespeicherten Fotos der jeweiligen physischen Flasche; es werden keine zusätzlichen Bilder kopiert.
4. In der Regalansicht kann ein einzelnes Fach mit **Kopieren** in dasselbe oder ein anderes Möbel kopiert werden (Name, Kapazität, Fachhöhe und Fronttyp ohne Flaschenzuordnung). Über **Kopieren** am Möbel lässt sich ein Regal oder eine Vitrine wahlweise **mit sämtlichen Fächern** oder **ohne Fächer** im gleichen oder einem anderen Raum duplizieren. Das System sucht einen freien Standort im Raumplan; falls kein Platz vorhanden ist, wird nichts geändert und eine Fehlermeldung angezeigt. Kopien erhalten eigene IDs und übernehmen **niemals** Flaschenzuordnungen.
5. Unter **Flaschen finden** nach Abfüllung, Inventarnummer, Alter, Erscheinungsjahr, Fasstyp oder Lagerort suchen, auf „Nur ohne Lagerort“ eingrenzen und eine physische Flasche einem Fach zuordnen. Die linksbündige Flaschenliste zeigt Alter, Erscheinungsjahr und Fasstyp an, sofern sie in der Abfüllung hinterlegt sind. Auf der Abfüllungsdetailseite zeigt jede Flasche den Lagerort sowie den Button **Lagerort** zum Zuordnen/Umlagern.

Die virtuelle Ablage **„Nicht zugeordnet“** oberhalb der Regalwand ist beim Öffnen der Seite zunächst **eingeklappt**. Ein Klick auf die Überschrift blendet Suche, Flaschen und Seitennavigation ein; erneutes Klicken klappt sie zu. Bei Neuzeichnungen der Regalwand bleibt der Zustand erhalten. Pro Seite werden maximal 24 Flaschen angezeigt. Auch hier sind Alter, Erscheinungsjahr und Fasstyp verfügbar, wenn die Angaben zur Abfüllung existieren. Diese drei Felder sind Teil der lesenden Lager-API, nicht der gespeicherten Lagerzuordnungen.

## Virtuelle Regalwand und Flaschen-Umlagerung

Die Lagerverwaltung trennt **Raumpläne** und **Regale & Fächer** bewusst nach Zuständigkeit:

- **Raumpläne:** Räume erstellen, bearbeiten und löschen; Grundriss, 2D- und 3D-Darstellung, Möbelpositionen, Montagehöhen, Blickwinkel und Sichtbarkeit. Ein Klick auf ein Möbel markiert es im Plan, ohne zur Fachansicht zu scrollen. Im **3D-Plan** öffnet ein Doppelklick auf ein belegtes Fach den vollständigen Fachinhalt im bestehenden Modal, ohne den Raumpläne-Reiter zu verlassen; die Fachzuordnung folgt der tatsächlichen Höhe. Leere, nicht belegbare oder nicht vorhandene Fächer öffnen keinen Dialog. Der **2D-Doppelklick** führt weiterhin zur Möbelbearbeitung unter **Regale & Fächer**. Über die gleichnamige Schaltfläche gelangt man direkt zur Verwaltung. In den Raumplänen gibt es keine Fachbearbeitung, Flaschenauswahl im Plan, Regalwand oder Möbel-Mehrfachaktionen.
- **Regale & Fächer:** Möbel anlegen, kopieren, bearbeiten, löschen, mehrfach auswählen/bearbeiten sowie Fächer anlegen und konfigurieren. Hier steht die **virtuelle Regalwand** mit sämtlichen Fächern und den Flaschen des gewählten Raums. Raum-Anlage und -Löschung bleiben dem Reiter Raumpläne vorbehalten.

Das gemeinsame **Fachinhalt-Modal** aus 3D-Raumplan, Regalwand und Möbelverwaltung zeigt alle eingelagerten Flaschen mit Inventarnummer, Alkoholgehalt und Status (jeweils nur, wenn vorhanden), zusätzlich zu Alter, Erscheinungsjahr und Fasstyp. Jede Flaschenkarte hat unmittelbar die Aktionen **Umlagern** und **Zur Detailseite** (bei vorhandener Abfüllungszuordnung). Innerhalb des Fachinhalt-Modals führt der Detailbutton direkt zur Flaschendetailseite, ohne ein weiteres Zwischenmodal. Im Fachinhalt-Modal sind die Flaschenbilder reine Anzeige: Ein Klick darauf oeffnet weder ein Einzelmodal noch eine Mehrfachauswahl. Nur die direkten Aktionsbuttons fuehren zu Umlagern oder der Detailseite. Die Regalwand behaelt ihre Mehrfachauswahl und das Ziehen/Umlagern; die Markierung liegt innerhalb des jeweiligen Flaschenplatzes und ragt nicht ueber Fachkanten hinaus. Die Aktion **Flaschendetails** fuer eine einzeln markierte Regalflasche oeffnet dagegen die Einzel-Flaschenvorschau, unabhaengig davon, ob ein Lagerfach zugeordnet ist. Flaschensymbole im Moebelmodal oeffnen diese Vorschau direkt, mit **Umlagern** und **Zu den Flaschendetails**.


Die Regalwand entfaltet die vier Blickrichtungen (0°/90°/180°/270°) zu einer gemeinsamen Frontansicht. Die Sortierung folgt den gespeicherten Raumkoordinaten je Blickrichtung. Schränke und Hängeregale mit derselben Grundfläche und getrennten Höhen stehen **übereinander**, nicht nebeneinander. Breite Obermöbel können dabei mehrere nebeneinanderstehende Unterschränke gemeinsam überdecken, ohne dass die Unterschränke auseinandergerissen werden. Jedes Möbel besitzt rechts oben ein kleines Bearbeiten-Icon innerhalb seiner bestehenden Kontur: Beim Mouseover wird der Möbelname angezeigt; ein Klick öffnet das zugehörige Möbelmodal. Sichtbare Möbelname-Kopfzeilen entfallen vollständig, die Fach- und Möbelabmessungen bleiben unverändert. Bei Kapazität 0 wird die Anzeige `0/0` weggelassen, das Fach bleibt bestehen. Möbel- und Fachmaße, fachbezogene feste Höhen und Montagehöhen folgen einem einheitlichen Maßstab. Der Arbeitsbereich wächst auf die **volle Höhe** der Möbel; nur horizontal wird innerhalb der Regalwand gescrollt. Nach dem Umlagern einer oder mehrerer Flaschen bleibt die horizontale Scrollposition des jeweiligen Raums erhalten.

**Virtuelle Ablage für nicht zugeordnete Flaschen:** In der gemeinsamen Werkzeugleiste oberhalb der Regalwand stehen der Auswahlzähler, die Auswahlaktionen und die Schaltfläche „Nicht zugeordnet (Anzahl)“. Die Ablage öffnet sich bei Bedarf unmittelbar unterhalb dieser Leiste, ohne eine zweite Kopfzeile; sie ist standardmäßig geschlossen. Sie enthält Flaschen ohne `shelfId`, unabhängig von der Raumzuordnung. Für große Sammlungen werden pro Seite höchstens 24 Flaschen dargestellt; eine Suche nach Name oder Inventarnummer und eine Seitennavigation stehen zur Verfügung. Die Auswahl bleibt auch bei Seitenwechseln erhalten. Aus dieser Ablage können einzelne oder gemeinsam markierte Flaschen in physische Fächer gezogen oder per Zuordnungsdialog zugewiesen werden. Sie ist keine reale Lagerstelle und fügt dem Datenmodell keine Möbel, Räume oder Fächer hinzu.

Eine physische Flasche kann per Maus, Stift oder Touch in ein anderes Fach gezogen werden, auch zwischen Regalen. Durch Anklicken/Antippen werden Flaschen in der Regalwand **ohne Checkboxen** markiert; die Markierung erscheint als farbige Hinterlegung. Erneutes Antippen hebt die Auswahl auf. Eine markierte Gruppe kann gemeinsam umgelagert werden. Browser und Server prüfen die Zielkapazität. Ist eine **positive** Fachkapazität zu klein, fragt die Oberfläche vor dem Zuordnen oder Drag-and-drop nach, ob sie auf die benötigte Anzahl Plätze erhöht werden soll. Die Rückfrage erscheint als **Anwendungsmodal** (keine native Browserbestätigung) und erhält bei einer bereits geöffneten Zuordnung die Formulareingaben. Bei Nein oder Schließen wird nichts geändert; bei Ja werden Kapazität und Zuordnung in einem atomaren Vorgang gespeichert. Der Server akzeptiert nur eine Kapazität bis zur zuvor bestätigten Grenze. Ein Fach mit **Kapazität 0** bleibt nicht belegbar: kein Fachmodal, kein Hand-Mauszeiger, keine Kapazitätserhöhung auf diesem Weg. Die API verschiebt bei einer Mehrfachzuordnung **alle Flaschen oder keine**. Für einzelne Flaschen stehen Details und der bisherige Umlagern-Dialog bereit. Die separate Flaschenliste verwendet weiterhin Checkboxen.

**Einzelbearbeitung und Mehrfachbearbeitung als getrennte Modals:** Die virtuelle Regalwand bleibt die einzige dauerhaft sichtbare Fachansicht. Ein Klick auf das Bearbeiten-Icon am Möbel öffnet direkt **nur dieses Möbel** mit seinen Fach-Aktionen und allen darin zugeordneten Flaschen (Fotos oder Flaschensymbole) in einem breiten Modal – ohne Möbelliste oder Auswahlsteuerung. Die Flaschensymbole öffnen direkt die Einzel-Flaschenvorschau mit den Flaschenaktionen; unter der Regalwand entsteht dabei keine zweite dauerhaft sichtbare Fachansicht. Neue Fächer, bestehende Fächer, Kopieren und Löschen werden von dort aus bedient, ohne eine zweite Fachansicht unter der Regalwand einzublenden. Die eigenständige Schaltfläche **„Mehrere Möbel bearbeiten“** öffnet stattdessen einen separaten Dialog: Möbel werden dort über anklickbare Kacheln mit goldfarbener Hinterlegung anstelle von Checkboxen markiert und anschließend gemeinsam geändert oder gelöscht. Der Dialog kann Drehung, Maße, Unterkante und Möbelhöhe selektiv verändern sowie linke und rechte Seitenwand und Rückwand festlegen. Leere Felder bleiben unverändert. Die bisherigen Kollisions-, Kapazitäts- und atomaren Validierungsregeln gelten unverändert.

**Wände am Lagermöbel:** Beim Anlegen/Bearbeiten eines Möbels lassen sich linke Seitenwand, rechte Seitenwand und Rückwand unabhängig aktivieren. Auch die gemeinsame Bearbeitung kann diese Optionen setzen oder unverändert lassen. Alle drei Wände werden in der 3D-Darstellung mit dem Möbel gedreht; ältere Datensätze ohne Wandattribute bleiben ohne zusätzliche Wände.

**Türkonfiguration auf Möbelstück-Ebene und durchgehende Türen:** Möbelstandards für Türflügelzahl und Glasrahmen gelten für alle Fächer, sofern keine Fach-Overrides gesetzt sind. Zusätzlich lassen sich im Möbel-Bearbeitungsdialog mehrere **Türbereiche** von Fachnummer bis Fachnummer definieren (Nummerierung von unten nach oben, z. B. 1–2 Holztür, 3–5 Glastür). Ein Türbereich verdeckt mehrere Fächer mit **einer durchgehenden Front**, statt pro Fach eine Tür zu zeichnen. Pro Bereich sind Türflügelzahl und Glasrahmen wählbar; die Möbelstandards bleiben als Fallback erhalten. Überlappende oder außerhalb der Möbel-Fächer liegende Bereiche werden abgewiesen. Bei Kopien mit Fächern bleiben Bereiche erhalten; das Löschen eines Fachs passt Bereichsgrenzen an. Fachangaben bleiben unter den Türbereichen gespeichert, so dass sie wieder gelten, wenn der Bereich entfernt wird. Fächer mit Kapazität 0 zeigen keinen Leerstandshinweis und keine Flaschenbelegungszahl.

**Türvarianten pro Fach:** Holz- und Glastüren lassen sich ein- oder zweiflügelig gestalten. Für Glastüren ist ein sichtbarer Rahmen pro Flügel optional. Nicht konfigurierte Bestandsdaten behalten die bisherigen Standardformen: Holztüren zweiflügelig, Glastüren einflügelig ohne Rahmen. Die Einstellungen gelten pro Fach und werden beim Kopieren übernommen.

**3D-Ansicht gemischter Möbel:** Die Fronten und individuellen Fachhöhen werden als echte 3D-Bauteile auf derselben Möbelgrundfläche abgebildet; offene Fächer bleiben auch bei einem Möbel vom Typ „Schrank“ offen. Holztüren und Glastüren liegen an der durch die Möbeldrehung bestimmten Vorderseite; 90° und 270° werden ebenso berücksichtigt wie 0° und 180°. Die bisherige 2D-Raumansicht und das Sammlungsschema bleiben unverändert.

**Raumkapazität:** Auf der Lagerübersicht wird für jeden Raum und für alle Räume zusammen die Summe der eingetragenen Fachkapazitäten in **Flaschenplätzen** angezeigt. Daneben steht die tatsächliche Zahl zugeordneter physischer Flaschen. Bei Fächern ohne Höchstzahl wird deren Kapazität **nicht erfunden**: die Anzeige nennt die bekannte Kapazität als Mindestwert und die Zahl der Fächer ohne Limit. Die Kapazität ist damit keine Schätzung des realen Platzbedarfs und keine Volumenberechnung.

**Schrank mit darüberliegendem Hängeregal:** Lege zwei getrennte Lagermöbel an, beispielsweise einen Schrank mit Unterkante 0 m und Höhe 1,8 m sowie ein Hängeregal mit Unterkante 1,9 m und Höhe 0,4 m. Beide dürfen dieselben X/Y-Koordinaten haben. Über die Planebenen-Umschaltung kann jedes Möbel einzeln angezeigt und ausgewählt werden. Bei Kopien wird ein freier Standort nach **Grundfläche und Höhenbereich** gesucht. Die 3D-Kollisionsprüfung berücksichtigt sowohl die gedrehte Grundfläche als auch den Höhenbereich (Unterkante bis Unterkante + Möbelhöhe). Ein Möbel darf im Grundriss über einem anderen liegen, wenn ihre Höhenbereiche sich nicht überschneiden. Zwei Flächen dürfen sich an Kanten berühren. Das gilt auch beim Drag-and-drop, inklusive schnellen Mausbewegungen; die API prüft die Endposition erneut. Bereits bestehende Überlagerungen werden nicht automatisch verschoben und reine Metadatenänderungen bleiben möglich. Die Raumhöhe (Deckenhöhe) wird weiterhin nicht erfasst.

**Flaschen im Fach:** Das gemeinsame Fachinhalt-Modal zeigt alle Flaschen eines Fachs mit vorhandenem Foto oder der einheitlichen Flaschen-Platzhaltergrafik. Sichtbar sind, soweit hinterlegt, Inventarnummer, Status, Alkoholgehalt, Alter, Erscheinungsjahr und Fasstyp. **Umlagern** und **Zur Detailseite** stehen direkt auf jeder Flaschenkarte; die Detailseite markiert die betreffende physische Flasche. Ein Klick auf die Detailaktion einer Fachkarte oeffnet direkt die vollstaendige Detailseite, nicht die Einzel-Flaschenvorschau. Die Flaschenbilder in diesem Dialog sind nicht anklickbar; es gibt dort weder eine Einzelvorschau per Bildklick noch eine Mehrfachauswahl. Auswahl und Mehrfach-Umlagerung erfolgen ausschliesslich in der Regalwand. Die Einzel-Flaschenvorschau steht bei einer direkt angeklickten Flasche im Moebelmodal sowie fuer eine einzeln ausgewaehlte Regalflasche zur Verfuegung. Das Öffnen des Fachinhalt-Modals verändert keine Lagerdaten.

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
- **Interaktion:** Einfacher Klick markiert das Möbel im Raumplan. Beim Doppelklick wird aus dem Raycast-Treffer und den gespeicherten Fachhöhen das konkrete Fach ermittelt: Nur bei zugeordneten Flaschen öffnet sich die vorhandene vollständige Fachinhalt-Ansicht als Modal direkt über dem unveränderten 3D-Raumplan. Ein Doppelklick auf ein leeres Fach, auf freie Möbelbereiche oder auf nicht belegbare Fächer löst kein Modal aus. Die gemeinsame Möbelliste hat ein großes Augen-Icon zum unabhängigen Ein-/Ausblenden jedes Möbels statt der früheren Freistellungsfunktion oder einer nummerierten Liste. Beim Hover über die Möbelkachel wird das Möbel im 3D-Modell hervorgehoben, ohne die Checkbox-Auswahl zu ändern. Der 2D-Plan behält sein bisheriges Doppelklick-Verhalten zur Möbelbearbeitung.
- **Performance:** Einfachste Grundkörper und flache Materialien ohne Echtzeitschatten. Die Bibliothek wird erst bei sichtbaren Raum-Miniaturen oder beim Öffnen der 3D-Ansicht lokal von `/vendor/three...` aus `node_modules` geladen; keine CDN-Abhängigkeit.
- **Fallback:** Wenn WebGL2 oder die installierte Three.js-Abhängigkeit fehlen, zeigt der 3D-Bereich eine verständliche Fehlermeldung. Die vollständige Lagerverwaltung und der 2D-Plan bleiben nutzbar.

Die 3D-Szene ist nur eine Darstellung der vorhandenen Lagerorte. Sie speichert keine weiteren 3D-Objekte und verändert weder `warehouse.json` noch `collection.json`. Die 2D-Ansicht bleibt für das Positionieren/Verschieben maßgeblich.

## Virtuelle Regalwand und Mehrfachzuordnung (ab v0.18.1)

- Die Regalwand unter **Regale & Fächer** zeigt die Frontansichten aller Schränke/Regale nach den Koordinaten im Grundriss und ihrer Blickrichtung (0°, 90°, 180°, 270°). Gegenüberstehende Wände werden hintereinander zu einer virtuellen Wand entfaltet; innerhalb einer Blickrichtung wird die reale seitliche Position beibehalten. Möbel mit weitgehend gleicher Grundfläche und unterschiedlichen, nicht überlappenden Höhen (zum Beispiel Schrank und Hängeregal darüber) werden in **einer gemeinsamen Spalte auf den gespeicherten Höhen** dargestellt. Namenssortierung ist nur noch ein Tie-Breaker. Die tatsächlichen Breiten, Möbelhöhen, Fachhöhen und Unterkantenhöhen folgen einem Maßstab. Explizit festgelegte Fachhöhen werden nicht gestreckt; eine verbleibende ungenutzte Höhe wird nicht als neues Fach dargestellt.
- Die virtuelle Wand hat **keine eigene vertikale Scrollbar und keine `vh`-Höhenbegrenzung**. Ihre Höhe richtet sich nach dem höchsten Möbel (einschließlich Montagehöhe), sodass die Seite normal vertikal scrollt. Nur die horizontale Bewegung findet innerhalb der Regalwand statt.
- In der **Regalwand** markiert ein Klick/Tipp auf eine Flasche diese mit einer sichtbaren farbigen Hinterlegung; erneutes Klicken entfernt sie aus der Auswahl. Checkboxen in der Regalwand entfallen. Flaschen können einzeln oder als markierte Gruppe per Pointer Events zwischen Fächern und Regalen verschoben werden. Ein **Doppelklick auf eine Flasche** oeffnet die Einzel-Flaschenvorschau. Die Schaltflaeche **Flaschendetails** oeffnet bei genau einer markierten Flasche dieselbe Vorschau; fuer nicht zugeordnete Flaschen gilt dies ebenfalls. In der separaten Flaschenliste sind Checkboxen weiterhin verfügbar; der Dialog **Auswahl zuordnen** bleibt für die gemeinsame Zuordnung erhalten.
- `POST /api/warehouse/bottles/bulk` nimmt `{ "ids": ["bottleId", ...], "shelfId": "shelfId" }` entgegen; `shelfId: null` entfernt die Zuordnungen. Der Server validiert Flaschen, Ziel und **gemeinsame** Kapazität vor jeder Änderung und speichert die Zuordnung atomar. Der bisherige Einzel-Endpunkt bleibt bestehen.

## Einzel-/Mehrraum-Transfer (ab v0.19.0)

In **Lagerübersicht** und **Raumpläne** öffnet **Räume übertragen** einen einzelnen Dialog mit den Reitern **Räume exportieren** und **Räume importieren**. Die Reiter belegen nie gleichzeitig Platz; beim Wechsel bleiben die bereits gewählten Optionen erhalten. Im Export-Reiter können Räume ausgewählt und als JSON-Datei heruntergeladen werden. Ein einzelner Raum, mehrere oder alle Räume sind möglich; Flaschenzuordnungen werden nur bei aktivierter Option in die Datei aufgenommen. Möbel/Fächer einschließlich ihrer Maße, Positionen, Türbereiche und Kapazitäten werden übertragen. Die Sammlung, Bilder, Belege und die Flaschenstammdaten sind ausdrücklich **kein** Bestandteil dieses Formats.

Der Reiter **Räume importieren** liest eine solche Datei. Eine serverseitige Vorschau und ein expliziter Bestätigungsschritt zeigen die Auswirkungen vor dem Schreiben. Doppelte Räume (gleiche Quell-ID oder gleicher Name) werden standardmäßig **übersprungen**. Bei expliziter Option **Ersetzen** wird ein Raum nur ersetzt, wenn seine bisherigen Fächer **unbelegt** sind; ansonsten wird der Import als Ganzes abgelehnt. Neu importierte Möbel/Fächer erhalten neue IDs und keine fremden Lagerreferenzen. Flaschenzuordnungen werden auf die neuen Fächer umgebogen, falls im Ziel eine Flasche mit exakt gleicher ID oder einer eindeutigen Inventarnummer existiert. Mehrdeutige, fehlende, bereits belegte oder überzählige Zuordnungen werden **nicht** übernommen und separat gezählt. Das Importieren ist ein einziger atomarer Schreibvorgang ohne teilweise ersetzte Räume. Andere Räume und die Sammlung bleiben unverändert. Das gespeicherte Lagerdateischema bleibt **1**.

Format: `format: "wcm-room-transfer"`, `formatVersion: 1`, `includesAssignments`, `rooms[]`, `assignments[]`. Jede Zuordnung enthält `bottleId`, `shelfId` und `inventoryNumber` (falls vorhanden). Beim Import kann die Übernahme der Zuordnungen nochmals abgewählt werden. Es handelt sich **nicht** um das vollständige Sicherungsformat. Das verschlüsselte ZIP-Backup ist für den Umzug der gesamten Installation einschließlich Medien vorzuziehen.

## Fachmodal für mehrere Flaschenreihen (ab v0.19.0)

Fächer zeigen in der Regalwand nur die vordere Reihe (maximal fünf Flaschen). Die bisherige horizontale Scrollbar innerhalb einzelner Fächer entfällt. Die Anzeige `+N` nennt die Flaschen hinter der sichtbaren Reihe. Ein **Doppelklick** auf die Fachfläche der Regalwand (Tastatur: Enter/Leertaste) oder auf die Fachflaeche im Einzelmoebel-Modal öffnet eine eigene vollständige Fachansicht als Dialog. Ein einfacher Klick auf die Fachfläche öffnet keinen Dialog. Einzelklick auf eine Flasche markiert sie fuer die Mehrfachbearbeitung; ein Doppelklick auf eine Flasche oeffnet deren Einzel-Flaschenvorschau. Drag-and-drop bleibt unabhaengig davon bedienbar. Dieser zeigt saemtliche Flaschen des Fachs als Karten, vorhandene Alter-/Jahrgang-/Fassangaben, Foto/Symbol sowie direkte Aktionen zum Umlagern und zur Detailseite. Klicks auf einzelne Flaschen im Einzelmöbel-Modal öffnen stattdessen die Einzel-Flaschenansicht mit Umlagern und dem Link **Zu den Flaschendetails**. Der separate Button **Flaschen anzeigen** im Moebelmodal entfaellt; die `+N`-Anzeige bei mehr als sechs Flaschen kann weiterhin den kompletten Fachinhalt oeffnen. Die Auswahlsteuerung der Regalwand wird im Fachdialog nicht dupliziert. Die reale Kapazität und das Umlagern per Drag-and-drop sind unabhängig von der gekürzten Frontansicht.

**Verschachtelte Modals:** Ein Dialog, der aus einem anderen Modal geoeffnet wird (z. B. Moebelmodal → Einzel-Flaschenvorschau → Umlagern oder Fachinhalt → Umlagern), legt sich ueber die bisherige Ansicht. Schliessen per X, Escape oder Klick auf die Abdeckung kehrt jeweils genau zum unmittelbar vorherigen Modal zurueck; bisherige Formulareingaben bleiben erhalten. Ein expliziter Seitenwechsel schliesst weiterhin die gesamte Modalkette.

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

- `public/js/views/warehouse.js`: Getrennte Teilansichten für Raumpläne (Raumgeometrie und 2D/3D-Positionierung) und Regale & Fächer (Möbel- und Fachverwaltung, Flaschen-Umlagerung), gemeinsame Auswahl- und Speichervorgänge.
- `public/js/views/warehouse-presentation.js`: reine HTML- und SVG-Darstellung einschließlich Fachlisten und Grundriss.
- `public/js/domain/warehouse-compartments.js` und `warehouse-placement.js`: gemeinsame browserunabhängige Fachhöhen-, Möbeltyp- und Kollisionsregeln für Browser und Server.
- `server/domain/warehouse-fields.js`: Normalisierung und Prüfung eingehender Fach- und Möbelwerte.
- `server/services/warehouse.js`: atomare Anwendungsfälle für Raum-, Möbel-, Fach- und Flaschenzuordnungen.
- `server/storage/warehouse-store.js`: Validierung und persistenter Dateiersatz.
- `public/js/domain/warehouse-3d-model.js` und `public/js/ui/warehouse-three-scene.js`: 3D-Modell beziehungsweise Three.js-Renderer.

Die Modulgrenzen und ihr Datenfluss sind auch in [ARCHITEKTUR.md](ARCHITEKTUR.md) dokumentiert.


### Dialog zum Umlagern einer Flasche (v0.16.15)

- Der Dialog zeigt die betroffene Flasche und ihren aktuellen Lagerort als separate Zusammenfassung.
- Ein neuer Lagerort wird über die aufeinander aufbauenden Felder **Raum**, **Möbel** und **Fach** ausgewählt.
- Belegte und freie Fachkapazitäten werden angezeigt; volle Fächer sind für neue Zuordnungen deaktiviert.
- Die Option **Ohne Lagerort** hebt eine bestehende Zuordnung ausdrücklich auf.
- Auf schmalen Bildschirmen werden alle Felder untereinander angezeigt; die API erhält unverändert nur die Ziel-Fach-ID.


### Platzhalter bei Fachinhalten

Ohne eigenes Flaschenfoto zeigen die Flaschenkarten im Fachinhalt-Modal die einheitliche SVG-Platzhaltergrafik `/assets/photo-placeholder.svg` aus der Sammlungsübersicht. Die Uebersichtskacheln verwenden denselben Platzhalter bewusst etwas groesser als zuvor, waehrend die Detailseite denselben Goldton auch im Dark Mode beibehaelt. Die kleine, schematische Flaschendarstellung innerhalb der Regalwand bleibt eigenstaendig erhalten.
