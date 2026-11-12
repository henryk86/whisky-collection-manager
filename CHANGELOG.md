# Changelog

## 0.16.10 - 2026-11-12

- Alten HTML-Import und vorherige Fragmentformate entfernt; nur neues generisches Importprotokoll, externe Erweiterung ausgelagert und Dokumentation neutralisiert

## 0.16.9 - 2026-11-12

- Optionale Browsererweiterung in separates privates Paket ausgelagert; Importoberflaeche nur noch bei eingehenden Daten sichtbar

## 0.16.8 - 2026-11-12

- Fehlenden analyzeBottleMask-Import im Regressionstest für transparente Flaschen ergänzt; CI-ReferenceError behoben.

## 0.16.7 - 2026-11-12

- Freistellung richtet Flaschen mit moderater Neigung bis 20 Grad aus statt sie ab 12 Grad unveraendert zu lassen; Regressionstests fuer beide Drehrichtungen.

## 0.16.6 - 2026-11-12

- Docker-Laufzeit auf Debian Slim umgestellt, damit Node.js 22 auf Raspberry Pi 4 ARM64 startet; Restic, Rclone und SSH-Client weiter enthalten

## 0.16.5 - 2026-11-12

- Regalfaecher: Flaschenklick zeigt Detail-Modal mit Foto, Lagerangaben, separatem Umlagern und Link zur gezielt markierten Flasche auf der Detailseite

## 0.16.4 - 2026-11-12

- Freistellung: breite halbtransparente Maskensaume auf eine schmale Antialias-Kante reduzieren

## 0.16.3 - 2026-11-12

- Freistellung: zentrale zusammenhaengende Flaschenkontur isolieren, leichte Schraeglage automatisch ausrichten und das transparente 2:3-Ergebnis oben/unten pixelgenau beschneiden

## 0.16.2 - 2026-11-12

- Freigestellte Flaschen anhand der erkannten Kontur automatisch auf transparentes 2:3 zuschneiden; redundanten Button „Neu freistellen“ aus der Vorschau entfernen.
- Freistellungsdialog: Original und Ergebnis werden vollständig ohne Bildbeschnitt angezeigt; größere Vorschau auf Desktop, untereinander angeordnete Bilder auf kleinen Bildschirmen. Browser-Regressionstest für unterschiedliche Bildformate und Viewports.

## 0.16.1 - 2026-11-12

- ONNX-Runtime-Module (.mjs) mit korrektem JavaScript-MIME-Typ ausliefern, damit die lokale Flaschenfreistellung im Browser starten kann

## 0.16.0 - 2026-11-12

- Lokale KI-Freistellung für Flaschenfotos mit ONNX Runtime Web und U²-Netp: Foto per Kamera oder Upload, Original-/Ergebnisvergleich, bestätigte Speicherung, Umschalten und Entfernen der Freistellung.
- Optionale transparente PNG-Ableitungen je Foto in Schema 4. Sammlung, Detail und Lager verwenden die gewählte Bildvariante; Originaldateien bleiben erhalten. Vorhandene AES-ZIP-Backups enthalten beide Dateien.
- Neue JSON- und Origin-geschützte Foto-Endpunkte; Validierung und Regressionstests für Speicherung, Original-Erhalt, ZIP-Backup und Bildauswahl.
- KI-Dateien werden beim Docker-Build oder über `npm run cutout:prepare` fest versioniert und lokal bereitgestellt. Die tatsächliche ONNX-Inferenz benötigt eine separate Browser-/Geräteabnahme; die Dateien konnten in der Arbeitsumgebung nicht heruntergeladen werden.

## 0.15.15 - 2026-11-12

- Dauerhafte Scrollbar-Spur statt hellem Gutter-Streifen, engerer initialer 3D-Raumausschnitt und README-Galerie mit GUI-Screenshots

- Die Root-Scrollbar verwendet `overflow-y: scroll` statt `scrollbar-gutter: stable`: weniger auffaelliger rechter Rand bei kurzen Seiten und offenen Menues, bei weiterhin stabilem Seitenlayout.
- Initiale orthografische 3D-Raumansicht vergroessert: Der gesamte Raum wird mit kleiner Sicherheitsreserve eingepasst und nutzt mehr der verfuegbaren 3D-Flaeche; bestehende Zoom- und Blickwinkelsteuerung bleiben unveraendert.
- README-Galerie mit vier echten GUI-Screenshots (Sammlung hell/dunkel, Mobil und synthetischer Lagerraum in 2D) hinzugefuegt.
- Regressionstests und technische Dokumentation zur Scrollbar-Spur und initialen Kameraframing erweitert.

## 0.15.14 - 2026-11-12

- Browser-Layouttests messen horizontalen Ueberlauf nun relativ zur tatsaechlichen Body-Breite (`getBoundingClientRect().width`) statt zu `body.clientWidth`, das mit stabilem Scrollbar-Gutter die Fensterbreite liefern kann.
- Der 8-px-Regressionstest verwendet eine Testflaeche im normalen Dokumentfluss und prueft sowohl deren sichtbare Ueberlappung als auch die Scrollbreite; responsive Breitentests folgen derselben Messregel.
- Teststatus, Testhistorie und Entwicklerdokumentation um das konkrete CI-Fehlerbild und die getrennten DOM-/HTTP-Browserpruefungen ergaenzt. Keine Aenderung an Produkt-CSS, Datenformaten oder API.

## 0.15.13 - 2026-11-12

- Test 24: Breite des tatsaechlichen Body-Layouts statt `document.documentElement.clientWidth` als Referenz bei `scrollbar-gutter: stable` verwendet.
- Rechtes Seitenmenue relativ zum fixierten Backdrop gemessen; alle Browser-Ueberlaufpruefungen auf die nutzbare Body-Breite umgestellt.
- Neuer Browser-Negativtest: 8 px horizontaler Ueberlauf muessen erkannt werden; Scrollbar-Test nutzt dieselbe Layoutmetrik. Keine Produkt-CSS-Aenderung.

- Browser-Layouttests messen die tatsaechlich nutzbare Seitenbreite inklusive Scrollbar-Gutter, pruefen Seitenmenue und erkennen kleine horizontale Ueberlaeufe.

## 0.15.12 - 2026-11-12

- Host-Warnlimit: Nach 20 verschiedenen abgelehnten Namen wird genau einmal erklaert, dass weitere Ablehnungen nicht mehr einzeln geloggt werden.
- Der Container-Supervisor verwendet fuer die HTTPS-Bereitschaftspruefung wie Docker `/api/version` statt `/api/collection`.
- Abgebrochene eingehende JSON-Uploads verursachen keine erwartbaren internen Fehler-Stacktraces; unvollstaendige Importe bleiben ohne Datenaenderung. Regressionstest hinzugefuegt.
- Browser-Test fuer die gemeinsame Breite von Sammlung und Landkarte vergleicht mit `document.documentElement.clientWidth` statt mit der Fensterbreite einschliesslich reserviertem Scrollbar-Gutter (15 px auf klassischen Systemen).

## 0.15.11 - 2026-11-12

- Host-Allowlist mit Upgrade-Diagnose, abgebrochene Downloads ohne Log-Flut und Betriebsdokumentation verbessert.
- HTTP-421-Ablehnungen werden einmalig pro Host protokolliert, beim Start erscheint die aktive Allowlist; Upgrade-Hinweise fuer Pi und lokale Installationen.
- Reverse Proxy mit HTTPS zum Backend und erhaltenem Host dokumentiert; HTTP-Upstream bleibt ohne Vertrauen in Forwarded-Header nicht unterstuetzt.
- Erwartete Verbindungsabbrueche beim Download erzeugen keine Stacktraces, echte Dateilesefehler bleiben sichtbar; Integrationstest.
- Testhistorie um v0.15.9/v0.15.10 ergaenzt (alter Scrollbar-Test war nicht aussagekraeftig), Schuldenliste und `tHtml()`-Migrationshinweise aktualisiert.

## 0.15.10 - 2026-11-12

- Security review: CSRF und Host-Haertung, sichere statische Antworten, CSV-Schutz, schnellere Lagerzuweisung und verbesserte Tests
- JSON-Schreibzugriffe mit Medientyp- und Origin-Pruefung abgesichert; Host-Allowlist gegen DNS-Rebinding, auch fuer Docker-Zertifikatsnamen.
- CSP mit Hashes der Inline-Skripte, Frame-Schutz und OSM-kompatible Referrer-Policy ergaenzt.
- CSV-Formelschutz, sichere Stream-Fehlerbehandlung, 400 bei defekten Pfadkodierungen, optimierte Fachzuweisung und Healthcheck.
- Optionales `EXTENSION_IDS`, sichere `tHtml()`-Parameter und aktuelle Nominatim-Version.
- Scrollbar-Browsertest um echten Negativfall ergaenzt; ungetestete visuelle Nebenwirkungen und Legacy-AES-Archive dokumentiert.

## 0.15.9 - 2026-11-12

- Globale Scrollbar-Breite stabilisiert, damit zentrierte Seiten beim Wechsel zwischen kurzen und langen Inhalten nicht horizontal springen; Browser-Regressionstest ergaenzt.

## 0.15.8 - 2026-11-12

- Einstellungsseite: Header an die uebrigen Hauptseiten mit Eyebrow, einheitlicher Typografie und Akzentpunkt angeglichen.

## 0.15.7 - 2026-11-12

- Interne Modulgrenzen, Dokumentation und Markdown-Linkpruefung ohne Funktionsaenderung bereinigt

## 0.15.6 - 2026-11-12

- Kartenlegende und zugehoerige Standorttexte vollstaendig ueber Sprachschluessel lokalisieren; englischen Regressionstest ergaenzen

## 0.15.5 - 2026-11-11

- Asynchronen Browser-Sprachtest synchronisieren und echten englischen Sprachkatalog pruefen

## 0.15.4 - 2026-11-11

- Untranslated English UI labels corrected across collection, analytics, warehouse, forms and dialogs; rendering regression tests added

## 0.15.3 - 2026-11-11

- Vollstaendigen englischen GUI-Sprachkatalog mit 790 Schluesseln ergaenzt und Englisch in der Sprachauswahl aktiviert.

## 0.15.2 - 2026-11-11

- Erzeugte, fehlerhafte i18n-Schlüssel durch sprechende fachliche englische Schlüssel ersetzt und alle Referenzen umgestellt.
- Dynamische Möbeltypen, Fachfronten, Blickachsen und Raum-Tabs auf explizite Schlüsselzuordnungen umgestellt; technische Konstanten aus den Übersetzungen entfernt.
- Browser-Sprachtest korrigiert: englische Testkataloge werden sowohl im normalen Chromium-Modus als auch im DOM-Modus geladen. Zusätzliche Schlüssel- und Regressionstests ergänzt.

## 0.15.1 - 2026-11-11

- GUI-Lokalisierung auf benannte Schluessel und Platzhalter umgestellt, dynamische Texte migriert und automatische Schluesselpruefung ergaenzt

## 0.15.0 - 2026-11-11

- Lokalisierung über de.json und Sprachwahl vorbereitet; Analyse und Lager nutzen dieselbe Seitenbreite wie die übrigen Hauptseiten.

## 0.14.7 - 2026-11-11

- Lager: freie Inventarnummern erneut vergeben; Raumplan-Kopfzeile und kompakte Werkzeuge; einheitliche Mehrfachbuttons und Wand-Toggles

## 0.14.6 - 2026-11-11

- Lager: kompakte 3D-Raumansicht mit daneben angeordneter scrollbarer Moebelliste, mobiler Leiste und Alle-einblenden-Aktion

## 0.14.5 - 2026-11-11

- Lager: grosses Augen-Icon schaltet jedes Moebel in 3D unabhaengig ein und aus, ohne Kamera-Reset

## 0.14.4 - 2026-11-11

- Raumplaene 3D als Standard, Freistellen per Augen-Icon, Moebel-Hover, korrekte Checkbox-Markierung, kleinere Raumvorschauen neben Text und Raumaktionen nur unter Raumplaene

## 0.14.3 - 2026-11-11

- Lager: gemeinsame Moebelliste, Doppelklick/Scrollziel und statische 3D-Raumvorschau in der Uebersicht

## 0.14.2 - 2026-11-11

- Lager: 3D-Kollisionspruefung bei Platzierung, Verschieben und Mehrfachbearbeitung; 10-cm-Raster im 2D-Raumplan

## 0.14.1 - 2026-11-11

- 2D-Raumplan mit massstabsgetreuem Raster (0,5 m und 1 m) unter den Moebeln

## 0.14.0 - 2026-11-11

- Durchgehende Holz- und Glastueren ueber frei definierbare Fachbereiche mit Moebelstandards und 3D-Darstellung; Null-Kapazitaet ohne Leerstandshinweis

## 0.13.4 - 2026-11-11

- Tuerfluegel und Glasrahmen auch auf Moebelstueck-Ebene und in der Mehrfachbearbeitung konfigurierbar; Fach-Overrides bleiben erhalten

## 0.13.3 - 2026-11-11

- Fachtueren ein- oder zweifluegelig konfigurieren; Glastueren mit optionalem Rahmen in der 3D-Ansicht

## 0.13.2 - 2026-11-11

- Lager: Einzelnes Löschen direkt am Möbel und Mehrfachlöschung über die Auswahl mit atomarer Prüfung belegter Fächer.
- Linke und rechte Seitenwand sowie Rückwand unabhängig in Einzel- und Mehrfachbearbeitung konfigurierbar, rotieren in der 3D-Darstellung mit; bestehende Lagerdateien bleiben kompatibel.

## 0.13.1 - 2026-11-11

- Mehrfachbearbeitung ohne Eigenschafts-Checkboxen; Fachkapazität 0 zulassen

## 0.13.0 - 2026-11-11

- Lager: Gemischte Möbel mit je Fach wählbarer offener Front, Holztür, Glastür oder Schublade; individuelle Fachhöhen in Zentimetern mit automatischer Resthöhenverteilung.
- Fachreihenfolge mit Hoch-/Runter-Aktionen verändern; vollständige Übernahme von Front und Höhe bei Fach- und Möbelkopien ohne Flaschenzuordnungen.
- Mehrfachbearbeitung der Möbelparameter (Drehung, Unterkante, Höhe, Breite, Tiefe) mit atomarer API-Validierung; Schrank-, Vitrinen- und Schubladenfronten drehen sich in allen vier Ausrichtungen korrekt mit.
- Alte `warehouse.json`-Dateien ohne neue Fachattribute bleiben lesbar, `collection.json` bleibt unverändert; neue API-/Geometrietests hinzugefügt.

## 0.12.0 - 2026-11-11

- 3D-Lageransicht vollständig mit Three.js/WebGL2 neu aufgebaut: echte Regalgeometrie, hardwaregestützte Tiefenverdeckung, Orbit-Kamera und lokaler Lazy-Load statt SVG-Projektion und Masken.

## 0.11.6 - 2026-11-11

- 3D-Regale: echte SVG-Verdeckungsmasken fuer hoeher montierte Moebel bei ueberlappender Grundflaeche; darunterliegende Linien werden in den betroffenen Bildbereichen ausgeblendet.
- Regressionstests für alle vier 3D-Blickrichtungen, übereinanderliegende und gedrehte Möbel, exklusive Berührung der Grundflächen sowie drei Höhenstufen. Die 2D-Ansicht und beide JSON-Datenmodelle bleiben unverändert.

## 0.11.5 - 2026-11-11

- 3D-Raumplan: höher montierte Möbel verdecken bei überlappender Grundfläche darunterliegende Möbel unabhängig vom Kamerabstand; Tiefensortierung für getrennte Möbel erhalten.

## 0.11.4 - 2026-11-11

- Lager-3D als minimalistische offene Regalstruktur mit duennen Fachboeden und Wandkonsolen neu zeichnen, ueberdeckende Dachmarker entfernen und Perspektivtests erweitern

## 0.11.3 - 2026-11-11

- Lager-3D: gesamten Raum bei 100 Prozent einpassen, proportionalen Zoom beider Achsen korrigieren und integrierte Browser-Regressionspruefung ergaenzen

## 0.11.2 - 2026-11-11

- Lager-3D: offene Regalfronten mit Fachboeden, Seitenstuetzen und Tiefe darstellen; Schrank, Vitrine und Kommode unterscheiden

## 0.11.1 - 2026-11-11

- Lager-3D: echten SVG-Zoom mit zentriertem Scrollen, nummerierte Regale und Freistellung verdeckter Moebel ergaenzen

## 0.11.0 - 2026-11-11

- Lager: schematische 3D-Raumansicht mit vier Kamerablickwinkeln und Fachbelegung

## 0.10.3 - 2026-11-11

- Raumkapazitaeten anzeigen und Haengeregale ueber Schrankmoebeln per Hoehenlage unterstuetzen

## 0.10.2 - 2026-11-11

- Lagerregale mit oder ohne Faecher sowie einzelne Faecher ohne Flaschenzuordnungen kopieren; vorhandene Flaschenfotos in der Regalansicht anzeigen

## 0.10.1 - 2026-11-11

- Lagerverwaltung: Kopfbereich und Tab-Navigation an die Analyse angeglichen

## 0.10.0 - 2026-11-10

- Lagerverwaltung mit Raumplan, Regalen, Faechern und separater Lagerdatei

## 0.9.11 - 2026-11-09

- iOS-Datumsfelder in Abfüllungseditor und Analyse einheitlich, bündig und ohne Breitenüberlauf darstellen

## 0.9.10 - 2026-11-09

- Sämtliche 14 Markdown-Dateien mit Quellcode, Datenmodell, Deployment und den aktuellen Funktionen abgeglichen; die ursprüngliche Anforderungsspezifikation durch den tatsächlich implementierten Stand ersetzt. Historische Versions- und Testberichte bleiben im Archiv erhalten.
- Analyse: „Von“ und „Bis“ wieder als einzelne, responsive Datumsfelder (`input[type="date"]`) statt getrennten Monats-/Jahres-Selects; auch bei WebKit-Mindestbreiten werden die Felder in ihrem Container begrenzt.
- Zeitreihen nach tatsächlichem Kalendertag filtern, erst anschließend nach Monat/Jahr aggregieren; ungültige Daten und Schaltjahre werden validiert.
- Regressionstests für Datumsfilter und mobile Formularbreiten ergänzt; Teststatus unterscheidet automatische Prüfungen, isoliertes Chromium und ausstehende iOS-/Android-Abnahmen.

## 0.9.9 - 2026-11-09

- Analyse: iOS-ueberbreite Monatsfelder durch kompakte Monats- und Jahresauswahl ersetzen

## 0.9.8 - 2026-11-09

- iOS Safari: Monatsfelder in der Analyse vertikal zentrieren und ihre native Monatsauswahl beibehalten.
- Mobil plattformübergreifend: Eingabefelder, Auswahlfelder und Formularkontainer gegen horizontales Überlaufen absichern (Analyse, Sammlung, Destilleriedialog, Backups).
- Responsive Zeitfilter als breitenbegrenztes Grid, kompakte und weiterhin gut lesbare Filter der Sammlungsübersicht.
- Zusätzliche Unit- und Browser-Regressionen für mehrere kleine Viewport-Breiten.

## 0.9.7 - 2026-11-09

- Mobil: Abfüllungsname auf voller Breite; Kartenbutton und Bearbeiten/Löschen werden unter dem Titel ohne horizontalen Überlauf angeordnet.
- Analyse: Horizontale Unterseiten-Navigation hält den aktiven Tab nach Seitenwechsel und Neuladen sichtbar.
- Mobil: Einheitliche 44-px-Höhe für Zeitraumfelder sowie Suchfeld, Dropdowns und Kachel-/Listenumschalter der Sammlungsübersicht.
- Regressionstests für die mobilen Layouts ergänzt.

## 0.9.6 - 2026-11-09

- Analyse-Seiten: überflüssigen Abstand zwischen Hinweistext und Footer reduziert

## 0.9.5 - 2026-11-09

- Abstaende zwischen Eingabefeldern im Destillerie-Dialog korrigiert.

## 0.9.4 - 2026-11-09

- Bottling detail actions right-aligned and map button gets a location icon

## 0.9.3 - 2026-11-09

- Analyse: In den Top-Destillerien sind alle verlinkten Zeilen durchgehend inklusive der letzten per Hover und Tastatur bedienbar.

## 0.9.2 - 2026-11-09

- Analyse: Links einheitlich ohne Unterstreichung; Abfuellungsdetails verlinken auf zugehoerige Landkartenstandorte einschliesslich mehrerer Destillerien.

## 0.9.1 - 2026-11-09

- Analyse: Nummern aus den Statistiküberschriften entfernt und Herkunft aus den Destilleriestandorten statt den Abfüllungsfeldern abgeleitet.
- Destillerienkatalog: 450 Länderangaben (Schottland statt UK/GB) und 287 schottische Whiskyregionen; bestehende Datensätze werden schonend ergänzt.
- „Distillery Bottling“ und übereinstimmende Destillerienamen werden als Originalabfüllung gezählt; Regressionstests ergänzt.

## 0.9.0 - 2026-11-09

- Neuer Analysebereich mit Dashboard, sechs Unterseiten, 38 Statistiken und gemeinsamen Filtern

## 0.8.20 - 2026-11-09

- Uebersicht: Destillerie- und Flaschentypfilter ohne Zusatzlabels in die bestehende Filterzeile integrieren und Kachel-/Tabellenumschalter auf Feldhoehe angleichen.

## 0.8.19 - 2026-11-09

- Sammlungsuebersicht: kombinierbare Schnellfilter fuer genutzte Destillerien und Flaschentypen Standard/Sample ergaenzt.

## 0.8.18 - 2026-11-08

- Browser-Test fuer geclusterte Bestandsmarker korrigiert und Teststatus nach aktuellem Stand neu strukturiert

## 0.8.17 - 2026-11-08

- Landkarte: kompakte responsive Legende und runde Gruppenmarker statt Hexagon; Status und Flaschen-Skalierung bleiben erhalten.

## 0.8.16 - 2026-11-08

- Landkarte: Legendenbeschriftungen mit und ohne Flaschen vereinheitlicht, Gruppierungen als Hexagone und Umbruch stabilisiert.

## 0.8.15 - 2026-11-08

- Landkarte: Legende fuer aktive und geschlossene Destillerien mit Flaschen ergaenzen; Beispielgroessen und Cluster exakt an echte Marker anpassen.

## 0.8.14 - 2026-11-08

- Landkarte: Legende logisch nach Einzelstandorten, Gruppen und optionalen unbestueckten Destillerien ordnen; Marker im Hell-/Dunkelmodus ohne Schatten oder Glow darstellen.

## 0.8.13 - 2026-11-08

- Landkarte: Alter, Alkoholgehalt und beschriftete Jahresangaben pro Abfuellung in der Standortliste anzeigen.

## 0.8.12 - 2026-11-08

- Sammlung: Abfuellungen bzw. Flaschen pro Seite werden im Browser gespeichert und nach F5 wiederhergestellt.
- Landkarte: Legendenicon „Gruppiert“ nutzt in Light- und Dark-Mode den echten Clusterstil; kein zusätzliches Legendenicon für aktive Einzelmarker.

## 0.8.11 - 2026-11-08

- Landkarte: Cluster bei maximalem Zoom aufloesen, ueberlappende Einzelmarker trennen und Legende auf 'Gruppiert' kuerzen.

## 0.8.10 - 2026-11-08

- Landkarte: Zoom-abhaengiges Marker-Clustering. Gruppen zeigen die Summe der physischen Flaschen; ein Klick zoomt hinein. Einzelmarker und Filter bleiben erhalten.
- Versionsrichtlinie im Repository dokumentiert: kleine Aenderungen als Patch, groessere Funktionen (beispielsweise neue Seiten) als Minor.

## 0.8.9 - 2026-11-08

- Release-Metadaten und README-Titel auf v0.8.9 synchronisiert; Release-Skript repariert abweichende README-Titel mit `release:sync` und beim Bump.
- Persistente Docker-Daten und Zertifikate aus dem Git-Checkout in ein externes Datenverzeichnis verlagert; keine automatische Datenmigration.


## 0.8.7 - 2026-11-08

- Browser-Testfix: Marker behalten das kompatible `Destilleriename:`-Praefix in `aria-label` und Tooltip; Status folgt nach den Flaschenangaben. Legendentest erwartet zwei getrennte Pagodenicons.

- Unterschiedliche Kartenmarker fuer aktive, geschlossene und wiedereroeffnete Destillerien. 158 internationale Destillerien aus mehr als 26 Laendern und Regionen ergaenzt; bestehende Sammlungen werden additiv aktualisiert, Status im Editor bearbeitbar.

## 0.8.6 - 2026-11-08

- externer Katalog: mehrere Destillerien einzeln zuordnen; Landkarte: alle Destillerien per Schalter anzeigen, ohne Flaschen mit Pagodendach-Marker.

## 0.8.5 - 2026-11-08

- Einheitliche SVG-Symbole fuer den Theme-Schalter auf Mobilgeraeten und Desktop; mehr Abstand zwischen Logo und Wortmarke im mobilen Header.

## 0.8.4 - 2026-11-08

- Dunkles OpenStreetMap-Kartenbild aufgehellt: Geländeflächen, Straßen und Ortsnamen besser lesbar; Marker und Kartenfunktionen unverändert.

## 0.8.3 - 2026-11-08

- OpenStreetMap-Karte folgt dem Hell/Dunkel-Theme; Mausradzoom haelt den Standort unter dem Mauszeiger fest.

## 0.8.2 - 2026-11-08

- Landkarte und Sammlung nutzen dieselbe Inhaltsbreite bei unveraendertem zweispaltigem Kartenlayout. Seitenmenue oeffnet rechts; Karten- und Einstellungsseite verwenden denselben Zur-Sammlung-Button.

## 0.8.1 - 2026-11-08

- Historische Ortsreferenzen ergaenzt: alle 292 Katalog-Destillerien in der Karte verortbar, ungenaue historische Positionen gekennzeichnet und manuelle Korrekturen priorisiert.
- Einstellungen ausschliesslich im Seitenmenue; Menuebutton ganz rechts. Standort-Korrektur als kleines Stift-SVG neben dem Destillerienamen, Rubrik fuer fehlende Standorte nur bei Anzahl > 0, ueberfluessige Karten-Erklaertexte entfernt.

## 0.8.0 - 2026-11-08

- OpenStreetMap-Landkarte mit automatisch an den Destilleriestandorten ausgerichtetem Zoom, markergrößen nach physischem Flaschenbestand, paginierter Standortliste, Standortsuche und erweiterbarem Seitenmenü.

## 0.7.1 - 2026-11-08

- Neue Flasche kann einer vorhandenen Abfüllung zugeordnet oder mit einer neuen Abfüllung angelegt werden; Suche und getrennte Flaschendaten.

## 0.7.0 - 2026-11-08

- Umschalter in die Sammlungsüberschrift verschoben; Flaschen ohne eigenes Foto zeigen das Titelbild der Abfüllung.

## 0.6.51 - 2026-11-08

- Sammlungsübersicht zwischen Abfüllungen und einzelnen Flaschen umschaltbar: eigene Metadaten, Filter, Tabelle, Paging und direkte Detailnavigation.

## 0.6.50 - 2026-11-08

- Der Etikett-Scanner im Bearbeiten-Dialog einer physischen Flasche verwendet jetzt dasselbe Scanner-SVG wie die Aktionen im Header und auf der Startseite, statt des alten Zeichens.
- Auf der Abfüllungsdetailseite zeigen Bearbeiten- und Löschen-Schaltflächen für Abfüllungen, einzelne Flaschen und Dateianhänge einheitliche Stift-/Papierkorb-SVGs vor den Texten.
- Der überflüssige Hinweistext zur Zuordnung der Fotos zu physischen Flaschen unter dem Titelbild wurde entfernt.


## 0.6.49 - 2026-11-08

- Beschädigtes Einstellungs-Zahnrad durch ein korrekt gezeichnetes, symmetrisches SVG ersetzt; mobil und am Desktop identisch.
- Die Erfassungsaktion heißt einheitlich „Neue Flasche“ in Header und Startseite sowie „Neue Flasche erfassen“ im Dialog. Scanner, Backup und übrige Bereiche bleiben unverändert.

## 0.6.48 - 2026-11-08

- Einheitliche Aktionen in Header und Startseite: „Neue Abfüllung“ und „Inventar scannen“ nutzen jeweils dasselbe SVG-Icon und dieselbe Beschriftung; kein Plus- oder Scanner-Textzeichen mehr.
- „Verwaltung“ heißt jetzt „Einstellungen“; Zahnrad-Icon im Desktop- und Mobile-Header sichtbar, mobil als Icon-Button.

## 0.6.47 - 2026-11-08

- Mobiler Header in einer kompakten Zeile: responsive Wortmarke, vier gut erreichbare Icon-Aktionen und eindeutiges Scanner-Symbol ohne Umbruch.

## 0.6.46 - 2026-11-08

- Hero-Bild auf der Startseite wieder dauerhaft dunkel dargestellt, unabhängig vom Theme; Photo-Viewer und responsives Grid unverändert.

## 0.6.45 - 2026-11-08

- Responsive Kachelhoehen korrigiert: Alle Karten innerhalb derselben sichtbaren CSS-Grid-Zeile werden auf die Hoehe der groessten Karte dieser Zeile gestreckt; andere Zeilen behalten unabhaengige Hoehen. Beim Umbruch von vier auf drei, zwei oder eine Spalte werden die Zeilen ohne JavaScript neu gebildet. Der Titel steht weiterhin unmittelbar vor seinen Fakten, ohne reservierte feste Titelhoehe.

## 0.6.44 - 2026-11-08

- Die Statistik zeigt **Geschlossen** vor **Geöffnet**; ohne Destillerie erscheint nur der Abfüllername (ohne Präfix) in Übersicht und Detailseite.
- Auf Mobilgeräten öffnet ein beschriftetes Einstellungs-Icon die Verwaltung; die Schaltfläche bleibt barrierefrei bedienbar.
- Das Startseitenbild und der Foto-Viewer verwenden im hellen Theme helle Hintergründe, im dunklen Theme weiterhin dunkle Overlays.
- Fehlende Alters-, Alkohol- und Jahresangaben erscheinen in der Übersicht nicht mehr als Platzhalter. Namen reservieren keine feste Höhe mehr; darunterliegende Daten folgen direkt, und die Kachelhöhen passen sich der jeweiligen responsiven Zeile an.

## 0.6.43 - 2026-11-08

- Mobile Theme-Umschaltung sichtbar, Gründungsjahr in Verwaltung speicherbar, Layout-Abstände optimiert, Statuskacheln getrennt und Abfüller-Fallback in Übersicht und Details ergänzt.

## 0.6.42 - 2026-11-07

- Docker-Build und GHCR-Release pruefen die Paketkonfiguration im echten Container auf ARM64 und AMD64 vor Freigabe von latest.

## 0.6.41 - 2026-11-07

- Versionsanzeige im Footer und einheitliche AES-256-verschluesselte ZIP-Backups fuer Download, Zeitplaene, Altbestand-Konvertierung und Wiederherstellung

## 0.6.40 - 2026-11-07

- Browser-Navigationstest fuer standardmaessig eingeklappten JSON-Import korrigiert; Einstellungen nach Vorwaerts-Navigation sichtbar pruefen und Importbereich explizit oeffnen.

## 0.6.39 - 2026-11-07

- **Eine Datensicherung für alle drei Wege:** vollständiges lesbares ZIP direkt herunterladen, automatische USB-/NAS-/Cloud-Sicherungen per Zeitplan und komplette Wiederherstellung in der App.
- ZIP-Generator zentralisiert; manueller Download und Backup-Worker verwenden denselben Archivcode inklusive CRC-Prüfung. Vor dem Einspielen erfolgt eine Vorschau mit gesonderter Bestätigung und Sicherheitskopie.
- Alte verschlüsselte Restic-Profile und Bestände bleiben für Prüfung und Wiederherstellung erhalten; vorhandene Stände lassen sich in lesbares ZIP umwandeln. Keine neuen Restic-Backups und keine zweite tägliche JSON-Sicherung beim Serverstart.
- USB-Setup für temporäres Einbinden ohne `/etc/fstab`; Backup-Oberfläche und Docker-Betriebsanleitung vereinfacht.

## 0.6.38 - 2026-11-07

- GitHub-Actions-Zertifikatstest OpenSSL-unabhaengig gemacht: SAN-Hostname/IP-Pruefung per Node X509Certificate statt Exit-Code

## 0.6.37 - 2026-11-07

- README aufgeräumt: Docker-Schnellstart, Konfiguration, Backups und Entwicklung klar strukturiert

## 0.6.36 - 2026-11-07

- Zertifikatsnamen und IPv4-Adressen in zentraler .env konfigurierbar; sichere Erneuerung und Tests

## 0.6.35 - 2026-11-07

- HTTPS-Zertifikat um home-pi und home-pi.local erweitert und sichere Zertifikatserneuerung ergänzt

## 0.6.34 - 2026-11-07

- Docker-Deployment auf einen einzigen GHCR-Container mit HTTPS 3543 umgestellt. Der integrierte Backup-Hintergrundprozess nutzt Restic und Rclone, verifiziert TLS auf der Loopback-Verbindung und benoetigt weder SSH-Tunnel noch einen HTTP-Port 3100. Vollstaendige docker-compose.yml im Repository-Stamm; Release-Workflow veroeffentlicht nur noch das App-Image.


## 0.6.33 - 2026-11-07

- GitHub-Ruleset fuer `main` als importierbares JSON: PR-Pflicht, Pflichtcheck `test`, aktuelle Branchbasis, Loesch- und Force-Push-Schutz ohne Bypass. Die CI erfordert `develop` aus demselben Repository als PR-Quelle; dokumentierte GitHub-Importanleitung.

## 0.6.32 - 2026-11-07

- **Release-Workflow:** `develop` als Entwicklungsbranch; `develop -> main` wird nach erfolgreicher CI zu einem versionierten GitHub Release. Tags und Draft-Releases werden idempotent behandelt; Freigabe erst nach erfolgreich gebautem ZIP und beiden Container-Images. Manuell veroeffentlichte Releases koennen dieselbe Pipeline ausloesen.
- **GitHub Actions/Container:** GHCR-Multiarchitektur-Builds fuer App und Backup-Worker laufen nur noch als Release, statt bei jedem Push auf `main`/`master`; Docker Compose kann `latest` oder einen festen Release-Tag ueber `IMAGE_TAG` ziehen. `docker-publish.yml` durch `release.yml` ersetzt.
- **Release-Dateien:** ZIP und SHA256 als GitHub-Release-Assets, Versionskonsistenz von App/Lockfile/Erweiterungsmanifest, `npm run release:bump` und `npm run release:check`, zusaetzliche Schutzpruefungen gegen versehentlich gepackte Sammlungsdaten/Secrets und Dokumentation fuer Branchschutz und GHCR.
- `.gitignore`/`.dockerignore` korrigiert, damit `public/js/features/backups/` beim Git-Archivieren und Docker-Build erhalten bleibt, waehrend private Sicherungen weiterhin ausgeschlossen sind.
- Keine Aenderung an `collection.json`, Backups, HTTPS-Port, externer Katalog-Freistellung oder Anwendungsoberflaeche. Dependabot-Merges bleiben erhalten.


## 0.6.31 - 2026-11-07

- **Neue Backup-Verwaltung in der App** unter Verwaltung & Datensicherung: getrennt entsperrte Backup-Administration, 1–n Profile für lokale/USB/NAS- und Rclone-Ziele (Dropbox, Google Drive, OneDrive, SFTP/VPS, S3 und WebDAV), unabhängige stündliche/tägliche/wöchentliche Zeitpläne, Aufbewahrungsregeln, manuelle Aufträge, Zieltest, Snapshotliste, Integritätsprüfung und nicht-destruktive Wiederherstellung in einen Prüf-Ordner.
- **Separater Backup-Worker** mit Restic-Verschlüsselung, Rclone-Cloud-Unterstützung und Jobwarteschlange. Er hat keine Zugangsdaten in der Sammlungsdatei, kein Direkt-Mount der laufenden Sammlung und fordert über ein separat authentifiziertes internes API einen konsistenten, temporären Quellstand (`collection.json`, Fotos und Dokumente) an. Keine ungefragte Überschreibung bei Restore.
- **Raspberry-Pi-4-Deployment mit Docker Compose**: zwei Container, persistente Host-Volumes, getrennte Schlüssel/Zertifikate, keine öffentlichen internen Worker-Ports, lokales HTTPS weiterhin 3543. `deploy/setup-pi.sh`, Dockerfiles und Schritt-für-Schritt-Anleitung in `docs/DOCKER_BACKUP.md`.
- **GitHub Actions → GHCR**: Multiarchitektur-Images (ARM64/AMD64) für App und Backup-Worker auf `main`/`master` und Versionstags; anschließend `docker compose pull && docker compose up -d` auf dem Pi. Die zuvor gemergten Dependabot-Updates `actions/checkout@v7`, `actions/setup-node@v7` und `playwright-core@1.64.1` bleiben erhalten.
- Tests für Backup-Validierung/Traversal-Schutz, Admin-/Worker-Authentifizierung, CRUD und Aufträge, Snapshot-Konsistenz, Worker-Jobpipeline mit simulierten Restic-/Rclone-Binaries, Restore-Ziel, Zeitplanung und Secrets-Isolation. JSON-Schema weiterhin 4, Flaschenbild-Freistellung bleibt bei v0.6.27 (v0.6.28 wird nicht übernommen).
- **Prüfgrenze:** Die tatsächlichen GitHub-GHCR-Pushes, der Docker-Build sowie ein Dropbox-OAuth-/Restic-Livelauf erfordern GitHub, Docker und echte Credentials; hier wurden sie nicht live ausgeführt.


## 0.6.30 - 2026-11-06

- GitHub-Actions-Browsertest `browser: 450 bottlings keep a fixed page size with only divisor-friendly grid widths` repariert: Die Seite-19-Schaltflaeche wird nun eindeutig ueber `aria-label="Seite 19"` ausgewaehlt, da sowohl die nummerierte Seite als auch die Schaltflaeche "Letzte Seite" den gleichen `data-page-to="19"`-Wert besitzen.
- Zweiten, im selben Test verdeckten Fehler behoben: Nach dem Wechsel auf 360 px Fensterbreite erwartet der Test beim Seitenwechsel korrekt **eine** Grid-Spalte; nach dem Zurueckwechsel auf 1660 px werden wieder **vier** Spalten geprueft.
- Nur Browsertests und Versions-/Release-Dokumentation geaendert. UI, Pagination, Bildfreistellung (wie v0.6.27) und JSON-Schema bleiben unveraendert.

## 0.6.29 - 2026-11-06

- Flaschenfotos werden in einem **Overlay innerhalb der App** statt mit `target="_blank"` in einem neuen Tab angezeigt. Das betrifft die Fotokacheln jeder physischen Flasche sowie das grosse Flaschenfoto auf der Abfuellungsdetailseite.
- Die Bildvorschau beim externer Katalog-Import kann ebenfalls im Overlay vergroessert werden. Der vorhandene App-Modalmechanismus sichert dabei Eingaben und bereits ausgewaehlte Dateien in darunterliegenden Formularen.
- Im Fotodialog innerhalb einer Flasche per Pfeiltasten oder Vor-/Zurueck-Schaltflaechen blaettern; Schliessen durch Kreuz, Escape oder Klick auf den abgedunkelten Hintergrund. Bildinhalte, JSON-Daten und die Bildfreistellung sind unveraendert (Basis v0.6.27; v0.6.28 verworfen).

## 0.6.27 - 2026-11-06

- externer Katalog-Erweiterung verwendet einen **bereits geöffneten Collection-Manager-Tab** anstatt für jede Übernahme einen weiteren Tab anzulegen. Falls kein Tab für die exakt konfigurierte App-Adresse (einschließlich HTTPS/HTTP und Port) vorhanden ist, wird wie bisher einmalig ein neuer geöffnet. Der Manager-Tab wird bevorzugt im aktuellen Browserfenster gesucht, andernfalls wird das andere Fenster fokussiert.
- Die Importdaten werden im vorhandenen Tab durch **Änderung des URL-Fragments** übergeben; der Manager verarbeitet diese jetzt zusätzlich bei `hashchange`, ohne die komplette App neu laden zu müssen. Die bisherige Bildkopie auf den lokalen Server und die Importvorschau bleiben erhalten.
- **Ungespeicherte Formulare werden geschützt:** Wenn beim Import bereits ein App-Dialog offen ist, fragt ein verschachteltes App-Modal nach, ob der alte Dialog verworfen werden darf. Ablehnen stellt ihn samt Eingaben wieder her; native Browser-`confirm`/`prompt` werden nicht verwendet.
- Zusätzlich ist ein Validierungsfehler behoben: Beim Import ohne Bild darf der interne `imageToken: null` in der Übernahmevorschau nicht als ungültig behandelt werden. Neue Unit-Tests prüfen Tab-Wiederverwendung, exakte Origin-Prüfung, Fensterfokus, Bildimport, URL-Payload und offene Formulare. Keine Änderung am Datenmodell, Scanner oder HTTPS.

## 0.6.26 - 2026-11-06

- externer Katalog-Bildfreistellung **neu implementiert**: Ausgangspunkt ist wieder die in den meisten Fällen bessere Hintergrundentfernung durch Flood Fill vom äußeren Bildrand. Ein global über sämtliche Bildzeilen verbreiterter oder morphologisch geschlossener Flaschenumriss entfällt vollständig. Natürliche Kanten, Schultern sowie die Rundungen an Kapsel und Boden werden damit nicht mehr pauschal verändert.
- **Nur wirkliche Ausnahmen reparieren:** Wenn eine weiße Etikettenfläche oder ein heller Flaschenhals mit dem weißen Hintergrund verbunden ist, werden ausschließlich nach oben und unten begrenzte Einschnitte zwischen erkennbaren Randankern geschlossen. Das funktioniert sowohl für kurze helle Stellen am Verschluss als auch für längere, unregelmäßig ausgeschnittene Etikettbereiche. Die originalen RGB-Farbwerte bleiben erhalten.
- Kleine, abgesetzte Randartefakte werden bei der Bestimmung der Flaschenform ignoriert. Die sichtbare Außenkante wird nur um höchstens etwa einen Pixel geglättet und über zwei schmale Alphastufen weich ausgeblendet. **Keine extrapolierten Endkappen, keine künstlichen Farben, keine globale Konturverbreiterung.**
- Bildprüfung mit dem tatsächlich hochgeladenen weißen **Lochindaal-Futures-Ausgangsbild** sowie einem aus dem bereits beschädigten Screenshot rekonstruierten Hepburn-Bild; beide nach Verarbeitung auf dunklem Hintergrund kontrolliert. Neuer Regressionstest für einen komplett weißen Halsabschnitt und längere, unregelmäßige Etiketteinschnitte mit glatter wiederhergestellter Kante. **112 Unit-/Integrationstests bestanden.** Ein Live-Test in einer angemeldeten externer Katalog-Sitzung steht noch aus.
- Die Browser-Erweiterung übernimmt weiterhin lokal kopierte Bildbytes (oder die sichtbare Screenshot-Kopie), nicht bloß Bild-URLs; nur der Bildtransparenzalgorithmus wurde geändert. Datenstruktur, HTTPS 3543, Scanner und Dependabot unverändert. Bereits beschädigte PNG-Dateien müssen aus der ursprünglichen Bildquelle erneut importiert werden.

## 0.6.25 - 2026-11-06

- externer Katalog-Bildimport: Fehler bei hellen Flaschenverschlüssen korrigiert. Ein kurzer, von intakten Konturabschnitten eingerahmter weißer Bereich wurde bisher als Flaschenhintergrund ausgeschnitten und erschien als seitliche Kerbe. Zusätzlich zur bisherigen breiten Etikett-Korrektur werden jetzt **kurze lokale Konturaussetzer** separat erkannt und zwischen ihren beiden Randankern interpoliert.
- Die Reparatur greift **nicht** bei realen, zum oberen oder unteren Flaschenende offenen Verjüngungen; die Flaschenform bleibt schmal und der Boden abgerundet. RGB-Pixel innerhalb der rekonstruierbaren Außenkontur werden weiterhin nicht künstlich ersetzt.
- Neuer Regressionstest mit einer 14-Pixel-Einkerbung an einem hellen Flaschenhals auf weißem Hintergrund; die bisherigen Tests für breite weiße Etiketten, Kapseln, Rundungen und Artefakte bleiben bestehen. **111 Unit-/Integrationstests bestanden.**
- Die neue Freistellung wird für direkt kopierte Bilder und für den Screenshot-Fallback verwendet. JSON-Datenschema, Fotoablage, Dependabot und HTTPS 3543 unverändert. Bereits beschädigte Fotos müssen aus dem ursprünglichen externer Katalog-Bild erneut importiert werden.

## 0.6.24 - 2026-11-06

- externer Katalog-Bildfreistellung am Beispiel des hochgeladenen Lochindaal-Futures-Screenshots ueberarbeitet und visuell gegen die bisherige Version geprueft: Die weissen rechteckigen Ecken oben und unten wurden durch einen Fehler in der **globalen Konturverbreiterung** verursacht. Die Silhouette blieb am Flaschenboden auf nahezu voller Koerperbreite, obwohl der echte Boden abgerundet ist.
- Die Konturreparatur greift jetzt **nur noch bei beidseitig vertikal begrenzten Einbuchtungen** (beispielsweise bei einem weissen, mit dem Hintergrund verbundenen Etikett). Die natuerliche Verjuengung von Kapsel, Flaschenhals und Flaschenboden wird nicht mehr uebersteuert; kuenstlich verlaengerte Endkappen wurden entfernt.
- Schmale getrennte vertikale Randartefakte aus Bild- und Screenshot-Kopien werden nicht mehr als durchgehende Flaschenaussenkante gewertet, wenn eine klar groessere zusammenhaengende Motivflaeche sichtbar ist. Die weiche Alphakante sowie die unveraenderten Pixel innerhalb der Silhouette bleiben erhalten.
- Zwei gezielte Regressionstests decken nun **abgerundete Kopf-/Bodenbereiche** und **duenne, abgesetzte vertikale Randreste** ab. 110 Unit-/Integrationstests bestanden; Vergleichsbilder wurden ausschliesslich fuer den Test erstellt und nicht in das Anwendungspaket aufgenommen. Der Test verwendet ein aus dem Benutzerscreenshot rekonstruiertes weisses Bild, nicht das unbearbeitete externer Katalog-Original. Ein echter externer Katalog-Live-Test steht weiterhin aus.
- Das Datenformat (Schema 4), die Dateiablage, die Scanner- und Bestandsfunktionen sowie HTTPS auf Port 3543 bleiben unveraendert.

## 0.6.23 - 2026-11-06

- externer Katalog-Flaschenbildimport: Die Freistellung nutzt jetzt zusaetzlich eine **hintergrundbezogene Kantenabtastung**. Der tatsaechliche Foto-Hintergrund wird aus dem Bildrand geschaetzt; pro Zeile wird dann die erste sichtbare Abweichung von diesem Hintergrund als zusaetzlicher Hinweis fuer die aeussere Flaschenkontur verwendet.
- Dadurch werden **weisse Ecken an oberen und unteren Rundungen** besser entfernt, wenn die eigentliche Flaschenkante nur aus sehr hellen oder anti-aliasten Pixeln besteht. Die Kontur bleibt weiterhin weich ausgeblendet, helle Etiketten innerhalb der Flasche bleiben erhalten.
- Die zusaetzliche Kantenabtastung wird nur bei echten Flaschenbildern mit sinnvoller Groesse aktiviert, damit der vorhandene 2x2-Regressionstest fuer den generischen Alpha-Pfad unveraendert stabil bleibt. Die Gesamtsuite bleibt bei **109/109 bestandenen Tests**. Bereits fehlerhaft freigestellte PNGs muessen erneut aus dem externer Katalog-Originalbild importiert werden.

## 0.6.22 - 2026-11-06

- externer Katalog-Flaschenbildimport: Die Konturmaske wurde an den **oberen und unteren Rundungen** verbessert. Fehlende helle Kopf- oder Bodenbereiche, die optisch mit dem weißen Hintergrund verschmelzen, werden nun als **abgerundete Endkappen** aus der bereits erkannten Silhouette rekonstruiert statt flach abgeschnitten.
- Die Entscheidung für diese Erweiterung orientiert sich an der tatsächlichen Breitenzunahme innerhalb der Flasche: nur wenn sich die Silhouette nach innen deutlich verbreitert, wird der Rand nach oben oder unten vorsichtig fortgesetzt. Dadurch bleiben weiße Kapseln, helle Glasböden und runde Abschlüsse besser erhalten, ohne den Flaschenkörper pauschal zu verbreitern.
- Neuer Regressionstest für helle, vollständig weiß erscheinende Rundungen an Kopf und Boden; die bestehende Prüfung für breite weiße Etiketten am Außenrand bleibt erhalten. Die Gesamtsuite umfasst jetzt **109 bestandene Tests**. Bereits fehlerhaft freigestellte PNGs müssen weiterhin aus dem externer Katalog-Original neu importiert werden.

## 0.6.21 - 2026-11-06

- externer Katalog-Flaschenbildimport: Die bisherige Pixel-Loeschung plus nachtraegliche Reparatur einzelner Einbuchtungen wurde durch eine echte **Konturmaske** ersetzt. Pro Bildzeile wird die linke/rechte Flaschenkante ermittelt und anhand benachbarter Zeilen stabilisiert; so bleibt eine typische Flaschenform mit Hals, Schultern und Boden erhalten.
- Weiss oder fast weiss, das **innerhalb** der erkannten Flaschensilhouette liegt (auch ein bis an den Bildrand reichendes helles Etikett), bleibt **farblich unveraendert und sichtbar**. Nur der Bereich ausserhalb der Kontur wird transparent; die aeussersten 1-2 Pixel werden weich ausgeblendet. Keine kuenstlich aus Nachbarpixeln berechneten Flaschenfarben mehr.
- Neue Regressionstests fuer ein breites, mit dem weissen Hintergrund verbundenes Etikett, feine Konturstoerungen, einen schmalen Flaschenhals, sanfte Schultern, weisse Manschetten und isolierte Artefakte ausserhalb der Silhouette. Beide Bildimportpfade (geladenes Bild und Screenshot-Fallback) verwenden dieselbe Funktion.
- Bereits gespeicherte, falsch freigestellte Fotos muessen neu von der originalen Quellseite importiert werden; bereits entfernte Bildinformationen lassen sich aus der beschaedigten PNG-Datei allein nicht rekonstruieren. Keine Aenderung am Schema, am Scanner oder an HTTPS auf Port 3543.

## 0.6.20 - 2026-11-06

- Die Freistellung von externer Katalog-Flaschenbildern wurde weiter verbessert: Nach dem Entfernen des weissen/#FFF-Hintergrunds wird die Flaschensilhouette nun zeilenweise geglättet. Dadurch werden groessere, unnatuerliche Einbuchtungen am Rand besser geschlossen.
- Wiederhergestellte Randpixel uebernehmen ihre Farbe jetzt aus mehreren benachbarten Flaschenpixeln statt aus nur einem Einzelpixel. Das reduziert harte Artefakte oder dunkle Zacken an Etikett- und Flaschenkanten.
- Bereits importierte Fotos muessen fuer den neuen Effekt erneut ueber externer Katalog uebernommen werden.

## 0.6.19 - 2026-11-06

- externer Katalog-Bildimport robuster gemacht: nach dem Entfernen des weissen/#FFF-Hintergrunds wird die Flaschensilhouette mit einer kleinen morphologischen Glättung stabilisiert. Schmale, versehentlich ausgeschnittene Einbuchtungen am Flaschenrand werden wieder geschlossen.
- Die weiche Kantenbehandlung bleibt erhalten; echte Hintergrundbereiche bleiben transparent, helle Flaschendetails am Rand werden jedoch besser bewahrt.
- Neue Unit-Tests decken nun auch randverbundene weisse Notches am Flaschenumriss ab.

## 0.6.18 - 2026-11-06

- Sammlungskarten: die abfüllungsabhängige Drei-Spalten-Sonderregel aus v0.6.17 wurde entfernt. Auf Desktopbreite über 1020 px erscheinen **vier Kacheln pro Zeile**, auch wenn nur sechs oder 18 Abfüllungen gefunden werden. Nur die Bildschirmbreite bestimmt noch die Spaltenzahl (4/3/2/1).
- Pagination bleibt unverändert mit festen 12/24/48/96 Abfüllungen pro Seite (Standard 24). Die letzte Reihe darf bei gefilterten Treffern oder auf der letzten Seite unvollständig sein; dies verändert weder Seitengröße noch Spaltenzahl.
- Keine Änderungen an Datenformat, externer Katalog-Erweiterungsfunktion, Flaschenverwaltung oder HTTPS-Konfiguration.

## 0.6.17 - 2026-11-06

- Sammlungskarten auf großen Browserfenstern lesbarer: die Sechs-Spalten-Regel wurde entfernt, weil der Inhaltsbereich maximal 1350 px breit ist und die Karten sonst zu schmal werden.
- Die Spaltenzahl orientiert sich bei kleinen Treffermengen auch an der tatsächlich sichtbaren Anzahl: sechs Abfüllungen erscheinen in zwei Reihen zu je drei Karten; auch 9 oder 18 Abfüllungen lassen sich so ohne Restspalte darstellen.
- Die ausgewählte Anzahl pro Seite bleibt exakt erhalten (12, 24, 48 oder 96; Standard 24). Volle Seiten verwenden vier Spalten am Desktop, kleinere Bildschirme drei, zwei oder eine. Keine Änderung an Datenformat, Bildern, Erweiterung oder HTTPS.


## 0.6.16 - 2026-11-06

- Pagination wieder auf **feste Abfüllungszahlen** korrigiert: Standard 24 pro Seite, wählbar 12/24/48/96, in Kachel- und Tabellenansicht identisch. Die zuvor eingeführte dynamische Berechnung nach Anzahl der Reihen wurde entfernt.
- Das responsive Karten-Grid verwendet nur noch **1, 2, 3, 4 oder 6 Spalten**, die alle verfügbaren Seitengrößen ohne Rest teilen. Fünf Spalten sind ausgeschlossen, damit jede volle Seite aus vollständigen Kachelreihen besteht.
- Die aktuell angezeigte Seite und ihre Abfüllungen bleiben bei Fensterbreitenwechsel gleich; Suche, Sortierung, Filter, Bookmark-URLs, HTTPS und JSON-Struktur unverändert.

## 0.6.15 - 2026-11-06

- Die Kachelpagination richtet sich nach vollständig gefüllten **Reihen** statt nach einer starren 24er-Anzahl. Standard sind fünf Reihen pro Seite: 25 Abfüllungen bei fünf Spalten, 20 bei vier und 10 bei zwei Spalten. Auswahl zwischen 3/5/10/20 Reihen.
- Die Spaltenzahl wird aus dem tatsächlich berechneten CSS-Grid ermittelt und bei Breitenänderungen automatisch neu bewertet. Die Tabellenansicht behält unabhängig vom Fenster eine feste Pagination mit standardmäßig 25 Abfüllungen bei.
- Suche, Filter und Sortierung wirken weiter vor der Pagination; Seitenwechsel bleiben in der URL und Browser-History. Kein Datenbank-/JSON-Schema- oder HTTPS-Wechsel.

## 0.6.14 - 2026-11-06

- externer Katalog-Übernahmevorschau als kompakte, zweispaltige Auswahl (mobil einspaltig) statt versetzter Checkboxen und unverbundener Texte.
- Checkboxen auf 18 px begrenzt und an den jeweiligen Angaben zentriert; die bisherige globale Mindesthöhe von 44 px wird für die Importauswahl überschrieben.
- Feldname, importierter Wert und gegebenenfalls bestehender Wert werden in einer gemeinsam anklickbaren Zeile angezeigt. Markierte Optionen sind goldfarben hervorgehoben, unbekannte Destillerien als nicht auswählbar gekennzeichnet.
- Bildimport-Checkbox ebenfalls an die Textzeile angepasst. Übernahmelogik, Datenmodell, HTTPS und Dependabot bleiben unverändert.

## 0.6.13 - 2026-11-06

- Der goldene Destilleriename im Detailkopf ist jetzt genauso groß wie der danebenstehende Vollständigkeitsstatus (13 px statt der kleineren Kartenbeschriftung). Großschreibung, Goldfarbe und Buchstabenabstand bleiben erhalten.
- Die Schriftgröße wird im Detailkopf geerbt, damit die mobile Kartenregel die Destillerie nicht wieder verkleinert. Keine Daten- oder API-Änderungen.

## 0.6.12 - 2026-11-06

- Destilleriename oberhalb der Abfüllungsdetailseite verwendet jetzt exakt die `.card-kicker`-Darstellung der Sammlungskarten: goldfarben, in Versalien und mit Zeichenabstand. Der Vollständigkeitsstatus bleibt als separat gestalteter grauer Text daneben.
- Bei Abfüllungen ohne Destillerie steht nur der Status, ohne überflüssigen Punkt oder Leerzeichen; lange Destillerienamen können umbrechen.
- Die zuvor gewünschte Dependabot-Konfiguration (`npm` und `github-actions` wöchentlich) wird unter `.github/dependabot.yml` mitgeliefert.
- Keine Änderungen an Datenstruktur, Bildimport, Scanverhalten oder HTTPS-Standardwerten.

## 0.6.11 - 2026-11-06

- Fotoabstand in der Sammlungsübersicht korrigiert: 27 px Innenabstand am unteren Bildrand (auch mobil), damit zwischen realem Foto und der 13 px über dem Kartenende liegenden Trennlinie mindestens 14 px verbleiben. Der SVG-Platzhalter ist unverändert.
- Destillerieverwaltung kompakt gestaltet: alphabetisch sortierte Liste mit 360 px maximaler Höhe (mobil 310 px), internem Scrollen, Live-Suche und Trefferzahl; keine endlos lange Verwaltungsseite mehr.
- Anlegen und Umbenennen von Destillerien erfolgt über das bestehende Anwendungs-Modal, nicht über `prompt()`. Aus einem geöffneten Abfüllungsformular heraus wird dessen DOM (einschließlich ungespeicherter Werte und Dateiauswahl) bewahrt; die neu angelegte Destillerie wird automatisch markiert.
- Bisherige native `confirm()`-Abfragen für Löschvorgänge und vollständigen JSON-Import durch anwendungseigene Bestätigungs-Modals ersetzt. Kein Browser-Popup für diese Aktionen.
- Keine Änderung am JSON-Schema, API-Vertrag, Scanner oder der HTTPS-Konfiguration.

## 0.6.10 - 2026-11-06

- Auf der Abfüllungsdetailseite werden nur tatsächlich vorhandene Stammdaten angezeigt; leere Labels und Platzhalterwerte entfallen.
- Unbekannte Whisky-Kategorie, fehlende Destillerien und die standardmäßig unbekannte Blend-Zusammensetzung werden nicht mehr als ausgefüllte Angaben dargestellt.
- Vollständige Destillations-/Abfülldaten, numerische Werte und Einheiten bleiben erhalten. Bearbeitungsformular und JSON-Schema bleiben unverändert.
- Bereits vorhandene Flaschenfotos erhalten in der Einzelansicht, Galerie und externer Katalog-Vorschau einen Innenabstand von mindestens 8 px; die große Fotoansicht hat unten 12 px Abstand zum Rahmen.
- Abfüllungsübersicht mit echter Seiteneinteilung (Standard: 24 pro Seite, wählbar 12/24/48/96), Seitenzahlen und Vor-/Zurück-Steuerung oben und unten. Suche, Filter und Sortierung laufen vor der Aufteilung; die aktuelle Seitenzahl wird in der URL gespeichert. 450 Abfüllungen ergeben 19 Seiten.

## 0.6.9 - 2026-11-06

- Das neu hochgeladene SVG ersetzt den bisherigen leeren Bildplatzhalter in Sammlungskarten und auf der Detailseite. Statt des generischen Rechtecks erscheint nun das passende Flaschenmotiv, solange noch kein Foto zur Abfüllung vorhanden ist.
- Neuer statischer Platzhalter unter `public/assets/photo-placeholder.svg`; die Karten- und Detailansicht referenzieren diese Datei direkt.
- Darstellung des Platzhalters auf hellem und dunklem Hintergrund optisch zurückgenommen (zentriert, leicht transparent, mit dezenter Schattierung), ohne Änderungen am JSON-Schema, Foto-Upload oder HTTPS-Setup.


## 0.6.8 - 2026-11-06

- Das neu hochgeladene 80x80-SVG (dünnere Linien und überarbeitete Flaschen) ersetzt sämtliche App-, Favicon-, iPhone- und Erweiterungssymbole.
- externer Katalog-Import: weiße und nahezu weiße Hintergrundbereiche werden jetzt nur vom Bildrand aus entfernt; ein etwa zwei Pixel breiter, weich ausgeblendeter Rand reduziert harte Freistellkanten und Weißsäume.
- Weiße Etiketten innerhalb der Flaschensilhouette bleiben erhalten; PNG mit Alphakanal und lokale Bildspeicherung unverändert.
- Keine Änderung an Datenstruktur, Scanner oder HTTPS-Konfiguration.


## 0.6.7 - 2026-11-06

- Das neue SVG mit Whiskyglas und Flaschen ersetzt das Headerlogo, Browser-Favicon, iPhone-Home-Icon, Web-App-Icons und die Symbole der externer Katalog-Erweiterung. Das unveränderte Original liegt unter `public/assets/logo-original.svg`; kleine App-Icons verwenden denselben Goldton auf marineblauem Grund.
- externer Katalog-Bildimport: Exakt weiße Pixel (`#FFFFFF`) werden beim lokalen Kopieren transparent (Alpha 0) und als PNG mit Transparenz gespeichert. Die Umwandlung erfolgt bei direkt geladenen Bildern und beim Screenshot-Fallback; andere Farben und bestehende Transparenz bleiben erhalten.
- Eigene Foto-Uploads bleiben unverändert. Keine Änderung an JSON-Schema, Scanner, Flaschenverwaltung oder HTTPS-Konfiguration.


## 0.6.6 - 2026-11-06

- externer Katalog-Bildübernahme korrigiert: Die Erweiterung fordert die externe Bild-URL nicht mehr erneut an (dieser separate Abruf lieferte HTTP 403).
- Bereits geladene Bildpixel werden zuerst direkt aus dem offenen Browser-Tab als eigene lokale PNG-Datei übernommen. Bei browserseitigem Cross-Origin-Schutz erfolgt alternativ ein auf den sichtbaren Flaschenbild-Bereich zugeschnittener Tab-Screenshot. Die Seite wird danach an die ursprüngliche Scrollposition gesetzt.
- Dateien werden weiterhin lokal auf dem Server zwischengespeichert und erst nach Bestätigung einer physischen Flasche zugeordnet. Keine externen Bildlinks in `collection.json`.
- Zusätzliche Unit-Tests für die Bildauswahl, das pixelbasierte Kopieren, Screenshot-Zuschnitt und den lokalen Upload ohne externen Bild-Fetch.
- Screenshot-Fallback kann nur die sichtbare Bildauflösung liefern. Kein Echtbetrieb-Test mit externer Katalog in der Entwicklungsumgebung.

## 0.6.5 - 2026-11-06

- Hochgeladenes Whisky-SVG als neues Markenlogo im Header eingesetzt. Die Zeichnung ist unverändert; nur der SVG-Ansichtsbereich wurde für kleine Darstellungen optimiert.
- Favicon (SVG/PNG), iPhone-Home-Icon und Web-App-Icons hinzugefügt. Das Symbol der externer Katalog-Erweiterung und ihr Popup verwenden dasselbe Motiv.
- Keine Änderungen an Sammlung, JSON-Schema, Barcode-Scanner, Bild-Upload oder HTTPS-Standardeinstellungen.


## 0.6.4 - 2026-11-06

- Bestandslabels zusammengefasst: geschlossen als Standardfall („2 Standardflaschen“, „1 Sample“); offen explizit („1 offene Standardflasche“, „1 offenes Sample“). Leere Flaschen erhalten in der Übersicht keine Zählmarke mehr; kein zusätzliches Statuszähl-Label.
- Flaschenfotos per Drag-and-drop auf Desktop und Touch neu sortierbar, zusätzliche Links-/Rechts-Schaltflächen; die Reihenfolge wird atomar im `photos[]`-Array der konkreten Flasche gespeichert und bleibt beim ZIP-Export erhalten.
- Erweiterung kann beim manuellen Einzelimport ein sichtbares externer Katalog-Flaschenbild als **Bildbytes** in den lokalen Manager übertragen. Temporärer Bildtransfer (15 Minuten), Vorschau und explizite Zuordnung zur ersten, neuen oder vorhandenen physischen Flasche; kein serverseitiger Abruf von externer Katalog.
- Importierte Bilder sind im lokalen Fotoverzeichnis gespeichert und durch externe Fotoherkunft als Referenzbilder gekennzeichnet, nicht als Eigentumsnachweis.
- Tests für Statuszählung, Foto-Reihenfolge, Bildtransfer, Eingabeprüfung und ZIP-Aufnahme ergänzt. Keine Änderung des Collection-Schemas oder der HTTPS-Standardwerte.

## 0.6.3 - 2026-11-05

- Mengenanzeige in Sammlungskarten und Tabellen berichtigt: Standardflaschen und Samples werden getrennt und ohne Doppelzählung dargestellt (z. B. „1 Standardflasche“ + „1 Sample“ statt „2 Flaschen“ + „1 Sample“).
- Der Gesamtbestand bleibt intern korrekt; in der Übersicht wird die Kennzahl als „Bestand gesamt“ benannt.
- Detailüberschrift zu „Flaschen und Samples“ präzisiert.
- Tests für gemischten, reinen Sample- und reinen Standardbestand ergänzt.

## 0.6.2 - 2026-11-05

- Sample-Label ohne Rahmen, optisch an die übrigen Status-Labels angepasst.
- Auf der Detailseite 12 px Abstand zwischen Flaschenstatus und Sample-Label.
- Browser-DOM-Test prüft Abstand und rahmenlose Darstellung in Light- und Dark-Mode.

## 0.6.1 - 2026-11-05

### Dokumente und Versicherungsnachweise pro physischer Flasche

- Eigene Dateiablage `files[]` an jeder physischen Flasche für Rechnungen, PDF-Dokumente, Bilder und weitere Belege. Dateien bleiben außerhalb von `collection.json`, werden dort aber mit relativen Pfaden, Originaldateiname, Größe und SHA-256 referenziert.
- Dateien über die Flaschendetailseite und die Erfassungs-/Bearbeitungsformulare hochladen; Downloads und Löschen je Datei. Uploads nur aus einer Typ-Whitelist mit 15-MiB-Limit. Dateien sind nur über die zugehörige Flaschen-ID abrufbar, nicht öffentlich statisch ausgeliefert.
- JSON- und CSV-Export enthalten die Dateiverweise; das vollständige ZIP enthält weiterhin alle Fotos und **auch sämtliche hinterlegten Nachweise**. Keine zusätzliche Werthistorie.

### Sample und Flaschengröße je Flasche

- `volumeType` (`sample`/`standard`) von der Abfüllung auf **jede physische Flasche** verschoben; die tatsächliche `volumeMl` ist pro Flasche erfassbar. Die optional erhaltene `bottling.volumeMl` beschreibt nur die Hersteller-Nennfüllmenge.
- Samples in Kachel-, Tabellen- und Flaschendetailansicht über Labels erkennbar, auch bei gemischtem Bestand (Standardflaschen und Samples derselben Abfüllung).
- Datenmodell auf `schemaVersion: 4` erhöht. Bestehende Schema-3-Dateien werden vor der Migration gesichert und samt IDs, Inventarnummern und Bildern übernommen. Belege haben ein eigenes Unterverzeichnis `documents/`.
- Unit-, Integrations- und Browser-DOM-Tests für Migration, Sample-Anzeige, Datei-Uploads, Downloads, Löschung und ZIP-Export ergänzt.

## 0.6.0 - 2026-11-05

### Struktur und Lesbarkeit

- Browser-Einstieg auf Initialisierung und Verbindung der Controller reduziert; Seiten, Formulare, Scanner, Foto-Uploads, externer Katalog, Navigation und Theme in benannte Module getrennt.
- Backend in HTTP-Schicht, Anwendungsfälle, Fachregeln, JSON-/Bildspeicherung, Migrationen und Exportformate aufgeteilt.
- CSS nach Verantwortungen getrennt, bestehende Reihenfolge und Gestaltung erhalten.
- Komprimierten Code erweitert, Namen verdeutlicht, kritische Entscheidungen kommentiert und JSON-Modell mit JSDoc dokumentiert.
- Architektur-, Entwickler-, API- und Testdokumentation ergänzt; EditorConfig und GitHub-Prüfworkflow hinzugefügt.
- Plattformunabhängige Testsuche, Syntax-/Importprüfung und Importzyklusprüfung ergänzt. Laufzeitabhängigkeiten bleiben unverändert; Playwright ist nur ein Entwicklungswerkzeug.

### Absicherung und Korrekturen

- Quelltext-Stringprüfungen für zentrale UI-Abläufe durch Verhaltenstests ersetzt bzw. ergänzt.
- Neu angelegte Abfüllung vor Navigation in den aktuellen Datenstand laden, damit ihre Detailseite direkt verfügbar ist.
- Nach Scannen aus einem Flaschenformular bleiben Flaschen-ID und ungespeicherte Textwerte erhalten; es wird keine neue Flasche statt der bearbeiteten erzeugt.
- Gesperrter `localStorage` verhindert nicht mehr den Start der Oberfläche.
- Nicht-Objekte und defektes JSON erhalten eine 400-Antwort. Abgelehnte Schreibvorgänge blockieren folgende Änderungen nicht.
- Reservierte Inventarnummern beim Import innerhalb derselben Schreibtransaktion zusammenführen.

### Bewusst unverändert

- Schema 3, verschachtelte Flaschen, Bildpfade, UUIDs und die einzige Inventarnummer.
- Scanner-Erkennungsparameter des bisherigen 0.5.5-basierten Standes; kein neuer optischer Erkennungsansatz.
- Nach Scan Abfüllung oben anzeigen, Flasche markieren, kein automatischer Editiermodus.
- HTTPS 3543, HTTP deaktiviert, `.env`-Nutzung und Beibehaltung des Ports beim Zertifikatssetup.
- Benutzerfoto, Theme, vorhandene Import-/Exportfunktionen und externer Katalog-Erweiterung.

Ausgangsbasis: v0.5.9. Für tatsächlich ausgeführte Prüfungen und Grenzen siehe `docs/TESTSTATUS.md`.
