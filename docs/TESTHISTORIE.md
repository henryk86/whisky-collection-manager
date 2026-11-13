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
