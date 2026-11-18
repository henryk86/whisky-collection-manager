# Funktions- und Anforderungsspezifikation – Whisky Collection Manager

**Produktstand:** aktuelles Schema 5 · **Stand:** 16.11.2026 · **Datenformat:** `schemaVersion: 5`

Dieses Dokument beschreibt den **aktuellen Funktionsumfang und die einzuhaltenden Regeln**. Es ersetzt den früheren Entwurf vom 05.11.2026, der teilweise noch React/TypeScript, XLSX-Export und eine externen Such-API als Planung enthielt. Für tatsächlich ausgeführte Tests gilt [TESTSTATUS.md](TESTSTATUS.md), für ältere technische Entscheidungen [TESTHISTORIE.md](TESTHISTORIE.md).

## 1. Ziel und Betrieb

Private, responsive Webanwendung zur Verwaltung einer Whisky-Sammlung. Der Node.js-Server läuft lokal auf PC oder Raspberry Pi 4; die Oberfläche funktioniert in aktuellen Desktop- und Mobilbrowsern. Sammlungsdaten bleiben auf dem eigenen Server. Kamera-/Barcode-Funktionen benötigen im LAN HTTPS. **Kein allgemeiner Login:** Betrieb ausschließlich in einem vertrauenswürdigen Netzwerk, nicht direkt im öffentlichen Internet.

Es gibt keine zwingende Cloud, keine externe Datenbank und keinen Build-Schritt für das Frontend. Server und Oberfläche nutzen JavaScript mit nativen ES-Modulen; die Dateiablage wird in einer JSON-Sammlung verwaltet.

## 2. Datenmodell und Beziehungen

| Objekt | Struktur und wesentliche Felder | Fachregel |
| --- | --- | --- |
| Sammlung | `schemaVersion: 5`, `settings`, `reservedInventoryNumbers`, `distilleries[]`, `bottlings[]` | Eine zentrale, atomar gespeicherte `collection.json` |
| Destillerie | `id`, `name`, optional `country`, `region`, `status`, `latitude`, `longitude` | Stammdaten und geografische Herkunft; benutzerdefinierte Positionen haben Vorrang |
| Abfüllung | `id`, `distilleryIds[]`, `name`, `bottler`, `whiskyType`, `ageYears`, `abv`, Nenn-`volumeMl`, Fass- und Jahrgangsangaben, WB-ID / Quellenlink, `completionStatus`, `bottles[]`, `tastings[]` | Eine Abfüllung kann mehrere beteiligte Destillerien und beliebig viele physische Flaschen haben |
| Physische Flasche | `id`, `inventoryNumber`, `volumeType`, `volumeMl`, `status`, Preise/Kaufdaten, Öffnungsdatum, `photos[]`, `files[]` | Individuelle Eigenschaften liegen **nur** an dieser konkreten Flasche |

- `distilleryIds[]` ist die aktuelle Zuordnung, nicht das alte Einzel-Feld `distilleryId`. Mehrere Destillerien zählen in Herkunfts- und Kartenstatistiken jeweils als beteiligt, duplizieren aber keine Flaschen.
- `volumeType` ist `standard` oder `sample` **an der physischen Flasche**. Die Nennmenge einer Abfüllung ist kein Ersatz für die individuelle Flaschengröße.
- Die Inventarnummer ist ein eindeutiger **String**, damit führende Nullen erhalten bleiben. Früher verwendete Nummern bleiben im Verlauf hinterlegt und werden bei automatischen Vorschlägen übersprungen; eine manuelle Wiedervergabe ist erlaubt, sobald die Nummer keiner aktuellen Flasche mehr gehört. Bei gleichzeitig vorhandenen Flaschen bleibt die Nummer eindeutig; ein gescannter QR-/Barcode ist genau diese Inventarnummer, kein zweites Etikettenfeld.
- Fotos und Dokumente liegen als Dateien außerhalb der JSON und sind über relative Pfade den physischen Flaschen zugeordnet. Es gibt keine separate Ablage von Bildern auf Abfüllungsebene.
- **Herkunftsland und Whiskyregion werden aus den Destilleriestammdaten ermittelt**, nicht mehr im Abfüllungseditor eingegeben. Historische Abfüllungsfelder bleiben ausschließlich zur Kompatibilität lesbar. Schottische Standorte heißen **Schottland**, nicht UK/GB. Uneindeutige Regionen bleiben unbekannt.
- Die Validierung und Aktualisierung liegt in `server/domain/`, `server/services/` und `server/storage/`; Änderungen an `collection.json` sind atomar und erfolgen nach Validierung. Sammlungen der Schemaversionen 1 bis 4 werden nach Sicherung und Validierung migriert; alle Nicht-Verkostungsdaten und die gesamte Lagerdatei bleiben erhalten. Nur historische Verkostungsdaten entfallen.

## 3. Sammlung, Erfassung und Detailansichten

- **Neue Flasche:** bestehende Abfüllung suchen und weitere Flasche hinzufügen oder neue Abfüllung samt erster Flasche erstellen. Vorhandene Stammdaten werden bei einer zusätzlichen Flasche nicht überschrieben.
- **Übersicht:** Kachel- und Tabellenansicht, Ansichtsmodus Abfüllungen/physische Flaschen, Suche, Status, Destillerie und Flaschentyp, Sortierung, Pagination (12/24/48/96). Die Anzahl pro Seite bleibt nach F5 im selben Browser erhalten. Filter greifen vor der Pagination.
- **Destilleriefilter:** nur Destillerien mit mindestens einer erfassten Abfüllung; auch mehrfache Zuordnungen. Status- und Flaschentypfilter beziehen sich in Kombination auf dieselbe physische Flasche.
- **Detailseite:** Stammdaten und Fotos; bei physischen Flaschen mit Foto wird das erste Bild der gespeicherten Reihenfolge links groß gezeigt, die komplette bearbeitbare Fotogalerie bleibt direkt darunter. Ohne Fotos entfällt die Bildspalte. Status, Kauf-/Lagerdaten und Aktionen stehen daneben, Dateien/Nachweise unten über die ganze Kartenbreite. Alle physischen Flaschen behalten Inventarnummer und Bearbeitungsaktionen. Flaschenfotos lassen sich mit der Maus am Bild oder Sortiergriff ziehen, auf Touch-Geraeten am Griff umsortieren sowie ueber die Pfeilbuttons verschieben. Ein abgebrochener Drag aendert die Reihenfolge nicht. Kartenlink öffnet einen oder mehrere zugehörige Standorte.
- **Scanner:** QR-/Barcode-Etiketten mit manueller Eingabe als Rückfall. Bekannte Codes führen zur passenden Flasche; unbekannte können einer Flasche zugeordnet werden. Keine Funktion für Etikettengenerierung oder -druck.
- **Design:** Responsive Desktop-/Mobilansichten, Light/Dark Theme, einheitliche Icons. Mobile Eingaben und Dialoge dürfen auch bei schmalen Bildschirmen keinen horizontalen Überlauf auslösen. Das Erscheinungsbild der Sammlung ist Massstab: Inhaltsflaechen und Karten-/Formular-Panels in Analyse, Hilfe, Lager, Karte und Einstellungen verwenden einheitliche eckige Rahmen. Kleine Bedienelemente haben eine einheitliche, minimale Abrundung (2 px); absichtlich runde Elemente (Radio-Buttons, Kartensymbole, Kreischarts) behalten ihre Form. Die linke Bereichsnavigation ist pro Seite in ihrer Breite abgestimmt; lange Hilfe-Themen wechseln auf Tablets zum mobilen Auswahlfeld.
- **Hilfe:** Eigene, direkt aufrufbare Hilfeseite (`/?view=help`) mit Hauptnavigationseintrag in beiden Sprachen. Allgemeine Bedienhinweise, Datenhaltung und Backupgrundlagen stehen dort; auf den Arbeitsseiten verbleiben nur notwendige Eingabehinweise und sicherheitsrelevante Warnungen. Desktop: gemeinsame Seitennavigation mit Analyse und gerader goldener Aktivmarkierung ohne gerundete Flaeche; kleinere Bildschirme: Auswahlfeld. Die Anleitungen stehen unverkuerzt in nummerierten Inhaltsabschnitten.

### Interaktives Geschmacksprofil je Verkostung

- Jede Abfüllung besitzt **0–n eigenständige Verkostungen**. Jede Verkostung besitzt optional ein Geschmacksprofil mit zehn Achsen und ganzzahligen Ausprägungen zwischen 0 und 10.
- Achsen sind sprachneutral persistiert; die Anzeige übersetzt sie für Deutsch und Englisch. Insbesondere entspricht `feinty` der deutschen Beschriftung **„Alkoholisch“**.
- SVG mit Touch-/Zeigersteuerung und nativen Reglern erlaubt Bearbeitung in der Einzelverkostung; die Abfüllungsdetails zeigen nur die letzte Gesamtbewertung. Nicht erfasste Profile sind `null`, nicht acht automatisch gespeicherte Nullen.
- Details: [GESCHMACKSPROFIL.md](GESCHMACKSPROFIL.md).

## 4. Destilleriekatalog und Landkarte

- Der mitgelieferte Katalog enthält **450 Destillerien** mit Länderangaben und Kartenpositionen. Historische Standorte können nur näherungsweise lokalisiert sein; individuell gespeicherte Koordinaten haben Vorrang.
- Die Landkarte zeigt standardmäßig Standorte der Sammlung; optional alle Katalog-Destillerien, auch ohne Bestand (Pagodendach-Icons). Aktive und geschlossene Standorte sind unterscheidbar. Beim Ein- und Ausschalten des Gesamtkatalogs bleiben die aktuelle Position und Zoomstufe unverändert; nur der eigene Fit-Button passt den Ausschnitt neu an.
- Bestandsmarker zeigen **physische Flaschen**, Cluster die addierte Flaschenzahl. Beim maximalen Zoom werden alle Destillerien einzeln auswählbar. Die Kartenlegende verwendet kompakte, runde Gruppenmarker ohne Schatten/Glow in den Beispielen.
- Destillerien lassen sich manuell verorten oder **auf Benutzeraktion** über eine einzelne OpenStreetMap-Nominatim-Suche finden. Kein Massengeocoding und kein Vorabladen aller Kacheln. OSM-Attribution muss sichtbar sein.
- Lange Standortlisten sind durchsuchbar und paginiert. Abfüllungsnamen erhalten, soweit vorhanden, Alter, ABV und Destillations-/Abfülljahr zur Unterscheidung.

Siehe [KARTE.md](KARTE.md) für Detailregeln und Datenschutz.

## 5. Optionaler externer Abfüllungsdatenimport

- Die öffentliche App enthält keinen Quellseitenparser, keine Browser-Erweiterung und keine Import-Schaltfläche im regulären Formular.
- Externe Anwendungen können einmalig ein URL-Fragment `#wcm-import=` mit URL-kodiertem JSON übergeben. Zulässig ist **nur** das Schema `version: 2` mit `source: "external"` und `fields`.
- Bei gültigen Importdaten erscheint eine Auswahlvorschau, in der technische Felder und Destillerien einzeln bestätigt werden. Erst das Speichern im Editor persistiert die Auswahl.
- WB-ID und Quellenlink bleiben als Stammdatenfelder sowie in vorhandenen Sammlungen erhalten. Das Dublettenverhalten wird anhand der ID geprüft.
- Die bisherige HTML-Import-API und frühere Fragmentformate sind ersatzlos entfallen. Temporärer Bildtransfer über den vorhandenen Stage-Endpunkt ist optional weiterhin möglich.
- Externe Programme sind nicht Bestandteil der öffentlichen App. Für fremde Texte und Bilder bleiben die jeweiligen Nutzungsrechte maßgeblich. Details: [Architektur](ARCHITEKTUR.md#externe-importdaten).

## 6. Analysebereich

Dashboard mit **sechs Unterseiten und 38 Auswertungen**: Sammlungsbestand, Herkunft/Destillerien, Whiskyprofil, Finanzen, Entwicklung/Verkostung und Datenqualität. Gemeinsame Filter gelten unterseitenübergreifend. Abfüllungen und physische Flaschen müssen fachlich unterschieden werden; unbekannte Werte werden nicht erfunden oder als Null interpretiert.

- Originalabfüllungen umfassen insbesondere den Abfüllerwert **„Distillery Bottling“** sowie passende Destillerienamen.
- Preise verschiedener Währungen werden nicht ohne nachgewiesenen Kurs addiert; ausgewiesen werden dokumentierte Ausgaben, nicht Marktwerte.
- Zeitraumdiagramme aggregieren nach Monat oder Jahr. **„Von“ und „Bis“ sind einzelne Datumsfelder mit Tagespräzision** (`JJJJ-MM-TT`), die Auswahl wirkt vor der zeitlichen Aggregation; leere Grenzen bedeuten keine Begrenzung. Summen für die gesamte Sammlung bleiben von diesen Zeitgrenzen unberührt.
- Diagramme verlinken, soweit sinnvoll, zu passenden Filtern oder Detailseiten. Analyse, Hilfe, Einstellungen und Lager verwenden dieselbe linke Bereichsnavigation und bei schmalen Ansichten einen Themenwähler; der aktive Bereich muss erkennbar bleiben.

Details der Kennzahlen: [ANALYSE.md](ANALYSE.md).

### Eigenständige Verkostungen

- Eine Abfüllung hat 0–n einzeln datierte und unabhängige Verkostungen.
- Jede Verkostung enthält Datum, optionalen Titel, Farbe, zehn Geschmacksachsen,
  Notizen (Nase, Geschmack, Abgang) und eine optionale Bewertung 0–100.
- Die Abfüllungsdetails zeigen die Bewertung der Verkostung mit dem jüngsten Datum;
  eine unbewertete jüngste Verkostung bleibt unbewertet.
- Verkostungen lassen sich in eigenen Ansichten erstellen, bearbeiten und nach
  Bestätigung im Anwendungsmodal löschen. Keine neue Migration bestehender
  Abfüllungsbewertungen oder Verkostungsnotizen in `tastings[]`.
- Analysen berücksichtigen die **letzte Bewertung je Abfüllung**, nicht alle
  Verkostungen einzeln.

## 7. Lagerverwaltung

- Jeder Raum enthält Möbel, jedes Möbel Fächer. Die Zuordnung einer Flasche erfolgt über stabile IDs in der getrennten `warehouse.json` (Schema 1).
- 3D ist die Standard-Raumansicht; der 2D-Grundriss dient zum Positionieren und zeigt 10-cm-Rasterlinien mit 50-cm- und Meter-Hervorhebungen. Ausblenden und Mehrfachauswahl sind unabhängig.
- Kollisionsregeln prüfen rotierte Grundflächen **und** Höhenbereiche. Höher angebrachte Möbel dürfen dieselbe Grundfläche teilen, solange sich ihre Höhenbereiche nicht überlappen. Ungültige Mehrfachänderungen werden vollständig verworfen.
- Fächer können offen, mit Holz-/Glastüren oder Schubladen ausgestattet und in ihrer Höhe festgelegt werden. Türbereiche dürfen mehrere aufeinanderfolgende Fächer umfassen; Seitenwände und Rückwand sind unabhängig steuerbar.
- Kapazität `null`/leer bedeutet unbegrenzt, `0` verbietet Flaschen, positive Ganzzahlen geben ein Maximum an. Belegte Lagerorte können nicht gelöscht werden.
- Nach Kapazitätsänderungen muss die bereits geöffnete Möbelansicht sofort die neue Kapazität und Belegung anzeigen. Fachbearbeitung ermöglicht Vorheriges/Nächstes und fragt bei ungespeicherten Werten per Anwendungsmodal nach Speichern, Verwerfen oder Abbrechen.
- Möbel können bis zu 24 eigenständige Fotos besitzen, die unter der Regaldarstellung mit denselben Hinzufügen-/Aufnehmen-Aktionen wie Flaschen angezeigt werden. Die Dateien liegen im normalen Bildspeicher und müssen vollständig gesichert und wiederhergestellt werden. Möbelkopien übernehmen keine Fotos.
- Die Lagerdatei ist Teil eines vollständigen Backups, nicht des reinen Collection-JSON-Exports. [Lagerdetails](LAGER.md).

## 8. Sicherung, Import und Export

- JSON-Export der Sammlung, CSV-Export und vollständige AES-256-verschlüsselte ZIP-Sicherungen. **Es gibt derzeit keinen eigenständigen XLSX-Export**; XLSX ist lediglich als Dateianhang an physischen Flaschen erlaubt.
- Manuelle und geplante Sicherungen verwenden dasselbe ZIP-Format. Profile für USB/NAS und Rclone-Ziele sowie Wiederherstellungs-Vorschau sind vorhanden. Separate Admin-Token- und Backup-Passwortverwaltung.
- JSON-Import ersetzt strukturelle Daten nach Validierung, ersetzt aber keine vollständige Wiederherstellung mit Bildern. Eine vollständige Wiederherstellung erfolgt über das ZIP.
- Auf dem Raspberry Pi liegen persistente Daten und Secrets **außerhalb des Git-Repositories** unter `WCM_DATA_DIR` (Vorgabe `$HOME/whisky-collection-manager-data`). Das Setup migriert alte `deploy/`-Laufzeitordner nicht automatisch.
- Die technische Hilfe behandelt Administrator-Schlüssel, zentrales ZIP-Passwort (getrennt von Cloud-Zugangsdaten), USB, NAS, Dropbox, OneDrive, weitere Rclone-Ziele, Zeitpläne, Prüfung und Restore in aufklappbaren Abschnitten.
- Bei geöffnetem Modal darf auf iOS der Seitenhintergrund nicht mitgescrollt werden; der Modalinhalt bleibt scrollbar und die Ausgangsposition wird nach dem Schließen wiederhergestellt.
- Der Docker-Service `app` stellt HTTPS auf 3543 bereit. Der Backup-Worker läuft im selben Container. Kein allgemein erreichbarer HTTP-Server ohne zusätzliche Zugriffskontrolle.

Siehe [DOCKER_BACKUP.md](DOCKER_BACKUP.md) und [API.md](API.md).

Die Anwendung nutzt auf iOS ein eigenes Apple-Touch-Icon. Bereits zum Home-Bildschirm hinzugefuegte PWAs koennen ihr bisheriges Symbol bis zur erneuten Installation zwischenspeichern.

## 9. Entwicklung, Qualität und Releases

Quellcodeänderungen werden auf `develop` gesammelt, ohne fuer jeden Commit die Version zu erhoehen. Commit-Nachrichten verwenden Conventional Commits (`fix`, `feat`, `!`/`BREAKING CHANGE`). Erst der **manuell freigegebene PR-Merge `develop -> main`** loest einen gemeinsamen Release-Snapshot aus: Der hoechste Aenderungstyp bestimmt genau einen Patch-, Minor- oder Major-Sprung. Der neue Stand wird aus dem getaggten Snapshot ueber einen geschuetzten Versions-PR auf `main` und anschliessend nach `develop` synchronisiert; historische Versionsangaben in Fachdokumenten werden dabei nicht umgeschrieben.

`npm run check`, `npm test`, `npm run release:check` und für Browserfunktionalität `npm run test:browser` sind getrennt auszuwerten. Bestandenes Unit-Testing ist kein Nachweis für Browser- oder Hardware-Kompatibilität. Der aktuelle Prüfstatus einschließlich offener iOS-/Android-Abnahmen steht in [TESTSTATUS.md](TESTSTATUS.md). Weitere technische Hinweise: [ARCHITEKTUR.md](ARCHITEKTUR.md) und [RELEASE_WORKFLOW.md](RELEASE_WORKFLOW.md).


## Mehrsprachige Fehlermeldungen

- UI-Validierungs- und Bildverarbeitungsfehler nutzen stabile Übersetzungsschlüssel (`de`, `en`).
- API-Validierungsfehler erhalten einen stabilen `errorCode`; das Frontend lokalisiert anhand dieses Codes.
- Der englische API-Text dient als Standard-Fallback und wird nicht als Übersetzung per Textvergleich genutzt.
- Unbekannte serverseitige Fehler zeigen weder deutsche Rohtexte noch interne Diagnoseinformationen, sondern eine neutrale, lokalisierte Meldung.

## Verkostungsnotizen

- Die Hauptnavigation enthält eine eigene Verkostungsstartseite mit gemeinsamer chronologischer Liste; als Seitenicon wird das bestehende Glencairn-Bewertungsglas verwendet.
- Für Sammlungsabfüllungen sind 0–n Verkostungen möglich. Übersichts- und Einzelverkostungsseite zeigen allgemeine Seitentitel ohne Icons. Die Abfüllung erscheint im ersten Informationsblock mit vorhandenen Angaben zu Alter, Fasstyp und Alkoholgehalt. Zurück-Links befinden sich oberhalb der vollständigen Seitenüberschrift.
- Für Whiskys außerhalb der Sammlung entsteht **ein einzelner Verkostungseintrag** mit eingebetteten Abfüllungsdaten. Eine externe Abfüllung als verwaltbares Objekt sowie Mehrfachverkostungen sind nicht vorgesehen.
- Eine externe Verkostung verlangt einen Abfüllungsnamen und kann optional Destillerie, Abfüller, Alter, Alkoholgehalt und Abfülljahr enthalten. Sie verändert weder Sammlung noch Bestandsanalysen.
- Geschmacksprofil samt Radar und Reglern kann vollständig zurückgesetzt und wiederhergestellt werden.
- Die Übersicht verwendet vollständig anklickbare Zeilen wie „Lager → Flasche finden“. Das Glencairn-Symbol wird in der Seitennavigation mit angeglichener Strichstärke verwendet.
- Die letzte Bewertung wird in der Sammlungsübersicht als fünf anteilig gefüllte Glencairn-Gläser auf dem Flaschenbild angezeigt und lässt sich über einen Bewertungs-Schnellfilter eingrenzen.
- Externe Einzelverkostungen lassen sich ohne Duplikat einer vorhandenen Sammlungsabfüllung zuordnen; ihre ID und Verkostungsdaten bleiben erhalten.
- Globaler App-Header und vorhandene Abfüllungsdetailseite werden durch diese Funktion nicht verändert.


### Optionale Tasting-Flights

- Ein Tasting-Flight gruppiert bereits vorhandene oder neu erstellte Verkostungsnotizen aus der Sammlung und von externen Whiskys; jede Notiz gehört zu höchstens **einem** Flight.
- Ein Flight besitzt einen Namen, ein Datum, eine optionale gemeinsame Notiz und eine **explizit geordnete** Liste von Verkostungs-IDs. Positionen können auf- und abwärts verschoben werden. Wiedereinstieg oder direktes Öffnen muss möglich sein.
- Einzelne Verkostungsdaten bleiben an ihrem ursprünglichen Ort, inklusive ihrer individuellen Bewertung und der bestehenden „letzte Verkostung“-Regel. Ein Flight hat **keine** neue Gesamtbewertung und erfasst keine einzelnen Schluckwechsel.
- Eine aus dem Flight heraus neu angelegte Sammlungs- oder externe Verkostung wird in einer atomaren Speicherung erzeugt und angehängt.
- Wird eine externe Verkostung später einer eigenen Abfüllung zugeordnet, bleibt ihre Flight-Position erhalten. Beim Löschen eines einzelnen Eintrags wird sein Flight-Verweis entfernt. Beim Löschen eines Flights bleiben alle verkosteten Einträge bestehen.
- Die Anzeige von Namen/Bewertung in der mobilen Verkostungsliste erhält genügend Platz und vermeidet Umbruch einzelner kurzer Wörter.
