# Archiv der Testberichte

Diese historischen Protokolle wurden aus `docs/TESTSTATUS.md` ausgegliedert. Das Archiv bleibt bewusst unverändert, wenn eine neuere Version veröffentlicht wird. Aussagen zu damals implementierten Formen, Groessen und Testlaeufen gelten ausschliesslich fuer die jeweilige Version. Sie beschreiben **nicht** den aktuellen Projektstand und wurden beim Ausgliedern nicht erneut verifiziert. Den gueltigen aktuellen Teststatus enthaelt [TESTSTATUS.md](TESTSTATUS.md).

---

## Nachtrag v0.16.3 - Isolierung und Geraderichten (12.11.2026)

- `npm test` 369/369, 3 gezielte Chromium-DOM-Tests bestanden. Die zentrale zusammenhängende Komponente wurde in der gespeicherten PNG-Maske isoliert, um kleine Schräglagen gedreht und eng auf 2:3 zugeschnitten.
- Noch enthalten war ein teils breiter weichgezeichneter Rand der Segmentierungsmaske; v0.16.4 reduziert diesen gezielt im finalen Alphakanal. Reale Modell-Inferenz und Glasqualitätsprüfung weiterhin offen.

## Nachtrag v0.16.2 - Freistellungs-Zuschnitt und Bildvorschau (12.11.2026)

- `npm test` 365/365, zwei gezielte Chromium-DOM-Tests bestanden. Original und bereits gespeicherte Freistellung konnten im Dialog in Desktop-/Mobilbreiten vollständig angezeigt werden.
- Der Zuschnitt basierte auf der größten zusammenhängenden Komponente zur Größenbestimmung, verwendete bei der tatsächlichen Komposition jedoch noch die ursprüngliche unbereinigte Alphamaske. Lose Fragmente konnten deshalb weiterhin im PNG sichtbar bleiben; dies wird mit v0.16.3 korrigiert.
- Echte U²-Netp-/ONNX-Inferenz mit unterschiedlichen Whiskyflaschen-Fotos war weiterhin nicht lokal abgeschlossen.

## Nachtrag v0.15.15 - Scrollbar, 3D und README-Galerie (12.11.2026)

- `npm test` 354/354, fünf gezielte Chromium-DOM-Pruefungen bestanden; die vollstaendige Browser-Suite sowie echte 3D-WebGL-Abnahme wurden nicht abgeschlossen.
- Die README-Galerie zeigt im Repository gespeicherte Demo-Screenshots. Die urspruengliche Chat-Antwort mit fremden Beispielbildern war nicht die README-Galerie.

## Nachtrag v0.15.14 - Browser-Ueberlaufkorrektur (12.11.2026)

- `npm test` 353/353, gezielte Chromium-DOM-Tests 9/9 bestanden.
- Die volle Browser-Suite wurde nicht abgeschlossen; HTTP-/WebGL-Abnahme offen.
- Die unter v0.15.14 noch verwendete Root-Regel `scrollbar-gutter: stable`
  erzeugte auf kurzen Seiten rechts einen hellen Streifen. v0.15.15
  ersetzt sie durch eine permanent reservierte Scrollbar-Spur.

## Nachtrag v0.15.13 - CI-Regression im Ueberlaufstest (12.11.2026)

- `npm run check`, `npm test` (**353/353**) und `npm run release:check`
  bestanden lokal. In GitHub Actions scheiterte danach der neue Test fuer
  8 px horizontalen Ueberlauf: `withOverflow` blieb 0, weil
  `body.clientWidth` unter `scrollbar-gutter: stable` die 320 px
  Fensterbreite meldete, obwohl der Body nur 305 px breit war. Der
  absolute Probe-Block war ebenfalls keine zuverlaessige Scrollbreitenprobe.
- v0.15.14 korrigiert beide Ursachen und ergaenzt Browserpruefungen im
  DOM-Modus; der regulaere GitHub-Actions-Lauf bleibt separat zu bestaetigen.

## Nachtrag v0.15.11 - Security-Review-Nachpruefung (12.11.2026)

- `npm run check`, `npm run release:check` und `npm test` bestanden
  (**351/351** Node-Tests). Die lokale vollstaendige HTTP-Chromium-Suite
  wurde nicht abgeschlossen.
- Im spaeteren GitHub-Actions-Browserlauf schlug der bereits bestehende
  Breitentest fuer Sammlung/Landkarte bei 320 px fehl: Der Test erwartete
  320 px `main`-Breite, obwohl `scrollbar-gutter: stable` auf klassischen
  Scrollbar-Systemen 15 px reserviert (tatsaechlich 305 px). Der Test
  wurde in v0.15.12 an die nutzbare Dokumentbreite angepasst; die CSS-
  Regel und das Seitenlayout wurden nicht geaendert.

## Nachtrag v0.15.10 - Security-Review (12.11.2026)

- `npm run check`, `npm run release:check` und `npm test` bestanden
  (**347/347** Node-Tests). CSRF-/Host-Schutz, CSP-Header, CSV-Formelschutz,
  Datei-Streamhandling und schnellere Lagerzuweisung getestet.
- Vollstaendige Chromium-Suite, echte CSP-/Scanner-/WebGL-Abnahme,
  Windows-/Firefox-Gutter-Pruefung und Pi-Docker-Deployment **nicht lokal
  ausgefuehrt**. Es handelt sich nicht um bestandene Browserpruefungen.

## Nachtrag v0.15.9 - Stabiler Scrollbar-Gutter (12.11.2026)

- `npm run check`, `npm test` (**338/338**) und `npm run release:check`
  bestanden. Die damalige Angabe **„Gezielter Chromium-Test 1/1 bestanden“
  ist als Wirksamkeitsnachweis nicht belastbar**: Headless-Chromium verbarg
  standardmaessig die Scrollbars (`--hide-scrollbars`); die Messung haette
  auch ohne `scrollbar-gutter: stable` bestanden. Der Test wurde in v0.15.10
  mit echtem Gegenversuch korrigiert, aber dort nicht im Browser ausgefuehrt.


## Nachtrag v0.8.17 - Kompakte Kartenlegende (08.11.2026)

- Die Legende richtet Abschnitte wieder an der Inhaltsbreite aus und vermeidet große Leerflächen bei wechselnder Kartenbreite.
- Statusanzeigen und Flaschenzahlbeispiele wurden platzsparend gestaltet; ihre Unterschiede bleiben erkennbar und die Statusbeschriftungen einheitlich.
- Cluster sind auf Karte und in Legende wieder rund und durch Gold gegenüber einzelnen Destillerien abgegrenzt. Beide Themes verwenden dieselben Farben; keine Schatten/Glow in der Legende.
- `npm run check`, `npm run release:check` und `npm test` erfolgreich (230/230 Unit- und Integrationstests). Die lokale Browserdarstellung konnte nicht verifiziert werden, da Chromium hier nicht erfolgreich startete.

## Nachtrag v0.8.16 - Einheitliche Statuslegende und Hexagon-Cluster (08.11.2026)

- Beide Statusgruppen zeigen eine Rubrik („Mit Flaschen“/„Ohne Flaschen“) und darunter dieselben Bezeichnungen „Aktiv“/„Geschlossen“.
- Goldene Cluster werden auf Karte und in der Legende als Sechseck dargestellt. Die Zahl bleibt die addierte physische Flaschenzahl.
- Responsives Raster ohne isolierte vertikale Trennlinien; Clusterfarben sind in beiden Themes konsistent, Legendensymbole ohne Schatten.
- `npm run check`, `npm run release:check` und `npm test` bestanden (230/230 Unit- und Integrationstests). Browser-Tests in dieser Umgebung nicht ausgefuehrt (fehlendes `playwright-core`; Chromium-Start schlug fehl).

## Nachtrag v0.8.15 - Kartenlegende mit Status und echten Groessen (08.11.2026)

- Bestueckte Destillerien erhalten eigene Legendenbeispiele fuer aktive (blau/solide Kontur) und geschlossene Standorte (grau/gestrichelte Kontur); die Flaschen-Skalierung zeigt die Zahlen 1/10/100 direkt im Marker.
- Einzelmarker-Beispiele verwenden unverkleinert die produktiven Durchmesser 31/43/59 px. Die Cluster-Beispielgroesse wird ueber dieselbe Funktion wie die Karte berechnet; die Darstellung bleibt ohne Schatten/Glow in Hell- und Dunkelmodus.
- Reihenfolge: Status mit Flaschen, Flaschenzahl, Gruppiert, optional unbestueckte Destillerien. Die Karte und die Sammlungsdaten bleiben unveraendert.
- `npm run check`, `npm run release:check` und `npm test` erfolgreich (230/230 Unit- und Integrationstests). Browser-Regressionspruefung erweitert; wegen fehlendem `playwright-core` konnte sie lokal nicht ausgefuehrt werden.

## Nachtrag v0.8.14 - Kartenlegende vereinfacht (08.11.2026)

- Reihenfolge der Legende: Flaschen-Skalierung 1/10/100, dann Cluster „Gruppiert“, und nur bei aktivierter Gesamtkataloganzeige die zwei Pagodenmarker fuer Destillerien ohne Flaschen.
- Markerbeispiele teilen sich die Farben und Konturen mit der Karte; nur in der Legende sind `box-shadow`, `text-shadow` und `filter` deaktiviert. Keine extra „Aktiv“-Legende fuer bestueckte Standorte. Die Darstellung ist responsiv und im Hell-/Dunkelmodus konsistent.
- `npm run check`, `npm run release:check` und `npm test` erfolgreich (230 Unit-/Integrationstests). Browser-Regressionspruefungen angepasst; lokal fehlt `playwright-core`.

## Nachtrag v0.8.13 - Metadaten der Abfüllungen in der Kartenliste (08.11.2026)

- Die Standortliste zeigt zu jeder Abfüllung verfügbare Angaben zu Alter, Alkoholgehalt, Destillations- und Abfülljahr; bei fehlendem Abfülljahr wird ein hinterlegtes Erscheinungsjahr gekennzeichnet. Unbekannte Felder bleiben ausgeblendet.
- Identisch benannte Abfüllungen bleiben über Metadaten unterscheidbar; die Zahl physischer Flaschen wird weiterhin separat angezeigt. Die Darstellung nutzt bestehende Theme-Farbvariablen für Hell- und Dunkelmodus.
- `npm run check`, `npm run release:check` sowie `npm test` (**227/227 Unit-/Integrationstests**) erfolgreich. Browser-Regression ergänzt, aber lokal mangels `playwright-core` nicht ausgeführt.

## Nachtrag v0.8.12 - Seitengröße und Cluster-Legende (08.11.2026)

- Die gewählte Anzahl Abfüllungen oder Flaschen pro Seite (12/24/48/96) bleibt nach F5 in `localStorage` erhalten; bei gesperrtem Speicher gilt weiterhin 24.
- Die Kartenlegende zeigt das tatsächliche Cluster-Symbol „Gruppiert“ in Hell- und Dunkelmodus, ohne zusätzlichen Legendenpunkt „Aktiv“ für den einzelnen Bestandsmarker.
- Browser-Regression für F5 und Vergleich der Clusterfarben in beiden Themes ergänzt.

## Nachtrag v0.8.11 - Karten-Einzelmarker und kompakte Legende (08.11.2026)

- Cluster werden auf der maximalen Zoomstufe aufgeloest; selbst Standorte mit identischen oder dicht benachbarten Koordinaten erscheinen als einzeln anklickbare, leicht versetzte Marker. Eine einzelne Destillerie wird nie als Gruppe dargestellt.
- Die sichtbare Cluster-Legende heisst jetzt nur noch **Gruppiert**. Cluster-Marker behalten die Summe der physischen Flaschen und den erklaerenden Tooltip.
- `npm run check`, `npm test` (**221/221 Unit-/Integrationstests**) und `npm run release:check` erfolgreich. Browser-Regressionstests angepasst; lokal nicht ausgefuehrt, da `playwright-core` nicht installiert ist.

## Nachtrag v0.8.10 - Karten-Clustering (08.11.2026)

- Nahe Destillerien werden bei niedrigem Zoom zu einem Marker gruppiert. Die sichtbare Zahl entspricht der Summe der zugeordneten physischen Flaschen; der Tooltip zeigt auch die Anzahl der Standorte. Einzelmarker und Filter bleiben erhalten.
- `npm run check`, `npm test` (**219/219 Unit-/Integrationstests**) und `npm run release:check` erfolgreich. Ein angepasster Browsertest prueft 3 + 1 = 4 Flaschen bei zwei Destillerien; der Chromium-Lauf konnte hier mangels `playwright-core` nicht ausgefuehrt werden.

# Teststatus v0.8.7 – 08.11.2026

Stand: 08.11.2026 (Korrektur v0.8.7): Vier gemeldete Browserfehler analysiert. Marker-`aria-label`-Praefix kompatibel wiederhergestellt; Legendentest prueft jetzt beide Statussymbole. `npm run check` und `npm test` erfolgreich (212/212 Unit-/Integrationstests). `npm run test:browser` konnte hier nicht ausgefuehrt werden, weil `playwright-core` nicht installiert ist und `npm ci` einen Timeout erreicht hat. Browser-CI muss diese Korrektur verifizieren. Internationaler Katalog: 450 Einträge insgesamt (292 Bestand + 158 neue Destillerien aus 31 Ländern).

# Teststatus v0.8.6 - 08.11.2026

- externer Katalog: Komma-/Semikolon-/Zeilenumbruch-getrennte Destillerien werden einzeln normalisiert, abgeglichen und im Übernahmedialog wählbar. Der Speichervorgang übernimmt mehrere IDs, ohne eine neue Destillerie zu erfinden.
- Landkarte: Umschaltbarer zusätzlicher Standortlayer für alle Katalog-Destillerien, auch ohne Abfüllungen und physische Flaschen. Leere Standorte werden mit einem Pagodendach-SVG statt mit einer Null angezeigt; bestehende Marker zeigen weiterhin den physischen Flaschenbestand. Der Karten-Zoom folgt dem eingeschalteten Modus. Die Auswahl wird lokal gespeichert.
- Neue Unit-Tests für den kompletten 292-Destillerien-Katalog und Multi-Destillerie-Import; neue Chromium-Regressionstests für Kartenumschalter, leere Destillerien und externer Katalog-Speicherung.
- **210/210 Unit- und Integrationstests bestanden.** Gezielter echter Chromium-Test (Desktop 1366 px und Mobil 390 px) bestätigt den Umschalter, die Pagodenmarker, die Detailauswahl, den Rückwechsel und die Speicherung von vier externer Katalog-Destillerien in einer Abfüllung. Die vollständige GitHub-Playwright-Suite und der Docker-/GHCR-Build wurden hier nicht ausgeführt.

# Teststatus v0.8.5 - 08.11.2026

- Header: Der Hell-/Dunkel-Schalter verwendet dieselben festen SVG-Symbole auf Desktop und Mobil. Auf geräteabhängige Unicode-/Schriftsymbole wird verzichtet. Die anderen Header-Aktionsicons bleiben unverändert und werden weiterhin in beiden Ansichten gemeinsam verwendet.
- Logoabstand auf Mobilgeräten: 10 px bis 450 px Bildschirmbreite, 8 px bei höchstens 380 px. Das responsive Header-Layout bleibt einzeilig.
- **203/203 Unit- und Integrationstests bestanden** (`npm run verify`), inklusive neuer Icon-/Abstandsregressionstests. `npm run release:check` bestanden.
- Echter Chromium-DOM-Test bei 320, 360, 390, 450, 600, 740, 900, 960, 1024 und 1366 px: Theme-Wechsel, SVG-Identität, Abstand, Header ohne Überschneidung oder horizontalen Überlauf; keine JavaScript-Fehler.
- Die vollständige GitHub-Playwright-Suite und ein Docker-/GHCR-Build wurden für diesen Patch lokal nicht ausgeführt.

# Teststatus v0.8.4 - 08.11.2026

- Das dunkle Kartenbild wurde moderat aufgehellt: Geländeflächen, Straßennamen und Ortsbeschriftungen sind besser erkennbar. Der Kachelhintergrund wurde angepasst. Der helle Modus, Standortmarker, Menüs und Mauszeiger-Zoom bleiben unverändert.
- CSS-Regressionstests und Browserprüfung für Farbwerte, Theme-Wechsel, nicht invertierte Marker und Zoom. **200/200 Unit- und Integrationstests bestanden**, **21/21 ausführbare Chromium-Browsertests bestanden**, ein nativer Navigationstest umgebungsbedingt übersprungen. `npm run release:check` erfolgreich. Docker-/GHCR-Build nicht lokal ausgeführt.

# Teststatus v0.8.3 - 08.11.2026

- OpenStreetMap-Kartenkacheln, Hintergrund, Steuerelemente und OSM-Quellenhinweis wechseln sofort mit dem Hell-/Dunkelmodus. Standortmarker und ihre Kontrastfarben bleiben unverfälscht; es wird kein weiterer Kartenanbieter benötigt.
- Das Mausrad zoomt präzise um den Standort unter dem Cursor im sichtbaren Kartenausschnitt, nicht länger um die Kartenmitte. Pinch-Zoom verankert am Mittelpunkt der Berührung; Plus/Minus und Tastatur nutzen weiterhin die Kartenmitte.
- Regressionstests kontrollieren die geografische Ankerposition bei mehreren Zoom-/Standortkombinationen, Zoomgrenzen, Theme-Wechsel im Chromium-Browser und Mausrad-Zoom um beziehungsweise neben einem Marker.
- **200/200 Unit- und Integrationstests bestanden**, **21/21 ausführbare Chromium-Browsertests bestanden**, ein Test für native Top-Level-Navigation umgebungsbedingt übersprungen. `npm run release:check` erfolgreich. GHCR-/Docker-Build nicht lokal ausgeführt.

# Teststatus v0.8.2 - 08.11.2026

- Landkarte und Sammlung nutzen dieselbe volle Inhaltsbreite, weiterhin mit zwei nebeneinanderliegenden Kartenspalten auf Desktop und einspaltig auf mobilen Breiten. Der Hauptcontainer hat eine feste Breite bis zur bisherigen Obergrenze.
- Das Seitenmenue ist rechts verankert und oeffnet dort, wo der rechte Burger-Button steht. Einstellungen und Landkarte verwenden dieselbe Ruecksprung-Aktion und Beschriftung „← Zur Sammlung“.
- Zusaetzliche Unit-Tests fuer CSS und gemeinsam verwendeten Ruecksprung-Button; Chromium-Regressionstest kontrolliert die tatsächliche Breite beider Seiten, Spaltenlage, Menuerichtung und Navigation bei 320, 390, 740, 1024, 1366 und 1660 px.
- **196/196 Unit- und Integrationstests bestanden. 20/20 ausfuehrbare Chromium-Browsertests bestanden, 1 Navigationstest umgebungsbedingt uebersprungen.** Release-Metadaten geprueft. GHCR-/Docker-Build nicht lokal ausgefuehrt.

# Teststatus v0.8.1 - 08.11.2026

- Vollstaendiger Positionskatalog mit 292/292 Destillerien des eingebauten Seed-Katalogs. Historische Lokalitaeten, deren exakter Standort nicht belegt ist, sind als ungefaehr gekennzeichnet. Explizit gespeicherte Positionen haben Vorrang. Keine Massengeocodierung.
- Einstellungen nur im ausklappbaren Seitenmenue; Menuebutton ganz rechts im mobilen und Desktop-Header. Das korrekte Zahnrad aus dem gemeinsamen Icon-Katalog wird benutzt.
- Standort-Korrektur ueber kleines Stift-SVG rechts neben dem Destillerienamen. Fehlende Standorte werden nur angezeigt, wenn die Anzahl groesser null ist. Technische Grenzwert- und Erklaertexte aus der Kartenansicht entfernt.
- Tests zur vollständigen Standortabdeckung, manuellem Vorrang und historischen Alternativnamen; Browser-Regressionstests fuer Header, Kartendetails und gezaehlte fehlende Standorte.
- **193/193 Unit- und Integrationstests bestanden** (`npm run verify`); **19/19 ausfuehrbare Chromium-Browsertests bestanden**, 1 Navigationstest aufgrund der lokalen Browserumgebung uebersprungen. `npm run release:check` erfolgreich. GHCR-/Docker-Build nicht lokal ausgefuehrt.

# Teststatus v0.8.0 - 08.11.2026

- Neue Seite **Landkarte** mit einem OpenStreetMap-Marker pro zugeordneter Destillerie; automatisch an alle vorhandenen Standortkoordinaten angepasster Ausschnitt (bei Islay-Standorten Islay-Zoom). Kein Geocoding im Hintergrund.
- Die Markerzahl zeigt **physische Flaschen**, der Durchmesser wächst logarithmisch. Zählungen für **Abfüllungen** und **Flaschen** bleiben getrennt; ein Standort mit mehr als 100 Abfüllungen erzeugt weiterhin nur einen Marker.
- Seitliche bzw. darunterliegende Abfüllungsliste ist filterbar und auf zwölf Einträge pro Seite begrenzt. Dicht benachbarte Destillerien können auch über die Liste gewählt werden.
- Fehlende Koordinaten können über Destillerie-Bearbeitung mit manuellen Eingaben oder einzelner benutzerbestätigter OpenStreetMap-Suche ergänzt und unverändert mit der Sammlung gesichert werden.
- Erweiterbares Seitenmenü, direkt verlinkbare Kartenroute `/?view=map`, mobiler Header inklusive bestehender Schnellaktionen.
- Tests für Koordinatenvalidierung, persistente API-Speicherung, Geocoder-Drosselung/Cache, über 100 Abfüllungen, Einordnung von Flaschen bei Mehrfachdestillerien, Projektion/Zoom und Browser-Navigation einschließlich Mobile und Standortformular.
- **191/191 Unit- und Integrationstests bestanden. 19/19 ausführbare Chromium-Browsertests bestanden, ein Test für direkte History-Navigation aufgrund der Browserumgebung übersprungen. Die finale Ausführung auf GitHub Actions steht noch aus.
- Keine gehosteten Kartendienste werden für Tests kontaktiert. Externe OSM-Kachel- und Nominatim-Dienste werden nur nach Ansicht bzw. Nutzerklick verwendet; deren tatsächliche Verfügbarkeit ist im lokalen Test nicht nachgewiesen.

# Teststatus v0.7.1 - 08.11.2026

- Neue Flasche: vorhandene Abfüllung per Name, Destillerie oder Abfüller finden; Auswahl ist ausdrücklich erforderlich. Der Flaschen-Dialog nutzt die vorhandene POST-/api/bottles-Route und erzeugt keine neue Abfüllung. Alternativ ist „Neue Abfüllung anlegen“ verfügbar.
- **184/184 Unit-/Integrationstests bestanden.** Such- und Zuordnungs-Regressionstests einschließlich XSS-sicherer Beschriftung. **17/17 ausgeführte Chromium-Browsertests bestanden**, ein Test für direkte History-Navigation aufgrund der Browserumgebung übersprungen. Die Browserprüfung für die neue Flaschenauswahl erfolgte bei 390 px und umfasst beide Anlagewege sowie die unveränderte Anzahl der Abfüllungen.

# Teststatus v0.7.0 - 08.11.2026

- Umschalter „Abfüllungen / Flaschen“ steht neben „Meine Sammlung“ an der Stelle des früheren Textes „N Abfüllungen“. Auf kleineren Displays bricht der Umschalter innerhalb der Überschrift um; unterhalb der Statistiken gibt es keinen zweiten Umschalter.
- In der Flaschen-Kachelansicht wird zuerst das individuelle Foto genutzt. Nur wenn eine physische Flasche kein eigenes Foto hat, erscheint das vorhandene Abfüllungs-Titelbild. Die Bilddaten im JSON bleiben unverändert.
- Unit-Test prüft die genaue Position des Umschalters und den Foto-Fallback; Browser-Regressionstest prüft den Umschalter oberhalb der Statistiken bei 320, 390, 740, 900 und 1366 px sowie identische Foto-URLs bei einer Flasche ohne eigenes Foto.
- **181/181 Unit- und Integrationstests bestanden.** In echtem Chromium (DOM-Modus) **16/16 ausgeführte Browsertests bestanden, ein Navigationstest wurde übersprungen**. Die direkte Navigation zu einem lokalen Testserver ist in dieser Umgebung vom Browser gesperrt; sie wird regulär in GitHub Actions geprüft. Der Testaufbau wartet jetzt im DOM-Modus ausdrücklich auf die initiale Darstellung, damit asynchrones Laden nicht zu zufälligen Fehlschlägen führt.

# Teststatus v0.6.51 - 08.11.2026

- Die Startseite bietet einen Umschalter zwischen **Abfüllungen** und **physischen Flaschen**. Flaschen werden einzeln mit eigenem Foto, Inventarnummer, Status, Sample-/Standardtyp und Größe angezeigt. Kachel- und Tabellenansicht sind in beiden Modi verfügbar; vorhandenes responsives Grid und pro-Zeile-Kachelhöhen bleiben unverändert.
- Suche, Flaschenstatusfilter und Paginierung wirken in der Flaschenansicht pro physischer Flasche, ohne die gespeicherten Daten zu duplizieren. Die URL `/?mode=bottles` erlaubt Direktzugriff und Wiederherstellung nach Neuladen/Zurück/Vorwärts. Ein Klick auf eine Flasche zeigt den passenden Detailabschnitt.
- Gezielte Unit-Tests für Mehrfachbestände, Einzelflaschenfilter, eigene Bilder, Sortierung, Paging, URLs und Navigation; zusätzlicher Playwright-Browser-Test für Umschalter, Filter, Karten/Tabelle und Detailnavigation. **Die reguläre Playwright-Suite muss noch in GitHub Actions ausgeführt werden.**

# Teststatus v0.6.50 - 08.11.2026

- Flaschen-Bearbeitungsdialog verwendet das gemeinsame Scanner-SVG, ohne andere Scan-Aktionen zu ändern.
- Bearbeiten/Löschen auf der Abfüllungsdetailseite inklusive Aktionen je physischer Flasche und Datei sind mit gemeinsamen SVG-Icons versehen. Foto-Hinweis entfernt.
- **175/175 Unit- und Integrationstests bestanden** (`npm run verify`); inklusive drei neuer Tests fuer das Scanner-SVG, Stift-/Papierkorb-SVGs und den entfernten Foto-Hinweis. Release-Metadatencheck erfolgreich. Ein separater Chromium-Screenshot konnte in dieser Umgebung nicht abgeschlossen werden; die vollstaendige Playwright-Suite bleibt GitHub Actions vorbehalten.

# Teststatus v0.6.49 - 08.11.2026

- Header und Startseite verwenden gemeinsame SVG-Definitionen fuer **Neue Flasche** und **Inventar scannen**. Die beiden Aktionen haben identische deutsche Labels, Titel und Screenreader-Namen. Das bisherige Text-Plus und das abweichende Scan-Symbol auf der Startseite sind entfernt.
- **Einstellungen** ersetzt **Verwaltung** als sichtbare Header- und Seitenbezeichnung. Das Zahnrad ist auch am Desktop neben dem Text sichtbar; mobil bleibt es ein reiner Icon-Button mit zugaenglichem Namen.
- **172/172 Unit- und Integrationstests bestanden**. Browser-DOM-Test mit realem Chromium bei 320/360/390/450/740/900/960/961/1020/1120/1366 px: keine Ueberlaeufe oder Header-Ueberlappung, Korrektes Zahnrad-SVG auf Mobil und Desktop sowie gepruefte Aktion „Neue Flasche“ inklusive Erfassungsdialog; keine Header-Ueberlaeufe. Die vollstaendige Node-Playwright-Suite bleibt GitHub Actions vorbehalten.

# Teststatus v0.6.47 – 08.11.2026

- Mobile/Tablet-Kopfzeile zwischen 320 und 960 px auf ein CSS-Grid mit einer Zeile umgestellt. Die vier Aktionen (Theme, Verwaltung, Scanner, neue Flasche) bleiben stets direkt erreichbar; keine zweite Button-Reihe und kein horizontaler Überlauf. Auf sehr schmalen Displays wird die Wortmarke kompakt zweizeilig angezeigt.
- Verwechslungen beim Scannen vermieden: Ein eindeutiges SVG-Scanner-Symbol ersetzt das bisherige quadratische Zeichen. Alle Icon-Aktionen besitzen zugängliche Namen und Titel.
- Einheitliche Höhe der Whisky-Kacheln pro Grid-Zeile, dauerhaft dunkles Hero-Bild, Backup-Funktionen und Docker-Konfiguration aus v0.6.46 bleiben unverändert.
- **168/168 Unit- und Integrationstests bestanden** (`npm run verify`). Neuer Unit- und Browser-Regressionstest für Header-Geometrie, Sichtbarkeit der vier Aktionen und responsive Umbrüche. Eigenständige Chromium-DOM-Prüfung mit echten Browsermaßen bei 320/340/360/375/390/414/450/600/740/900/960/961/1024/1366 px: keine Überlappung, kein zweiter Action-Row, kein horizontaler Overflow und Theme-/Verwaltungs-Navigation funktionieren. Die reguläre GitHub-Playwright-Suite muss noch auf GitHub laufen.

# Teststatus v0.6.46 – 08.11.2026

- Originalen dauerhaft dunklen Hero-Bildhintergrund von v0.6.43 wiederhergestellt: Bildfilter, Ueberlagerungs-Verlauf, Randverlaeufe, Textfarben und Kontrast der Hero-Aktionen sind auch im Light Mode dunkel und kontrastreich. Theme-Wechsel aendert den Hero-Hintergrund nicht mehr.
- Die theme-abhaengige Foto-Grossansicht bleibt erhalten. Das responsive CSS-Grid mit pro Zeile gleichen, zwischen Zeilen unabhaengigen Kachelhoehen aus v0.6.45 bleibt unveraendert.
- **167/167 Unit- und Integrationstests bestanden** (`npm run verify`); Release-Metadatencheck gruen. Im echten Chromium-DOM-Test blieb der dunkle Hero-Hintergrund beim Umschalten von Hell auf Dunkel unveraendert. Die Kacheln wurden bei 1366/900/740/390/320 px auf gleiche Hoehe innerhalb der jeweiligen Zeile und unabhaengige Zeilenhoehen geprueft. Die vollstaendige GitHub-Playwright-Suite steht noch aus.

# Teststatus v0.6.45 – 08.11.2026

- Per-Zeile-Equal-Height-Fix: CSS-Grid `align-items: stretch`, weiterhin automatisch hohe Grid-Zeilen. Unterschiedliche Zeilen bekommen keine gemeinsame Hoehe. Die feste Titel-Mindesthoehe bleibt entfernt, damit Name und Fakten nahe zusammenstehen.
- Neuer Browser-Regressionstest misst reale Kachelgroessen und den Titel/Fakten-Abstand bei 1366/900/740/390/320 px sowie den unabhaengigen Hoehenwechsel nach responsivem Umbruch. Zusaetzlich ein statischer Grid-Regressionstest.
- **167/167 Unit- und Integrationstests bestanden** (`npm run verify`), einschliesslich Syntax- und Importpruefung. Der Versionscheck ist erfolgreich.
- Realer Chromium-DOM-Test mit acht Abfuellungen und absichtlich unterschiedlich langen Namen: bei 1366/900/740/390/320 px exakt gleiche Kartenhoehen innerhalb jeder Zeile, keine globale Gleichsetzung der Zeilenhoehen, kompakter Name-Fakten-Abstand von 5 px und kein horizontaler Overflow.
- Die neue Browser-Regression ist in `tests/browser/app.test.js` enthalten; die vollstaendige Node-Playwright-Suite muss in GitHub Actions laufen.

# Teststatus v0.6.44 – 08.11.2026

- Sechs UI-Anpassungen aus der mobilen Rückmeldung umgesetzt: Reihenfolge Geschlossen/Geöffnet, Abfüllername ohne Präfix, Verwaltungs-Icon bei schmaler Bildschirmbreite, themenabhängige Hero- und Fotoansichts-Overlays, keine Platzhalter für fehlende Whisky-Fakten und natürlich hohe Kacheltitel.
- **166/166 Unit- und Integrationstests bestanden** (`npm test`), ebenso Syntax- und Modulabhängigkeitsprüfung (`npm run check`). Der Versions- und Release-Metadatencheck ist ebenfalls bestanden.
- Zusätzlich Chromium/Playwright-DOM-Prüfung mit fünf echten Abfüllungen und verschiedenen Titellängen bei 320/390/740/900/1366 px: 1/2/2/3/4 Spalten, **5 px Abstand zwischen Titel und Fakten** bei allen Breiten, kein horizontales Überlaufen. Hell/Dunkel-Farbwechsel für Hero-Bild und Foto-Viewer überprüft; keine JavaScript-Laufzeitfehler. Dieser lokale DOM-Lauf nutzt ein abgefangenes HTTP-Backend, da Chromium in dieser Umgebung direkte Navigation blockiert.
- Die reguläre Node-Playwright-Browsersuite wird weiterhin von GitHub Actions ausgeführt; ein lokaler vollständiger Live-Navigationslauf ist hier nicht möglich.

# Teststatus v0.6.43 – 08.11.2026

- Responsive UI: Theme-Umschalter bleibt auch im Mobil-Header sichtbar; der Hero-Abstand vor `COLLECTION · EST.` ist größer; überflüssige Abstände zwischen Paginierung und Footer sind reduziert.
- Die vier Statistik-Kacheln zeigen Abfüllungen, Gesamtbestand, **Geöffnet** und **Geschlossen**. Die bisherige Statistik-Kachel `Unvollständig` entfällt; Filter und Bearbeitungsstatus bleiben unverändert.
- Sammlungseinstellung `establishedYear` über `PATCH /api/settings` in `collection.json` gespeichert; in vollständigen ZIP-Backups enthalten, bei älteren Sammlungen optional. Ohne Einstellung wird keine Jahreszahl erfunden.
- Übersichtskacheln, Tabellen und Detailüberschrift zeigen bei fehlender Destillerie den vorhandenen Abfüller. Bei vorhandener Destillerie bleibt deren Name vorrangig.
- **163/163 Unit- und Integrationstests bestanden**, einschließlich Persistenz, Eingabevalidierung, alten JSON-Daten, Zählungen, Escaping und Fallback. `npm run verify` erfolgreich.
- Browser-Regressionstests für die mobile Sichtbarkeit, Abstände, gespeichertes Gründungsjahr, Tabelle und Detailseite sind ergänzt. **Keine vollständige Browserausführung hier** (Playwright-Core-Abhängigkeit nicht verfügbar; Headless-Chromium startet in dieser Umgebung nicht erfolgreich). GitHub Actions muss sie prüfen.

# Teststatus v0.6.42 – 07.11.2026

- Fehleranalyse zu `ERR_INVALID_PACKAGE_CONFIG`: Die `package.json` in der letzten bereitgestellten v0.6.41-ZIP ist gueltiges JSON. Die tatsaechlich auf dem Pi gestartete GHCR-Image-Datei wurde nicht ausgelesen; die genaue Ursache ist deshalb offen.
- Der Dockerfile validiert Paketdateien beim Build und prueft die Node-Einstiegsdatei im fertigen Image.
- Der GitHub-Release-Workflow zieht die bereits publizierten Images fuer ARM64 und AMD64, prueft die `package.json`-Version und den Node-Entrypoint und aktualisiert `latest` nur nach erfolgreicher Verifikation.
- Automatisierte lokale Tests: **156/156 Unit- und Integrationstests bestanden**; `npm run verify` erfolgreich.
- Ein echter Docker-/GHCR-Lauf wurde lokal mangels Docker-Engine nicht durchgefuehrt; die Verifikation erfolgt beim naechsten GitHub-Release.

# Teststatus v0.6.41 – 07.11.2026

- **155/155 Unit- und Integrationstests bestanden** (`npm run verify`); Syntax-, Import- und Release-Metadatenpruefung gruen.
- Versionsnummer im Footer dynamisch vom Server (`GET /api/version`), ohne fest codierte UI-Version.
- Ein gemeinsames Backup-Passwort (ueber die Backup-Oberflaeche und Administrator-Schluessel) fuer alle **neuen** ZIPs: manueller Download, geplante USB/NAS/Cloud-Backups, Restic-Altbestand-Konvertierung und Vorher-Sicherung bei Restore. Ohne Passwort bricht die Backup-Erstellung ab.
- WinZip-AES-256 (AE-2), AES-HMAC-Authentifizierung, positive und negative Passworttests, Manipulationstest, Wiederherstellungsvorschau sowie bestehende unverschluesselte ZIP-Importe geprueft. Die Archiv-Kryptografie wurde zusaetzlich mit einem unabhaengigen Python-Cryptography-Entschluesseler gegenprueft.
- Das Passwort liegt nur persistent und zugriffsbeschraenkt unter `${WCM_DATA_DIR}/backup-control/backup-zip-password`, nicht in der Sammlung oder den ZIPs; es wird nicht ueber API-Antworten ausgegeben. Alte unverschluesselte ZIP-Dateien werden nicht automatisch umgeschluesselt.
- Browser-/GHCR-Build-/echter USB-Test hier nicht ausgefuehrt. 7-Zip-Interoperabilitaet noch am Zielgeraet pruefen.

# Teststatus v0.6.40 – 07.11.2026

- Navigationstest `browser: real back/forward navigation and direct reload` korrigiert: die Settings-Seite wird nach `goForward()` ueber eine sichtbare Ueberschrift geprueft. Der alte JSON-Import befindet sich absichtlich in einem geschlossenen `<details>`-Bereich; der Test oeffnet ihn vor der Sichtbarkeitspruefung.
- Zusaetzlicher Regressionstest sichert die beabsichtigte Ausblendung des JSON-Imports ab. **153 Unit- und Integrationstests bestanden**, ebenso Syntax- und Versionspruefung.
- **Browser-Lauf hier nicht ausgefuehrt:** `playwright-core` ist in dieser Umgebung nicht installiert, und die npm-Registry ist nicht erreichbar (`EAI_AGAIN`). Der GitHub-Actions-Lauf muss den realen Chromium-Test bestaetigen.

# Teststatus v0.6.39 – 07.11.2026

- **152/152 Unit- und Integrationstests bestanden** (`npm run verify`). Tests für gemeinsam genutzten ZIP-Generator, manuelle Browser-Downloads, zeitgesteuerte lokale ZIP-Backups, Wiederherstellung mit Vorschau, ältere ZIP-Exporte und Restic-Kompatibilität.
- Genau ein regulärer Backup-Weg: einheitliches ZIP-Format für Direktdownload und zeitgesteuerte USB-/NAS-/Cloud-Sicherungen. Automatische tägliche JSON-Backups beim App-Start entfernt.
- Vollständige ZIP-Wiederherstellung: Upload bzw. gesicherten Stand wählen, Prüfsummen und Sammlung prüfen, Vorschau, gesonderte Bestätigung, Sicherheits-ZIP und Rückrolllogik. Alte Restic-Profile werden nicht gelöscht und sind noch prüf- und wiederherstellbar; neue Restic-Sicherungen werden blockiert.
- Ein einzelner HTTPS-Container, Port 3543; für USB-Tests ein einmaliges Mount-Skript ohne Änderung an `/etc/fstab`.
- **Nicht hier nachgestellt:** Docker-Image-Build, echter USB-Stick am Pi, Cloud-OAuth-Anmeldung und Live-Browser-Test mit Chrome/Firefox. Diese müssen nach dem Release am Zielsystem überprüft werden.

# Teststatus v0.6.38

Stand: 07.11.2026. GitHub-Actions-Regression bei `tests/integration/pi-certificate.test.js`: Auf manchen OpenSSL-Versionen meldet `openssl x509 -checkhost` bei nicht passendem Host `does NOT match certificate`, liefert dabei aber dennoch Exit-Code `0`. Der Test hat zuvor falsch `1` vorausgesetzt. Die SAN-Pruefung verwendet jetzt `node:crypto` (`X509Certificate.checkHost` / `checkIP`) fuer passende und nicht passende DNS-Namen und IP-Adressen, einschliesslich des Zustands vor/nach `--renew-cert`. Die eigentliche Zertifikatserstellung und der Docker-Betrieb sind unveraendert.

**145/145 Unit- und Integrationstests bestanden** (`npm run verify` einschliesslich Syntax- und Release-Metadatenpruefung). Browser- und Docker-Tests wurden fuer diesen Testfix nicht ausgefuehrt.

# Teststatus v0.6.37

Stand: 07.11.2026. README umstrukturiert: kompakte Projektübersicht, Raspberry-Pi-Docker-Schnellstart, zentrale .env-/Zertifikatskonfiguration, Backup-Daten, Updates und Verweise auf die Fach-Dokumentation. Keine funktionalen Änderungen. **145/145 Unit- und Integrationstests bestanden**; Browser-/Docker-Lauf nicht erneut durchgeführt.

# Teststatus v0.6.36

Stand: 07.11.2026. Das Pi-Setup übernimmt `CERT_DNS_NAMES` und `CERT_IP_ADDRESSES` aus der **projektweiten `.env`** (Vorlage `deploy/.env.example`, automatisch beim ersten Setup kopiert). Neues Zertifikat nur mit `--renew-cert` und mit Sicherung des alten Schlüsselpaares; bestehende Secrets bleiben erhalten. Zusätzliche Tests prüfen SAN-Konfiguration, angepasste Hostnamen und IPs, Upgrade von `deploy/.env`, ungültige Werte und dass `.env` nicht als Shell-Code ausgeführt wird. **145/145 Unit- und Integrationstests bestanden** (`npm run verify`, einschließlich Syntax- und Release-Metadatenprüfung). Docker-Engine-Test bleibt mangels lokaler Engine aus.

# Teststatus v0.6.34 – 07.11.2026

- Neu: ein einziger Docker-Container mit HTTPS 3543, internem Backup-Worker-Prozess, Restic/Rclone und eigenständiger docker-compose.yml im Repository-Stamm. Kein Port 3100, kein SSH-Tunnel, keine zweite GHCR-Build-Matrix.
- GitHub-Release baut weiterhin einen ARM64/AMD64-Container sowie das versionsgebundene ZIP; Runtime-Daten bleiben außerhalb des Images.
- Technisch geprüft: YAML-Syntax, statische Deployment-/Release-Checks sowie Unit- und Integrationstests. Ein tatsächlicher Docker-Build benötigt eine Docker-Engine auf GitHub bzw. dem Pi.

# Teststatus v0.6.32 – 07.11.2026

- `npm run verify`: **138/138 Tests bestanden**, einschliesslich vier neuer Release-/Versions-/Archivtests; ebenso nach Git-Archivierung und frischer ZIP-Entpackung.
- Neuer `develop`-/`main`-Branch- und Release-Workflow mit automatischem GitHub Draft Release nach erfolgreicher CI; ZIP plus SHA256 und zwei GHCR-Multiarchitektur-Images werden aus demselben Tag gebaut. Der Draft wird nur nach allen erfolgreichen Jobs veroeffentlicht.
- Versionierungsskript prueft Package, Lockfile, Erweiterungsmanifest, README und Changelog auf Uebereinstimmung. Optionaler Test auf bereits vergebene Git-Tags vor der Freigabe.
- Einmaliger GitHub-Actions-Build, GHCR-Push und `gh release`-Aufrufe koennen hier ohne Zugriff auf das GitHub-Repository nicht real ausgefuehrt werden; die Workflows werden syntaktisch/statisch und die JavaScript-Helfer mit Unit-Tests geprueft.
- Datenhaltung, HTTPS, Backups und die verwendete Version der Flaschenbild-Freistellung bleiben unveraendert.

# Teststatus v0.6.31 – 07.11.2026

- `npm run verify`: **134/134 Unit- und Integrationstests bestanden** (Node.js 22.16.0), einschließlich der neuen Backup-API-/Worker-/Docker-Konfigurationstests.
- Backup-API: Administrator-Schlüssel, Profilvalidierung, relative Pfade, unabhängige Profile, sichere HTTP-Routen, separate interne Worker-Authentifizierung, stabil kopierte Bilder/Dokumente/JSON-Daten.
- Worker-Pipeline: Auftrag, Rclone/Restic-Aufruf, Aufbewahrungsregeln, Integritätsprüfung und Restore in getrennten Ordner **mit Test-Doubles der externen Programme** geprüft. Kein echter Dropbox-Cloudlauf im Test.
- Dockerfiles, Compose-Bind-Mounts, GHCR-Multiarchitektur-Workflow und drei Dependabot-Änderungen statisch geprüft. YAML-Syntax der Docker-/GitHub-Konfigurationsdateien ebenfalls geprüft. Kein Docker-Daemon in der Testumgebung, daher keine reale Image-Build-/Pull-Prüfung.
- Desktop-/Mobilansicht der Backup-Sektion mit Chromium durch statisches HTML-Rendering bei 1280/390 px geprüft (keine horizontale Überbreite). Direkte Browsernavigation zur laufenden lokalen App bleibt durch `ERR_BLOCKED_BY_ADMINISTRATOR` blockiert; daher **kein vollständiger Live-Browserintegrationstest**.
- RESTIC-Backup- und Retention-Gruppe `host,tags`, damit sich bei wechselndem temporärem Snapshot-Verzeichnis das Aufbewahrungsverhalten nicht aufspaltet.
- Datenschutz: Keine Zugangsdaten oder Sammlungsdaten im Release-ZIP; getrennte lokale Schlüssel und persistent gemountete Laufwerksverzeichnisse werden auf dem Pi erstellt.

# Teststatus v0.6.30

Stand: 06.11.2026. Zwei nicht eindeutige Playwright-Selektoren im GitHub-Actions-Browsertest fuer 450 Abfuellungen wurden durch eindeutige `aria-label="Seite 19"`-Selektoren ersetzt. Ein zweiter, bisher verdeckter Testfehler wurde ebenfalls korrigiert: Der Seitenwechsel auf der 360-px-Ansicht wird mit einer Grid-Spalte geprueft; nach Verbreiterung auf 1660 px sind vier Spalten zu erwarten. **125/125 Unit-/Integrationstests bestanden.** Ein vollstaendiger Playwright-Lauf konnte lokal nicht ausgefuehrt werden, da `npm ci` in dieser Umgebung nicht abgeschlossen wurde. Die GitHub-Action `npm run test:browser` ist die massgebliche Nachpruefung.

# Teststatus v0.6.29

Stand: 06.11.2026. Abgeleitet von **v0.6.27** (v0.6.28 verworfen), ohne Änderung der externer Katalog-Bildfreistellung. Flaschenfotos der Detailansicht und das große Titelbild öffnen jetzt den bestehenden App-Modalmechanismus statt eines neuen Tabs; dasselbe gilt für die externer Katalog-Bildvorschau. Die Galerie kann mit den Pfeiltasten und Vor-/Zurück-Schaltflächen bedient werden; Escape und der Overlay-Hintergrund schließen sie. Nested-Modals bewahren ungespeicherte Eingaben und Dateiauswahlen.

Die Unit-Tests prüfen das Öffnen und Blättern, sichere Bildquellen und HTML-Escaping sowie das Ausbleiben bisheriger `target="_blank"`-Bildlinks. Ein zusätzlicher Browser-Test ist enthalten, konnte aber mangels lokal verfügbarer `playwright-core`-Abhängigkeit in dieser Umgebung noch nicht ausgeführt werden. **125 Unit-/Integrationstests bestanden**; vollständige Prüfung des finalen ZIP erfolgt nach dem Paketbau.

# Teststatus v0.6.27

Stand: 06.11.2026. Die externer Katalog-Erweiterung wiederverwendet nun vorhandene Manager-Tabs über eine exakte Origin-Prüfung (Protokoll, Host und Port); bei Bedarf wird weiterhin ein erster Tab angelegt. Die App verarbeitet neue Import-Fragmente per `hashchange` ohne vollständigen Reload und schützt einen offenen Bearbeitungsdialog vor unbestätigtem Verwerfen. Zusätzliche Unit-Tests prüfen die Tab-Auswahl, Fensterfokus, den Bild-Token-Transfer und die Import-Bestätigung im bereits geöffneten App-Tab sowie eine erfolgreiche erneute Validierung ohne Bild-Token. Die Live-Browser-Prüfung ist weiterhin gesondert erforderlich; Unit- und Integrationstests lassen sich mit `npm run verify` reproduzieren.

Stand: 06.11.2026. **112 Unit-/Integrationstests bestanden** (`npm run verify`). Die neue Freistellung verwendet eine weiße Hintergrundmaske mit Flood Fill vom äußeren Bildrand und rekonstruiert nur nach oben und unten abgeschlossene Einschnitte, anstatt die gesamte Flaschensilhouette zu verändern. Ein zusätzlicher Regressionstest prüft einen vollständig weißen Halsabschnitt, einen unregelmäßigen, länger beschädigten Etikettenrand sowie die Glätte der reparierten Kontur. Die bestehenden Tests für weiße Etiketten, helle Verschlüsse, natürlichen Flaschenboden, Bildtransfer und Screenshot-Fallback bleiben grün.

**Visuelle Prüfung:** Die tatsächliche `removeWhiteBackgroundWithSoftEdge()`-Funktion aus `extension/image-transfer.js` wurde auf das im Chat hochgeladene **Lochindaal-Originalbild** (weiß, 400 × 800) und auf das aus einem früheren beschädigten PNG rekonstruierte **Hepburn-Bild** (196 × 391) angewendet. Die Ergebnisse wurden gegen den dunkelblauen App-Hintergrund zusammengesetzt und mit Version 0.6.25 verglichen. Beide Flaschen bleiben in dieser Prüfung ohne weiße Rechtecke bzw. seitliche Löcher am Hals/Etikett. Das Hepburn-Bild stellt kein unbearbeitetes externer Katalog-Original dar.

**Offen:** Kein Live-Test auf einer angemeldeten Quellseite. Bereits vorher entfernte Originalpixel können nicht aus den beschädigten PNGs restauriert werden. `collection.json`/Schema 4, HTTPS-Port 3543 mit deaktiviertem HTTP sowie `.github/dependabot.yml` sind unverändert. Der Releasepaket-Test aus frisch entpacktem ZIP wird gesondert durchgeführt.

# Teststatus v0.6.25

Stand: 06.11.2026. Die externer Katalog-Bildfreistellung verarbeitet nun zusätzlich kurze, beidseitig begrenzte Kontur-Aussetzer am hellen Flaschenhals. Ein Regressionstest bildet den beobachteten 14-Pixel-Einschnitt an einer weißen Verschlussfläche nach und prüft zugleich weiße Etiketten, Außenhintergrund, schmale Kapsel und abgerundeten Boden. Das lokale Rekonstruieren der weißen Hintergrundfläche aus dem **bereits beschädigten Screenshot** ist ein Näherungstest; das unversehrte Originalbild stand nicht zur Verfügung. Ein echter Import auf einer angemeldeten Quellseite bleibt ungetestet. **111/111 Unit-/Integrationstests bestanden**; Server- und HTTP/HTTPS-Tests sind enthalten. Schema 4, HTTPS 3543, HTTP deaktiviert, Dependabot unverändert.

# Teststatus v0.6.24

Stand: 06.11.2026. Freistellung des externer Katalog-Flaschenbildes nach einer Sichtpruefung mit dem bereitgestellten Lochindaal-Futures-Screenshot korrigiert. Die bisherige globale Konturverbreiterung erzeugte weisse rechteckige Ecken oben und unten; die korrigierte Variante bewahrt die gemessene natuerliche Verjuengung von Flaschenhals und -boden und repariert ausschliesslich vertikal begrenzte Einschneidungen. Ein zweiter Filter verwirft schmale abgesetzte vertikale Randartefakte, wenn breitere zusammenhaengende Motivpixel vorhanden sind. Zur visuellen Pruefung wurde der dunkle UI-Hintergrund im Screenshot als Weiss rekonstruiert, die neue JavaScript-Bildroutine darauf angewendet und mit dem vorherigen Screenshot verglichen. Das ist **kein Live-Test mit dem unversehrten externer Katalog-Originalbild**. Ein weiterer Regressionstest fuer die isolierten Randlinien wurde ergaenzt; insgesamt **110/110 Unit-/Integrationstests bestanden**. Eigene Fotos und bestehende Daten bleiben unveraendert.

Stand: 06.11.2026. Zusaetzlich zur Konturmaske und den abgerundeten Endkappen verwendet der externer Katalog-Bildimport jetzt eine **hintergrundbezogene Kantenabtastung**: Der aeussere Bildrand dient als Referenz fuer den Foto-Hintergrund, und pro Bildzeile wird die erste sichtbare Abweichung davon als weiterer Hinweis fuer die aeussere Flaschenkante genutzt. Dadurch werden insbesondere **weisse Reste in den Ecken von oberen und unteren Rundungen** besser entfernt, ohne helle Etiketten innerhalb der Flasche pauschal als Hintergrund zu behandeln. Die zusaetzliche Abtastung ist fuer echte Flaschenbilder aktiviert, aber nicht fuer winzige Testbilder. **109/109 Tests bestanden**. Bereits beschaedigte PNGs muessen weiterhin neu aus der originalen Quellseite importiert werden.

Stand: 06.11.2026. Der externer Katalog-Bildimport nutzt jetzt eine zeilenweise rekonstruierte Flaschenkanten-Maske anstelle einer Pixel-Entfernung mit nachträglichen Farb-Reparaturen. Regressionstests prüfen eine bis an den Außenrand reichende weiße Etikettenfläche, einen vollständig weißen Halsabschnitt, schmale und breite Flaschenbereiche, die transparente Außenseite, unveränderte RGB-Werte innerhalb der Silhouette, einzelne Fremdpixel außerhalb sowie beide vorhandenen Browser-Bildimportwege. Die direkte Gegenüberstellung mit einem aus dem gemeldeten Beispielbild rekonstruierten weißen Hintergrund ist nur ein Näherungstest, da die zuvor entfernten Pixel im Anhang nicht mehr vorhanden sind. Ein Live-Test mit der originalen externer Katalog-Bilddatei in einer angemeldeten Browsersitzung bleibt offen.

Das JSON-Schema bleibt bei 4; HTTPS auf Port 3543 und HTTP deaktiviert. Die Tests werden nach dem ZIP-Bau aus einer frischen Entpackung erneut ausgeführt.

# Teststatus v0.6.18

Stand: 06.11.2026. Die 3-Spalten-Sonderregel für genau sechs, neun und 18 sichtbare Abfüllungen wurde entfernt. Desktop nutzt stets vier Spalten ab 1021 px, unabhängig vom Ergebnisumfang; kleinere Breakpoints bleiben 3/2/1. Die feste Pagination (12/24/48/96) ist unverändert. Regressionstests prüfen den statischen Grid-Klassennamen, die CSS-Breakpoints, sechs Ergebnisse und die letzte Seite von 450 Abfüllungen. 105 Unit-/Integrationstests im Arbeitsverzeichnis bestanden. Ein zusätzlicher Chromium-Versuch zur visuellen Prüfung lief in dieser Umgebung in einen Timeout und ist nicht als erfolgreicher Browsertest zu werten. Der Releasepaket-Test aus einer frischen Entpackung folgt separat.

# Teststatus v0.6.17

Stand: 06.11.2026. Regression gegen v0.6.15: feste Pagination (12/24/48/96), explizit responsive Spaltenzahlen 1/2/3/4, keine dynamischen Zeilenzahlen mehr. 450 Abfüllungen = 19 Seiten bei Standard 24, die letzte Seite hat 18 Einträge. Fensterbreitenwechsel verändert keine Seiteneinteilung. Unit-/Integrationstests und Paketverifikation werden aus dem frisch entpackten ZIP erneut ausgeführt; eine Live-Browserprüfung ist nur bei erfolgreich gestarteter Browserumgebung möglich.

Stand: 06.11.2026. Responsive Kachelpagination mit fünf Reihen und berechneter CSS-Spaltenzahl; Tests für 450 Abfüllungen (Desktop fünf Spalten: 18 Seiten à 25; Smartphone zwei Spalten: 45 Seiten à 10), Filtern/Sortieren vor Pagination und feste Tabellen-Pagination. Ein aktualisierter Browser-Test für Breitenwechsel und Zeilenwahl ist enthalten.

Stand: 06.11.2026. 100 Unit-/Integrationstests nach der Korrektur der externer Katalog-Übernahmevorschau. Neue Tests prüfen die Zuordnung der Checkbox zur jeweiligen Beschriftung, den realen Vorschau-Template-Aufbau, beibehaltene Vorauswahlregeln, Escaping, nicht auswählbare unbekannte Destillerien und die korrigierte 18-px-Checkbox-Darstellung samt zweispaltigem Desktop- und einspaltigem Mobile-Layout. Auch die goldene Auswahlumrandung im Dark Mode wird geprüft. Ein visueller Chromium-Test konnte in dieser Umgebung nicht abgeschlossen werden (Browserprozess hängt beim Laden der Testseite).

Stand: 06.11.2026. Zusätzlich zu den bisherigen Regressionstests prüft ein neuer Unit-Test den Detailkopf sowohl mit Destillerie (gleiche goldene Versalzeile wie auf Übersichtskarten, grauer Status getrennt) als auch ohne Destillerie (kein überflüssiger Separator). Die Versionsnummern und die auf Wunsch ergänzte `.github/dependabot.yml` werden im Release-ZIP geprüft.

Stand: 06.11.2026. 93 Unit-/Integrationstests nach der Destillerie-UI-Überarbeitung, inkl. Testfällen für kompakte Suchliste, Modal-Stapel (Wiederherstellung derselben Formular-DOM-Knoten samt Dateiauswahl), Verzicht auf native Browser-Prompts sowie unteren Abstand vorhandener Fotos in der Kartenübersicht. Zusätzliche Browser-Testfälle für Verwaltung, Hinzufügen während ungespeicherter Eingaben und Kartenabstand sind enthalten, aber ein Chromium-Live-Test wurde hier nicht erfolgreich abgeschlossen (Aufruf der Browserumgebung blockiert/hängt). Ein realer iPhone-Test steht aus.

Die Datenstruktur `schemaVersion: 4`, die HTTPS-Standardkonfiguration auf Port 3543 und die API sind unverändert. Die Unit-/Integrationstests werden nach dem Paketbau erneut aus der frisch entpackten ZIP-Datei ausgeführt.

# Teststatus v0.6.10

Stand: 06.11.2026. Diese Version umfasst zusätzlich die Detailfeldfilterung, Fotoinnenabstände und Pagination der Abfüllungsübersicht. Unit-/Integrationstests prüfen 450 Abfüllungen (19 Seiten à 24, letzte Seite 18), Sortierung vor Pagination, Seitengrenzen und URL-Parsing. Ein zusätzlicher Browser-Testfall ist enthalten, aber mangels installierter Playwright-Abhängigkeit hier nicht ausgeführt. Bisherige Prüfungen: Die neuen Tests decken ab: transparenten weißen und nahezu weißen Bildrand, zweistufige weiche Kontur, unveränderte weiße Etiketten innerhalb der Flasche, Erhaltung vorhandener Transparenz und beide externer Katalog-Bildübertragungswege. Das neue 80 × 80-SVG mit dünneren Linien wird als Headerlogo (Original) sowie für Favicon, iPhone- und Erweiterungsicons (gerendert) verwendet.

**Grenzen:** Der neue Bildimport wurde mit simulierten Pixeln und Browserantworten getestet, nicht live mit einer angemeldeten Quellseite. iPhone- und echter Browser-Test der Erweiterung stehen aus. Bereits gespeicherte Bilder werden nicht automatisch neu verarbeitet.

# Teststatus v0.6.7

Stand: 06.11.2026. Das neue SVG ist unverändert als `logo-original.svg` enthalten und wird auch im Header verwendet. Browser-, iPhone- und Erweiterungsicons werden daraus gerendert. Der Bildtransfer der Browser-Erweiterung konvertiert RGB `#FFFFFF` in Alphakanal-Transparenz und erzeugt PNG-Dateien. Tests prüfen Weiß, Fast-Weiß und bestehende Transparenz sowie beide Importpfade. Ein Live-Test auf der angemeldeten Quellseite und auf einem iPhone ist weiterhin offen.

# Teststatus v0.6.6

Stand: 06.11.2026. `npm run check` und `npm test` ausgeführt. **73 Unit-/Integrationstests bestanden**. Der Bildimport verwendet **keinen direkten Fetch auf die externer Katalog-Bild-URL** mehr. Zusätzliche Tests prüfen die Übernahme bereits geladener Bildpixel, den Cross-Origin-Screenshot-Fallback, dessen Zuschnitt und den lokalen Upload aus dem Erweiterungs-Popup. Die bestehenden Bild- und ZIP-Integrationstests bleiben unverändert.

**Grenze:** Keine Live-Prüfung in einer angemeldeten externer Katalog-Browsersitzung. Der Screenshot-Fallback speichert die sichtbaren Pixel als PNG, nicht die Originaldatei mit ihrer vollen Auflösung. Auf nicht sichtbare Bilder kann er nicht zugreifen.

# Teststatus v0.6.5

Stand: 06.11.2026. `npm run check` erfolgreich; **68 Unit-/Integrationstests bestanden**. Der neue Icon-Test prüft die unveränderte SVG-Zeichnung, den Header-Verweis, die Manifest-Verweise, die PNG-Dateien der Browser-Erweiterung sowie die HTTP-Auslieferung von SVG, Favicon, iPhone-Icon und Web-App-Manifest. Auch `.env` mit `HTTPS_PORT=3543` ist unverändert.

**Grenzen:** Der visuelle Chromium-Test konnte in dieser Ausführungsumgebung nicht abgeschlossen werden (Browserprozess ohne fertigen Seitenaufruf; die lokal vorliegenden Dev-Dependencies sind unvollständig). Optische Darstellung und iPhone-Home-Icon müssen bei Bedarf auf dem Zielgerät geprüft werden. Die Anwendung selbst wurde nicht funktional geändert.

# Teststatus v0.6.4

Stand: 06.11.2026. `npm run check` und `npm test`: **67 Unit-/Integrationstests bestanden**. Zusätzliche Tests prüfen den vollständigen lokalen Foto-Transfer (temporäre Bildbytes → Bestätigung → physische Flasche → ZIP), Ablehnung ungültiger Bildbytes, Foto-Reihenfolge mit vollständiger ID-Mengenprüfung sowie die vier disjunkten Status-/Typ-Bestandsetiketten einschließlich leerer Flaschen.

**Nicht live verifiziert:** Abruf eines echten externer Katalog-Bildes im angemeldeten Chrome-/Edge-Browser sowie die Drag-and-drop-Interaktion auf iOS. Ein zusätzlicher Chromium-Seitenaufruf wurde in der Umgebung mit `ERR_BLOCKED_BY_ADMINISTRATOR` verhindert. Die Browser-Erweiterung und die echte lokale Installation benötigen daher einen Praxistest. Eine `npm ci`-Installation konnte wegen nicht erreichbarer npm-Registry nicht abgeschlossen werden; zum Testen des Codes wurden die Node.js-Unit-/Integrationstests ohne Drittbibliotheken verwendet.

Die bisherigen Prüfgrenzen (HTTPS, echter iPhone-Scanner, native Browser-History) bleiben bestehen. Das JSON-Schema bleibt 4.

# Teststatus v0.6.3

Prüfung der Dateiablage- und Sample-Erweiterung vom 05.11.2026 auf Linux mit Node.js 22.16.0.

| Prüfung | Ergebnis |
| --- | --- |
| Ausgangsversion v0.5.9 | 42 bestehende Tests bestanden |
| `npm run check` | 80 JavaScript-Dateien: Syntax und relative Importe gültig, keine erkannten Importzyklen |
| `npm test` | 60 Unit-/Integrationstests bestanden, keine ausgelassen |
| Chromium-Tests im ausdrücklichen DOM-Modus | 6 bestanden, 1 echter Navigationstest ausgelassen |
| ZIP | CRC/Entpackbarkeit, Dateiauswahl und Standardkonfiguration separat geprüft |

## Geprüftes Verhalten

- Anlegen, Bearbeiten und Löschen, verschachtelte physische Flaschen, eindeutige und reservierte Inventarnummern.
- Automatische Migration alter Schema-3-Daten auf Schema 4 einschließlich alter Sample-Typen und Flaschengrößen, Import, CSV-/JSON-/ZIP-Export und Fotozuordnung. Vorherige JSON-Datei wird vor dem Umschreiben gesichert.
- Schreibwarteschlange, fehlgeschlagene Mutationen, gleichzeitige Nummernvergabe, defektes JSON und statische Modul-/CSS-/Bildauslieferung.
- Je physischer Flasche mehrere PDF-/Bildnachweise: Upload, Metadaten und SHA-256, Download nur für die zugehörige Flasche, Dateilöschung, ZIP-Export und Ablehnung ungültiger Dateien/Dateinamen.
- Unabhängige 700-ml-Standardflasche und 30-ml-Sample unter derselben Abfüllung; Sample-Label in Kacheln, Tabelle und Flaschendetails.
- HTTPS-Server mit echtem Testzertifikat, Konfigurationswerte und Port-Erhalt beim Zertifikatssetup.
- URLs, History-Aufrufe und Scrollregeln als Controller-/Unit-Tests.
- Read-only-Abfüllungskontext, fehlende Trennzeichen am Ende und Escaping im Flaschenformular.
- Im Chromium-DOM: Abfüllung erzeugen, Flasche bearbeiten, Foto hochladen, nach erkannter Nummer oben navigieren und markieren, Scan-Rückweg ohne Verlust von Flaschen-ID oder ungespeichertem Kommentar.
- Hell/Dunkel umschalten; Desktop- und schmale Mobilansicht ohne horizontalen Seitenüberlauf. Screenshots visuell geprüft.

## Grenzen der Prüfung

Die verwaltete Browserumgebung blockiert Top-Level-Seitenaufrufe. Deshalb liefen die vier UI-Tests mit `WHISKY_BROWSER_DOM_ONLY=true`: echte Module, CSS und API-Aufrufe, jedoch ersetzte History-Methoden. Der echte Browsertest für Zurück/Vorwärts und Neuladen wurde **nicht** ausgeführt. Er ist enthalten und läuft lokal mit `npm run test:browser`, ohne diesen Schalter. Die gesonderten Navigationstests liefen regulär.

Der Scanner-Decoder ist in den UI-Tests kontrolliert ersetzt. Es gibt keinen Nachweis für das optische Lesen eines Etiketts auf einem echten iPhone. Auch die externer Katalog-Erweiterung wurde nicht mit einer angemeldeten Live-Sitzung geprüft. Bestehende parserbezogene Tests verwenden Beispielinhalte.

Für die UI-Prüfung wurde der vorinstallierte Playwright-Treiber 1.57.0-beta-1764944708000 mit System-Chromium verwendet. Das Projekt deklariert als Entwicklungsabhängigkeit die stabile Version 1.56.1. Ein frischer Download der npm-Pakete war wegen fehlender Netzwerkverbindung der Ausführungsumgebung nicht möglich; die Lockfile-Metadaten wurden offline von npm akzeptiert. Die native Prüfung benötigt keine npm-Bibliotheken. Der GitHub-Workflow ist eingerichtet, aber nicht auf GitHub ausgeführt.

Diese Prüfungen sind Regressionstests, kein vollständiger Sicherheits-Audit und keine Garantie für alle Browser/Geräte.

V0.6.1: Der Dateiablage-UI-Test wurde im Chromium-DOM-Modus ergänzt (Upload und Löschen). Kein realer iPhone-Scanner-Test; keine echten Kundenbelege eingesetzt.


V0.6.3: Bestandszählung wird auf Karten und in Tabellen in disjunkte Gruppen (Standardflaschen und Samples) aufgeteilt. Drei zusätzliche Unit-Tests prüfen gemischten Bestand, reine Samples und alte Einträge ohne Typ. Ein Browser-DOM-Test prüft zusätzlich die korrekte Darstellung in beiden Übersichten.

## Archivierter Teststand v0.8.20 (09.11.2026)

- `npm run check`: bestanden (161 JavaScript-Dateien)
- `npm test`: 234/234 Unit- und Integrationstests bestanden
- `npm run release:check`: bestanden
- `npm run test:browser`: nicht lokal ausgeführt; Browser-Regression offen
- Browser-Layoutabnahme: nicht abgeschlossen


## v0.9.0 – letzter Stand vor der Herkunftskorrektur (09.11.2026)

- 238/238 Unit- und Integrationstests bestanden (siehe historischen Teststatus des v0.9.0-Pakets).
- Browser-Tests und visuelle Prüfung lokal nicht abgeschlossen.
- Im v0.9.1-Patch wurde die geographische Herkunftslogik der Analyse korrigiert.


## v0.15.12 – archivierter CI-Status (12.11.2026)

- `npm run check` und `npm run release:check`: bestanden.
- `npm test`: 353/353 Unit- und Integrationstests bestanden.
- GitHub-Actions-Browser-Test 24: **fehlgeschlagen** bei 320 px,
  `collection main should fill usable width 320, got 305`.
  Obwohl `document.documentElement.clientWidth` verwendet wurde, meldete
  der Root-Scrollcontainer 320 px; das Body-Layout war wegen des
  reservierten Scrollbar-Gutters nur 305 px breit.
- Die folgenden Drawer- und Ueberlaufpruefungen desselben Tests
  wurden in diesem CI-Lauf **nicht erreicht**.
- Browser-Durchlauf insgesamt: **nicht bestanden**. Korrekturen in v0.15.13,
  CI-Verifikation steht aus.

## v0.16.0 - Vor der MIME-Korrektur (12.11.2026)

- `npm test`: 360/360 erfolgreich; Browser-Test der Foto-Dialoge bestand.
- In echter Browserumgebung schlug der dynamische Import von `ort.wasm.min.mjs` fehl: Server lieferte `application/octet-stream` bei aktivem `nosniff` statt JavaScript.
- Ab v0.16.1 durch `.mjs`-MIME-Mapping und gezielten HTTP-Test korrigiert; vollständige WebAssembly-Inferenz weiterhin separat zu prüfen.


## v0.16.1 – vor dem automatischen Zuschnitt (12.11.2026)

- `npm run check` und `npm run release:check` erfolgreich.
- `npm test`: 361/361 bestanden.
- Gezielt getesteter Chromium-DOM-Fotodialog: 1/1 erfolgreich; echte ONNX-Inferenz und der vollständige Browserlauf offen.
- Ab v0.16.2 wird das KI-Ergebnis zusätzlich im exakten Seitenverhältnis 2:3 zugeschnitten und der Dialog ohne Bildbeschnitt angezeigt.


## Archivierter Teststatus v0.16.8 (12.11.2026)

**Stand:** 12.11.2026. **Bezugsbasis:** Quellpaket v0.16.8. Frühere Testergebnisse stehen in [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen (v0.16.8)

| Prüfung | Ergebnis | Aussagekraft |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionskonsistenz v0.16.8. |
| `node --test tests/unit/photo-cutout.test.js` | **14/14 bestanden** | Der bisher fehlerhafte Test zu transparenten Flaschen läuft mit dem ergänzten `analyzeBottleMask`-Import. |
| `npm test` | **374/374 bestanden** | Vollständige Unit- und Integrationstests mit begrenzter Parallelität (`node --test --test-concurrency=4`); kein Browserlauf. |
| `npm run check` | **Nicht abgeschlossen (Timeout)** | Gesamtprüfung erneut am Zeitlimit abgebrochen; betroffene JavaScript-Dateien, Übersetzungsschlüssel und Dokumentationslinks separat erfolgreich geprüft. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Browser-Abnahme bleibt offen. |
| Reale KI-Freistellung des Nutzerfotos | **Offen** | Ohne lokale ONNX-Inferenz ist nicht überprüfbar, ob die transparente PET-Flasche korrekt segmentiert und ausgerichtet wird. |
| Tatsächlicher Docker-Build / Lauf auf Raspberry Pi ARM64 | **Offen** | Keine lokale Docker-Engine. |

## Änderungen v0.16.8

- Fehlenden ES-Modul-Import von `analyzeBottleMask` im bereits vorhandenen Regressionstest für transparente Flaschen ergänzt. Dadurch tritt der GitHub-Actions-Fehler `ReferenceError: analyzeBottleMask is not defined` nicht mehr auf.
- Der Produktionscode für die Freistellung sowie Datenmodell, API und Docker-Image bleiben unverändert.

## Änderungen v0.16.7

- Automatische Drehung für Flaschenmasken von maximal 12° auf maximal 20° ausgeweitet. Oberhalb dieses Winkels sowie bei kaum länglichen Konturen bleibt die bisherige Schutzlogik aktiv.
- Maskengeometrie, Beschnitt, 2:3-Zielformat, Schärfung der Alphakante, ONNX-Modell und Originalfoto bleiben unverändert.
- Gezielte Geometrie-Regressionstests für beide Drehrichtungen mit nichtquadratischem Quellfoto ergänzt. Die realistische Glas-/Transparenz-Segmentierung muss auf dem Gerät visuell geprüft werden.

## Änderungen v0.16.6

- Docker-Laufzeitbasis von `node:22-alpine` auf `node:22-bookworm-slim` umgestellt. Die vorherige ARM64-Alpine-Variante stürzte auf Raspberry Pi 4 bereits bei `node --version` mit Exit 139 ab, während die Debian-Basis Node.js 22 korrekt ausführte.
- Restic, Rclone, OpenSSH-Client und CA-Zertifikate werden jetzt über Debian `apt-get` bereitgestellt. Keine Änderungen an App-Code, Datenformaten, Volumes oder Compose-Service.
- Deployment-Regressionstest, GHCR-Release-Smoke-Checks fuer Node/Restic/Rclone/SSH auf beiden Architekturen und Raspberry-Pi-Dokumentation angepasst. Der Live-Betrieb des neu gebauten Images ist noch nicht verifiziert.

## Änderungen v0.16.5

- Klick auf eine Flasche im angezeigten Regalfach öffnet ein schreibgeschütztes Detail-Modal statt unmittelbar den Umlagerungseditor.
- Foto/Platzhalter, Lagerort, Inventarnummer, Status, Füllmenge, Flaschentyp sowie vorhandene Abfüllungs-/Flaschendaten werden gezeigt. Der Link **Zur Detailseite** führt zur richtigen Abfüllung und hebt die angeklickte physische Flasche hervor; **Umlagern** ist ein eigener Button.
- Responsive Darstellung und deutsche/englische Labels. Keine API-, Schema- oder Datenpersistenzänderungen.
- Neuer Unit-Test und neuer Browser-Regressionstest (im Code); zusätzlich gezielter lokaler Chromium-DOM-Test mit 390-px-Layoutcheck ausgeführt.

## Änderungen v0.16.4

- Die Freistellung reduziert die breite Alpha-Überblendung **nach** Rotation, Skalierung und Rasterisierung durch eine Smoothstep-Kurve (Alpha 110–190). Schwache Hintergrund-Restwerte entfallen, während eine schmale Antialias-Zone bestehen bleibt. Originalfoto, API, Datenformat und Komponentenauswahl bleiben unverändert.
- Zwei neue Unit-Tests prüfen Alphakurve und unveränderte RGB-Kanäle. Zwei gezielte Chromium-DOM-Tests prüfen den tatsächlich exportierten PNG-Rand und den bestehenden randlosen 2:3-Zuschnitt.
- Echte U²-Netp-Inferenz mit Glasflaschen und visuelle Geräteprüfung bleiben offen.

## Änderungen v0.16.3

- Nach der KI-Segmentierung wird nur die zentrale Hauptkomponente behalten, einschließlich eines ein Pixel breiten Antialias-Randes. Abgetrennte Maskenfragmente werden auch aus der **exportierten transparenten PNG-Datei** entfernt.
- Aus der Kontur wird die Hauptachse in den **natürlichen Bildproportionen** bestimmt; plausible kleine Schräglagen werden in v0.16.3 bis maximal 12 Grad automatisch gedreht. Unplausible oder kaum langgestreckte Konturen bleiben unangetastet.
- Nach der Drehung wird das Objekt erneut eng auf transparentes 2:3 zugeschnitten. Ein zusätzlicher rasterbasierter Durchlauf entfernt verbleibende leere Zeilen oben/unten, soweit dies ohne Abschneiden der Flasche möglich ist.
- Zusätzliche Unit-Tests für Komponentenauswahl, Rotation und Zuschnitt sowie ein echter Chromium-Canvas-Test ohne ONNX-Modell.

## Vorherige Änderungen v0.16.2

- Nach der Segmentierung wird die zusammenhängende Flaschenmaske zur transparenten Ausgabe im exakten Seitenverhältnis 2:3 zugeschnitten. Bei breiten Objekten kann transparenter Rand verbleiben, um nichts von der Flasche abzuschneiden.
- Der wiederholende „Neu freistellen“-Button entfällt; nur bei einem Berechnungsfehler gibt es eine erneute Ausführung.
- Original- und Ergebnisbild werden im Dialog nicht mehr durch Grid-Mindestgrößen angeschnitten. Bei schmalen Bildschirmen werden beide vollständig untereinander angezeigt; der Dialog bleibt scrollbar.

## Korrektur v0.16.1

- Der statische Server liefert `.mjs`-Module jetzt mit `text/javascript; charset=utf-8` aus. Mit `X-Content-Type-Options: nosniff` waren sie zuvor fälschlich `application/octet-stream` und wurden vom Browser blockiert.
- Die ONNX- und WASM-Binärdateien selbst wurden nicht verändert. Ein echter End-to-End-Freistellungstest mit den vorbereiteten Assets auf dem Raspberry Pi steht weiterhin aus.

## Funktionsumfang und Grenzen

- **v0.16.0:** Die physische Flasche kann eine transparente PNG-Ableitung neben einem weiterhin unveränderten Originalfoto speichern. `selected` steuert die Anzeige im Sammlungskatalog, in Details und im Lager. Vorschau wird lokal im Browser berechnet, Übernehmen erfolgt ausdrücklich über den Button. Die vorhandene ZIP-Sicherung erfasst beide Dateien.
- **Keine neue Schema-Hauptversion:** Das optionale Feld `photos[].cutout` ergänzt Schema 4. Bestehende Fotos und alte Sammlungen bleiben lesbar. Die Freistellung erzeugt keine Cloud-Anfragen im Normalbetrieb.
- **Einmaliger Modell-Download beim Image-Build bzw. lokal mit `npm run cutout:prepare`:** Ausgehender Netzwerkzugang beim Build erforderlich. Der Quell-ZIP enthält absichtlich keine binären Drittanbieter-KI-Dateien.
- Die maschinelle Segmentierung, WebAssembly-Inferenz und tatsächliche Bildergebnisse konnten hier wegen fehlender Modell-/Runtime-Assets **nicht end-to-end getestet** werden. Dies ist eine funktionale Freigabegrenze, keine bestandene Browserprüfung.

[Freistellungskonzept und Betrieb](PHOTO_FREISTELLUNG.md)

---

## Testbericht v0.16.12 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.16.11 mit automatischer Synchronisierung des Teststatus beim Versionssprung auf 0.16.12; Anwendungscode, Abhaengigkeiten und Docker-Konfiguration sind unveraendert. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben im öffentlichen Projekt stimmen überein. |
| `npm run check` | **Bestanden** | 209 JavaScript-Dateien, 892 referenzierte Übersetzungsschlüssel und 81 relative Links geprüft. |
| `npm test` (mit `--test-concurrency=4`) | **343/343 bestanden** | Öffentliche Unit- und Integrationstests, einschließlich Verbot älterer Importformate und entferntem HTML-Endpunkt. |
| Private Erweiterung: `npm test` | **Nicht erneut ausgefuehrt** | Separates privates Projekt; nicht Bestandteil dieses Quellpakets. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Reale Browserinteraktion und Zusammenspiel mit Erweiterung offen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Ausführung auf Raspberry Pi nach CI-Release prüfen. |

Die öffentlichen Unit-/Integrationstests wurden mit `node --test --test-concurrency=4 tests/unit/*.test.js tests/integration/*.test.js` ausgeführt. Eine echte angemeldete Quellseite und der Browser-Erweiterungsablauf wurden hier nicht live geprüft.

### Änderungen v0.16.12

- Release-Metadaten auf 0.16.12 fortgeschrieben; das Bump-Skript aktualisiert nun auch den Teststatus und archiviert vorherige Pruefberichte.
- release:check validiert jetzt die Teststatus-Version; die neuen Regressionstests verhindern erneute CI-Ausfaelle durch einen veralteten Teststatus. Kein Eingriff in Programmfunktionen, Importprotokoll oder Deployment.
- Ein fehlender Remote-Branch `develop` wird nicht durch dieses ZIP angelegt und muss auf GitHub separat eingerichtet werden.

### Historische Änderungen v0.16.11

- Dependabot-Abhaengigkeit `playwright-core` von 1.64.1 auf 1.65.0 aktualisiert; `package-lock.json` enthaelt die passende Archiv-URL und Integritaetspruefsumme.
- Zwei Tests fuer Docker- und Release-Workflow lesen die exakte `playwright-core`-Version aus `package.json` und verifizieren die Uebereinstimmung mit dem Lockfile. Dadurch scheitert CI nicht mehr durch legitime Dependabot-Updates.
- Sonstige Anwendungslogik, Datenformate, Importprotokoll und Deployment-Konfiguration bleiben unveraendert.

### Unveraenderte Funktionen aus v0.16.10

- Nur noch `#wcm-import=` mit Payload-Version 2 und `source: "external"` wird angenommen. Alte Fragmente und Payload-Version 1 werden nicht mehr verarbeitet.
- Alten HTML-Importparser samt API-Endpunkt und den dazugehörigen Unit-Tests entfernt; ein Integrationstest prüft den entfallenen Endpunkt.
- Öffentliches Repository ohne Erweiterungsdateien und ohne anbieterspezifische Anleitung.
- WB-ID und Quellenlink bleiben im Datenmodell, Formular und bereits gespeicherten Einträgen erhalten. Kein Datenbankschemawechsel.
- Die private Erweiterung wurde auf das neue Format umgestellt; beide Projekte müssen gemeinsam aktualisiert werden.

---

## Testbericht v0.16.13 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.16.12; Korrektur der Fotosortierung auf der Abfuellungsdetailseite. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten und Teststatus zeigen v0.16.13. |
| `npm run check` | **Bestanden** | 210 JavaScript-Dateien, 892 Uebersetzungsschluessel, 82 relative Markdown-Links. |
| `npm test` (mit `--test-concurrency=4`) | **345/345 bestanden** | Unit- und Integrationstests einschliesslich neuer Tests zur Fotosortierung. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Neuer Playwright-Chromium-Regressionstest vorhanden; im aktuellen Buildsystem waren die Browser-Testabhaengigkeiten nicht verfuegbar. Ausfuehrung in CI erforderlich. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach Release auf Raspberry Pi pruefen. |

Die Unit-/Integrationstests wurden mit `node --test --test-concurrency=4 tests/unit/*.test.js tests/integration/*.test.js` ausgefuehrt. Der hinzugefuegte Browser-Test fuer Maus-Drag am Griff und Bild, Drop ausserhalb und normales Oeffnen der Grossansicht wurde hier nicht live ausgefuehrt.

### Aenderungen v0.16.13

- Fotosortierung verwendet fuer Desktop-Maus, Touch und Stift einheitliche Pointer-Events mit Pointer Capture statt des nativen HTML-Drag-and-Drop-Verhaltens von Chrome.
- Auf Desktop kann am Sortiergriff oder direkt auf dem Vorschaubild gezogen werden. Auf Touch-Geraeten ist weiterhin nur der Griff Drag-aktiv, damit das Scrollen und die normale Foto-Grossansicht funktionieren.
- Die Position beim Loslassen bestimmt das Ziel. Abbruch ausserhalb einer Galerie oder an derselben Foto-Position speichert nichts; der durch Drag synthetisierte Klick oeffnet keine Grossansicht.
- Die Links-/Rechts-Pfeilbuttons bleiben als barrierearme Alternative erhalten. Zwei Unit-Tests und ein Playwright-Browser-Regressionstest hinzugefuegt.
- Keine Aenderung am Datenmodell, API-Vertrag, Importformat oder Docker-Deployment.

---

## Testbericht v0.16.14 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.16.13, Korrektur der Kartenkamera nach dem Speichern einer Destillerieposition. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben und Release-Metadaten stimmen überein. |
| `npm run check` | **Bestanden** | 210 JavaScript-Dateien, 892 Übersetzungsschlüssel und 83 relative Links geprüft (vor finaler Dokumentationsprüfung). |
| `npm test` | **345/345 bestanden** | Vollständige Unit- und Integrationstests mit `--test-concurrency=4`; bestehende Funktionen ohne Regression. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Neuer Chromium-Regressionstest für Erhalt von Zoom, Zentrierung und Metadatenänderungen ergänzt; Playwright-Installation hier nicht abgeschlossen (Timeout). |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Raspberry Pi nach erfolgreichem Release prüfen. |

### Änderungen v0.16.14

- Der Karten-Viewer kann die aktuelle Kamera (Mittelpunkt und Zoomstufe) beim Neuzeichnen übernehmen, anstatt alle Standorte erneut einzupassen.
- Bei geänderten Destilleriekoordinaten wird ausschließlich zur aktualisierten Position geschwenkt, ohne die gewählte Zoomstufe zu verändern. Reine Status- und Namensänderungen lösen keine Neuzentrierung aus.
- Der Schalter „Alle Destillerien anzeigen“ führt weiterhin bewusst eine Neuberechnung des Kartenausschnitts aus; das Aufrufen der Karte aus einer Abfüllungsdetailseite behält seine gezielte Fokussierung.
- Browser-Regressionstest ergänzt; echte Chromium-Ausführung auf CI noch zu bestätigen. Anwendungsdaten, Importformat und Docker-Konfiguration unverändert.

---

## Testbericht v0.16.15 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.16.14 mit Korrektur des Karten-Updates und einem neu gestalteten Lagerort-Dialog. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version in Paketdateien, README, Changelog und Teststatus konsistent. |
| `npm run check` | **Bestanden** | 212 JavaScript-Dateien, 906 verwendete Übersetzungsschlüssel und 84 relative Links geprüft. |
| `npm test` | **347/347 bestanden** | Vollständige öffentliche Unit- und Integrationstestsuite, einschließlich neuer Lagerort-Regressionstests. |
| Gezielter Chromium-DOM-Test: Karte | **Bestanden** | Nach Statusänderung bleibt der verschobene Kartenmarker bei exakt demselben Bildschirmpunkt (55/25 Pixel); Zoom 12 bleibt erhalten. Neue Koordinaten verändern den Zoom nicht. |
| Gezielter Chromium-DOM-Test: Lagerort | **Bestanden** | Dreistufige Auswahl und Belegungsanzeige, Umschaltung auf „Ohne Lagerort“ und mobile Ansicht mit einer Spalte (390 Pixel). |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollständige Node-Playwright-Browsersuite wegen fehlender `playwright-core`-Installation hier nicht gestartet. Der gezielte Chromium-Test verwendete Python Playwright mit abgefangenen HTTP-Anfragen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Prüfung nach CI-Release auf dem Raspberry Pi. |

### Änderungen v0.16.15

- Der Lagerort-Dialog stellt den aktuellen Lagerplatz und die Zielauswahl getrennt dar, inklusive Kapazität pro Fach, einer expliziten Option ohne Lagerplatz und einem responsiven Layout.
- Die Karte wird bei Datenaktualisierungen nicht mehr zerstört und neu aufgebaut. Marker und Seitendaten werden in-place aktualisiert, wodurch Panning, Zoom und Kameramittelpunkt bei reinen Metadatenänderungen erhalten bleiben.
- Nur bei geänderten Destillenkoordinaten erfolgt ein gezieltes Zentrieren auf die korrigierte Position mit der vorherigen Zoomstufe.
- Der Browser-Regressionstest für Kartenänderungen verlangt nun zusätzlich, dass das Kartelement beim Speichern identisch bleibt.

Der gezielte Chromium-Test deckt die beschriebenen Abläufe ab, ersetzt aber nicht die vollständige Browser-CI-Suite.

---

## Testbericht v0.16.16 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.16.15 mit Korrektur der Flaschenbild-Skalierung im Lagerort-Zuordnungsdialog. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Version in Paketdateien, README, Changelog und Teststatus konsistent. |
| `npm run check` | **Bestanden** | 212 JavaScript-Dateien, 906 verwendete Übersetzungsschlüssel und 85 relative Dokumentationslinks geprüft. |
| `npm test` (Unit- und Integrationstests) | **347/347 bestanden** | `node --test --test-concurrency=4 tests/unit/*.test.js tests/integration/*.test.js`. |
| Gezielter Chromium-CSS-Test | **Bestanden** | Großes Hochformatbild: vorherige CSS-Version überragt 96-Pixel-Vorschau mit 288 Pixel Bildhöhe, neue Variante misst 96 Pixel. Mobile: alt 232 Pixel im 77-Pixel-Rahmen, neu 77 Pixel. `object-fit: contain` bleibt aktiv. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Der vorhandene Chromium-Regressionstest wurde um die Bildgrößenprüfung auf Desktop/Mobil erweitert, die komplette Node-Playwright-Suite wurde hier nicht gestartet. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Prüfung nach CI-Release auf dem Raspberry Pi. |

### Änderungen v0.16.16

- Das Bild im Lagerort-Zuordnungsdialog ist jetzt absolut innerhalb eines fest dimensionierten Vorschaucontainers positioniert. Dadurch kann die intrinsische Größe hoher Flaschenfotos nicht mehr das CSS-Grid aufweiten und das Bild abschneiden.
- Die ursprünglichen Proportionen bleiben erhalten (`object-fit: contain`). Das Vorschaubild passt vollständig in den verfügbaren Rahmen auf Desktop und Mobilgeräten.
- Browser-Regressionstest für ungewöhnlich hohe Bilddateien bei beiden Bildschirmgrößen ergänzt.

Ein gezielter Chromium-CSS-Test wurde mit einem synthetischen Testbild und der tatsächlichen CSS-Regel durchgeführt. Das ersetzt keine vollständige Browser-CI-Prüfung der Anwendung.

---

## Testbericht v0.16.17 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.16.16 mit gezielter Korrektur der Radio- und Checkbox-Marker. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben in Paketdateien, README, Changelog und Teststatus stimmen überein. |
| `npm run check` | **Bestanden** | 213 JavaScript-Dateien, 906 referenzierte Übersetzungsschlüssel und 86 relative Dokumentationslinks geprüft. |
| `npm test` | **348/348 bestanden** | Unit- und Integrationstests einschließlich neuem CSS-Regressionstest. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Direkter Chromium-Versuch konnte hier nicht abgeschlossen werden; keine vollständige Browser-Prüfung. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach Veröffentlichung auf dem Raspberry Pi prüfen. |

### Änderungen v0.16.17

- Die nativen Radio-Markierungen im Lagerort-Zuordnungsdialog und die Checkboxen der Möbel-Mehrfachauswahl werden auf 18 × 18 Pixel begrenzt, einschließlich `min-height`, `padding` und `margin`.
- Die allgemeine Formularregel (`min-height: 44px`, `padding: 11px 12px`) beeinflusst diese beiden Auswahlmarkierungen nicht mehr.
- Sonstige Gestaltung, Kartenauswahl, Abstände, Ereignisverarbeitung, Datenmodell und Docker-Konfiguration unverändert.

---

## Testbericht v0.17.0 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.16.17. Neuer nicht-destruktiver Bildeditor auf der Abfüllungsdetailseite. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionen in Paketdateien, README, Changelog und Teststatus konsistent. |
| `npm run check` | **Bestanden** | 217 JavaScript-Dateien, 919 Übersetzungsschlüssel und 89 Dokumentationslinks geprüft. |
| `npm test` | **353/353 bestanden** | Unit- und Integrationstests inklusive Parametergrenzen, RGB/Alpha, Auto-Korrektur, Dateischutz, Korrekturwechsel und Backup. |
| Gezielt: `browser: photo editor` | **Bestanden** | Chromium im DOM-Testmodus: Vorschau, EV-Regler, Vorher/Nachher, Speichern, Regler wiederherstellen, Zurücksetzen. |
| Desktop/Mobil: gezielter Chromium-Durchlauf | **Bestanden** | 1400 × 900 und 390 × 844 Pixel; Vorschau verändert, Speichern, erneutes Öffnen, Original wiederhergestellt. |
| `npm run test:browser` (vollständige CI-Suite) | **Nicht abgeschlossen** | 20 Tests bestanden, 1 browserabhängiger Test übersprungen; Testlauf danach wegen Zeitlimit abgebrochen. Kein vollständiges CI-Ergebnis. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Veröffentlichung und Prüfung auf Raspberry Pi nach GitHub-Release. |

### Änderungen v0.17.0

- Neue Bildkorrektur in der Fotogalerie mit neun Reglern (Belichtung, Kontrast, Lichter, Tiefen, Temperatur, Tönung, Sättigung, Klarheit, Schärfe), automatischem Vorschlag, Live-Vorschau und Vorher/Nachher.
- Ausgangsbild und aktive Freistellung bleiben unverändert. Reversible Reglerwerte plus separat gerenderte WebP-Ableitung mit Upload-Limit und serverseitiger Validierung.
- Löschen und erneutes Speichern räumen alte Ableitungen auf; vollständige ZIP-Backups enthalten neue Bilddateien. Lager- und Sammlungsansicht verwenden die bearbeitete Darstellung.
- Neue Unit-, Integration- und Browser-Regressionsprüfungen. Keine neue Abhängigkeit und keine Änderung der Schema-Versionsnummer.

---

## Testbericht v0.17.1 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-13. **Status:** v0.17.1 geprueft. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Alle Release-Metadaten auf 0.17.1. |
| `npm run check` | **Bestanden** | Syntax, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **357/357 bestanden** | Einschliesslich Reset-Gruppen und Pixelberechnung der Weißabgleich-Pipette. |
| `npm run test:browser` | **Nicht abgeschlossen** | Playwright-Core aus dem npm-Registry-Download nicht verfuegbar; gezielter Chromium-Test separat mit Python-Playwright und lokalem Server-Request-Routing auf Desktop (1366px) sowie 390px Viewport bestanden. Neuer CI-Browser-Regressionstest enthalten, noch nicht im kompletten Node-Browserlauf ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.17.1

- Flaschenbild bearbeiten: Textschaltflaeche durch Stift-Icon ersetzt, analog Freistellungs-Icon.
- Eigene Reset-Buttons fuer Licht, Farbe und Details; Weißabgleich-Pipette mit markierbarem neutralen Referenzbereich, ohne Aenderung des Originals.

Originalbilder und Freistellungen werden bei diesem UI-Update nicht veraendert; der Browser-Test hat die Ruecksetzung einzelner Gruppen und die Korrektur anhand eines markierten neutralen Bereichs geprueft.

---

## Testbericht v0.17.2 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.17.1 mit korrigiertem kombinierten Fotoeditor. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsdateien stimmen überein. |
| `npm run check` | **Bestanden** | JavaScript-Syntax, Module, Übersetzungen und Dokumentationslinks. |
| `npm test` | **358/358 bestanden** | Vollständige Unit-/Integrationstests inklusive atomarer Korrektur-/Freistell-Speicherung, Wechsel und Entfernen. |
| Gezielter Chromium-Lauf Desktop | **Bestanden** | 1366 px; 28×28-Icon-Buttons, kein Reset/Slider-Overlap, genau eine Vorschau, Belichtung 0,6 → Freistellen → Speichern → erneut bearbeiten. |
| Gezielter Chromium-Lauf Mobil | **Bestanden** | 390 px; dieselben Bedienabläufe und Größenprüfungen. |
| `npm run test:browser` | **Nicht abgeschlossen** | Ein zusätzlicher Browser-Regressionstest ist enthalten; der vollständige Node-Playwright-Lauf wurde in dieser Umgebung nicht ausgeführt. Bei den gezielten Chromium-Prüfungen wurde die ONNX-Segmentierung durch eine deterministische Testmaske ersetzt. |
| Echte ONNX-Freistellung / ARM64-Docker | **Nicht lokal ausgeführt** | Nach dem Release visuell und auf dem Raspberry Pi prüfen. |

### Änderungen v0.17.2

- Bildeditor und Freistellung in einer einzigen Oberfläche mit einer Vorschau statt zweier Bilder.
- Bestehende Korrekturen bleiben beim Freistellen erhalten; Original/Freistellung haben getrennte reversible Korrektursätze.
- Galerie-Stift und Schere identisch groß; Gruppen-Reset-Symbole überlagern die Regler nicht mehr.
- Kombinierte Bilddateien werden serverseitig innerhalb einer Collection-Änderung zusammen gespeichert; Original bleibt unverändert.

---

## Testbericht v0.17.3 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.17.2 mit vereinheitlichtem Bildeditor, Zoom und manueller Freistellmasken-Korrektur. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben, Changelog und Teststatus sind konsistent. |
| `npm run check` | **Bestanden** | JavaScript-Module, Übersetzungsschlüssel und Dokumentationslinks geprüft. |
| `npm test` | **362/362 bestanden** | Unit- und Integrationstests; vier neue Masken-Pinseltests prüfen Alpha, Wiederherstellen, Zoom-unabhängige Normalisierung und Rückgängig. |
| Chromium: Desktop und Mobil | **Gezielte Tests bestanden** | 1366 × 900 und 390 × 844: Editieren einer vorhandenen Freistellung, Radieren bei 150 % Zoom, Strich-Rückgängig, Werkzeugwechsel und Speichern als neues PNG; Original bleibt erhalten. Chromium lief im DOM-Testmodus mit abgefangenen lokalen Netzwerkaufrufen. |
| `npm run test:browser` | **Nicht vollständig ausgeführt** | Ein neuer automatisierter Browser-Regressionstest ist enthalten; die komplette Suite wurde hier nicht durchlaufen. |
| Echte ONNX-Maskenerkennung / ARM64-Docker | **Nicht lokal ausgeführt** | Modellqualität und Raspberry-Pi-Deployment sind separat zu prüfen. |

### Änderungen v0.17.3

- Nur ein Galerie-Stift-Button führt zum Fotoeditor; Freistellung kann separat entfernt werden.
- Weißabgleich-Pipette direkt vor dem Gruppen-Reset der Farbe.
- Anzeige-Zoom bis 600 %, ohne den Export zu beeinflussen.
- Lokales Radieren, Wiederherstellen und Rückgängig der Freistellmaske; Pinselgröße und Alpha-Export auch bei Zoom unterstützt.

**Grenze der Wiederherstellung:** Der Wiederherstellen-Pinsel greift auf den Alphakanal der beim Öffnen vorhandenen Freistellung zurück. Er kann keine schon vom Segmentierungsmodell vollständig entfernten Bildteile rekonstruieren. Gespeicherte Maskenkorrekturen erzeugen eine neue transparente PNG-Basis; das Foto-Original wird nicht überschrieben.

---

## Testbericht v0.17.4 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.17.3 mit korrigierter, höher auflösender Foto-Pipeline und konstant großer Vorschau mit zwei Tabs. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Paket- und Dokumentationsversion konsistent. |
| `npm run check` | **Bestanden** | 220 JavaScript-Dateien, 928 referenzierte Übersetzungsschlüssel und 93 Dokumentationslinks geprüft. |
| `npm test` | **364/364 bestanden** | Vollständige Unit- und Integrationstests einschließlich der neuen Auflösungs- und Altbestandsprüfungen. |
| Chromium: fester Ausschnitt und Tabs | **Gezielte Desktop-/Mobiltests bestanden** | Tabwechsel verändert die Vorschauhöhe nicht: Desktop 567 px, Mobil 390 px. |
| Chromium: Korrigieren → Freistellen → Speichern → erneut öffnen | **Gezielter Test bestanden** | Belichtung +0,6 bleibt gespeichert; das gerenderte freigestellte WebP ist heller als das rohe Freistell-PNG (mittlere RGB-Werte 111,2 statt 91,0) und hat identische Abmessungen von 1514 × 2271 px. |
| `npm run test:browser` | **Nicht abgeschlossen** | Die volle Node-Playwright-CI-Suite steht weiterhin aus; der gezielte Chromium-Test lief als Python-Playwright-Test mit abgefangenen lokalen Seitenaufrufen. |
| Echte ONNX-Freistellung / ARM64-Docker | **Nicht lokal ausgeführt** | Chromium verwendete eine reproduzierbare Testmaske. Erkennungsqualität an Glas und realen Fotos muss separat geprüft werden. |

### Änderungen v0.17.4

- Bildansicht behält ihre Größe, unabhängig vom aktiven Tab und von vorhandenen Radierer-Werkzeugen.
- Freistellung bis 4096 px Crop-Höhe (statt bisher maximal 1600 px), sofern die PNG-Dateigrenze es erlaubt; hochauflösender WebP-Export verwendet angepasste Qualitätsstufen vor einer etwaigen Verkleinerung.
- Farbanpassungen werden beim Freistellen und Speichern erhalten. Fehlende Cutout-Reglerwerte älterer Fotos werden beim Öffnen aus dem bearbeiteten Original übernommen.
- Zwei Tabs rechts: Anpassungen und Freistellung mit Radierer, Wiederherstellen und Maskenwerkzeugen.

**Grenzen:** Die Freistellmaske wurde im gezielten Browser-Test synthetisch erzeugt. Die Prüfung belegt Speichern, Pixeländerung, Auflösung und UI-Zustand, nicht die Güte der echten KI-Erkennung. Das Bild wird nur bei Upload- oder Speicherlimits herunterskaliert.

---

## Testbericht v0.17.5 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-13. **Status:** Reguläre Prüfungen bestanden; vollständiger Browserlauf offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben stimmen überein. |
| `npm run check` | **Bestanden** | 220 JavaScript-Dateien, 928 referenzierte Übersetzungsschlüssel und 94 relative Dokumentationslinks geprüft. |
| `npm test` | **364/364 bestanden** | Öffentliche Unit- und Integrationstests. |
| `npm run test:browser` | **Nicht abgeschlossen** | Gesamtsuite nicht ausgeführt; gezielte Chromium-Prüfungen separat erfolgreich. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.17.5

- Bildvarianten im Fotoeditor nur lokal umschalten; Auswahl und Korrekturen erst beim Speichern uebernehmen.
- Zoom und Vorher/Nachher überlagern nur die Bildvorschau; der Hinweis steht über die gesamte Editorbreite. Der Reglerbereich nutzt auf Desktop 44 px zusätzliche Höhe.
- Gezielt in Chromium mit 1366 × 900, 844 × 390, 390 × 844 und 320 × 568 geprüft: Bildrahmen unverändert; Zoom/Vorher-Nachher innerhalb des Bildrahmens, Klicks und Zoomzustand funktionieren. Original/Freistellung lokal umgeschaltet und erst beim Speichern übernommen (Desktop/Mobil). Die vollstaendige Browser-CI-Suite wurde nicht ausgeführt.

Nach Durchfuehrung der Pruefungen die Ergebnisse und ihre Grenzen hier dokumentieren.

---

## Testbericht v0.17.6 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-13. **Status:** Reguläre Prüfungen und gezielte Browserprüfungen bestanden; vollständige Browser-CI-Suite noch offen. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Metadaten und Versionsangaben stimmen überein. |
| `npm run check` | **Bestanden** | 220 JavaScript-Dateien, 928 referenzierte Übersetzungsschlüssel und 95 relative Dokumentationslinks geprüft. |
| `npm test` | **366/366 bestanden** | Unit- und Integrationstests inklusive zwei neuer Regressionstests für fehlende Bildmetadaten. |
| `npm run test:browser` | **Nicht abgeschlossen** | Gesamtsuite nicht ausgeführt; gezielter Chromium-Test für frisches Foto wurde separat ausgeführt. |
| Chromium: Neues Bild → Bearbeiten → Speichern → erneut öffnen | **Bestanden** | Desktop 1366 × 900 und Mobil 390 × 844; neue Fotos ohne `cutout`/`adjustment` öffnen mit neutralen Reglern, speichern +0,5 Belichtung und laden sie erneut. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach Release auf dem Raspberry Pi prüfen. |

### Änderungen v0.17.6

- Fehler beim Öffnen neuer Flaschenfotos ohne Freistellung behoben: ein Vergleich zweier fehlender Eigenschaften wurde bisher irrtümlich als vorhandene Freistellungsanpassung behandelt und führte zu `Cannot read properties of undefined (reading 'adjustment')`.
- Anfangswerte für Original und Freistellung werden jetzt mit expliziten Existenzprüfungen ermittelt. Fehlende Bearbeitungsdaten starten bei neutralen Reglerwerten; bereits bearbeitete Originale und Freistellungen behalten ihre gespeicherten Werte.
- Zwei Unit-Regressionstests für neue Bilder ohne Bearbeitungsdaten und für die getrennten gespeicherten Korrekturen ergänzt. Die vorhandenen Browserfälle für frisch hochgeladene Bilder bleiben bestehen.

Die vollständige Chromium-CI-Suite und ein Docker-/ARM64-Livetest wurden hier nicht erneut ausgeführt.

---

## Testbericht v0.17.7 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.17.6; Vergleich nach Freistellung und Pipetten-Icon korrigiert. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Dateien und Version 0.17.7 stimmen überein. |
| `npm run check` | **Bestanden** | 220 JavaScript-Dateien, 928 referenzierte Übersetzungsschlüssel und 96 relative Dokumentationslinks geprüft. |
| `npm test` | **366/366 bestanden** | Unit- und Integrationstests. |
| Gezielter Chromium-Test | **Bestanden** | Direkt nach erster Freistellung sowie nach Speichern/erneutem Öffnen: Vorher zeigt das deckende Original, Nachher die transparente Freistellung. Geprüft bei 1366 × 900 und 390 × 844; synthetische ONNX-Testmaske. |
| `npm run test:browser` | **Nicht abgeschlossen** | Vollständige Browser-Suite lokal nicht ausgeführt; neuer Browser-Regressionstest hinzugefügt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Ausführung auf Raspberry Pi nach CI-Release prüfen. |

### Änderungen v0.17.7

- Vorher/Nachher berücksichtigt neben Farbkorrekturen jetzt auch die Freistellung selbst, ohne Dialogwechsel oder Speichern.
- Das Original für den Vergleich wird bei frisch freigestellten Fotos im Editor gehalten und bei gespeicherten Freistellungen bei Bedarf nachgeladen.
- Das Pipetten-Icon wurde auf eine klar erkennbare Pipettenform umgestellt; das übrige Editorlayout bleibt unverändert.

Die echte U2Netp-/ONNX-Erkennungsqualität wurde nicht geprüft; der Chromium-Test verwendet eine deterministische synthetische Maske.

---

## Testbericht v0.17.8 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.17.7; nur die Aufteilung des Fotoeditors geändert. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben im Projekt stimmen überein. |
| `npm run check` | **Bestanden** | 220 JavaScript-Dateien, 928 referenzierte Übersetzungsschlüssel, 97 relative Markdown-Links geprüft. |
| `npm test` | **366/366 bestanden** | Unit- und Integrationstests. |
| Gezielte Chromium-Prüfung | **Bestanden** | Dialog bei 1366×900, 1366×768, 1152×648, 844×390, 390×844 und 320×568 geprüft. Bild-/Reglerhöhe auf Desktop gleich; Zoom/Vorher-Nachher im Vorschaufenster, Status und Buttons ohne Überdeckung. |
| `npm run test:browser` | **Nicht abgeschlossen** | Vollständige Browser-CI-Suite in dieser Umgebung nicht ausgeführt; bestehender Layout-Regressionstest aktualisiert. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Zielsystemprüfung nach Release offen. |

### Änderungen v0.17.8

- Gemeinsame Arbeitsbereichshöhe für Foto-Vorschau und rechte Tab-/Reglerspalte; bisherige überstehende 44 Pixel entfernt.
- Regler-Inhalt separat scrollbar; die Tab-Leiste selbst bleibt stehen.
- Statusmeldung kompakter, unterhalb der Spalten über volle Breite, und Aktionsleiste ohne unnötigen Leerraum.
- Kein Eingriff in Bildkorrekturen, Freistellung, Speicherformat oder Bildauflösung.

Die gezielte Chromium-Prüfung nutzte eine synthetische lokale Flaschenbilddatei; die vollständige Browser- und die ONNX-Erkennungsprüfung wurden nicht ausgeführt.

---

## Testbericht v0.17.9 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.17.8; ausschließlich Fehlerkorrekturen im Fotoeditor und passende Regressionstests. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version in Paket, Lockfile, README, Changelog und Teststatus konsistent. |
| `npm run check` | **Bestanden** | 220 JavaScript-Dateien, 928 referenzierte Übersetzungsschlüssel, 98 relative Markdown-Links geprüft. |
| `npm test` | **366/366 bestanden** | Unit- und Integrationstests des ursprünglichen Funktionsumfangs. |
| Gezielte Chromium-Prüfung im lokalen DOM-Modus | **6/6 bestanden** | Fotoeditor-Layout, gespeicherte Freistellung und Umschalten, synchroner Originalvergleich, Maskenpinsel, reversible Bildkorrekturen, Weißabgleich. |
| ONNX-abhängige Browserregressionen (Tests 50 und 51) | **2/2 bestanden unter angepasstem Testaufbau** | Separater Validierungsklon mit synthetischem ONNX-Modul und für die lokale Sandbox korrigierter Import-URL; die Hilfsänderung ist **nicht** Teil des Releases. |
| Vollständiges `npm run test:browser` im normalen Navigationsmodus | **Nicht lokal ausgeführt** | Chromium blockiert hier `http://127.0.0.1` mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Vollständige GitHub-CI-Prüfung steht aus. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Prüfung auf dem Zielsystem offen. |

### Änderungen v0.17.9

- Vorher/Nachher zeichnet das ursprüngliche, vollständig deckende Foto vor dem Umschalten des UI-Zustands. Dadurch bleibt nicht kurzzeitig die transparente Freistellung sichtbar.
- Bereits gespeicherte Original- und Freistellungsbilder werden beim Öffnen des Editors vorgeladen; der Vorschauwechsel erfolgt ohne asynchrones Nachladen.
- Browser-Test zum Entfernen einer Freistellung prüft weiterhin vorhandene Originalkorrekturen statt fälschlich das uneditierte Originalbild zu erwarten.
- Regressionstest zur unmittelbar vollständigen Originalvorschau ergänzt; Slider-Test vergleicht numerische Werte statt browserabhängiger Zeichenfolgen.

**Keine Etikettenerkennung / OCR:** Ausgangspunkt ist ausdrücklich das Archiv v0.17.8. Die in v0.18.0 eingeführten Funktionen sind nicht enthalten.

---

## Testbericht v0.17.10 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.17.9 ohne Etikettenerkennung/OCR. Fehlertexte und API-Fehlerausgabe wurden lokalisiert. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Paket, Lockfile, README, Changelog und Teststatus verwenden v0.17.10. |
| `npm run check` | **Bestanden** | 225 JavaScript-Dateien, 959 referenzierte Übersetzungsschlüssel und 99 relative Dokumentationslinks. |
| `npm test` | **371/371 bestanden** | Alle Unit- und Integrationstests einschließlich 5 neuer Fehlerlokalisierungs-Tests. |
| Neue API-Integrationstests | **Bestanden** | Englischsprachiger API-Fallback und stabile Fehlercodes am echten Testserver. |
| Neue Browser-Testläufe (`npm run test:browser`) | **Nicht lokal ausgeführt** | UI wurde über Unit-/Integrationstests geprüft; vollständige Chromium-/GitHub-CI-Prüfung bleibt offen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem noch zu prüfen. |

### Änderungen v0.17.10

- Bekannte Bildverarbeitungs-, Datei-, Import- und Scannerfehler verwenden stabile Übersetzungsschlüssel in Deutsch und Englisch statt fest eingebauter deutscher Texte.
- 182 bekannte API-Fehlertexte erhalten einen maschinenlesbaren `errorCode` und einen englischen Standardtext; zusätzlich einige Validierungsfehler mit benannten Parametern.
- Das Frontend zeigt den passenden übersetzten Text an. Unbekannte oder alte API-Fehler werden nicht als unveränderte deutsche Rohmeldungen angezeigt.
- Fehlende oder leere Übersetzungseinträge fallen auf Englisch zurück; der englische Katalog ist dafür lokal verfügbar.
- Auch im Backup-Dialog werden bekannte API-Fehler übersetzt, unbekannte Hintergrund-Fehlermeldungen neutral dargestellt.
- **Keine Funktionen aus der verworfenen 0.18.x-Reihe übernommen.**

---

## Testbericht v0.17.11 (vor dem naechsten Versionswechsel)

**Stand:** 13.11.2026. **Basis:** v0.17.10 (ohne die verworfene Etikettenerkennung). Interne Importverarbeitung ist quellunabhängig; Datenformate und Endpunkte bleiben kompatibel. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Paket, Lockfile, README, Changelog und Teststatus verwenden v0.17.11. |
| `npm run check` | **Bestanden** | 229 JavaScript-Dateien, 962 referenzierte Übersetzungsschlüssel und 101 relative Dokumentationslinks. |
| `npm test` (identische Testsuite mit begrenzter Parallelität) | **378/378 bestanden** | Vollständiger Node-Testlauf mit `--test-concurrency=4` über `tests/unit` und `tests/integration`. Der stärker parallelisierte Standard-Aufruf überschritt lokal das Zeitlimit. |
| Neue Import-Regressionstests | **Bestanden** | Anbieterneutrale Feldübernahme, Payload-Validierung, Referenzbildauswahl und Quellenmarkierung sowie bisheriger Importpfad. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | `playwright-core` ist in der Prüfungsumgebung nicht installiert; `npm ci --offline` scheitert am fehlenden npm-Paketcache (`ENOTCACHED`). Die vorhandenen Browser-Regressionen wurden auf die neuen Selektoren angepasst, aber nicht ausgeführt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgeführt** | Auf dem Zielsystem noch zu prüfen. |

### Änderungen v0.17.11

- Die generische Importlogik für Feldvorschau, Auswahl, Übernahme, Destillerie-Abgleich und Importfoto lebt unter `public/js/features/import/`.
- Allgemeine Importvariablen, Formularnamen, DOM-Selektoren, CSS-Klassen, Ereignisse und Übersetzungen tragen keine anbieterspezifischen Namen mehr.
- Nur der Quelladapter prüft spezifische Kennungen und URLs. Der gemeinsame Payload-Normalisierer beschränkt Feldtypen und erlaubte Importdaten; Originalformate bleiben gültig.
- Der Server kann Referenzfotos ohne spezifische Quellenmarkierung übernehmen. Bestehende Erweiterungsbilder behalten ihre bisherigen Quellenangaben.
- Keine Funktionen aus der verworfenen 0.18.x-Reihe übernommen.

---

## Testbericht v0.17.12 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-13. **Status:** Node-Pruefungen erfolgreich; vollstaendige Browser- und Docker-Pruefungen offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsdaten 0.17.12 konsistent. |
| `npm run check` | **Bestanden** | 229 JavaScript-Dateien, 962 referenzierte i18n-Schluessel, 18 Markdown-Dateien. |
| `npm test` | **376/376 bestanden** | Unit- und Integrationstests; reine Namens-Abwesenheitstests wurden entfernt. |
| Reproduktion des CI-Fehlers | **Bestanden** | 0.17.10 mit 0.17.11 ueberschrieben: 231 JavaScript-Dateien und exakt der gemeldete fehlende Schluessel. Nach Entfernen der beiden alten Dateien: 229 Dateien und `npm run check` gruen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Chromium-Tests sind separat in CI zu pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.17.12

- Zwei beim Provider-Refactoring entfallene Quelldateien muessen bei bestehendem Git-Checkout geloescht und die Loeschungen committed werden; es fehlen keine Uebersetzungen in der aktuellen Importimplementierung.
- Fragile Tests, die lediglich das Nichtvorkommen von `Whiskybase` im Quelltext oder in der Dokumentation verlangen, entfernt. Positive Import- und API-Verhaltenstests bleiben erhalten.
- Upgrade-Hinweis samt konkretem `git rm`-Befehl in README dokumentiert.

Eine vollstaendige GitHub-Actions- und Browser-Abnahme von 0.17.12 steht noch aus.

---

## Testbericht v0.17.13 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-13. **Status:** Node-Pruefungen erfolgreich, Browser- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.17.13 konsistent. |
| `npm run check` | **Bestanden** | 229 JavaScript-Dateien, 962 i18n-Referenzen, 18 Markdown-Dateien und 2 referenzierte Testbilddateien vorhanden. |
| Negativprobe ohne Testbild | **Bestanden** | Beim kurzzeitigen Entfernen der neuen Referenz-PNG meldet `scripts/check.js` den genauen fehlenden Dateipfad; nach Wiederherstellung gruener Check. |
| `npm test` | **376/376 bestanden** | Vollstaendiger Unit- und Integrationstestlauf. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Playwright-Abhaengigkeiten sind lokal nicht verfuegbar; `npm ci --offline` scheitert am fehlenden npm-Cache. Die 59 Chromium-Tests muessen in GitHub Actions laufen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.17.13

- Die bisher vorhandene 120x180-PNG `tests/fixtures/photo-wb-reference.png` wurde ohne Inhaltsaenderung nach `tests/fixtures/photo-import-reference.png` umbenannt. Alle fuenf fehlerhaften Browserfaelle verwenden nun eine existierende Datei.
- `npm run check` prueft relative `../fixtures/`-Referenzen in Tests, bevor CI die Browser-Suite startet. Keine Browser-Tests entfernt und keine Produktivfunktionen veraendert.

**Hinweis:** Ein erfolgreicher Node-Testlauf und die Fixture-Pruefung bestaetigen nicht die erfolgreiche Ausfuehrung der Browser-Tests. Der vollstaendige CI-Browserlauf bleibt ausstehend.

---

## Testbericht v0.17.14 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Unit-/Integrationstests, Versions- und statische Prüfungen bestanden; Browser- und Docker-Prüfungen für diese Version nicht ausgeführt. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.17.14 sind konsistent. |
| `npm run check` | **Bestanden** | JavaScript-Importe und Syntax, i18n-Kataloge, Dokumentationslinks sowie Test-Fixtures geprüft. |
| `npm test` | **378/378 bestanden** | Gesamte lokal ausführbare Unit-/Integrationssuite, einschließlich zwei neuer Sprach-Regressionstests. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Browser-Verhalten für diese Version nicht überprüft. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Deployment weiterhin separat prüfen. |
| Windows-PowerShell-Testlauf | **Nicht lokal ausgeführt** | Windows-spezifische Probleme aus früheren Testberichten sind hiermit nicht behoben oder neu geprüft. |

### Änderungen v0.17.14

- Sichtbare erklärende Klammerzusätze aus Formular- und Detailbeschriftungen der Abfüllungs- und Flaschenansicht entfernt, sowohl auf Deutsch als auch auf Englisch.
- Informationen, die echte Werte darstellen (beispielsweise Anzahl von Fotos), behalten ihre dynamischen Zähler.
- Zwei gezielte Tests schützen die geänderten deutschen und englischen Beschriftungen vor Regressionen.

**Abgrenzung:** Es wurden nur Übersetzungstexte und Tests für diese Darstellung geändert, keine gespeicherten Daten, Feldtypen oder Validierungsregeln.

---

## Testbericht v0.17.15 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Unit-/Integrationstests, Versions- und statische Pruefungen erfolgreich. Browser-, Windows- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten fuer 0.17.15 konsistent. |
| `npm run check` | **Bestanden** | Node-Syntax, Imports, Test-Fixtures, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **386/386 bestanden** | Vollstaendige lokale Unit-/Integrationssuite inklusive sieben Start-Unit-Tests und einem realen `npm start`-Prozess-Smoke-Test in einer isolierten Testinstallation. |
| Start-Prozess-Smoke-Test | **Bestanden** | Ruft wirklich `npm start` auf; prueft Vorbereitung vor Serverstart ohne Netzwerkbedarf durch ersetzte Modellvorbereitung und einen Testserver. |
| Echte Erstinstallation (`npm ci` + ONNX-/WASM-Download + TLS-Erstellung) | **Nicht lokal ausgefuehrt** | Ohne Netz-/Systemvoraussetzungen hier nicht vollstaendig end-to-end getestet; Ablauf und Fehlerfaelle in Unit-Tests geprueft. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Chromium-Suite fuer diese Version nicht ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Docker-Entrypoint bleibt unveraendert, Build nicht erneut getestet. |
| Windows-PowerShell-Starttest | **Nicht lokal ausgeführt** | Verhalten unter nativem Windows nicht verifiziert; plattformunabhaengiger Node-Starter und Batch-Aufruf vorhanden. |

### Aenderungen v0.17.15

- `npm start` startet nun `scripts/start.js`: fehlende/veraltete npm-Abhaengigkeiten ueber `npm ci` einrichten; Cutout-Assets pruefen und bei Bedarf herunterladen; `.env` bei lokalem Erststart anlegen; bei fehlenden Standardzertifikaten lokale HTTPS-Einrichtung starten; anschliessend Server ausfuehren.
- Vorhandene Installationen und Zertifikate bleiben erhalten. Bei Fehlern in der Vorbereitung startet der Server nicht unvollstaendig.
- `start-unix.sh` und `start-windows.bat` verwenden denselben Startablauf. Der Docker-Entrypoint und sein Buildzeit-Installationsprozess bleiben unveraendert.
- Neue Regressionstests pruefen Reihenfolge, notwendige/skippbare Installationen, Produktionsmodus, TLS-Konfiguration und Fehlerabbruch sowie den realen Prozessaufruf.

**Hinweis:** Die lokale Erstinstallation und der echte Download aller ONNX-Dateien wurden hier nicht mit realem Netzwerkzugriff ausgefuehrt. Ein erfolgreicher Modell-Download, Windows-Start und Browserlauf sind damit nicht zugesichert.

---

## Testbericht v0.18.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich; vollstaendige Browser- und Docker-Abnahme ausstehend. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten 0.18.0 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Importe, Uebersetzungen, Referenz-Bilddateien und Dokumentationslinks geprueft. |
| `npm test` | **394/394 bestanden** | Vollstaendiger Unit- und Integrationstestlauf einschliesslich virtueller Regalwand, Drag-and-drop und serverseitiger Umlagerung zwischen gegenueberstehenden Regalen. |
| Gezielte Pointer-Tests | **Bestanden** | Volle Faecher, Quellfach, Abbruch, Auto-Scroll und einmalige Speicherung getestet. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Playwright-Abhaengigkeiten fehlen; ein npm-ci-Versuch erreichte das Zeitlimit. Ein direkter Chromium-Smoke-Test blieb ebenfalls am Browserstart haengen. Daher keine behauptete Browser-Freigabe. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Separat in GitHub Actions und auf dem Raspberry Pi pruefen. |

### Aenderungen v0.18.0

- Neuer Modus **Regalwand** in den Raumplaenen: alle Moebel mit Faechern eines Raums werden virtuell nebeneinander als Frontansichten gezeigt, auch wenn sie sich gegenueberstehen. Kein neues Lagerdatenformat.
- Drag-and-drop physischer Flaschen innerhalb einer Einzelregalansicht und zwischen allen Regalen der virtuellen Wand. Zielmarkierung, schwebende Flaschenvorschau und automatisches Scrollen am Rand. Auf Touch-Geraeten nutzbare Pointer Events; das Umlagern ueber das Flaschendetail bleibt erhalten.
- Kapazitaet und Existenz des Zielfachs werden clientseitig vorgeprueft und serverseitig ueber den bestehenden API-Endpunkt verbindlich validiert. Keine lokale Aenderung der Zuordnung vor Serverbestaetigung.
- Deutsch/Englisch, Dokumentation und Regressionstests aktualisiert. Keine OCR-Komponenten aus der verworfenen frueheren 0.18-Reihe enthalten.

**Einschraenkung:** Unit- und Integrationstests belegen nicht die gerateuebergreifende Bedienung in echten Browsern. Der Browser-CI-Lauf ist vor der Freigabe auf `main` erforderlich.

---

## Testbericht v0.18.1 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Tests, statische Pruefungen und Versionspruefung bestanden; Browser- und Docker-Abnahme ausstehend. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.18.1 konsistent. |
| `npm run check` | **Bestanden** | 240 JavaScript-Dateien, Sprachkataloge, Test-Fixtures und Dokumentationslinks geprueft. |
| `npm test` | **402/402 bestanden** | Gesamte Node-Unit- und Integrationssuite, einschliesslich atomarem Bulk-API-Test, Einzel- und Gruppendrag, Sortierung, Schrankhoehen, Fachhoehen und Scroll-CSS. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Playwright-Suite hier nicht ausgefuehrt; reale Ansicht und Touch-Bedienung in CI/auf Geraeten pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.18.1

- Regalwand sortiert Möbelnamen natuerlich; Schrankhoehe, Fachhoehe und Montagehoehe im gemeinsamen Massstab. Keine Streckung flacher Faecher oder Phantom-Faecher fuer Resthoehen.
- Regalwand hat keine eigene vertikale Scrollbar und keine `vh`-Grenze mehr: komplette Hoehe ist direkt im Seitenlayout vorhanden; nur horizontales Scrollen innerhalb der Wand (auch beim Drag-and-drop).
- Mehrere physische Flaschen per Checkbox in der Flaschenliste oder Regalwand auswaehlen, gemeinsam einem Fach zuweisen oder ausgewaehlte Gruppe ziehen. Neues `POST /api/warehouse/bottles/bulk` prueft die Gesamtbelegung und speichert alle Zuordnungen zusammen oder gar keine. Datenmodell unveraendert.

**Grenze:** Die Node-Tests verifizieren API und generiertes Markup/CSS, nicht die tatsaechliche Darstellung und Touchsteuerung in einem Browser. Vor Merge nach `main` Browser-CI pruefen.

---

## Testbericht v0.18.2 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen bestanden. Vollstaendige Chromium- und Docker-Abnahme offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.18.2 konsistent. |
| `npm run check` | **Bestanden** | JavaScript-Syntax und Importgraph, deutsche/englische Uebersetzungen, Dateireferenzen und Markdown-Links. |
| `npm test` | **407/407 bestanden** | Vollstaendige Unit- und Integrationstests, einschliesslich neuer Abgrenzung zwischen Raumplaenen und Regalen/Faechern. |
| Gezielte Lager-Unit-Tests | **Bestanden** | Regalwand-Geometrie, mehrfache Flaschenauswahl, Fachverwaltung sowie Trennung der Raum- und Regalansichten. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Playwright-Abhaengigkeit lokal nicht installiert; direkter Chromium-Start haengt in der Ausfuehrungsumgebung. Die geaenderten Browser-Tests muessen in CI ausgefuehrt werden. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Separat auf dem Zielsystem pruefen. |

### Aenderungen v0.18.2

- Die Regalwand folgt Raumkoordinaten und Blickrichtung; uebereinander montierte Moebel stehen uebereinander.
- Flaschen werden in der Regalwand ohne Checkboxen durch farbige Hinterlegung markiert und koennen gemeinsam umgelagert werden.
- Die Raumplan-Registerkarte enthaelt nur Raumverwaltung und 2D-/3D-Positionierung. Moebel-Mehrfachbearbeitung, Fachverwaltung und die komplette Regalwand befinden sich unter **Regale & Faecher**.
- Die bisherige Mehrfach-Umlagerung, Fachkapazitaetspruefung und gespeicherte Lagerstruktur bleiben unveraendert.

Ein gruener Node-Testlauf ersetzt keine visuelle Browserpruefung oder mobile Touch-Abnahme.

---

## Testbericht v0.18.3 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen bestanden. Vollstaendige Chromium-, native Touch- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.18.3 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Modulgraph, DE/EN-Uebersetzungen, Test-Fixtures und Markdown-Links. |
| `npm test` | **413/413 bestanden** | Gesamte Node-Unit-/Integrationstestsuite inklusive Lagerwand-/Modalregressionen. |
| Gezielte Regalwand-Regressionspruefung | **Bestanden** | Breites Obermoebel ueber mehreren Unterschraenken, gespeicherte horizontale Scrollposition, Raumplan-Auswahl, keine duplizierte Fachansicht und Moebelverwaltung im Modal. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Die Browserabhaengigkeit ist in dieser Arbeitskopie nicht installiert; auch der direkte Chromium-Smoke-Test startet hier nicht erfolgreich (Timeout). Die angepassten Browserfaelle muessen in CI ausgefuehrt werden. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Separat auf dem Zielsystem pruefen. |

### Aenderungen v0.18.3

- Einfache Raumplan-Auswahl zeigt eine sichtbare Positionszusammenfassung mit Weg zu **Regale & Faecher** statt einer wirkungslosen Auswahl.
- Kein zweites Regal bzw. keine zweite Flaschendarstellung mehr unter der virtuellen Regalwand. Die Fach-/Moebelverwaltung wird mit einem breiten Modal geoeffnet, entweder ueber **Moebel und Faecher bearbeiten** oder direkt durch Klick auf den Moebelnamen in der Regalwand.
- Physisch ueber mehrere Unterschraenke reichende Obermoebel werden ueber die gemeinsame Breite angeordnet.
- Nach dem Umlagern von Flaschen bleibt die horizontale Regalwand-Position pro Raum erhalten; auch die Dokument-Scrollposition wird wiederhergestellt.
- Datenmodell, APIs und Lagerzuordnungen bleiben unveraendert.

Eine gruene Node-Suite ist kein Nachweis fuer eine bestandene visuelle Browserpruefung oder mobile Touch-Abnahme.

---

## Testbericht v0.18.4 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich, Browser- und Docker-Abnahme offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent. |
| `npm run check` | **Bestanden** | Syntax, Importe, Uebersetzungen, Testbildreferenzen und Dokumentationslinks. |
| `npm test` | **418/418 bestanden** | Vollstaendiger lokaler Unit- und Integrationstestlauf unter Linux. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Browserpruefungen separat dokumentieren. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.18.4

- Virtuelle globale Ablage fuer nicht zugeordnete Flaschen, Suche, Seitennavigation und gemeinsame Flaschenauswahl ohne neue physische Lagerstellen.
- Einzelmoebel-Modals zeigen ausschliesslich das angeklickte Moebel. Die Moebel-Mehrfachbearbeitung hat eine getrennte Auswahlansicht mit hervorgehobenen Kacheln.
- Oberer Leerraum der Regalwand reduziert. Vorhandene physische Lagerzuordnungen und APIs bleiben unveraendert.

**Abgrenzung:** Die vollstaendige Chromium- und Touch-Bedienung sowie der native Windows-Testlauf und der Docker-/ARM64-Test sind nicht lokal ausgefuehrt. Der erfolgreiche Node-Testlauf belegt nicht die visuelle Browsertauglichkeit.

---

## Testbericht v0.18.5 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich; Browser- und Docker-Abnahme offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.18.5 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Imports, Uebersetzungen, Testbildverweise und Dokumentationslinks. |
| `npm test` | **422/422 bestanden** | Vollstaendige Unit- und Integrationstestsuite inklusive neuer Metadaten- und Aufklapptests. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Browserpruefungen separat dokumentieren. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.18.5

- Ablage fuer nicht zugeordnete Flaschen standardmaessig einklappen, mit Zustandserhalt nach Neuzeichnung.
- Flaschenlisten links ausrichten und Alter, Erscheinungsjahr und Fasstyp aus Abfuellungsdaten anzeigen.
- Backend liefert nur lesbare Flaschen-Metadaten; gespeicherte Lagerdaten und API-Aktionen bleiben unveraendert.

**Grenzen:** Die vollstaendige Browser-/Touch- und Docker-/ARM64-Pruefung wurde in dieser Umgebung nicht durchgefuehrt. Ein erfolgreicher Node-Testlauf ist keine visuelle Browserabnahme.

---

## Testbericht v0.18.6 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich; Browser- und Docker-Abnahme offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version v0.18.6 in allen Release-Dateien konsistent. |
| `npm run check` | **Bestanden** | Syntax, Modulimports, Uebersetzungen, Fixtures und Dokumentationslinks. |
| `npm test` | **422/422 bestanden** | Vollstaendiger Unit- und Integrationstestlauf; zusaetzlich gezielter Modal-Test nach Nachschaerfung bestanden. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige Chromium-Tests bleiben fuer CI offen; neuer Browser-Regressionstest ist enthalten. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach dem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.18.6

- Die Fachliste im Einzelmoebel-Modal zeigt wieder alle diesem Moebel zugeordneten Flaschen als Symbole bzw. geladene Fotos und ermoeglicht das Oeffnen der Flaschendetails.
- Die Regalwand bleibt die einzige dauerhaft sichtbare Gesamtansicht; andere Moebel und ihre Flaschen erscheinen nicht im Einzelmoebel-Modal.
- Regressionstests pruefen die Anzeige und die Begrenzung auf das angeklickte Moebel.

**Grenzen:** Browserdarstellung, Touch-Bedienung und Docker/ARM64 wurden hier nicht abschliessend geprueft. Unit-/Integrationstests ersetzen keine visuelle Browserabnahme.

---

## Testbericht v0.19.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich, Browser- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.19.0 sind konsistent. |
| `npm run check` | **Bestanden** | JavaScript-Syntax, Module, Uebersetzungsreferenzen und Dokumentationschecks. |
| `npm test` | **433/433 bestanden** | Vollstaendige Node-Unit- und Integrationssuite, inklusive Transfer zwischen zwei Instanzen, Fach mit 15 Flaschen und kombiniertem Export-/Import-Dialog und zusammengefuehrter Flaschenleiste. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Die Browser-Suite konnte nicht erfolgreich gestartet werden. Ein direkter Chromium-Headless-Aufruf haengt hier schon bei einem statischen Minimaldokument; UI, Datei-Download und Touch-Bedienung sind nicht visuell bestaetigt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach Uebernahme in CI bzw. auf dem Zielsystem pruefen. |

### Aenderungen v0.19.0

- Auswahlaktionen und virtuelle Ablage „Nicht zugeordnet“ stehen in einer einzigen kompakten Regalwand-Leiste; die Ablage wird ohne zweiten Header eingeblendet.
- Kombinierter Dialog „Räume übertragen“ mit Export-/Import-Reitern; portabler Raumtransfer fuer einen, mehrere oder alle Raeume, mit oder ohne Flaschenzuordnung.
- Importvorschau, sichere Konfliktregeln und Neuvergabe der Raum-, Moebel- und Fach-IDs; Zuordnung vorhandener Flaschen nur anhand eindeutiger Referenzen.
- Fachbezogenes Flaschenmodal: Die Frontansicht zeigt nur die erste sichtbare Reihe und `+N`, der Dialog zeigt alle enthaltenen Flaschen (Regressionstest: 15 Flaschen).

**Einschraenkung:** Die Testzahlen bestaetigen die serverseitigen Importregeln, die HTML-Ausgabe und das Ansprechen der Ansichten im Code; sie ersetzen keine vollstaendige Browser- und Touch-Pruefung.

---

## Testbericht v0.19.1 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich; Browser- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.19.1 konsistent. |
| `npm run check` | **Bestanden** | Syntax, ES-Modulimporte, Uebersetzungsreferenzen, Test-Fixtures und Dokumentationslinks. |
| `npm test` | **437/437 bestanden** | Vollstaendige Unit- und Integrationssuite, inklusive vier neuer Tests fuer Fach-Doppelklick und Auswahl-/Tastaturabgrenzung. |
| `node --test tests/unit/warehouse-shelf-doubleclick.test.js tests/unit/warehouse-shelf-dialog.test.js tests/unit/warehouse-room-wall.test.js` | **20/20 bestanden** | Fach-Dialog per Doppelklick, unveraenderte Flaschenauswahl, direkte Buttonaktion und Tastaturbedienung. |
| `npm run test:browser` | **Nicht lokal ausgefuehrt** | Vollstaendige Chromium- und Touch-Pruefung noch offen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgefuehrt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.19.1

- Doppelklick auf die Fachflaeche der Regalwand oeffnet das Fachmodal; einfacher Klick auf den Fachhintergrund tut dies nicht mehr.
- Doppelklick auf einen nicht-interaktiven Bereich eines Fachs im Moebelmodal ist ebenfalls moeglich; die explizite Schaltflaeche `Flaschen anzeigen` bleibt einfach anklickbar.
- Anklickbare Flaschen, Drag-and-drop und Tastaturaktivierung (Enter/Leertaste) bleiben unabhaengig vom Fach-Doppelklick.
- Deutsche und englische Bedienhinweise, README und Lagerdokumentation aktualisiert.

**Einschraenkung:** Der Node-Testlauf bestaetigt die delegierte Ereignisbehandlung und die HTML-Erzeugung; eine visuelle Browser- und Touch-Abnahme steht aus.

---

## Testbericht v0.19.2 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich, Browser- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.19.2 konsistent. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien, Uebersetzungen, Test-Fixtures und Dokumentationslinks. |
| `npm test` | **442/442 bestanden** | Vollstaendiger Unit- und Integrationstestlauf. |
| `node --test tests/unit/warehouse-assignment.test.js tests/unit/warehouse-bottle-drag.test.js tests/unit/warehouse-room-wall.test.js tests/unit/warehouse-shelf-dialog.test.js tests/unit/warehouse-shelf-doubleclick.test.js tests/integration/warehouse-bulk-bottles.test.js` | **34/34 bestanden** | Fachinteraktion, Drag-and-drop, Kapazitaetsbestaetigung und atomare Zuordnung. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Visuelle Chromium- und Touch-Pruefung ausstehend. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.19.2

- Faecher mit Kapazitaet 0 sind keine anklickbaren Fachdialog-Ziele. Kein `role=button`, kein `tabindex`, kein Doppelklick- oder Tastaturoeffnen und kein Hand-Mauszeiger. Die ausdrueckliche Fachbearbeitung bleibt moeglich.
- Bei positiver Fachkapazitaet und zu wenig Platz fragt die Oberflaeche bei Einzel- und Mehrfachzuordnung sowie Drag-and-drop nach einer Erhoehung auf die benoetigte Anzahl. Abbruch veraendert keine Daten.
- API nimmt das optionale, zuvor bestaetigte `increaseCapacityTo` entgegen und schreibt Kapazitaet und Flaschenzuordnungen atomar. Nicht ausreichende Freigaben oder Kapazitaet 0 fuehren weiterhin zu HTTP 409 ohne Teiloperation.
- Regressionstests fuer Serverzustand, wiederholte Umlagerung, Kapazitaet 0 und Bestaetigung ergänzt.

**Hinweis:** Erfolgreiche Node-Tests ersetzen keine Browserabnahme des Bestaetigungsdialogs mit Maus und Touch.

---

## Testbericht v0.19.3 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich, Browser- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.19.3 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Imports, Uebersetzungen, Testbilder und Dokumentationslinks. |
| `npm test` | **446/446 bestanden** | Vollstaendiger Unit- und Integrationstestlauf, einschliesslich Modal-Bestaetigung und gestapelter Moebelbeschriftungen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Die vollstaendige Chromium-Browser-Suite ist noch offen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.19.3

- Kapazitaetserhoehungen werden ausschliesslich ueber ein Anwendungsmodal bestaetigt; eine verschachtelte Rueckfrage erhaelt den bestehenden Zuordnungsdialog und seine Formulareingaben. Abbruch aendert nichts.
- Bei gestapelten Moebeln werden Moebelname und Fachbeschriftung ohne Ueberlagerung untereinander dargestellt.
- Zusaetzliche Regressionstests fuer Annahme/Ablehnung der Modal-Rueckfrage, die Erhaltung verschachtelter Formulare und die Moebelbeschriftung.

**Hinweis:** Bestehende Browser- und Touch-Bedienablaeufe sind mit den Node-Tests nicht visuell abgenommen.

---

## Testbericht v0.19.4 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich; visuelle Browser- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.19.4 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Imports, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **446/446 bestanden** | Alle Unit- und Integrationstests einschliesslich neuer Regalwand-Regressionen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Die vollstaendige Browser-Suite und das Hover-Verhalten muessen noch visuell geprueft werden. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.19.4

- Sichtbare Moebelname-Kopfzeilen vollstaendig entfernt. Stattdessen ein kleines Bearbeiten-Icon in der rechten oberen Ecke innerhalb jedes Moebels, mit Namen als Tooltip und barrierefreiem Label; unveraenderte physische Hoehen und Fachpositionen.
- Kapazitaet-0-Faecher bleiben sichtbar und nicht interaktiv, zeigen jedoch keine `0/0`-Belegung mehr.
- Bestehende Regalwand- und Browser-Tests fuer den neuen Bedieneinstieg angepasst; der ueberfluessige obere Titelabstand wurde reduziert.

**Hinweis:** Der erfolgreiche Node-Testlauf ersetzt keine visuelle Browser- oder Touch-Abnahme.

---

## Testbericht v0.19.5 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich; visuelle Browser- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.19.5 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Imports, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **447/447 bestanden** | Alle Unit- und Integrationstests, einschliesslich Schriftgroessen-Regression. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Die visuelle Darstellung bleibt im Browser zu pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.19.5

- Die Schriftgroesse von "Fach ist leer" in der Regalwand entspricht mit 10 px der Schriftgroesse von "Nicht belegbar"; beide Platzhalter haben dieselbe Zeilenhoehe. An anderen Fachansichten wurde nichts geaendert.
- CSS-Regressionstest fuer gleiche Schriftgroesse beider Hinweise ergaenzt.

**Hinweis:** Node-Pruefungen ersetzen keine visuelle Browser- oder Touch-Abnahme.

---

## Testbericht v0.19.6 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Pruefungen erfolgreich; visuelle Browser- und Docker-Abnahme weiterhin offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.19.6 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Imports, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **448/448 bestanden** | Unit- und Integrationstests einschliesslich Top-Fach-Abstandsregel. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Visuelle Pruefung von oberem Fachrahmen und anderen Fachhoehen steht aus. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.19.6

- Die obere Holzleiste wird innerhalb des Moebelrahmens gezeichnet und ueberlagerte bislang die ersten Pixel des obersten Fachs. Dessen Kopfzeile erhaelt bei fehlendem oberen Freiraum einen um 5 px groesseren Innenabstand (8 statt 3 px).
- Andere Faecher, kleine Faecher und Faecher hinter einem oberen Freiraum behalten ihren bisherigen Innenabstand. Die reale Fachhoehe, Moebelpositionen und Flaschenauswahl bleiben unveraendert.
- Neuer gezielter Regressionstest fuer die Sonderregel und unveraenderte Fachhoehen.

**Hinweis:** Die CSS-Regel ist automatisiert geprueft. Ein visueller Chromium- oder Touch-Test wurde nicht durchgefuehrt.

---

## Testbericht v0.19.7 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Release-Metadaten, Quellcodepruefung sowie Unit- und Integrationstests erfolgreich; Browsertests und Docker-Livetest offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten konsistent mit v0.19.7. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien; 1015 referenzierte Sprachschluessel; 18 Markdown-Dateien und 120 relative Links. |
| `npm test` | **Bestanden** | 452 Tests, 452 bestanden, 0 fehlgeschlagen. |
| `npm run test:browser` | **Nicht ausgefuehrt** | `playwright-core` fehlt; `npm ci --offline` scheiterte wegen fehlender Pakete im npm-Cache, Online-Nachinstallation war nicht erfolgreich. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.19.7

- 3D-Raumplan: Doppelklick auf belegtes Fach oeffnet Fachinhalt als Modal ohne Reiterwechsel; leere Faecher bleiben geschlossen

Die Browser-Interaktion im echten Chromium sowie der Docker-Build und ein ARM64-Livetest bleiben ungetestet; das erfolgreiche `npm test` ersetzt diese Pruefungen nicht.

---

## Testbericht v0.19.8 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Release-Metadaten, statische Pruefungen sowie Unit- und Integrationstests bestanden; Browser- und Docker-Livepruefungen offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten konsistent mit v0.19.8. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien; 1015 referenzierte Sprachschluessel; 18 Markdown-Dateien und 121 relative Links. |
| `npm test` | **Bestanden** | 454 Tests, 454 bestanden, 0 fehlgeschlagen. |
| `npm run test:browser` | **Blockiert, nicht durchgefuehrt** | Playwright kann nicht importiert werden (`node_modules/playwright-core/index.js` fehlt); Abbruch vor Ausfuehrung der Browserfaelle. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgefuehrt** | Nach einem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.19.8

- Das identische Fachinhalt-Modal zeigt in 3D-Raumplan und Regalansicht je Flasche die vorhandene Inventarnummer, den Alkoholgehalt der Abfuellung und den Status.
- Je Flasche direkt im Fachinhalt: **Umlagern** und **Zur Detailseite** (mit Hervorhebung der konkreten Flasche). Die verkleinerte Zwischenvorschau entfaellt fuer eingelagerten Flaschen.
- Aus der Regalwand fuehrt die Aktion fuer genau eine ausgewählte, eingelagerte Flasche direkt zum Fachinhalt; die Flaschensymbole im Moebelmodal fuehren ebenfalls dorthin. Mehrfachauswahl und Drag-and-drop bleiben erhalten. Nicht zugeordnete Flaschen behalten ihre Einzelvorschau.
- Regressionstests fuer vorhandene/fehlende Metadaten, HTML-Escaping, Direktaktionen und die gemeinsame Fachansicht ergaenzt. Browser-Testaktualisierung vorgenommen, jedoch wegen der nicht verfuegbaren Playwright-Installation nicht ausgefuehrt.

Die erfolgreiche Node-Testsuite ersetzt weder einen Chromium-Interaktionstest noch die Mobil-/Docker-Pruefung.

---

## Testbericht v0.19.9 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Die Node-Pruefungen wurden nach Abschluss der Aenderungen erfolgreich ausgefuehrt. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.9. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien, Sprachschluessel, 18 Markdown-Dateien und relative Links geprueft. |
| `npm test` | **456/456 bestanden** | Unit- und Integrationstests, darunter neue Regressionstests fuer die Platzhaltergrafik in Uebersicht und Fachinhalt. |
| `npm run test:browser` | **Nicht durchfuehrbar** | Versuch unternommen; Browser-Suite startet nicht, weil `playwright-core/index.js` in der lokalen Installation fehlt (`ERR_MODULE_NOT_FOUND`). Kein Browser-Test bestanden oder ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.19.9

- Platzhalter in Sammlungskacheln kleiner darstellen, vorhandene Flaschenfotos unveraendert lassen.
- Platzhaltermotiv fuer Flaschen ohne Foto im Fachinhalt-Modal an die Sammlungsuebersicht angleichen; Regalwand-Symbole unveraendert.
- README auf dauerhafte Projektinformationen konzentrieren; veraltete Release- und Migrationsdetails entfernen und Lagerdokumentation an das aktuelle Fachmodal angleichen.

**Offen:** Browser-/WebGL-Darstellung, verschiedene Displaybreiten, reale Mobilgeraete und Pi-Docker-Betrieb verifizieren.

---

## Testbericht v0.19.10 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Die Node-Pruefungen wurden nach Abschluss der Aenderungen erfolgreich ausgefuehrt. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.10. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien, Sprachschluessel, 18 Markdown-Dateien und relative Links geprueft. |
| `npm test` | **457/457 bestanden** | Unit- und Integrationstests, darunter aktualisierte Regressionstests fuer die an Flaschenfotos angeglichene Platzhaltergroesse und die Dark-Mode-Farben auf der Detailseite. |
| `npm run test:browser` | **Blockiert** | Versuch unternommen; Browser-Suite startet nicht, weil `playwright-core/index.js` in der lokalen Installation fehlt (`ERR_MODULE_NOT_FOUND`). Kein Browser-Test bestanden oder ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.19.10

- Platzhalter in Sammlungskacheln auf die sichtbare Hoehe echter Flaschenfotos vergroessern, ohne reale Fotos zu beeinflussen.
- Platzhalter auf der Detailseite farblich an die Sammlung angleichen; im Dark Mode bleibt das Goldmotiv sichtbar statt dunkel ueberblendet.
- Lagerdokumentation und Tests an die getrennte Behandlung von Kachel- und Detail-Platzhaltern angepasst.

**Offen:** Browser-/WebGL-Darstellung, verschiedene Displaybreiten, reale Mobilgeraete und Pi-Docker-Betrieb verifizieren.

---

## Testbericht v0.19.11 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Die Node-Pruefungen wurden nach Abschluss der Aenderungen erfolgreich ausgefuehrt. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.11. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien, Sprachschluessel, 18 Markdown-Dateien und relative Links geprueft. |
| `npm test` | **458/458 bestanden** | Unit- und Integrationstests, darunter Regressionen fuer statische Flaschenbilder im Fachmodal und die innenliegende Regalwand-Auswahlmarkierung. |
| `npm run test:browser` | **Nicht durchfuehrbar** | Versuch unternommen; Browser-Suite startet wegen fehlendem `playwright-core/index.js` (`ERR_MODULE_NOT_FOUND`) nicht. Kein Browser-Test bestanden oder ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.19.11

- Fachinhalt-Modal: Flaschenbilder sind rein dekorativ, keine Mehrfachauswahl und keine doppelten Markierungsrahmen. Aktionen **Umlagern** und **Zur Detailseite** bleiben erhalten.
- Regalwand: Auswahl bleibt unveraendert moeglich, der Markierungsrahmen liegt innerhalb der festen Flaschenplatz-Grenzen und ueberlagert keine Holzleisten.

**Offen:** Browser-/WebGL-Darstellung, schmale Displaybreiten, reale Mobilgeraete und Pi-Docker-Betrieb verifizieren.

---

## Testbericht v0.19.12 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Die Node-Pruefungen wurden nach Abschluss der Aenderungen erfolgreich ausgefuehrt. Historische Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.12. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien, 1013 referenzierte Sprachschluessel, 18 Markdown-Dateien und relative Links geprueft. |
| `npm test` | **458/458 bestanden** | Unit- und Integrationstests, darunter Regressionen fuer Einzel-Flaschenvorschau im Moebelmodal, Fach-Doppelklick und direkte Aktionen. |
| `npm run test:browser` | **Nicht durchfuehrbar** | Testlauf gestartet, wegen fehlendem `playwright-core/index.js` jedoch vor Ausfuehrung gescheitert (`ERR_MODULE_NOT_FOUND`). Keine Browser-Tests bestanden. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.19.12

- Im Einzelmoebel-Modal oeffnet ein Klick auf eine Flasche die Einzel-Flaschenvorschau mit **Umlagern** und **Zu den Flaschendetails** statt die Fachuebersicht.
- Die ausgeschriebene Schaltflaeche **Flaschen anzeigen** im Einzelmoebel-Modal entfaellt. Der Doppelklick auf die Fachflaeche und die `+N`-Anzeige fuer weitere Flaschen bleiben erhalten.
- Bei genau einer markierten Flasche in der Regalwand fuehrt die Vorschau-Aktion ebenfalls zur Einzel-Flaschenansicht; die Mehrfachauswahl und das Umlagern per Drag-and-drop bleiben bestehen.

**Offen:** Visuelle Chromium-/WebGL-Pruefung, schmale Displaybreiten, reale Mobilgeraete und Pi-Docker-Betrieb.

---

## Testbericht v0.19.13 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Die Unit- und Integrationstests sowie die Versions-/Konsistenzpruefung wurden nach Abschluss der Aenderungen erfolgreich ausgefuehrt. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.13. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien, Sprachschluessel, 18 Markdown-Dateien und relative Links geprueft. |
| `npm test` | **460/460 bestanden** | Unit- und Integrationstests, darunter automatische dreistufige Modal-Rueckkehr, Formularerhalt und Flaschen-Doppelklick. |
| `npm run test:browser` | **Blockiert** | Versuch unternommen; Browser-Suite startet nicht, weil `playwright-core` in der lokalen Installation fehlt (`ERR_MODULE_NOT_FOUND`). Kein Browser-Test bestanden oder ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.19.13

- Regalwand: Doppelklick auf eine Flasche oeffnet deren Einzelvorschau; Einzelklick, Fach-Doppelklick und Drag-and-drop bleiben getrennt.
- Aus dem Fachinhalt-Modal oeffnet ein Flaschenbild die Einzel-Flaschenvorschau, ohne Mehrfachauswahl.
- Modalverwaltung: Folge-Dialoge werden standardmaessig verschachtelt. Schliessen (X, Escape, Hintergrund) kehrt jeweils eine Ebene zurueck, bei expliziten Seitenwechseln wird die gesamte Kette beendet.
- Bestehende ungespeicherte Eingaben und Dateiauswahlen im vorherigen Modal bleiben beim Zurueckkehren erhalten.

**Offen:** Browserbasierte End-to-End-Pruefung der Dialogkette, unterschiedliche Displaybreiten, reale Mobilgeraete und Pi-Docker-Betrieb.

---

## Testbericht v0.19.14 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Die Unit- und Integrationstests sowie die Versions- und Konsistenzpruefungen wurden nach den Aenderungen erfolgreich ausgefuehrt. Historische Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.14. |
| `npm run check` | **Bestanden** | 254 JavaScript-Dateien, Uebersetzungen, 18 Markdown-Dateien und relative Links geprueft. |
| `npm test` | **460/460 bestanden** | Unit- und Integrationstests; Fachuebersicht-Bilder ohne Klickaktion, direkte Fachaktionen, Flaschenvorschau im Moebelmodal und Rueckkehr in der Modalkette. |
| `npm run test:browser` | **Blockiert** | Lauf versucht, startet wegen fehlendem Paket `playwright-core` nicht (`ERR_MODULE_NOT_FOUND`). Die Browser-Regression ist aktualisiert, aber nicht ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.19.14

- Flaschenbilder der Fachinhalt-Uebersicht sind reine Anzeige ohne Klickaktion und ohne Mehrfachauswahl.
- `Umlagern` und `Zur Detailseite` bleiben direkt auf jeder Fachkarte; ein Umlagern-Modal kehrt beim Schliessen zur Fachuebersicht zurueck.
- Flaschen im Moebelmodal bleiben einzeln anklickbar; die Regalwand behaelt Doppelklick fuer Flaschendetails sowie Einfachklick fuer Mehrfachauswahl.
- Browser-Test und Lagerdokumentation an die voneinander getrennten Modalaktionen angepasst.

**Offen:** End-to-End-Pruefung im Browser, mobile Geraete und Pi-Docker-Betrieb.

---

## Testbericht v0.19.15 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Node-Pruefungen und gezielte Chromium-DOM-Tests erfolgreich. Historische Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.15. |
| `npm run check` | **Bestanden** | JavaScript-Syntax/Importe, Uebersetzungsschluessel und Dokumentationslinks geprueft. |
| `npm test` | **460/460 bestanden** | Vollstaendige Unit- und Integrationstests. |
| Gezielte Chromium-Tests (DOM-Modus) | **3/3 bestanden** | Die drei zuvor in GitHub Actions gescheiterten Browser-Testfaelle (Raumplan/Three.js, Fachuebersicht/Modal, Moebelwerkzeuge) bestehen zusammen bei Ausfuehrung mit `WHISKY_BROWSER_DOM_ONLY=true` und lokalem Chromium. Verwendet wurde die lokal verfuegbare Playwright-Laufzeit, nicht das in package-lock.json festgelegte Paket. |
| `npm run test:browser` (normaler Lauf) | **Nicht abgeschlossen** | Direkte Browser-Navigation auf `127.0.0.1` wird hier mit `ERR_BLOCKED_BY_ADMINISTRATOR` abgelehnt. GitHub-Actions-Lauf mit realer Navigation separat pruefen. |
| Vollstaendige Browser-Suite / Docker / ARM64 | **Nicht ausgefuehrt** | Auf CI- beziehungsweise Zielsystem separat pruefen. |

### Aenderungen v0.19.15

- 3D-Raumplan-Browsertest an den aktuellen Wechsel zu `Regale & Faecher` angepasst. Testmoebel erhalten ein Fach, damit sie in der Regalwand sichtbar sind.
- Modal-Browsertest waehlt eindeutig den Schliessen-Button in der Dialog-Kopfzeile statt auch `Abbrechen` zu treffen. Inerte Flaschenbilder werden mit einem echten Mauszeiger-Klick auf die Bildflaeche geprueft.
- Mehrfachbearbeitungs-Browsertest prueft vier Aktionen im separaten Moebelverwaltungsmodal statt im Reiter `Raumplaene`. Der eigentliche Raumplan bleibt frei von diesen Aktionen.
- Keine Aenderung der Anwendungslogik oder der bisherigen Flaschen- und Fachklicks.

**Offen:** Erneuter GitHub-Actions-Browserlauf mit normaler Navigation, komplette Browser-Suite und reale mobile Endgeraete.

---

## Testbericht v0.19.16 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Unit-, Integrations- und gezielter Chromium-DOM-Test erfolgreich. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.19.16. |
| `npm run check` | **Bestanden** | JavaScript, Sprachschluessel und Dokumentationslinks geprueft. |
| `npm test` | **462/462 bestanden** | Vollstaendige Unit- und Integrationstests, darunter Tests fuer belegte und leere Raeume, fehlende Zustimmung, atomare Auslagerung und unveraenderte Flaschenstammdaten. |
| Gezielter Chromium-Test (DOM-Modus) | **1/1 bestanden** | Im Raumplan geloester Raum mit Flasche: Modal, Abbrechen ohne Aenderung sowie anschliessende Auslagerung mit Raumloeschung im Browser geprueft. |
| `npm run test:browser` (normaler Lauf) | **Nicht lokal ausgeführt** | Vollstaendige Browser-Suite mit regulaerer Navigation nicht lokal geprueft. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.19.16

- Belegte Raeume bieten eine Anwendungssicherheitsabfrage mit den Optionen "Abbrechen" oder "Flaschen auslagern und Raum loeschen" und zeigen die Anzahl betroffener Flaschen.
- Der Server entfernt nach ausdruecklicher Zustimmung nur die Zuordnungen zu Faechern des betroffenen Raums und den Raum selbst in einer atomaren Warehouse-Schreiboperation; `collection.json` und andere Raeume bleiben unveraendert.
- Leere Raeume erhalten weiterhin eine normale Loeschbestaetigung. Neue Regressionstests pruefen Schutzverhalten, UI, API und Persistenz.

**Offen:** Vollstaendige Browser-Suite, reale mobile Endgeraete und Raspberry-Pi-/Docker-Livebetrieb verifizieren.

---

## Testbericht v0.20.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Pruefungen der Quellcode-Aenderungen abgeschlossen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten auf v0.20.0 konsistent. |
| `npm run check` | **Bestanden** | 256 JavaScript-Dateien, 1015 i18n-Referenzen und 19 Markdown-Dateien mit 129 relativen Links geprueft. |
| `npm test` | **468/468 bestanden** | Unit- und Integrationstests, darunter 6 neue Offline-Release-Tests. |
| `node --test tests/unit/offline-release.test.js` | **6/6 bestanden** | SHA-256-Versiegelung, fehlende/manipulierte Assets, Symlinkschutz, ausschliesslich lokale Installation und Release-Workflow-Verknuepfung. |
| `sh -n deploy/save-offline-release.sh` und Kopiertest | **Bestanden** | SHA-256-Verifikation vor/nach Kopie, Wiederholung ohne Ueberschreiben und Ablehnung einer manipulierten Zieldatei. |
| YAML-Syntax | **Bestanden** | Release-Workflow mit Ruby YAML-Parser geladen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Keine Browser-/WebGL-Abnahme fuer v0.20.0. |
| Offline-Bundle mit echten npm-/ONNX-Dateien | **Nicht lokal ausfuehrbar** | Paketserver/Modellhosting nicht erreichbar. Vollstaendiger Neuinstallationstest mit `npm_config_offline=true` ist im Release-Workflow hinterlegt, aber noch nicht in GitHub Actions ausgefuehrt. |
| Docker-Image-Export ARM64/AMD64 und `docker load` | **Nicht lokal ausfuehrbar** | Docker Engine in der Testumgebung nicht vorhanden; automatisierte Tests im GitHub-Release-Workflow hinterlegt, aber noch nicht ausgefuehrt. |
| Raspberry-Pi-Live-Test und USB/NAS-Laufwerk | **Nicht ausgefuehrt** | Vor der produktiven Verwendung auf dem Zielsystem pruefen. |

### Aenderungen v0.20.0

- GitHub-Releases erzeugen kuenftig ein Offline-Installations-ZIP mit allen npm-Abhaengigkeiten, KI-Modell, ONNX/WASM-Laufzeit, Lizenzen und SHA-256-Manifest.
- Offline-Start validiert das Archiv, installiert fehlende Pakete mit `npm ci --offline` aus einer temporaeren Cache-Kopie und verzichtet auf Downloadversuche.
- Separate ARM64- und AMD64-Docker-Archive mit `docker save` und Offline-Import-/Startpruefung im Release-Workflow.
- Verifizierte, getrennte Archivierung der Release-Dateien auf USB/NAS-Zielen neben den verschluesselten Datenbackups.
- Anleitung: [OFFLINE_RELEASES.md](OFFLINE_RELEASES.md).

**Offen:** GitHub-Actions-Release-Build und echte Wiederherstellung aus den dort erzeugten Offline-Artefakten; Pi- und Mobil-/Browser-Abnahme.

---

## Testbericht v0.20.1 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Die lokalen Quellcode- und Node-Pruefungen wurden nach der Workflow-Korrektur erfolgreich ausgefuehrt. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.20.1 konsistent. |
| `npm run check` | **Bestanden** | 256 JavaScript-Dateien und 19 Markdown-Dateien, Sprachschluessel und relative Links geprueft. |
| `npm test` | **469/469 bestanden** | Unit- und Integrationstests, einschliesslich neuem Regressionstest fuer die GitHub-Release-Uploads ohne Checkout. |
| YAML-Syntax | **Bestanden** | `.github/workflows/release.yml` mit Ruby YAML-Parser geladen. |
| `node --test tests/unit/offline-release.test.js tests/unit/release-workflow.test.js` | **15/15 bestanden** | Workflow-Abhaengigkeiten, explizite Repository-Auswahl, Offline-Bundle-Verifikation. |
| GitHub Actions Release-Workflow | **Noch nicht ausgefuehrt** | Ob der Upload auf GitHub erfolgreich ist, muss nach Merge und neuem Release v0.20.1 bestaetigt werden. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | UI- und WebGL-Verhalten wurde nicht veraendert. |
| Docker-Archiv-Erstellung und ARM64-/AMD64-Import | **Nicht lokal ausgefuehrt** | Keine lokale Docker Engine; Build und Upload in GitHub Actions offen. |

### Aenderungen v0.20.1

- Der `docker-offline`-Job besitzt bewusst keinen Checkout; `gh release upload` konnte deshalb das Repository nicht aus `.git` ermitteln.
- Beide Asset-Upload-Schritte uebergeben `--repo "$GITHUB_REPOSITORY"`, sodass das Repository unabhaengig vom Arbeitsverzeichnis eindeutig feststeht.
- Regressionstest sichert die explizite Repository-Angabe fuer beide Upload-Schritte ab.

**Offen:** Vollstaendigen GitHub-Actions-Lauf und erfolgreiche Veroeffentlichung der Offline-Archive beobachten. Ein erneuter Lauf des alten v0.20.0-Workflows enthaelt diese Aenderung noch nicht.

---

## Testbericht v0.21.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Ergebnisse fuer v0.21.0; historische Testberichte stehen in [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version 0.21.0 und Release-Metadaten konsistent. |
| `npm run check` | **Bestanden** | 258 JavaScript-Dateien, Sprachschluessel beider Sprachen und 19 Markdown-Dateien inklusive relativer Links geprueft. |
| `npm test` | **473/473 bestanden** | Unit- und Integrationstests, darunter neue Help-Routing-, Inhalts- und Karten-Regressionstests. |
| Gezielter Chromium-DOM-Test | **Bestanden** | Hilfeseite mit 8 Bereichen; Kartenmittelpunkt und Zoom nach Ein-/Ausschalten des Gesamtkatalogs identisch; keine JavaScript-Fehler. |
| Chromium-DOM bei 375 px | **Bestanden** | Hilfeseite ohne horizontales Ueberlaufen (375 px Dokument / 375 px Viewport). |
| `npm run test:browser` (komplette Suite) | **Nicht lokal ausgeführt** | `playwright-core` ist hier nicht installiert. Der direkte Chromium-Aufruf der App wird von der Umgebung blockiert (`ERR_BLOCKED_BY_ADMINISTRATOR`). Der gezielte DOM-Test verwendete deshalb abgefangene lokale Requests. |
| Docker / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.21.0

- Landkarten-Schalter zeigt oder verbirgt Katalog-Destillerien ohne Kamera-Reset; Legende, Sidebar und Zaehler aktualisieren sich.
- Neue Hilfe-Hauptseite (Deutsch/Englisch) mit direkt verlinkten Themenbereichen zu Sammlung, Destillerien, Lagerung, Karte, Fotos, Analyse, Backups und Datenhaltung.
- Erklaertexte von Arbeitsseiten und Formularen entfernt. Bestaetigungen und wichtige Sicherungswarnungen bleiben direkt an der Aktion.

**Offen:** Gesamte Browser-Suite in GitHub Actions, weitere Geraete/Browser und Docker-Betrieb.

---

## Testbericht v0.21.1 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Ergebnisse fuer v0.21.1; fruehere Testberichte stehen in [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version 0.21.1 und Release-Metadaten konsistent. |
| `npm run check` | **Bestanden** | 258 JavaScript-Dateien, Sprachschluessel in Deutsch/Englisch, 19 Markdown-Dateien und 132 relative Links geprueft. |
| `npm test` | **473/473 bestanden** | Unit- und Integrationstests inklusive aktualisiertem Regressionstest fuer die konkrete Einleitung der Hilfeseite. |
| `npm run test:browser` | **Nicht lokal ausgefuehrt** | Reine Textaenderung der Hilfe-Einleitung; keine neue Browserpruefung fuer diese Version. |
| Docker / ARM64-Live-Test | **Nicht ausgefuehrt** | Keine Aenderung an Server, Docker oder Betriebsablauf. |

### Aenderungen v0.21.1

- Einleitung der Hilfeseite nennt konkrete Hilfethemen und typische Aufgaben statt allgemeiner Aussagen; deutsche und englische Texte angepasst.
- Regressionstest fuer die Hilfeseiten-Einleitung ergaenzt.

**Offen:** Vollstaendige Browser-Suite in GitHub Actions sowie Prüfungen auf weiteren Geraeten und im Docker-Betrieb.

---

## Testbericht v0.21.2 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Ergebnisse fuer v0.21.2; fruehere Testberichte stehen in [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version 0.21.2 und Release-Metadaten konsistent. |
| `npm run check` | **Bestanden** | 258 JavaScript-Dateien, Sprachschluessel in Deutsch/Englisch und relative Dokumentationslinks geprueft. |
| `npm test` | **474/474 bestanden** | Unit- und Integrationstests einschliesslich Regressionstests fuer den Analyse-Untertitel und die kurze Hilfeseiten-Einleitung. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Text- und Layoutanpassung an der Hilfeseite; Browser-Pruefung dieser Version nicht ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Keine Aenderung an Server, Docker oder Deployment. |

### Aenderungen v0.21.2

- Satzpunkt beim Analyse-Untertitel in Deutsch und Englisch ergaenzt.
- Regressionstest fuer beide Uebersetzungen hinzugefuegt.
- Hilfeseite: kurze Punchline und bisherige ausfuehrliche Erklaerung in den Seiteninhalt verschoben; Regressionstest angepasst.

**Offen:** Vollstaendige Browser-Suite in GitHub Actions und weitere Geraete-/Docker-Pruefungen.

---

## Testbericht v0.21.3 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Die Node-Pruefungen wurden nach Abschluss der Aenderungen erfolgreich ausgefuehrt. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten konsistent auf v0.21.3. |
| `npm run check` | **Bestanden** | 258 JavaScript-Dateien, Uebersetzungen und 19 Markdown-Dateien geprueft. |
| `npm test` | **474/474 bestanden** | Unit- und Integrationstests, einschliesslich neuer Regressionstests fuer gemeinsame Seitenheader, Breiten und Einstellungen-Punchline. |
| `npm run test:browser` | **Nicht lokal ausgefuehrt** | Keine vollstaendige visuelle Browser-Abnahme dieser Version; in GitHub Actions nachholen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Nicht von diesen UI-Anpassungen betroffen. |

### Aenderungen v0.21.3

- Sammlung, Analyse, Lager, Landkarte, Einstellungen und Hilfe verwenden das gleiche Headerlayout und dessen Typografie; das Sammlung-Headerbild bleibt erhalten.
- Hilfe nutzt die volle Inhaltsbreite. Die ausfuehrliche Einleitung wird unter dem Kopf als kompakter Fliesstext angezeigt.
- Einstellungsseite um eine deutsche und englische Punchline ergaenzt; zusaetzliche obere Abstaende in Analyse, Lager, Landkarte und Einstellungen entfernt.
- Bestehende Abstands-/Header-Tests aktualisiert und neue Regressionstests hinzugefuegt.

**Offen:** Vollstaendige Browser-Suite, visuelle Pruefung unterschiedlicher Displaybreiten und Pi-Docker-Betrieb.

---

## Testbericht v0.21.4 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. Node-Pruefungen erfolgreich durchgefuehrt. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten konsistent auf v0.21.4. |
| `npm run check` | **Bestanden** | 258 JavaScript-Dateien, Uebersetzungen und 19 Markdown-Dateien einschliesslich Links geprueft. |
| `npm test` | **478/478 bestanden** | Unit- und Integrationstests, einschliesslich der UI-Regressionstests fuer einheitliche Kennzahlen-Kacheln, Hilfereiter und die feste Analyse-Punchline. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Browser-Suite nicht in dieser Umgebung ausgefuehrt; visuelle Abnahme in GitHub Actions nachholen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Nicht von dieser Text-/CSS-Aenderung betroffen. |

### Aenderungen v0.21.4

- Hilfe mit horizontalen Reitern und einem sichtbaren Themenbereich, einschliesslich Tastaturbedienung.
- Einleitungs- und Startseitentexte in ihrer urspruenglichen Form beibehalten; lange Hilfebeschreibung nur innerhalb des ersten Hilfereiters anzeigen.
- Sammlung als verbindliche Designreferenz: Analyse- und Lagerkennzahlen nutzen dieselben Kachelklassen, goldene Oberkante, Abstaende, Typografie und mobilen Spalten wie die Sammlung.
- Analyse-Punchline auf allen Reitern dauerhaft "Das Wichtigste auf einen Blick." (beziehungsweise englische Uebersetzung) setzen.
- Regressionstests fuer alle Analyse-Reiter und die gemeinsamen Kennzahlen-Stile ergaenzen.

**Offen:** Vollstaendiger Browser-Testlauf und visuelle Abnahme von Desktop- und Mobilansichten.

---

## Testbericht v0.22.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Tests und gezielte Chromium-DOM-Pruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version 0.22.0 mit README, Lockfile und Changelog abgeglichen. |
| `npm run check` | **Bestanden** | Syntax, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **481/481 bestanden** | Node-Tests einschliesslich Navigation und Text-/Filterlayout. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige Browser-Suite bleibt in GitHub Actions zu pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Erneut nach dem Release auf dem Zielsystem pruefen. |

### Gezielt lokal geprueft

- Chromium-DOM-Modus: **5 von 5 Browser-Tests bestanden**. Untersucht wurden Analyse-Uebersicht, Deep Links und Filter, mobile Analyse mit Datumsfeldern, Hilfe direkt ueber Navigation, gemeinsame Seitennavigation und neues responsives Layout bei 390/1040/1440 px.
- In Headless Chromium zusaetzlich Screenshots bei 390/1040/1440 px erstellt und untersucht: keine horizontalen Ueberlaeufe, einzeilige Seitennavigation bei 1440 px, bewusst getrennte zwei Saetze im Startseiten-Hero bei Desktopbreite, geordnetes Filterraster.
- Browser-Live-Navigation statt DOM-Modus, andere Browserengines sowie der komplette CI-Lauf sind damit **nicht** als bestanden nachgewiesen.

### Aenderungen v0.22.0

- Hilfe und Analyse teilen sich die neue linke Bereichsnavigation auf Desktopbreiten und den mobilen Auswahlwaehler.
- Der aktive Bereich wird mit einer geraden Goldlinie statt einer runden Hervorhebung markiert.
- Hilfeinhalt mit nummerierten Textabschnitten, die nicht durch unruhige Listen oder zu schmale Spalten zerteilt werden.
- Sammlung und Analyse mit responsiven Filterbereichen ohne ungewollte isolierte Zeilen; Hero-Text der Sammlung bleibt wortgleich.

---

## Testbericht v0.23.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node- und gezielte Chromium-DOM-Pruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version v0.23.0 und Release-Metadaten synchron. |
| `npm run check` | **Bestanden** | JavaScript-Syntax, Imports, i18n und Dokumentationslinks. |
| `npm test` | **482/482 bestanden** | Alle Unit- und Integrationstests bestanden, einschliesslich iOS-Icon-Dateien und Lagerort-Darstellung. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige Browsersuite offen; 5/5 gezielte Chromium-DOM-Tests bestanden (Lagerortmodal, Hilfenavigation, Analyse/Filter, Einstellungen und Lager). |
| iOS Safari / PWA auf echtem iPhone | **Nicht lokal ausgeführt** | Icon-Datei und Apple-Touch-Verweis geprueft, aber echtes Hinzufuegen zum Home-Bildschirm nicht getestet; iOS kann bereits installierte Icons zwischenspeichern. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem beziehungsweise im GitHub-Release pruefen. |

### Aenderungen v0.23.0

- Vereinheitlichte, auf der Sammlungsseite basierende Seitenstruktur mit linker Navigation fuer Analyse, Hilfe, Einstellungen und Lager; mobil ein Bereichswaehler. Einstellungen behalten ungespeicherte Formularwerte beim Bereichswechsel.
- Hilfe als ruhiger Analyse-Inhaltsbereich ohne Kachelrahmen; mehr Abstand zum Seitenheader.
- Verbesserte Anordnung des virtuell nicht zugeordneten Flaschenregals und der Filter. Startseitenbeschreibung unveraendert; Umbrueche gestalterisch begrenzt.
- Quadratisches, deckendes Apple-Touch-Icon mit dem App-Logo statt Platzhalterbuchstabe; iOS-Safari-Hardwarepruefung offen.
- Modal **Lagerort** mit hervorgehobener aktueller Zuordnung und standardmaessig geschlossenem Bereich **Lagerort aendern**; Bearbeiten und Speichern erst nach dem Aufklappen moeglich.

---

## Testbericht v0.23.1 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Tests und gezielte Chromium-DOM-Pruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Version v0.23.1 und Metadaten synchron. |
| `npm run check` | **Bestanden** | Syntax, Module, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **483/483 bestanden** | Vollstaendige Node-Unit- und Integrationstests, inklusive der angepassten UI-Regressionstests. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Die komplette Browsersuite bleibt offen. 3 gezielte Chromium-DOM-Tests zu Hero-Umbruechen, Einstellungs-Liste und responsivem Layout bestanden. |
| iOS Safari / PWA auf echtem iPhone | **Nicht lokal ausgeführt** | Icon-Abnahme aus v0.23.0 ist weiterhin offen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Weiterhin auf Zielsystem beziehungsweise in GitHub Actions zu pruefen. |

### Aenderungen v0.23.1

- Lange Einblendung zur virtuellen Ablage **Nicht zugeordnet** entfernt; Suche und paginierte Flaschenkarten bleiben unveraendert verfuegbar.
- Die beiden originalen Saetze der Startseitenbeschreibung stehen ab Desktopbreite jeweils auf einer vollstaendigen Zeile. Kein Text wurde umformuliert.
- **Einstellungen / Destillerien**: doppelten Bereichstitel entfernt, Suchfeld, Trefferzahl und Hinzufuegen-Aktion zusammengefuehrt. Die komplette Destillerienliste scrollt mit der Seite statt in einem eigenen kleinen Fenster.
- Einstellungsinhalte werden ohne zusaetzliche hochgestellte Aussenkacheln angezeigt; bestehende Formulare, Backup-Dialoge, Filter und modale Aktionen bleiben erhalten.

---

## Testbericht v0.23.2 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node- und gezielte Chromium-DOM-Pruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | v0.23.2 und Release-Metadaten synchron. |
| `npm run check` | **Bestanden** | Syntax, Importgraph, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **484/484 bestanden** | Vollstaendige Node-Unit- und Integrationstests, einschliesslich gemeinsamer Designregel. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Komplette Browsersuite offen. Vier gezielte Chromium-DOM-Tests zu Seitenlayout, Menuebreiten, Einstellungen und einzeiligem Hero-Text bestanden. |
| iOS Safari / PWA auf echtem iPhone | **Nicht lokal ausgeführt** | Favicon in Chromium per Code geprueft; Apple-Icon auf echtem Geraet separat pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Weiterhin auf Zielsystem oder in GitHub Actions zu pruefen. |

### Aenderungen v0.23.2

- Ganze originale Startseitenbeschreibung ab 741 px auf einer Zeile; keine Textkuerzung, kein horizontaler Ueberlauf in den getesteten Desktopgroessen.
- Ablage-Suchfeld nach unten verlegt, sichtbares Label entfaellt; beschreibender Placeholder und zugaengliches `aria-label` vorhanden.
- Einstellungsbereiche wie Analyse-Panels mit weiss hinterlegten, eckigen Rahmen; weitere Informationsbloecke seitenuebergreifend an der Sammlungsseite ausgerichtet.
- Eigene Menuebreiten je Seite und Tablet-Auswahl fuer die laengeren Hilfethemen. Goldene Aktivlinie bleibt unveraendert.
- Browser-Tab-Favicon transparent mit goldenem Motiv; iOS-Home-Screen-Icon bleibt deckend.

---

## Testbericht v0.23.3 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** gezielte Pruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.23.3 konsistent. |
| `npm run check` | **Bestanden** | 262 JavaScript-Dateien, 1004 Referenzschluessel, 19 Markdown-Dateien. |
| `npm test` | **485/485 bestanden** | Alle Node-Unit- und Integrationstests. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige Browser-Suite bleibt fuer GitHub Actions offen. |
| Gezielte Chromium-DOM-Tests | **3/3 bestanden** | Lager-Footer-Suche inkl. Fokus; Einstellungen-Abstaende; rechtsseitiges Hilfe-Panel bei 1440 und 390 px sowie Themenwechsel. |
| Browser-Sichtpruefung Hilfe | **Bestanden** | Reale CSS-Darstellung bei 1440 und 390 px: eckiges, weisses Panel unter Themenueberschrift; linke Navigation unveraendert; kein horizontaler Ueberlauf. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach dem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.23.3

- Lager-Ablage: Suche exakt zwischen Flaschenzaehler und Seitennavigation in derselben Footer-Zeile; Suchfokus bleibt beim Filtern erhalten.
- Allgemeine Einstellungen: einheitlicher Abstand zwischen Bereichsueberschrift und Panel.
- Raumkopf: eckiger Rahmen.
- Hilfe: freigegebene Darstellung **nur rechts** als weisses, eckiges Analyse-Panel. Themenueberschrift ausserhalb des Panels; linke Navigation und Hilfetexte bleiben unveraendert.

Die lokale volle Chromium-HTTP-Suite, reale Geraeteabnahme und ARM64-Live-Tests wurden nicht ausgefuehrt.

---

## Testbericht v0.23.4 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** gezielte Pruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.23.4 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Uebersetzungen und Dokumentation geprueft. |
| `npm test` | **486/486 bestanden** | Alle Node-Unit- und Integrationstests, inklusive neuer Darkmode-Regression. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige Browser-Suite bleibt fuer GitHub Actions offen. |
| Gezielter Chromium-DOM-Test | **Bestanden** | Analyse-Filterfarben im Lightmode (rgb 236/233/225) und Darkmode (rgb 27/41/54), passende dunkle Umrandung sowie die vier Auswahlfelder geprueft. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach dem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.23.4

- Analyse: Die Filterleiste behaelt ihre beige Lightmode-Farbe, verwendet im Darkmode jedoch denselben dunklen Hintergrund wie die Sammlung-Toolbar und die thematische Rahmenfarbe.
- Regressionstest stellt sicher, dass die explizite Darkmode-Regel erhalten bleibt.

Die lokale volle Chromium-HTTP-Suite, reale Geraeteabnahme und ARM64-Live-Tests wurden nicht ausgefuehrt.

---

## Testbericht v0.23.5 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** gezielte Pruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.23.5 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Uebersetzungen und Dokumentation geprueft. |
| `npm test` | **487/487 bestanden** | Alle Node-Unit- und Integrationstests, inklusive neuem CSS-Abstandsregressionstest. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige Browser-Suite bleibt fuer GitHub Actions offen. |
| Gezielter Chromium-DOM-Test | **Bestanden (1/1)** | Einstellungen -> Allgemein: Abstand zwischen Bereichsueberschrift und erstem Panel bei 16px geprueft. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach dem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.23.5

- Einstellungen: Der Allgemein-Abschnitt erhaelt 2 px mehr Abstand zwischen Bereichsueberschrift und erstem Inhaltspanel (16 statt 14 px), entsprechend den anderen Einstellungsgruppen. Keine anderen Oberflaechenfunktionen veraendert.

Die lokale volle Chromium-HTTP-Suite, reale Geraeteabnahme und ARM64-Live-Tests wurden nicht ausgefuehrt.

---

## Testbericht v0.23.6 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-14. **Status:** Node-Tests und gezielte Browserpruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.23.6 konsistent. |
| `npm run check` | **Bestanden** | JavaScript-Syntax, Uebersetzungen und Dokumentationslinks geprueft. |
| `npm test` | **487/487 bestanden** | Alle Node-Unit- und Integrationstests. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige HTTP-Browser-Suite einschliesslich echtem Zurueck-/Vorwaerts-Navigieren in GitHub Actions pruefen. |
| Gezielte Chromium-DOM-Tests | **4/4 bestanden** | Destillerienverwaltung, mobile Einstellungen, alle Destillerien samt Pagoden und Karten-Kameraerhalt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach dem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.23.6

- Browser-Tests oeffnen vor dem Importdialog und der Destillerienverwaltung die dafuer vorgesehenen Einstellungsbereiche (Desktop-Seitenmenue oder mobiler Bereichswaehler).
- Destillerien-Test prueft nun die explizit gewollte vollstaendige Liste ohne eigenen Scrollbereich statt der alten Hoehenbegrenzung.
- Kartentest prueft den unveraenderten Zoom beim Ein-/Ausschalten und verwendet erst danach ausdruecklich "Alle Standorte anzeigen" fuer den Weltkartenausschnitt.
- Kartenfehler behoben: Beim Wechsel des Destillerien-Anzeigemodus werden die Pagoden-Marker ohne erneuten Kartenaufbau aktualisiert.

**Grenze:** Der HTTP-basierte Test fuer echte Browser-History und die komplette GitHub-Actions-Browsersuite konnten in der lokalen, auf DOM-Zugriff beschraenkten Umgebung nicht ausgefuehrt werden. Die Korrektur dieses History-Tests wurde im Quellcode und anhand der gemeinsamen Einstellungsnavigation kontrolliert, nicht in einem vollstaendigen realen Navigationslauf.

---

## Testbericht v0.24.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node-Tests, gezielte Chromium-DOM-Tests und Release-Metadatenpruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.24.0 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Modulimporte, Uebersetzungsschluessel und Dokumentationslinks. |
| `npm test` | **495/495 bestanden** | Vollstaendige Node-Unit- und Integrationstests inklusive Geschmacksprofil, Fachnavigation und Moebelfoto-API. |
| Gezielte Chromium-DOM-Tests | **5/5 bestanden** | Interaktives Profil, Fachwechsel/sofortige Kapazitaet, Moebelfotos, Help-Accordion und iOS-artige Modal-Sperre; zudem Regressionen fuer bestehende Flaschen-/Regaldialoge. |
| AES-256-ZIP mit Moebelfotos | **Bestanden** | Backup erstellt, AES-256-Archiv authentifiziert und entpackt; Bilddateien, Zuordnung und Reihenfolge verglichen. |
| `npm run test:browser` | **Nicht vollstaendig lokal ausgefuehrt** | Vollstaendige HTTP-Browser-Suite einschliesslich echtem Zurueck-/Vorwaerts-Navigieren muss in GitHub Actions geprueft werden. |
| Echtes iPhone / iOS Safari | **Nicht ausgefuehrt** | Hintergrund-Scrollfokus, verschachtelte Dialoge und Bildschirmtastatur auf echter Hardware pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Nach dem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.24.0

- Interaktives achtachsiges Geschmacksprofil je Abfuellung; deutsche und englische Achsenbeschriftungen einschliesslich **Alkoholisch** / **Feinty**, Skala 0–10, SVG und Regler.
- Kapazitaetsanzeige der bereits geoeffneten Regalansicht aktualisiert sich unmittelbar nach dem Speichern; Vorheriges/Naechstes Fach mit dreistufigem Anwendungsmodal bei ungespeicherten Aenderungen.
- Mehrere Fotos pro Moebelstueck inklusive Anzeige, Reihenfolge, Loeschung und Einbindung in AES-256-ZIP-Sicherungen.
- Zentrale Hintergrund-Scrollsperre bei offenen Modals mit Erhalt der Seitenposition, insbesondere fuer iOS Safari vorgesehen.
- Technische Backup-Hilfe zu Administrator-Schluessel und zentralem ZIP-Passwort, USB, NAS, Dropbox, OneDrive und weiteren Rclone-Zielen; zusaetzliche Hinweise in den anderen sieben Hilfethemen.

**Grenze:** Die erfolgreichen gezielten DOM-Browserpruefungen sind kein Ersatz fuer die vollstaendige GitHub-Actions-Browsersuite oder einen Test des Scrollverhaltens auf einem echten iPhone.

---

## Testbericht v0.25.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node-Tests, gezielte Chromium-DOM-Tests und Release-Pruefungen bestanden. Fruehere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version v0.25.0 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Modulimporte, Uebersetzungen und Dokumentation. |
| `npm test` | **502/502 bestanden** | Vollstaendige Node-Testreihe inklusive datenverlustfreier Migration, Bewertungsdarstellung und Historie. |
| Gezielte Chromium-DOM-Tests | **3/3 bestanden** | Abfuellungsverkostung mit Glencairn-Auswahl und Rueckgaengig/Wiederholen, Fachbearbeitung mit Moebelfotos, mobile Dialoge und Backup-Hilfe. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige HTTP-Browser-Suite einschliesslich echter Navigation muss in GitHub Actions laufen; gezielte DOM-Tests sind kein Ersatz. |
| Echtes iPhone / iOS Safari | **Nicht ausgefuehrt** | Scroll- und Eingabeverhalten auf realer Hardware pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Nach Release auf Zielsystem pruefen. |

### Aenderungen v0.25.0

- Gemeinsamer zweiter Detailblock fuer Geschmacksprofil, drei Verkostungsnotizen und Fuenf-Glencairn-Bewertung, direkt aenderbar mit seitenlokalem Rueckgaengig/Wiederholen.
- Bewertungen bleiben im Datenmodell auf 0–100 Punkten, um bestehende Zwischenwerte nicht zu runden.
- Migration verschiebt bisherige Bewertungen und Notizen in die Abfuellung. Abweichende Einzelwerte bleiben als archivierte Originaleintraege mit Flaschenbezug erhalten; die vorhandene Collection wird vor der Migration gesichert.
- Analysen und Kurzansichten zaehlen die gemeinsamen Werte je Abfuellung statt je physischer Flasche.
- Hilfe enthaelt nur noch sinnvoll erweiterte Themen, detaillierte Backup-Anleitungen bleiben aufklappbar.
- Moebelfotos stehen unter der Regalansicht. Hinzufuegen und Kameraaufnahme entsprechen den Flaschen; unnoetige Verschieben-Schaltflaechen sind entfernt.

**Grenze:** Keine vollstaendige GitHub-Actions-Browsersuite und keine echte iPhone-Abnahme in dieser Umgebung.

---

## Testbericht v0.25.1 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node-Tests, gezielte Chromium-DOM-Tests und Release-Pruefungen bestanden. Fruehere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version v0.25.1 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Modulimporte, Uebersetzungen und Dokumentation. |
| `npm test` | **504/504 bestanden** | Node-Tests inklusive Farbspeicherung, dezimaler Ratingvalidierung, Glencairn-Symbol und Historiendaten. |
| Gezielte Chromium-DOM-Tests | **3/3 bestanden** | Neue Detailseite, Glas-Bewertung, Farbwahl, Undo/Redo, bestehende Fachnavigation. |
| Darstellung | **Geprueft** | 1440px und 390px, Dark- und Lightmode; Bild- und Faktenblock gleich hoch, kein horizontaler Ueberlauf. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Echte Browsernavigation muss in GitHub Actions geprueft werden; DOM-Tests ersetzen diese nicht. |
| Echtes iPhone / iOS Safari | **Nicht ausgefuehrt** | Mobile Eingaben und Touch-Slider auf realem Geraet pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgefuehrt** | Nach Release auf Zielsystem pruefen. |

### Aenderungen v0.25.1

- Gleich hoher Foto- und Faktenblock; das Bild wird weder verzerrt noch abgeschnitten.
- Dreispaltiges Geschmackslayout aus Radardiagramm und zwei Reglergruppen.
- Glencairn-Bewertungsicons direkt anhand der vom Nutzer gelieferten Silhouette gezeichnet.
- Manuelle Bewertungszahlen zwischen 0 und 100 mit hoechstens einer Nachkommastelle; deutsche und englische Dezimaltrennung.
- Optionale, themaunabhaengige zwoelfstufige Whiskyfarbe; Farbwerte pro Abfuellung, mit Validierung bei API-Schreibvorgaengen.
- Die Gesamtbewertung steht am Schluss; seitenlokale Undo-/Redo-Aktionen erscheinen als Icon-Buttons.

**Grenze:** Die vollstaendige GitHub-Actions-Browsersuite und eine echte iPhone-Abnahme wurden nicht ausgefuehrt.

---

## Testbericht v0.25.2 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node-, gezielte Chromium-DOM- und Release-Pruefungen bestanden. Fruehere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version v0.25.2 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Modulimporte, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **505/505 bestanden** | Node-Tests einschliesslich Drei-Spalten-Markup und unveraenderten Datenmodellen. |
| Gezielte Chromium-DOM-Tests | **2/2 bestanden** | Bestandstest v0.25.1 und neuer Full-HD-Layouttest mit Palette 3x4, Radar und Reglern 2x4. |
| Responsive Darstellung | **Geprueft** | Chromium bei 1920 x 1080, 1040 x 900 und 390 x 844; kein horizontaler Ueberlauf. |
| Screenshots | **Erstellt** | Echte Full-HD-Browserbilder in Light- und Darkmode mit Beispielwerten; nicht Teil des Quellcode-Releases. |
| `npm run test:browser` | **Nicht komplett lokal ausgefuehrt** | Echte Browsernavigation muss in GitHub Actions geprueft werden. |
| Echtes iPhone / iOS Safari | **Nicht ausgefuehrt** | Touch-Interaktion auf realem Geraet separat pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Nach Release auf Zielsystem pruefen. |

### Aenderungen v0.25.2

- Whiskyfarben links mit zwoelf Glencairn-Glas-Piktogrammen in einem 3 x 4-Raster.
- Radardiagramm als mittlere Spalte, acht kurze Geschmacksregler rechts in zwei Spalten mit jeweils vier Werten.
- Responsive Layoutumbrueche bei Tablets und Smartphones, mit unveraenderter Farbdarstellung beider Themes.
- Keine Aenderung an Datenmodell, Geschmackswerten, Foto- oder Bewertungsfunktionen.

**Grenze:** Die vollstaendige GitHub-Actions-Browsersuite und eine echte iPhone-Abnahme stehen noch aus.

---

## Testbericht v0.25.3 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node-, gezielte Chromium-DOM- und Release-Pruefungen bestanden. Fruehere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version v0.25.3 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Modulimporte, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **505/505 bestanden** | Node-Unit- und Integrationstests, einschliesslich der Glencairn-Fuellhoehe. |
| Gezielter Chromium-DOM-Test | **1/1 bestanden** | Drei eckige Analyse-Panels, exakte 87,5 Punkte und 4 volle sowie ein anteilig goldgefuelltes Glencairn-Glas im Light- und Darkmode. |
| Responsive Darstellung | **Geprueft** | Test bei 1440 px und 390 px ohne horizontalen Ueberlauf. |
| `npm run test:browser` | **Nicht komplett lokal ausgefuehrt** | Echte Browsernavigation muss in GitHub Actions geprueft werden. |
| Echtes iPhone / iOS Safari | **Nicht ausgefuehrt** | Bedienung auf realem Geraet separat pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.25.3

- Die Verkostung wird in drei getrennten, flachen Inhalts-Panels nach den bestehenden Analyse-/Einstellungsregeln dargestellt: Geschmacksprofil, Verkostungsnotizen und Bewertung.
- Bei der Bewertung werden die Original-Glencairn-Silhouetten im Kelch von unten mit Whisky-Gold gefuellt. Die Fuellhoehe stellt je Glas die entsprechende Teilbewertung von 0 bis 20 Punkten dar; Kontur und Glanzstrich bleiben sichtbar.
- Der genaue Punktestand (z. B. 87,5 / 100) wird deutlich angezeigt; die manuelle Eingabe und die vorhandene Datenhaltung bleiben unveraendert.

**Grenze:** Die vollstaendige GitHub-Actions-Browsersuite und eine echte iPhone-Abnahme stehen noch aus.

---

## Testbericht v0.25.4 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node-, gezielte Chromium-DOM- und Release-Pruefungen bestanden. Fruehere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version v0.25.4 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Modulimporte, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **505/505 bestanden** | Node-Unit- und Integrationstests ohne Funktionsaenderung. |
| Gezielte Chromium-DOM-Tests | **2/2 bestanden** | Full HD: getrennte Farb- und Geschmacksprofil-Panels, 3x4 Farbpalette, gemeinsames Radar mit 2x4-Reglern; vier eckige Analyse-Panels, goldgefuellte Glencairn-Glaser und exakte 87,5-Punkte-Eingabe. |
| Responsive Darstellung | **Geprueft** | Chromium bei 1920, 1040, 1440 und 390 px ohne horizontalen Ueberlauf. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Echte Browsernavigation muss in GitHub Actions geprueft werden. |
| Echtes iPhone / iOS Safari | **Nicht ausgefuehrt** | Bedienung auf realem Geraet separat pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.25.4

- Die Verkostung hat vier klar benannte, eckige Inhalts-Panels: Farbe, Geschmacksprofil, Verkostungsnotizen und Gesamtbewertung. Farbe ist fachlich vom Geschmacksprofil getrennt; Radar und Regler bleiben gemeinsam in einem Block.
- Uebergeordnet ist nur eine Ueberschrift „Verkostung“ sichtbar, statt wiederholter oder unterschiedlich gewichteter Titelleisten.
- Bewertung erfolgt weiterhin durch von unten goldgefuellte Glencairn-Glaeser und manuelle Praezision bis eine Nachkommastelle. Keine redundanten Info-Icons oder Erklaertexte.
- Speichermodell, Farben, Notizen, Bewertung und Undo/Redo sind unveraendert.

**Grenze:** Die vollstaendige GitHub-Actions-Browsersuite und eine echte iPhone-Abnahme stehen noch aus.

---

## Testbericht v0.25.5 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node-, gezielte Chromium-DOM- und Release-Pruefungen bestanden. Fruehere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version v0.25.5 in Release-Dateien konsistent. |
| `npm run check` | **Bestanden** | 276 JavaScript-Dateien, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **505/505 bestanden** | Node-Unit- und Integrationstests. |
| Gezielter Chromium-DOM-Test | **Bestanden** | Echtes Chromium mit abgefangenen HTTP-Requests: neue Abfuellung, Farbe auswaehlen/entfernen, 87,5 Punkte eingeben, anteilige Glasfuellung, Bewertung entfernen und per Undo wiederherstellen, keine JS-Fehler. |
| Responsive Darstellung | **Bestanden** | Chromium bei 1920, 390 und 320 px ohne horizontalen Ueberlauf; Light- und Darkmode-Screenshots bei 390 px, Darkmode-Screenshot auf Desktop. |
| `npm run test:browser` | **Nicht ausgefuehrt** | Vollstaendige Playwright-Node-Browsersuite nicht verfuegbar, da npm-Abhaengigkeiten hier nicht installiert werden konnten. Gezielte Chromium-DOM-Pruefung separat durchgefuehrt. |
| Echtes iPhone / iOS Safari | **Nicht ausgefuehrt** | Pruefung auf einem realen Geraet separat erforderlich. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgefuehrt** | Auf dem Zielsystem separat pruefen. |

### Aenderungen v0.25.5

- Aktive Whiskyfarbe durch zusaetzliche goldgetoente Kachel, ausgepraegten Rahmen und Haekchen sichtbar hervorgehoben. Unnoetige wiederholte Farbbezeichnung unter der Palette entfernt.
- „Farbe entfernen“ und „Bewertung entfernen“ rechtsbuendig in den jeweiligen Panel-Ueberschriften. Aktivierung und Deaktivierung bleiben auch nach Undo/Redo synchron.
- Gesamtbewertung mit fuenf goldgefuellten Glaesern und genau **einer** numerischen Darstellung: editierbares Punktefeld mit `/ 100`, ohne separat wiederholte grosse Zahl. Die bisherige Praezision und Validierung sind unveraendert.

**Grenze:** Vollstaendige GitHub-Actions-Browsersuite, echtes iOS Safari und ARM64-Live-Test stehen weiterhin aus.

---

## Testbericht v0.26.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node-, Release- und gezielte Chromium-DOM-Pruefungen bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben fuer 0.26.0 konsistent. |
| `npm run check` | **Bestanden** | Syntax/Imports, Sprachkataloge und Dokumentationslinks. |
| `npm test` | **510/510 bestanden** | Node-Unit- und Integrationstests, darunter neue Verkostungs-API, Datumsreihenfolge, Loeschen, No-Migration-Fall und Analytics. |
| Gezielter Chromium-DOM-Test | **Bestanden** | Abfuellungsdetails, Entwurf ohne Persistenz, Anlegen, Wertbearbeitung, Navigation sowie Punkte-/Farbwahl. |
| Responsive Darstellung | **Bestanden** | Chromium bei 1440, 390 und 320 px ohne JS-Fehler und horizontalen Ueberlauf; Desktop-/Mobil-Screenshots. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollstaendige Node-Playwright-Suite lokal nicht verfuegbar (fehlendes `playwright-core`); die gezielte Chromium-DOM-Pruefung ersetzt sie nicht. |
| Echtes iPhone / iOS Safari | **Nicht lokal ausgeführt** | Abnahme auf realer Hardware steht aus. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Deployment auf Zielsystem muss separat geprueft werden. |

### Aenderungen v0.26.0

- 0-n eigenstaendige, datierte Verkostungen je Abfuellung. Uebersicht und Editor auf separaten Seiten, Punkte der letzten (nach Verkostungsdatum) in den Abfuellungsdetails.
- Datumsfeld und optionaler Titel; eigenes Geschmacksprofil, Farbe, Nase/Geschmack/Abgang und Gesamtbewertung je Verkostung.
- Erstellen erst nach explizitem Speichern, spaetere Aenderungen automatisch, Loeschen mit Anwendungsmodal.
- Neue CRUD-API fuer Verkostungen und schreibgeschuetzte Kompatibilitaetsprojektionen auf der Abfuellung, unveraendertes Sammlungsschema 4.
- **Keine neue Datenmigration**: Bestehende Bewertungen/Notizen werden nicht in `tastings[]` umgewandelt. Bestehende Abfuellungsdaten bleiben gespeichert.
- Analysen zeigen nur die letzte Bewertung je Abfuellung; vorhandenes `legacyTastings`-Archiv bleibt lesbar.

**Grenzen:** Vollstaendige Browser-Regression, echtes iOS Safari und ARM64-Live-Abnahme sind noch offen.

---

## Testbericht v0.27.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node-, Release- und gezielte Chromium-DOM-Prüfungen bestanden. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsangaben für v0.27.0 konsistent. |
| `npm run check` | **Bestanden** | JS-Syntax/Imports, Lokalisierungen und Dokumentationslinks. |
| `npm test` (`--test-concurrency=4`) | **513/513 bestanden** | Unit- und Integrationstests einschließlich separater externer Verkostungen und vollständig zurücksetzbarem Geschmacksprofil. |
| Gezielter Chromium-DOM-Test | **Bestanden** | Externe Abfüllung erfassen, erste Verkostung speichern, Wertbearbeitung, Radar entfernen, Undo, Gesamtbewertung und Abgrenzung zur Sammlungsansicht. |
| Responsive Darstellung | **Bestanden** | Chromium bei 1440, 390 und 320 px ohne JS-Fehler oder horizontalen Überlauf auf der Startseite. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Vollständige Browser-Suite erfordert lokal `playwright-core`; gezielter Python-/Chromium-DOM-Test ist kein Ersatz. |
| Echtes iPhone / iOS Safari | **Nicht lokal ausgeführt** | Abnahme auf echter Hardware steht aus. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Deployment auf dem Zielsystem separat prüfen. |

### Änderungen v0.27.0

- Neue Verkostungsstartseite im Hauptmenü mit chronologischer Übersicht aller Verkostungen und Einstieg für eigene Abfüllungen.
- Externe Abfüllungen mit Stammdaten und 0–n Verkostungen, getrennt unter `collection.tastingBottlings[]` von `collection.bottlings[]`. Keine Sammlungs-, Bestands- oder Analysezuordnung; Daten in Export und Backup enthalten.
- Eigenständiger Editor und CRUD für externe Verkostungen; vollständige Radar-Zurücksetzung (`flavorProfile: null`) einschließlich Undo/Redo.
- Abfüllungsdetailseite unverändert; bestehende Sammlungen benötigen keine Migration und behalten Schema 4.

**Grenzen:** Vollständige Browserregression, echtes iOS Safari und ARM64-Live-Abnahme stehen aus.

---

## Testbericht v0.27.1 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Statische Pruefungen und alle Unit-/Integrationstests bestanden. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.27.1 konsistent. |
| `npm run check` | **Bestanden** | 286 JavaScript-Dateien, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **515/515 bestanden** | Unit-/Integrationstests inklusive Header-Gleichheit und Seitenueberschrift. |
| Quellcodeabgleich mit v0.27.0 | **Bestanden** | `public/js/ui/shell.js` (globaler App-Header) und `public/js/views/detail.js` byte-identisch zur Vorversion. |
| `npm run test:browser` | **Nicht ausgefuehrt** | Lokale Chromium-Navigation durch Umgebung blockiert (`ERR_BLOCKED_BY_ADMINISTRATOR`); visuelle Abnahme offen. |
| iOS Safari / Android / Docker | **Nicht ausgefuehrt** | Geraete- und Deploymentpruefungen offen. |

### Aenderungen v0.27.1

- Ausschliesslich den internen Ueberschriftenbereich der Verkostungsstartseite an die gemeinsame Hauptseiten-Hierarchie angeglichen: Eyebrow, Titel, goldener Punkt und Beschreibung.
- Der globale App-Header, seine Aktionen und die Abfuellungsdetailseite sind unveraendert.
- Regressionstests sichern die Header-Gleichheit ueber alle Seiten hinweg ab.

---

## Testbericht v0.27.2 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Statische Prüfungen und die vollständige Unit-/Integrationstestsuite bestanden. Frühere Berichte: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.27.2 konsistent. |
| `npm run check` | **Bestanden** | JS-Syntax und Importe, Deutsch/Englisch, relative Dokumentationslinks. |
| `npm test` | **516/516 bestanden** | Unit-/Integrationstests einschließlich neuer externer Einzelverkostung und Abfüllungsmetadaten in Listen- und Einzelansicht. |
| Vergleich `public/js/views/detail.js` mit v0.27.1 | **Bestanden** | Abfüllungsdetailseite unverändert. |
| Globaler App-Header auf allen Seiten | **Bestanden (Unit-Test)** | Identischer Header einschließlich Aktionen. |
| Direkte API-Smoke-Prüfung | **Bestanden** | Abfüllung mit Alter/Fasstyp/Alkoholgehalt und eigenständige externe Verkostung angelegt. |
| Chromium-Screenshot | **Nicht erfolgreich** | Headless Chromium hängt in der lokalen Umgebung; keine visuelle Browserabnahme behauptet. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Playwright-Browserabhängigkeiten hier nicht installiert. |
| iOS Safari / Android / Docker | **Nicht ausgeführt** | Gerätespezifische und Deployment-Prüfungen offen. |

### Änderungen v0.27.2

- Einheitliche Seitenüberschriften und Abstände auf der Verkostungsstartseite, mit wiederverwendetem Glencairn-Icon aus der Bewertung.
- Abfüllungsname als Hauptüberschrift in Abfüllungs-Verkostungsliste und Einzelverkostung. Vorhandenes Alter, Fasstyp und Alkoholgehalt erscheinen darunter; fehlende Informationen werden nicht angezeigt.
- Sichtbare Zurück-Pfeile zu Abfüllung beziehungsweise Verkostungsübersicht.
- Gemeinsames chronologisches Journal. Externe Verkostungen sind einzelne Datensätze mit eingebetteten Abfüllungsangaben (`externalTastings[]`); keine Verwaltung externer Abfüllungen, keine Mehrfachverkostungen und keine Altformatmigration.
- Globaler App-Header und Abfüllungsdetailseite werden nicht verändert.

---

## Testbericht v0.27.3 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Quellcode- und automatisierte Unit-/Integrationstests erfolgreich; visuelle Browserpruefung offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Package, Lockfile, README, CHANGELOG und Teststatus auf 0.27.3 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Importe, Uebersetzungen und Dokumentationslinks. |
| `npm test` (identische Testdateien mit `node --test --test-concurrency=2`) | **519/519 bestanden** | Unit- und Integrationstests einschliesslich neuer Header-/Infoblock-/Notizfeld-Regressionstests. Der regulaere Gesamtlauf blieb zuvor nach Teiltests haengen; die Wiederholung mit begrenzter Parallelitaet wurde vollstaendig abgeschlossen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Chromium-Start mit einfachem Screenshot-Probelauf in dieser Umgebung nach 10 Sekunden abgebrochen; visuelle Browserpruefung offen. |
| iOS Safari / Android Browser | **Nicht lokal ausgeführt** | Echte Geraete gesondert pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.27.3

- Keine Icons in den Verkostungs-Seitentiteln; gemeinsame Ueberschriftengeometrie.
- In der Verkostungsuebersicht und in der Einzelverkostung steht die Abfuellung samt verfuegbaren Informationen im ersten Informationspanel. Die Zurueck-Links bleiben mit sichtbarem Pfeil erhalten.
- Die drei Notizfelder sind oben an den Labels verankert, auch wenn ein Feld vertikal vergroessert wird.
- Der globale App-Header, die Abfuellungsdetailseite, das Datenmodell und die API bleiben unveraendert.

---

## Testbericht v0.27.4 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Quellcode- und automatisierte Unit-/Integrationstests erfolgreich; visuelle Browserpruefung offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Package, Lockfile, README, CHANGELOG und Teststatus auf 0.27.4 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Importe, Uebersetzungen und Dokumentationslinks. |
| `npm test` (identische Testdateien mit `node --test --test-concurrency=2`) | **523/523 bestanden** | Unit- und Integrationstests einschliesslich Navigation, Listenlayout und explizitem Bearbeiten/Abbrechen externer Abfuellungsinformationen. Alle Tests wurden im Gesamtlauf erfolgreich abgeschlossen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Chromium startete schon beim minimalen lokalen DOM-Probelauf nicht innerhalb von 9 Sekunden; visuelle Browserpruefung offen. |
| iOS Safari / Android Browser | **Nicht lokal ausgeführt** | Echte Geraete gesondert pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.27.4

- Zurueck-Navigation ist auf untergeordneten Verkostungsseiten eine eigene Zeile unmittelbar unter dem Seitenheader.
- Keine zusaetzliche Ueberschrift "Abfuellungsangaben" im ersten Informationsblock; keine doppelten "Verkostungen"-Titel.
- Eintraege verwenden die eingerahmten, getrennten Zeilen aus Lager -> Flasche finden und jeweils eigene Aktionsbuttons.
- Externe Verkostungen zeigen die eingebetteten Abfuellungsdaten nach der Ersterfassung lesend. Der bestehende Stift-Icon-Button wechselt in einen expliziten Bearbeitungsmodus mit Speichern und Abbrechen.
- Globaler App-Header, Abfuellungsdetailseite und Datenmodell bleiben unveraendert.

---

## Testbericht v0.27.5 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Quellcode- und automatisierte Unit-/Integrationstests erfolgreich; visuelle Browserpruefung offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Package, Lockfile, README, CHANGELOG und Teststatus auf v0.27.5 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Importe, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **529/529 bestanden** | Unit- und Integrationstests, einschliesslich Bewertungsfilter, proportionalen Glencairn-Fuellungen, klickbarer Verkostungslisten und atomarer Zuordnung externer Verkostungen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Chromium-/Screenshotpruefungen fuer diese Version nicht abgeschlossen; visuelle Browserpruefung offen. |
| iOS Safari / Android Browser | **Nicht lokal ausgeführt** | Echte Geraete gesondert pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.27.5

- Hauptbereich heisst „Verkostungsnotizen“ auf Deutsch und „Tasting notes“ auf Englisch; Titel und Navigation verwenden dieselbe Terminologie.
- Zurueck-Navigation auf den Verkostungsunterseiten oberhalb der Seitenueberschrift; ganze Listeneintraege oeffnen die Verkostung, separate Loeschaktion bleibt erhalten.
- Sammlungsuebersicht zeigt die Bewertung der letzten Verkostung in Glencairn-Glaesern im Flaschenbild und bietet einen Bewertungs-Schnellfilter.
- Glencairn-Navigationssymbol mit staerkerem optischem Gewicht; externe Einzelverkostungen koennen atomar bestehenden Sammlungsabfuellungen zugeordnet werden.

---

## Testbericht v0.27.6 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Quellcode- und automatisierte Unit-/Integrationstests erfolgreich; visuelle Browserpruefung offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten fuer v0.27.6 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Importe, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **534/534 bestanden** | Unit- und Integrationstests einschliesslich Abfuellungsfoto, externen Einzelverkostungen, transparenter Bewertungsdarstellung sowie Lesemodus und manuell aktivierter Bearbeitung fuer eigene und externe Verkostungen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Lokaler Chromium-Probelauf brach nach Timeout ab, daher keine visuelle Browserfreigabe. |
| iOS Safari / Android Browser | **Nicht lokal ausgeführt** | Echte Geraete gesondert pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.27.6

- Vorhandenes Abfuellungsfoto (dieselbe Coverbild-Auswahl wie in den Abfuellungsdetails) in der ersten Abfuellungs-Infobox auf den Sammlungs-Verkostungsseiten anzeigen; aktuelle Freistellung/Bearbeitung beruecksichtigen. Bei fehlendem Foto oder externer Einzelverkostung kein Platzhalter.
- Glencairn-Bewertung auf den Sammlungskarten ohne Badge-Hintergrund, Rahmen und Schatten des Containers. Glasformen bleiben ablesbar und anteilig gefuellt.
- Gespeicherte Verkostungen im Lesemodus mit statischer Darstellung von Datum, Farbe, Radar, Notizen und Bewertung; Stift-Button aktiviert Bearbeiten, Fertig schliesst es. Neue Verkostungen bleiben direkt im Editor.
- Im Abfuellungs-Infoblock eigener Sammlungsabfuellungen fuehrt ein Button direkt zu deren Abfuellungsdetails.

---

## Testbericht v0.27.7 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Automatisierte Quellcode-, Unit- und Integrationstests bestanden; visuelle Browserpruefung offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten v0.27.7 stimmen ueberein. |
| `npm run check` | **Bestanden** | 288 JavaScript-Dateien, Imports, Uebersetzungen und Dokumentationslinks geprueft. |
| `npm test` | **541/541 bestanden** | Vollstaendige Unit- und Integrationstests, inklusive neuer Regressionstests fuer Button-Position, Navigationsziel, Abfuellungsfoto und Bewertungsdarstellung. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Keine vollstaendige Playwright-Browsersuite; visuelle Darstellung nicht freigegeben. |
| iOS Safari / Android Browser | **Nicht lokal ausgeführt** | Auf echten Geraeten gesondert pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem pruefen. |

### Aenderungen v0.27.7

- "Bearbeiten" fuer gespeicherte Verkostungen innerhalb des ersten Datenblocks (Datum/Titel), nicht mehr in der Abschnittsueberschrift "Eindruecke".
- Erstellung neuer Verkostungen in den Abfuellungsdetails als Plus-Aktion oberhalb der Bewertungskachel; Glencairn-Glaeser vor der Bewertung.
- Auf der Verkostungsstartseite die neue Verkostung wieder in der Kopfzeile des Listenpanels. Einheitliche Glas- und Punktespalten, mehr Abstand zur Trennlinie.
- Abfuellungsfoto links vor dem Informationstext; leere Verkostungslisten aus den Abfuellungsdetails ohne ungueltige ID erreichbar.
- Deutlichere Farbanzeige in der Leseansicht und Punkte des Radars ohne Zeilenumbruch.

---

## Testbericht v0.27.8 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Quellcode-, Release-, Unit- und Integrationstests bestanden; visuelle Browserpruefung offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version 0.27.8 ueber alle Release-Dateien konsistent. |
| `npm run check` | **Bestanden** | Syntax, Imports, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **544/544 bestanden** | Vollstaendige Unit- und Integrationstests, inklusive Position der Aktionen, einheitlicher Plus-Icons und Glencairn-Ausrichtung. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Visuelle Browserpruefung und vollstaendige Playwright-Suite offen. |
| iOS Safari / Android Browser | **Nicht lokal ausgeführt** | Auf echten Geraeten gesondert pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach dem Release auf dem Zielsystem pruefen. |

### Aenderungen v0.27.8

- Die Aktion "Neue Verkostung" befindet sich in den Abfuellungsdetails wieder innerhalb der Bewertungskachel; die zur Abfuellung gehoerende Verkostungsliste zeigt die Neuanlage im Listenpanel.
- Rueckgaengig/Wiederholen, Fertig und Loeschen stehen beim Editieren im ersten Datenpanel statt neben der Ueberschrift "Eindruecke"; dessen Abstand zum Panel ist an die anderen Abschnitte angeglichen.
- Einheitliches SVG-Plus fuer Aktionen zum Anlegen/Hinzufuegen; statt separater Text-Pluszeichen in Schaltflaechen.
- Die kleine Glencairn-Bewertung in den Sammlungskarten wurde etwas weiter links ausgerichtet.

---

## Testbericht v0.27.9 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Statische Projektpruefungen und 545 Unit-/Integrationstests erfolgreich. Vorherige Testberichte: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version 0.27.9 und Release-Metadaten stimmen ueberein. |
| `npm run check` | **Bestanden** | Syntax, Modulimporte, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **545/545 bestanden** | Unit- und Integrationstests mit begrenzter Parallelitaet. |
| `npm run test:browser` | **Nicht lokal ausgefuehrt** | Visuelle Browserpruefung steht aus. |
| iOS Safari, Android, Docker/ARM64 | **Nicht lokal ausgefuehrt** | Endgeraete- und Deployment-Pruefungen stehen aus. |

### Aenderungen v0.27.9

- „Neue Verkostung“ in Abfuellungsdetails in die Abschnittsueberschrift ueber der Bewertungskachel verschoben; der Button in der Verkostungslistenansicht bleibt innerhalb ihrer Kachel.
- Der Bearbeitungsblock fuer Verkostungen nutzt Desktop-seitig drei Spalten: schmales Datum, breiter Titel, rechts die Aktionen. Responsive Umbrueche fuer schmale Ansichten.
- Regressionstests fuer Button-Position sowie DOM-Reihenfolge und Grid-Aufteilung ergaenzt.

Die tatsaechliche Browserdarstellung wurde hier nicht visuell abgenommen.

---

## Testbericht v0.27.10 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Statische Projektpruefungen und 545 Unit-/Integrationstests erfolgreich. Vorherige Testberichte: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten der Version 0.27.10 stimmen ueberein. |
| `npm run check` | **Bestanden** | Syntax, Modulimporte, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **545/545 bestanden** | Unit- und Integrationstests, inklusive Lesemodus-/Bearbeitungsmodus-Regression. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Visuelle Browserpruefung steht aus. |
| iOS Safari, Android, Docker/ARM64 | **Nicht lokal ausgeführt** | Endgeraete- und Deployment-Pruefungen stehen aus. |

### Aenderungen v0.27.10

- In gespeicherten Verkostungen lautet die Titelbeschriftung im Lesemodus nur noch „Titel“ (englisch „Title“); bei der Bearbeitung bleibt „Titel (optional)“ (englisch „Title (optional)“).
- Regressionstest stellt die unterschiedlichen Beschriftungen in beiden Modi sicher.

Die tatsaechliche Browserdarstellung wurde hier nicht visuell abgenommen.

---

## Testbericht v0.27.11 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Kernpruefungen fuer v0.27.11 erfolgreich, manuelle Browser-/Zielsystempruefungen noch offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten fuer v0.27.11 konsistent. |
| `npm run check` | **Erfolgreich** | 290 JavaScript-Dateien, Uebersetzungen und 165 Markdown-Links geprueft. |
| `npm test` | **Erfolgreich (545/545 Tests)** | Unit- und Integrationstests komplett gruen. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Kein separater Browserlauf in diesem Release dokumentiert. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Weiterhin auf dem Zielsystem pruefen. |

### Aenderungen v0.27.11

- Filterleiste der Sammlung so angepasst, dass lange Select-Beschriftungen wie „Alle Bewertungen“ und „Alle Flaschentypen“ nicht mehr abgeschnitten werden.
- Desktop-Layout der Sammlungsfilter bekommt frueher einen Zeilenumbruch, bevor Controls unleserlich eng werden.

### Hinweise

- Die Aenderung betrifft ausschliesslich das Layout der Filterleiste auf der Sammlungsseite.
- Eine manuelle Sichtpruefung im Browser, insbesondere fuer schmale Desktop-Breiten und Mobilgeraete, ist weiterhin empfohlen.

---

## Testbericht v0.27.12 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Node- und Chromium-Pruefungen erfolgreich. Browser-History ausserhalb des DOM-Testmodus, iOS Safari und Docker/ARM64 bleiben separat zu pruefen. Aeltere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten stimmen fuer v0.27.12 ueberein. |
| `npm run check` | **Erfolgreich** | Syntax, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **545/545 bestanden** | Unit- und Integrationstests vollstaendig abgeschlossen. |
| `npm run test:browser` | **Bestanden (76/77)** | Chromium im DOM-Testmodus: 76 erfolgreich, 0 fehlgeschlagen, 1 uebersprungen (echte Browser-History). |
| iOS Safari / Android | **Nicht lokal ausgeführt** | Manuelle Endgeraetepruefung ausstehend. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf dem Zielsystem ausstehend. |

### Aenderungen v0.27.12

- Fehlenden `toast`-Import in der Abfuellungsdetailansicht korrigiert. Dokumente und Fotos laden nach dem Speichern wieder korrekt in die aktualisierte Ansicht.
- Foto-Sortierung im Browsertest erst nach dem Scrollen der Galerie in den sichtbaren Bereich simuliert.
- Tests fuer den sechsten Schnellfilter, den Abschnitt `Eindruecke`, eindeutig benannte Modalschaltflaechen und den Abschluss asynchroner Loeschvorgaenge aktualisiert.
- In der DOM-Browser-Testumgebung haben spezifische Mock-Routen fuer den Freistellungsdienst Vorrang vor der allgemeinen Request-Weiterleitung.

### Grenzen

- Der Chromium-Lauf verwendete `WHISKY_BROWSER_DOM_ONLY=true`, weil der direkte Aufruf lokaler Browser-URLs in dieser Umgebung blockiert ist. Der explizit uebersprungene Test fuer Browser-History wird in diesem Modus nicht ausgefuehrt.
- Die beiden vorher fehlgeschlagenen KI-Mock-Tests wurden nach Korrektur des Routing-Verhaltens erneut erfolgreich ausgefuehrt und sind Teil der obigen 76 Browser-Pruefungen.

---

## Testbericht v0.28.0 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-15. **Status:** Unit- und Integrationstests erfolgreich; gezielte Chromium-Tests erfolgreich. Vollständiger Browser-Gesamtlauf nicht abgeschlossen. Historische Berichte: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version 0.28.0 in den Release-Metadaten. |
| `npm run check` | **Bestanden** | Syntax/Importe, Übersetzungen und Markdown-Links. |
| `npm test` | **551/551 bestanden** | Enthält sechs gezielte neue Unit-/Integrationstests für Flight-Modell, Exklusivität, Anlegen, Sortieren, Löschen und Navigation. |
| `npm run test:browser` | **Nicht abgeschlossen** | Vollständiger lokaler DOM-Modus-Lauf nach 27 protokollierten Browserfällen (26 bestanden, 1 übersprungen) ohne Testergebnis wegen Timeouts beendet. Nicht als bestanden gewertet. |
| `tests/browser/app.test.js` (gezielt) | **2/2 bestanden** | Chromium: Flight anlegen, vorhandene eigene Notiz anhängen, neue externe Notiz atomar anlegen, Reihenfolge ändern; mobile Liste und Flight bei 390 und 320 px ohne horizontalen Überlauf. |
| Echter iOS Safari / Android / Docker ARM64 | **Nicht lokal ausgeführt** | Prüfen auf realen Zielgeräten. |

### Aenderungen v0.28.0

- Optionale Tasting-Flights: Name, Datum, gemeinsame Notiz und geordnete Verkostungs-IDs.
- Eine Verkostungsnotiz darf maximal einem Flight angehören; Server validiert dies atomar.
- Bereits vorhandene und neue eigene/externe Verkostungen können in einen Flight aufgenommen werden.
- Eine spätere externe Zuordnung zur Sammlung behält den Flight-Eintrag und seine Position.
- Beim Löschen des Flights werden die Einzelverkostungen nicht gelöscht; beim Löschen der Verkostung wird nur die Flight-Referenz bereinigt.
- Mobile Verkostungslisten: Titel und Bewertung auf getrennten Zeilen, damit kurze Titel nicht mehr gebrochen werden.

### Grenzen

Die visuelle Darstellung wurde mit Chromium bei Desktop- und Mobilbreite geprüft. Die vollständige Browsertestsuite hat in dieser Umgebung nach Test 27 nicht abgeschlossen. Daraus wird kein Erfolg der restlichen Testfälle abgeleitet.

---

## Testbericht v0.28.1 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-16. **Status:** Unit-/Integrationstests und gezielte Chromium-Pruefung erfolgreich. Weitere Browser- und Zielsystempruefungen offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten fuer v0.28.1 konsistent. |
| `npm run check` | **Erfolgreich** | Syntax/Imports, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **553/553 bestanden** | Vollstaendige Unit-/Integrationssuite, inklusive zweier neuer Flight-Tests. |
| Gezielter Chromium-Check | **Erfolgreich** | Bei drei Flight-Eintraegen blieben Glas- und Punktespalten exakt ausgerichtet; Pointer-Ziehen veraenderte die Reihenfolge und speicherte sie ueber die API; bei 320 px kein horizontaler Ueberlauf. |
| `npm run test:browser` | **Nicht abgeschlossen** | Ein Regressionstest fuer das Ziehen wurde in die Suite aufgenommen. Der gezielte Browser-Check erfolgte separat im DOM-Modus mit Python-Playwright. |
| iOS Safari / Android / Docker ARM64 | **Nicht lokal ausgefuehrt** | Auf Zielgeraeten pruefen. |

### Aenderungen v0.28.1

- Die Bewertung eines Flight-Eintrags verwendet feste Breiten fuer die Glencairn-Darstellung und die Punktzahl.
- Ein Griff neben der Positionsnummer ermoeglicht das Umsortieren per Ziehen mit Maus, Touch oder Stift. Beim Loslassen wird die neue Reihenfolge ueber die bestehende Flight-API gespeichert. Auf-/Ab-Buttons bleiben bestehen.
- Die einzelne Verkostungsnotiz bleibt nach der Sortierung unveraendert; nur ihre Position im Flight aendert sich.

---

## Testbericht v0.28.2 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-16. **Status:** Kernpruefungen erfolgreich, Browser- und Zielsystempruefungen noch offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten von v0.28.2 konsistent. |
| `npm run check` | **Erfolgreich** | Syntax, Importpfade, Uebersetzungen und relative Dokumentationslinks. |
| `npm test` | **554/554 bestanden** | Unit- und Integrationstests, einschliesslich erweiterter Hilfeseitentests. |
| `node --test tests/unit/help-page.test.js` | **Erfolgreich (6/6)** | Hilfe in beiden Sprachen, Themen-Navigation und neue Verkostungs-/Flight-Inhalte. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Visuelle und interaktive Browserpruefung steht noch aus. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach Einspielen auf dem Zielsystem pruefen. |

### Aenderungen v0.28.2

- Eigenstaendige Hilfethemen fuer Verkostungsnotizen und Tasting-Flights ergaenzt, jeweils in Deutsch und Englisch.
- Lesemodus, Neu- und Mehrfachverkostung, letzte Bewertung, Whiskyfarbe, Radar, externe Abfuellungen, spaetere Zuordnung, Flight-Mitgliedschaft und Reihenfolge dokumentiert.
- Veraltete Hilfeaussagen zur Bearbeitung von Geschmacksprofil und Bewertung direkt an der Abfuellung entfernt.
- Hilfe-Einleitung, Menueuebersicht und README auf die vorhandenen Funktionen aktualisiert.

---

## Testbericht v0.28.3 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-16. **Status:** Kernpruefungen erfolgreich, visuelle Layoutpruefungen in Chromium durchgefuehrt; Browser-End-to-End und Zielsystempruefungen noch offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten von v0.28.3 konsistent. |
| `npm run check` | **Erfolgreich** | Syntax, Importpfade, Uebersetzungen und relative Dokumentationslinks. |
| `npm test` | **557/557 bestanden** | Unit- und Integrationstests einschliesslich neuer Flaschenkarten- und Fotovorschau-Tests. |
| `node --test tests/unit/detail-action-icons.test.js tests/unit/photo-viewer.test.js` | **Erfolgreich (11/11)** | Unveraenderte Foto-Aktionen, eine Galerie je Flasche, Bildbetrachter und Ansicht ohne Bild. |
| Chromium Layoutpruefung | **Erfolgreich** | Gerenderter Detailmarkup/CSS-Stand mit Bild und ohne Bild bei 1440 px (Light), 390 px (Light) und 320 px (Dark): kein horizontaler Ueberlauf, Bild und Daten in erwarteter Reihenfolge. Kein vollstaendiger App-E2E-Lauf. |
| `npm run test:browser` | **Nicht lokal ausgefuehrt** | Foto-/Datei-Aktionen weiterhin im integrierten Browser-End-to-End-Lauf zu pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgefuehrt** | Nach Einspielen auf dem Zielsystem pruefen. |

### Aenderungen v0.28.3

- Physische Flaschenkarten: grosse Vorschau des ersten gespeicherten Fotos links; Galerie mit allen bestehenden WB-/Freistellungskennzeichen, Editier-, Sortier-, Upload- und Loeschaktionen direkt darunter.
- Inventarnummer, Status und Groesse sowie Kaufdatum, Preis, Lagerort und weitere vorhandene Angaben rechts; Dokumente und Nachweise unterhalb in voller Kartenbreite.
- Bei Flaschen ohne Fotos entfaellt die linke Bildspalte. Neue Fotos koennen trotzdem direkt hinzugefuegt oder aufgenommen werden.
- Bildbetrachter navigiert von der grossen Vorschau nur innerhalb der Galerie derselben physischen Flasche. Weder Foto- noch Dateiablageformat wurden veraendert.

---

## Testbericht v0.28.4 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-16. **Status:** Kernpruefungen erfolgreich. Chromium-Layoutpruefung durchgefuehrt; kompletter Browser-End-to-End-Lauf und Tests auf echten Mobilgeraeten noch offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten fuer v0.28.4 konsistent. |
| `npm run check` | **Erfolgreich** | Syntax, Importpfade, beide Sprachkataloge und Dokumentationslinks. |
| `npm test` | **557/557 bestanden** | Unit- und Integrationstests inklusive Fotoaktionstests und Layoutstruktur der Flaschenkarte. |
| `node --test tests/unit/detail-action-icons.test.js tests/unit/photo-viewer.test.js` | **11/11 bestanden** | Fotogalerie-Aktionen, einzelne Bildvorschau, Bearbeitung, Sortierung, Anzeige ohne Foto. |
| Chromium-Layoutpruefung | **Erfolgreich** | HTML/CSS in Chromium bei 1440 px (Light), 390 px (Light) und 320 px (Dark); kein horizontaler Ueberlauf, korrekte Layoutspalten und mobile Reihenfolge. Standalone-Rendering, kein vollstaendiger App-End-to-End-Test. |
| `npm run test:browser` | **Nicht lokal ausgefuehrt** | Interaktive Foto- und Dateiablaufe noch im integrierten Browser-End-to-End-Test pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgefuehrt** | Nach Einspielen auf dem Zielsystem pruefen. |

### Aenderungen v0.28.4

- Flaschendaten im zweispaltigen Beschriftungs-/Wertstil der Abfuellungsdaten statt der bisherigen horizontalen Kennzahlenleiste; einheitlicher Abschnittstitel.
- Bei Flaschen mit Fotos: erstes Foto weiterhin gross links, komplette sortierbare Thumbnail-Leiste mit Bildbearbeitung, WB-/Freistellungskennzeichnung, Upload und Kameraaufnahme platzsparend rechts unter den Flaschendaten.
- Auf schmalen Displays: grosses Bild, Fotoaktionen, Flaschendaten und Nachweise untereinander; ohne Foto keine leere Bildspalte.
- Dateien und Nachweise bleiben am Ende der Karte ueber die volle Breite; Datenformat und vorhandene Foto-/Dateiaktionen unveraendert.

---

## Testbericht v0.28.5 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-16. **Status:** Kernpruefungen erfolgreich; vollstaendige Browser-Suite und echte Mobilgeraete noch offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten v0.28.5 konsistent. |
| `npm run check` | **Erfolgreich** | JavaScript, Uebersetzungen und Dokumentationslinks geprueft. |
| `npm test` | **557/557 bestanden** | Unit- und Integrationstests. |
| Gezielt gerendertes Chromium-Layout | **Erfolgreich** | 1440 px (Light/Dark), 390 px (Light), 320 px (Dark): drei bzw. zwei Datenspalten, eine Flaschenkarte, kleinere Vorschau, Fotos und Nachweise linksbuendig ueber volle Kartenbreite, kein horizontaler Ueberlauf. |
| `npm run test:browser` (vollstaendig) | **Nicht lokal ausgeführt** | Eine vollstaendige End-to-End-Suite wurde fuer diesen Release nicht ausgefuehrt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf Zielsystem pruefen. |
| Echte iOS-/Android-Geraete | **Nicht lokal ausgeführt** | Mobile Browser weiterhin separat pruefen. |

### Aenderungen v0.28.5

- Doppelte Kartenrahmen der physischen Flaschen entfernt.
- Flaschendetails drei Spalten ohne Linien zwischen den Feldern auf breiten Viewports.
- Kompaktere Flaschenfoto-Vorschau; Fotos und Nachweise beginnen jeweils links unter der Kopfzeile und nutzen die volle Kartenbreite.
- WB-Kennzeichnung, Bildeditor, Drag-and-drop-Sortierung, Pfeile, Upload, Kamera und Dateien beibehalten.

---

## Testbericht v0.28.6 (vor dem naechsten Versionswechsel)

**Stand:** 2026-11-16. **Status:** Unit-/Integrationstests und gezielte Chromium-Pruefungen erfolgreich; vollstaendige Browser-Suite sowie reale Mobilgeraete noch offen. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

### Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Erfolgreich** | Release-Metadaten v0.28.6 konsistent. |
| `npm run check` | **Erfolgreich** | JavaScript, Sprachkataloge und Dokumentationslinks. |
| `npm test` | **557/557 bestanden** | Vollstaendige Unit-/Integrationstests. |
| Chromium-DOM-Pruefung mit realer App | **Erfolgreich** | Acht Testfotos; Loeschen eines mittleren und des ersten Fotos sowie eines PDF-Nachweises: kein Sprung des Seiteninhalts, sofortige Scrollwiederherstellung. |
| `npm run test:browser` (vollstaendig) | **Nicht lokal ausgeführt** | Neuer Browser-Regressionstest vorhanden, vollstaendiger Runner steht noch aus. |
| Echte iOS-/Android-Geraete | **Nicht lokal ausgeführt** | Scroll-Lock auf Safari und anderen Mobilbrowsern separat pruefen. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Auf Zielsystem pruefen. |

### Aenderungen v0.28.6

- Bei Updates derselben Ansicht bleiben Header und modale Ebene bestehen. Die Abfuellungsdetailseite ersetzt nur veraenderte Abschnitte, statt das gesamte Dokument kurz zu entfernen.
- Bestaetigungsdialoge stellen die Scrollposition sofort wieder her, ohne die globale sanfte Scrollanimation auszuloesen.
- Bei einer neuen Titelfotografie bleibt die zuvor sichtbare Bildhoehe bis zum Laden des Ersatzfotos reserviert.
- Foto-Sortierung wird bei wiederverwendeten Galerieelementen nur einmal angebunden.
- Eine Browser-Regression gegen sichtbare Scrollspruenge beim Loeschen von Fotos und Nachweisen wurde ergaenzt.
