# OpenStreetMap-Landkarte

Die Seite **Landkarte** ist über den Menübutton im Kopfbereich erreichbar. Standardmäßig zeigt sie **einen Marker pro Destillerie mit Abfüllungen**. Der Schalter **Alle Destillerien anzeigen** blendet darüber hinaus alle Destillerien des gespeicherten Katalogs ein, auch ohne Abfüllungen oder Flaschen. Diese Standorte sind über ein Pagodendach-SVG markiert; vorhandene Bestandsmarker bleiben erhalten. Die Einstellung ist lokal im Browser gespeichert. Die Flaschen- und Abfüllungsdaten kommen aus der gespeicherten `collection.json`; die Standorte aus individuellen Koordinaten oder aus dem integrierten Destillerie-Katalog.

## Standorte und Initialausschnitt

- Für wichtige Destillerien auf **Islay**, darunter Kilchoman, Ardbeg, Lagavulin, Laphroaig, Bowmore, Bruichladdich, Caol Ila, Bunnahabhain und Ardnahoe, werden geprüfte Koordinaten mitgeliefert. Quellen: [Islay Whisky Map](https://islaywhiskys.com/visit/islay-whisky-map), [Wikivoyage Islay](https://de.wikivoyage.org/wiki/Islay). Die eingebauten Koordinaten sind nur Ausgangswerte; individuelle Werte haben Vorrang.
- Für **alle 450 im mitgelieferten Katalog enthaltenen Destillerien** sind Kartenpositionen verfügbar. Für historische, stillgelegte und nicht exakt dokumentierte Standorte verwenden wir in vielen Fällen **ungefähre Ortskoordinaten**, keine fiktiven exakten Gebäudepositionen. Die Kartenansicht kennzeichnet diese als „Ungefähre Lage“. Neue oder selbst angelegte Destillerien erscheinen nur dann unter „Noch nicht verortet“, wenn keine Position gefunden wird; bei 0 fehlenden Standorten wird die gesamte Rubrik ausgeblendet.
- Über „Ort festlegen“ für neue Destillerien bzw. das kleine Stift-Icon rechts neben dem Destillerienamen öffnet sich das Destillerieformular. Dort können Breitengrad und Längengrad direkt eingegeben werden. Optional findet „Standort über OpenStreetMap suchen“ einzelne Kandidaten. **Der Benutzer prüft und wählt** den richtigen Standort, anschließend speichert er die Destillerie.
- Die Koordinaten werden optional als `distillery.latitude` und `distillery.longitude` in `collection.json` gespeichert, im vollständigen Backup erfasst und durch JSON-Import wiederhergestellt. Das bisherige `schemaVersion: 4` bleibt kompatibel.
- **Nach dem Speichern einer Destillerieposition** behält die Landkarte die aktuelle Zoomstufe. Wenn sich die Koordinaten tatsächlich geändert haben, wird nur der betroffene Standort neu zentriert. Änderungen an Name oder Betriebsstatus sowie gewöhnliche Datenaktualisierungen setzen weder Zoom noch Kartenausschnitt zurück; der Button „Alle Standorte anzeigen“ bleibt der bewusste Weg, alle Punkte einzupassen.
- Beim Öffnen und mit „Alle Standorte anzeigen“ berechnet die Karte den Ausschnitt aus den gerade eingeblendeten Orten. Im Standardmodus passen Islay-Bestände die Karte auf Islay an. Mit dem Schalter für alle Destillerien erweitert sich der Ausschnitt auf deren Standorte; nach dem Ausschalten wird wieder der Bestandsausschnitt angezeigt. Bei nur einem Standort wird Zoomstufe 11 verwendet. Ohne Standorte zeigt die Karte das Ausgangsgebiet.

## Marker, Bestand und große Destillerien

- Ein Standort fasst **alle Abfüllungen dieser Destillerie** zusammen, auch wenn beispielsweise mehr als 100 Kilchoman-Abfüllungen gespeichert sind.
- Die **Zahl im Bestandsmarker** ist die Summe aller zugeordneten **physischen Flaschen** (`bottles.length`); die Markergröße steigt logarithmisch mit dem Bestand. Für Destillerien ohne physische Flaschen verwendet der zuschaltbare Gesamtmodus stattdessen das Pagodendach-Icon.
- Beim Herauszoomen werden nahe Destillerien dynamisch zu **Clustern** zusammengefasst. Die Zahl im Cluster-Marker zeigt **die Summe ihrer physischen Flaschen**, nicht die Anzahl der Destillerien oder Abfüllungen. Der Tooltip nennt zusätzlich die Zahl der gruppierten Destillerien. Beim Klick wird hineingezoomt; bei maximalem Zoom erscheinen alle Destillerien als Einzelmarker. Standorte mit gleichen oder sehr nahen Koordinaten werden dabei visuell auseinandergezogen, ohne die gespeicherten Koordinaten zu verändern. Die kompakte Kartenlegende erklärt aktive und geschlossene Destillerien **mit Flaschen** (blau/geschlossen grau mit gestricheltem Rand), die Größenstaffelung 1, 10 und 100 in verkleinerten, proportionalen Beispielen sowie „Gruppiert“ als goldenen Kreis mit beispielhafter Flaschensumme. Bei aktiviertem Gesamtkatalog folgt auf „Mit Flaschen“ direkt der gleich aufgebaute Statusblock „Ohne Flaschen“ (jeweils Aktiv/Geschlossen). Die Markerfarben und Konturen entsprechen der Karte in beiden Themes, aber nur die echten Kartenmarker haben Schatten; die Legende bleibt bewusst flach. Die gespeicherten Daten bleiben unverändert. Gruppen leerer Destillerien zeigen 0 Flaschen.
- Die Standortliste enthält pro Destillerie die Anzahlen von **Abfüllungen und Flaschen**. Unter dem Namen jeder Abfüllung erscheinen, sofern hinterlegt, **Alter**, **Alkoholgehalt**, **Destillationsjahr** (Dest.), **Abfülljahr** (Abgef.) beziehungsweise ersatzweise **Erscheinungsjahr** (Ersch.). So sind gleichnamige Abfüllungen besser unterscheidbar, ohne Werte zu erfinden. Die vorhandene Flaschenanzahl bleibt sichtbar. Die Liste ist durchsuchbar und zeigt **höchstens 12 Abfüllungen auf einer Seite**, mit Vor-/Zurück-Navigation. Destillerien ohne Abfüllungen sind ebenfalls auswählbar und werden entsprechend als leer angezeigt. Ein Abfüllungseintrag führt zur Detailansicht.
- Bei Whisky aus mehreren Destillerien wird dieselbe Abfüllung **jeder beteiligten Destillerie** zugeordnet. Dies verdoppelt keine Sammlungsdaten; die Summen der Standorte können deswegen größer als der globale Flaschenbestand sein.
- Die Liste neben bzw. unter der Karte bleibt auch dann bedienbar, wenn geografisch benachbarte Marker sich überlappen.

## Landkartenlink aus der Abfüllungsdetailseite (v0.9.2)

Auf der Detailseite einer Abfüllung mit zugeordneten Destillerien gibt es **„Auf Landkarte anzeigen“** bzw. bei mehreren Destillerien **„Standorte auf Landkarte“**. Der Link öffnet `/?view=map&focusBottling=<Abfüllungs-ID>`; nach Aktualisieren der Seite bleibt die Zuordnung erhalten. Die Karte zeigt alle verorteten Destillerien der Abfüllung im gemeinsamen Ausschnitt (keinen künstlichen Mittelpunkt als Standort). Die zugehörigen Standorte sind in der rechten Seitenleiste explizit auswählbar; ein Klick fokussiert die gewählte Destillerie. Falls eine der Destillerien noch nicht verortet ist, erscheint sie dort mit **„Ort festlegen“**. Ohne zugeordnete Destillerie wird kein Kartenlink angeboten. Die bestehende Sammlung wird nicht verändert.

## Standorte und Quellen

Die lokale Positionsliste liegt unter `public/js/domain/distillery-locations.js`; die Islay-Standorte unter `public/js/domain/distillery-map.js`. Referenzen: [Schottische Whisky-Destillerien (Wikipedia)](https://en.wikipedia.org/wiki/List_of_whisky_distilleries_in_Scotland), [Uisge Beatha Distillery Map (2026)](https://uisgebeatha.co.uk/data/scotch-distillery-map/), [MacLean & Bruce Whisky Map](https://www.macleanandbruce.com/whisky-map) sowie Einzelnachweise in historischen Standortbeschreibungen. Die Unterscheidung zwischen hinterlegtem Katalog-Fallback und explizit gespeicherter Nutzerposition bleibt erhalten. Die Referenzliste ist kein Live-Geocoding und verwendet insbesondere keine massenhaften Nominatim-Abfragen.

## OpenStreetMap und Datenschutz

- Die Karte verwendet interaktiv **https://tile.openstreetmap.org/{z}/{x}/{y}.png** mit sichtbarer OpenStreetMap-Lizenzzuordnung. Der Browser lädt nur die für den **aktuellen Ausschnitt** notwendigen Kacheln und hält sich an die Caching-Header. Keine Hintergrundkarte, keine Vorratsdownloads, keine Offline-Karten: siehe [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
- Die **Standortsuche** wird nur nach Klick auf den Suchbutton gestartet, niemals automatisch oder als regelmäßiger Hintergrundjob. Anfragen gehen über den App-Server mit identifizierbarem User-Agent. Pro Anwendung gilt eine Begrenzung von maximal einer Anfrage alle 1,2 Sekunden; Suchergebnisse werden für 24 Stunden zwischengespeichert. Mehrfachsuche, Autocomplete und Massengeocodierung sind nicht vorgesehen: [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/).
- Für selbst gehostete Geocoding-Dienste kann `OSM_GEOCODING_URL` in der `.env` im Projektstamm festgelegt werden. Für die Standardeinstellung ist keine weitere Konfiguration erforderlich.
- Die Karte erfordert Internet, wenn die Kartengrafik noch nicht im Browsercache liegt. **Sammlungsdaten bleiben lokal**; die Kartendienst-Anbieter sehen die angeforderten Kartenausschnitte und bei einer ausdrücklich ausgelösten Suche den Namen der gesuchten Destillerie. Die App überträgt dabei **keine Sammlung, Flaschen, Inventarnummern oder Backup-Passwörter**.

## Technik und Navigation

- Der Hauptinhalt von **Landkarte** und **Sammlung** hat dieselbe Breite. Die Karte bleibt auf breiten Displays zweispaltig mit der Destillerienliste rechts; auf kleinen Displays stehen beide untereinander.
- Das Seitenmenü öffnet sich an der rechten Bildschirmkante neben dem rechten Menübutton. Karte und Einstellungen verwenden einheitlich „← Zur Sammlung“ als Rücksprung.
- Die Hauptnavigation ist in `public/js/navigation/pages.js` als erweiterbare Liste gepflegt. Die neue Seite hat den Browser-Link `/?view=map`. Direktes Öffnen und Zurück/Vorwärts funktionieren mit dem bestehenden Router.
- Der Hell-/Dunkelmodus wechselt auch das Kartenbild, Kartensteuerung und Quellenhinweis. Die OSM-Kacheln bleiben von derselben Quelle; nur ihre Darstellung wechselt. Das Mausrad zoomt um den Standort unter dem Mauszeiger, während die Plus-/Minus-Tasten und die Tastatur weiterhin um die Kartenmitte zoomen.
- Die SVG-/Marker- und Kachellogik liegt unter `public/js/features/map/tile-map.js`; die Aggregation und Positionsberechnung unter `public/js/domain/distillery-map.js`; die Ansicht unter `public/js/views/map.js`.
- Für weitere Seiten einen Eintrag in `pages.js`, einen Router-Fall in `routes.js` und eine View in `app.js` ergänzen; die **Analyse** ist bereits eine eigene Hauptseite mit sechs Unterseiten. Die bestehende einzeilige mobile Kopfzeile und die Schnellaktionen bleiben erhalten.

**Anmerkung:** Öffentliche OSM-Kachel- und Nominatim-Dienste sind Best-Effort-Dienste ohne Verfügbarkeitsgarantie. Bei dauerhafter hoher Nutzung sollte ein eigener oder kommerziell betriebener OSM-kompatibler Dienst konfiguriert werden.

**Legende (aktueller Stand):** Beide Statusgruppen verwenden dieselbe Reihenfolge und dieselbe Beschriftungsstruktur: **Mit Flaschen** → Aktiv / Geschlossen sowie bei aktiviertem Destilleriekatalog **Ohne Flaschen** → Aktiv / Geschlossen. Anschließend folgen die Flaschenzahl-Beispiele 1/10/100 und **Gruppiert** als goldener, runder Marker, dessen Zahl die addierten physischen Flaschen zeigt. Die Legende verwendet ein platzsparendes, responsives Flexlayout ohne freistehende Trennlinien oder ausgedehnte Leerflächen. Kreisfarbe und Rahmen entsprechen den tatsächlichen Kartenmarkern im Light- und Dark-Mode. Legendenbeispiele bleiben ohne Schatten, Glow und Filter.

**Lokalisierung ab v0.15.6:** Die Statusbeschriftungen in beiden Legendenabschnitten (Aktiv/Geschlossen bzw. Active/Closed) werden dynamisch aus dem jeweiligen Sprachkatalog bezogen; dasselbe gilt fuer Hinweise auf Standorte von Abfuellungen. Ein Unit-Test und ein gezielter Chromium-Test pruefen diese Beschriftungen mit `en.json`.

## Kacheln und Sicherheitsheader (v0.15.10)

Die Browser-CSP erlaubt Bilder von `https://tile.openstreetmap.org`.
`Referrer-Policy: strict-origin-when-cross-origin` ist bewusst gewaehlt:
OpenStreetMap verlangt bei Browser-Kacheln einen Referer und untersagt eine
Policy, die diesen komplett unterdrueckt.
Siehe https://operations.osmfoundation.org/policies/tiles/.
Die visuelle Browserabnahme nach CSP-Einfuehrung ist noch offen.
