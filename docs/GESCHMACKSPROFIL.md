# Geschmacksprofil und eigenständige Verkostungen (v0.26.0)

Pro Abfüllung sind **0–n unabhängige Verkostungen** erlaubt. Eine Verkostung gehört
zur Abfüllung, nicht zu einer physischen Flasche. Das bisherige Profil-, Farb-,
Notiz- und Punkte-UI aus v0.25.5 wird je Verkostung unverändert wiederverwendet.

## Aufruf und Navigation

- Abfüllungsdetails `/?bottling=<id>`: Kompakte Zusammenfassung. Bei 0 Einträgen
  erscheint „Noch keine Verkostung“ mit „Erste Verkostung erfassen“.
- Bei einem Eintrag öffnet „Verkostung anzeigen“ direkt diesen Eintrag.
  Bei mehreren Einträgen öffnet „Alle Verkostungsnotizen“ die chronologische Liste.
- Übersicht `/?bottling=<id>&view=tastings`: Neueste Verkostung zuerst; pro Zeile
  Datum, optionaler Titel, Bewertung und ein Löschen-Button. Löschen benötigt
  eine Bestätigung im **Anwendungsmodal** und ist abbrechbar.
- Einzelverkostung `/?bottling=<id>&tasting=<tastingId>`: Datum, optionaler Titel,
  Farbe, Geschmacksprofil, Nase, Geschmack, Abgang und Gesamtbewertung.
  Neue Datensätze erscheinen erst, nachdem „Verkostung speichern“ geklickt wurde.
  Bestehende Verkostungen öffnen grundsätzlich in einer reinen Leseansicht. Erst
  über den Stift-Button „Bearbeiten“ im ersten Datenblock werden Datum, Titel, Farbe, Profil, Notizen
  und Bewertung editierbar; „Fertig“ wechselt zurück in die Leseansicht.
  Änderungen im Bearbeitungsmodus werden automatisch gespeichert.
- Die Browsernavigation und direkte Aufrufe über die URL werden unterstützt.

## Letzte Bewertung

Maßgeblich ist das **neueste Verkostungsdatum**, nicht das Bearbeitungsdatum.
Bei gleichem Datum entscheidet zuerst der Erstellungszeitpunkt und danach die ID.
Die Bewertung der letzten Verkostung erscheint lesend in den Abfüllungsdetails.
Ist die neueste Verkostung nicht bewertet, wird „Nicht bewertet“ angezeigt;
ältere Punktzahlen werden **nicht** als Ersatz verwendet.
Die Analysen berücksichtigen höchstens die aktuelle Bewertung *einer* Abfüllung
und gewichten mehrfache Verkostungen nicht stärker.

## Eingaben

| Schlüssel | Bereich |
| --- | --- |
| `tastedOn` | Pflichtdatum `YYYY-MM-DD` (beim Anlegen mit lokalem Datum vorbefüllt) |
| `title` | Optionaler Titel mit maximal 120 Zeichen |
| `tastingNotes` | `nose`, `palate`, `finish`, beliebige Textlängen |
| `rating` | `null` oder 0–100 mit höchstens einer Nachkommastelle in der UI |
| `whiskyColor` | Eine der zwölf unveränderlichen Farben oder `null` |
| `flavorProfile` | `null` oder genau acht ganzzahlige Achsen (0–10) |

Die Profilachsen sind im JSON fest: `woody`, `cereal`, `peaty`, `fruity`,
`floral`, `winey`, `feinty`, `sulphury`. Sie entsprechen Holzig, Getreidig,
Torfig, Fruchtig, Floral, Weinartig, Alkoholisch und Schwefelig.

Das Radardiagramm und die acht Regler bleiben gemeinsam in einem Panel, die
zwölf Farben in ihrem eigenen Panel. Notizen und Punkte erscheinen darunter.
Die gewählte Farbe ist durch goldene Hervorhebung und Häkchen kenntlich;
Entfernen-Schaltflächen befinden sich rechts in den jeweiligen Überschriften.
Die fünf Glencairn-Gläser geben je bis zu 20 Punkte vor und zeigen Bruchteile
mit anteiliger Füllhöhe. Die Punktzahl wird ausschließlich über das editierbare
Feld mit `/ 100` dargestellt. Rückgängig/Wiederholen wird für jede geöffnete
Verkostung separat verwaltet.

## Datenmodell und Kompatibilität

- Die Daten stehen in `bottlings[].tastings[]` innerhalb von `collection.json`.
  Jeder Eintrag enthält eine unveränderliche ID und zwei Zeitstempel.
- **Keine neue Migration:** Bisher gespeicherte Abfüllungswerte und archivierte
  `legacyTastings` werden nicht in neue Verkostungen umgewandelt. Das bestehende
  Archiv bleibt auf der Abfüllungsdetailseite abrufbar.
- `schemaVersion: 4` bleibt bestehen. Ältere Sammlungen ohne `tastings[]` sind
  gültig. Für Abfüllungen mit neuen Verkostungen werden die bisherigen
  Abfüllungswerte (`rating`, `tastingNotes`, `whiskyColor`, `flavorProfile`) als
  schreibgeschützte Kompatibilitätsprojektion der neuesten Verkostung gepflegt.
- JSON-/ZIP-Exporte und Wiederherstellung enthalten alle Verkostungen.
  Physische Flaschen, Bilder, Kaufdaten und Lagerungen bleiben unverändert.

## Technische Bausteine

- Daten: `public/js/domain/tasting-records.js`, `server/services/tastings.js`
  und `server/domain/validation.js`.
- UI: `public/js/views/tastings.js` und die Zusammenfassung in
  `public/js/views/detail.js`.
- Unveränderte Controls: `public/js/ui/flavor-profile.js`,
  `public/js/ui/whisky-color-selector.js` und
  `public/js/ui/glencairn-rating.js`.
- Historie: `public/js/domain/tasting-history.js`, zustandsbezogen je Eintrag.
- Tests: `tests/unit/tasting-records.test.js`,
  `tests/integration/tastings.test.js` und `tests/browser/app.test.js`.

## v0.27.2: einheitliche Verkostungsansichten

Die Verkostungsstartseite verwendet die gleichen Überschriftenabstände wie die
anderen Hauptseiten. Das Glencairn-Glas dient als Menüicon; der Seitenheader
selbst enthält kein Icon.
Sie listet alle datierten Verkostungen gemeinsam auf. Für eine Abfüllung aus
der Sammlung existiert eine eigene Verkostungsliste (0–n); Listen- und
Einzelverkostungsseite zeigen die Abfüllung samt vorhandenen Angaben zu Alter,
Fasstyp und Alkoholgehalt. Die Zurück-Navigation nutzt sichtbare
Linkspfeile. Die eigentliche Abfüllungsdetailseite bleibt unverändert.

Bei Whisky außerhalb der Sammlung ist eine Verkostung dagegen **ein einzelner
Datensatz** (`externalTastings[]`) mit eingebetteten Abfüllungsangaben. Es gibt
weder eine externe Abfüllungsverwaltung noch eine weitere Verkostungsliste je
externem Whisky. Diese Einträge beeinflussen den Bestand und dessen Analysen
nicht und sind trotzdem im Backup enthalten. Es findet keine Migration statt.

Auf jeder Einzelverkostungsseite kann das Geschmacksprofil mit „Profil
zurücksetzen“ vollständig entfernt werden (`flavorProfile: null`), statt acht
Nullwerte zu speichern. Die Rückgängig-/Wiederholen-Funktion bleibt erhalten.

## v0.27.3: Seitenhierarchie und Ausrichtung der Notizfelder

Die Verkostungsstartseite, die Übersicht einer Abfüllung und die einzelne
Verkostung verwenden die vorhandenen Seitenheader-Klassen und Abstände ohne
zusätzliche Symbole im Titel. Die untergeordneten Seiten tragen allgemeine
Überschriften (z. B. „Verkostungsübersicht“, „Verkostung erfassen“ oder
„Verkostung bearbeiten“); die konkrete Abfüllung steht mit ihren vorhandenen
Stammdaten im **ersten Informationspanel** unterhalb des Headers. Bei externen
Verkostungen sind die ergänzenden Abfüllungsfelder direkt dort editierbar.
Der globale App-Header und die Abfüllungsdetailseite bleiben unverändert.

Nase, Geschmack und Abgang bleiben nebeneinander, solange der verfügbare
Bildschirmplatz dies zulässt. Jedes Feld und sein Label sind am oberen Rand
ausgerichtet: Vergrößert man ein Textfeld, werden die benachbarten Felder
nicht nach unten verschoben oder gestreckt. Auf schmalen Bildschirmen stehen
die Felder weiterhin untereinander.

## v0.27.4: Navigation, Listen und externe Abfüllungsangaben

Der Zurück-Link (sichtbarer Pfeil links) steht auf den untergeordneten
Verkostungsseiten als eigene Navigationszeile **direkt unterhalb des
Seitenheaders** und vor dem Abfüllungsblock. Der erste Informationsblock
zeigt den Abfüllungsnamen und die verfügbaren Daten **ohne weitere
„Abfüllungsangaben“-Überschrift**. Die Überschriften der Haupt- und
Unterseiten verwenden unterschiedliche, nicht redundante Bezeichnungen
(Journal / Verkostungsnotizen / Einträge; Notizen / Verkostung bearbeiten / Eindrücke).

Die globale Verkostungsübersicht und die Liste innerhalb einer Abfüllung
verwenden die Rahmen-, Trennlinien- und Zeilenstruktur von
**Lager → Flasche finden**. Datum, Bezeichnung und Bewertung sind
sofort sichtbar; Öffnen und gegebenenfalls Löschen erfolgen über
separate Zeilenaktionen.

Für eine neue Verkostung außerhalb der Sammlung werden die zusätzlichen
Abfüllungsangaben einmalig im ersten Formularblock erfasst. Beim erneuten
Öffnen erscheinen diese Angaben lesend (Name, verfügbare Metadaten);
ein Bearbeiten-Button mit dem gemeinsamen Stift-SVG schaltet ausschließlich
diesen Block in einen Bearbeitungsmodus mit **Speichern** und **Abbrechen**.
Abbrechen verwirft unveröffentlichte Eingaben. Die Verkostung selbst bleibt
weiterhin eigenständig editierbar. Es wird keine externe Flasche in der
Sammlung angelegt, und es findet keine Migration statt.

Die globale App-Kopfzeile und die vorhandene Abfüllungsdetailseite bleiben
im Quellcode unverändert.

### Änderungen in v0.27.5

- Die Hauptseite trägt den Namen „Verkostungsnotizen“ (englisch „Tasting notes“). Unterseiten haben Zurück-Links vor dem Seitenkopf. Verkostungseinträge sind als ganze Zeilen anklickbar und per Tastatur bedienbar.
- Die letzte Bewertung einer Sammlungsabfüllung wird zusätzlich als fünf proportional gefüllte Glencairn-Gläser im Flaschenbild dargestellt; der Schnellfilter bietet fünf Punktbereiche und „Nicht bewertet“.
- Eine externe Einzelverkostung kann einer bestehenden Sammlungsabfüllung zugeordnet werden. Der Server verschiebt den Datensatz atomar, erhält ID, Datum, Notizen, Farbe, Radarprofil und Punkte; die jüngste Verkostung bestimmt weiterhin die Bewertung der Abfüllung.

### Darstellung in v0.27.6

- Bestehende eigene und externe Verkostungen zeigen zunächst Datum, Titel, Farbe,
  Radar, Notizen und gefüllte Bewertungs-Gläser ohne Eingabefelder. Ein Stift-Button
  öffnet den bisherigen Editor; die Neuerfassung bleibt direkt bearbeitbar.
- Im ersten Infoblock einer Sammlungsabfüllung führt „Zu den Abfüllungsdetails“
  direkt zur vorhandenen Abfüllungsdetailseite. Für externe Einträge erscheint
  dieser Button nicht.

- Die Abfüllungsinformation auf den Verkostungsseiten zeigt, wenn vorhanden, dasselbe Abfüllungsfoto wie die Abfüllungsdetailseite kompakt neben Name und vorhandenen Stammdaten. Die dort verwendete Bildauswahl und Freistellung bzw. Bildbearbeitung wird unverändert übernommen. Bei Abfüllungen ohne Foto wird kein leerer Bildbereich erzeugt.
- Die fünf Glencairn-Gläser im Flaschenbild der Sammlungsübersicht bleiben proportional gefüllt, aber ohne dunkles Badge, Hintergrund, Rand oder Panel-Schatten. Lediglich die Glassymbole haben eine leichte Schattierung zur Erkennbarkeit.

## Bedienoberflaeche v0.27.8

In den Abfuellungsdetails steht „Neue Verkostung“ oberhalb der Bewertungskachel auf Hoehe der Abschnittsueberschrift (wie „Weitere Flasche“). In den Verkostungslisten steht die Anlegeaktion innerhalb des jeweiligen Listenblocks. Im Bearbeitungsmodus sind Datum (schmal), Titel (breit) und Aktionsbuttons in einer Zeile im ersten Eingabeblock angeordnet, auf kleinen Displays responsiv umgebrochen. Der Abschnitt "Eindruecke" verwendet denselben Abstand zum darunterliegenden Block wie die anderen Abschnitte. Anlegeaktionen verwenden ein gemeinsames SVG-Plus. Die Glencairn-Anzeige in Sammlungsbildern ist mit etwas mehr Abstand zum rechten Bildrand ausgerichtet.
