# Tasting-Flights planen und dokumentieren

Zwei Modi sind vorgesehen: **Dokumentieren** gruppiert bestehende oder neu erstellte Verkostungen; **Planen** schlägt eine zukünftige Verkostungsfolge aus vorhandenen Flaschen vor. Planung verändert keine Bestände, erstellt keine Verkostungsdaten und nutzt keine externen Dienste.

## Kandidaten und Vergleich

- Nicht leere eigene Flaschen (optional nur geöffnet, Samples oder aktuell gefilterter Bestand). Höchstens eine Flasche pro Abfüllung; die Wahl ist deterministisch.
- Grundlage ist das neueste **vorhandene** Geschmacksprofil der Abfüllung. Ein fehlendes Achsen-/Fass-/Altersmerkmal bleibt unbekannt, nicht Null.
- Die zehn Radarachsen bilden Aromengruppen. `caskType` ist Freitext; erkannte Gruppen sind Bourbon, Sherry (einschließlich PX/Oloroso/Fino/Amontillado/Palo Cortado/Manzanilla), Wein und Exotisch. Unbekannte Fassangaben werden keiner erfundenen Kategorie zugeordnet. Finish wird schwächer gewichtet als Hauptreifung.
- Vergleichsdistanzen werden aus Radarprofil, gewichteten Fassgruppen und Alter gebildet. Bei Ähnlichkeit/Kontrast ist die Regelgewichtung **65 % Radar, 25 % Fass, 10 % Alter**; nur **vorhandene** Merkmale werden normalisiert. Nicht vergleichbare Profile erhalten eine dokumentierte Abwertung statt geschätzter Aromen.
- Alter: `min(|Alter_A − Alter_B| / 15, 1)` bei vorhandenen Altersangaben. Fassgruppen nutzen gewichteten Jaccard-Abstand; erkannte Sherry-Untertypen können den Vergleich verfeinern.

Die konkrete aktuelle Vorschlags- und Tie-Breaking-Logik ist in `public/js/domain/flight-planner.js` und `flight-casks.js` implementiert; dies sind die maßgeblichen Stellen für neue Strategien.

## Planungsdialog

Strategie, Flaschenwahl und optionales Thema steuern Vorschläge. Der Dialog zeigt nachvollziehbare Gründe, kann geplante Elemente umsortieren und unterstützt einen verschachtelten Hilfedialog. Beim Öffnen/Schließen der Hilfe müssen ungespeicherte Planungswerte erhalten bleiben. Geplante Flights werden ohne zugeordnete `tastingIds` gespeichert; beim Dokumentieren stehen konkrete Verkostungen und ihre Reihenfolge im Mittelpunkt.

## Daten und API

Die Collection speichert `tastingFlights[]`; dokumentierte Flights verweisen auf IDs einzelner Verkostungen. Ein gelöschter Flight entfernt nicht die Verkostungen, eine gelöschte Verkostung wird aus ihrer Flight-Liste entfernt. Relevante Routen und Nutzlasten: [API](API.md#tasting-flights). Fachtests: `tests/unit/flight-planner-strategies.test.js` und `tests/browser/tastings.test.js` (soweit vorhanden); bei Modals zusätzlich die Browser-Regressionstests.
