# Tasting-Flights planen und dokumentieren

Zwei Modi sind vorgesehen: **Dokumentieren** gruppiert bestehende oder neu erstellte Verkostungen; **Planen** schlägt eine zukünftige Verkostungsfolge aus vorhandenen Flaschen vor. Planung verändert keine Bestände, erstellt keine Verkostungsdaten und nutzt keine externen Dienste.

## Kandidaten und Vergleich

- Nicht leere eigene Flaschen (optional nur geöffnet, Samples oder aktuell gefilterter Bestand). Höchstens eine Flasche pro Abfüllung; die Wahl ist deterministisch.
- Grundlage ist das neueste **vorhandene** Geschmacksprofil der Abfüllung. Ein fehlendes Achsen-/Fass-/Altersmerkmal bleibt unbekannt, nicht Null.
- Die zehn Radarachsen bilden Aromengruppen. `caskType` bleibt unveränderter Freitext. Die zentrale Klassifikation `flight-casks.js` erkennt Bourbon, Sherry, Portwein, Madeira, nicht fortifizierten Wein, sonstige fortifizierte Weine, Rum, sonstigen Whisky, Brandy, sonstige Spirituosen, Bier, Virgin Oak und explizit erkannte sonstige Belegungen. Nicht erkennbare Angaben sind unbekannt. Sherry, Port, Madeira und Wein haben Untertypen; Weinfarbe, Stil, Bezeichnung und Rebsorte werden getrennt erfasst. Rum besitzt keine Untertypen. Explizit benannte Finishes erhalten Gewicht 0,5, andere Fassangaben 1; ohne explizite Angabe bleibt die Reifungsphase unbekannt.
- Vergleichsdistanzen werden aus Radarprofil, gewichteten Fassgruppen und Alter gebildet. Bei Ähnlichkeit/Kontrast ist die Regelgewichtung **65 % Radar, 25 % Fass, 10 % Alter**; nur **vorhandene** Merkmale werden normalisiert. Nicht vergleichbare Profile erhalten eine dokumentierte Abwertung statt geschätzter Aromen.
- Alter: `min(|Alter_A − Alter_B| / 15, 1)` bei vorhandenen Altersangaben. Fassgruppen nutzen gewichteten Jaccard-Abstand. Vergleichbare bekannte Merkmalsdimensionen gemeinsamer Gruppen verfeinern den verbleibenden Abstand um maximal 25 %. Überlappende Merkmale (etwa Colheita/Tawny) werden nicht als unabhängige Gruppen gezählt. Automatische Fassabdeckung verteilt höchstens eine Einheit je Abfüllung auf ihre Gruppen und begrenzt jede Gruppe auf eine Einheit. Ausgewogen und Entdecken berücksichtigen zusätzlich einen auf einen Punkt begrenzten Untertypbeitrag aus Paarvergleichen bzw. der Historie.

Die konkrete aktuelle Vorschlags- und Tie-Breaking-Logik ist in `public/js/domain/flight-planner.js` und `flight-casks.js` implementiert; dies sind die maßgeblichen Stellen für neue Strategien.

## Planungsdialog

Strategie, Flaschenwahl und optionales Thema steuern Vorschläge. Unter Fassart & Alter können mehrere Fassgruppen und jeweils mehrere Merkmale gewählt werden: Gruppen und Werte innerhalb einer Dimension sind Alternativen (ODER), unterschiedliche Dimensionen und eine explizite Reifungsphase müssen zur selben Fassbelegung passen (UND). Ohne Untertyp zählen auch unbekannte Untertypen. Ohne Auswahl gibt es keine Fassgruppeneinschränkung. Kompakte Auswahlfelder und aufklappbare Detailbereiche zeigen ausgewählte Merkmale und eine Zusammenfassung. Zurücksetzen löscht die Fassauswahl einschließlich Reifungsphase, ohne andere Planungswerte zu verändern. Sauternes erfüllt Weißwein und Süßwein, Colheita auch Tawny. Präferenzen bewerten Treffer, harte Filter schließen unpassende Abfüllungen aus; mehrere gewählte Gruppen garantieren nicht, dass jede im Flight vorkommt. Der Dialog zeigt nachvollziehbare Gründe, kann geplante Elemente umsortieren und unterstützt einen verschachtelten Hilfedialog. Beim Öffnen/Schließen der Hilfe müssen ungespeicherte Planungswerte erhalten bleiben. Geplante Flights werden ohne zugeordnete `tastingIds` gespeichert; beim Dokumentieren stehen konkrete Verkostungen und ihre Reihenfolge im Mittelpunkt.

## Daten und API

Die Collection speichert `tastingFlights[]`; dokumentierte Flights verweisen auf IDs einzelner Verkostungen. Ein gelöschter Flight entfernt nicht die Verkostungen, eine gelöschte Verkostung wird aus ihrer Flight-Liste entfernt. Relevante Routen und Nutzlasten: [API](API.md#tasting-flights). Fachtests: `tests/unit/flight-planner-strategies.test.js` und `tests/browser/tastings.test.js` (soweit vorhanden); bei Modals zusätzlich die Browser-Regressionstests.
