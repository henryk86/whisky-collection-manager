# Geplante Tasting Flights

Der Verkostungsbereich unterscheidet zwischen **Flight dokumentieren**
(bisherige Zusammenstellung vorhandener und neu angelegter Verkostungen) und
**Flight planen** (Zukunftsplanung auf Basis vorhandener Flaschen).

## Vorschlagslogik

Der Vorschlagsalgorithmus laeuft vollstaendig offline in
`public/js/domain/flight-planner.js`. Er benoetigt keinen API-Schluessel.
Kandidaten sind physische, nicht leere Flaschen. Standardmaessig werden nur
geoeffnete Flaschen vorgeschlagen; alternativ koennen auch geschlossene oder
nur Sample-Flaschen beruecksichtigt werden. Pro Abfuellung wird maximal eine
physische Flasche ausgewaehlt. Vorschlagsvarianten:

- **Ausgewogen:** bevorzugt bekannte Geschmacksprofile und sortiert die Auswahl
  nach einer dokumentierten Intensitaetsheuristik aus Geschmacksachsen und ABV.
- **Thematisch aehnlich:** bevorzugt geringe Abstaende zwischen vorhandenen,
  vergleichbaren Geschmacksachsen.
- **Kontrastreich:** bevorzugt grosse Unterschiede zwischen solchen Profilen.
- **Entdecken:** priorisiert noch nicht oder lange nicht verkostete Abfuellungen.

Bei fehlenden Profilen werden keine Aromen erfunden. Die UI kennzeichnet
fehlende Daten. Die Vorschlaege sind nicht unfehlbare Geschmacksurteile.
Ein gespeicherter Plan enthaelt geordnete Referenzen auf `bottlingId` und
`bottleId` sowie eine kurze Auswahlbegruendung; die Eintraege lassen sich
manuell umordnen, ersetzen, ergaenzen oder entfernen. Entfernte beziehungsweise
leere Flaschen werden als nicht verfuegbar angezeigt und verhindern den Start.

## Lebenszyklus

1. **Geplant:** Nur Flaschenreferenzen; keine Verkostungsdatensaetze.
2. **In Durchfuehrung:** „Verkostung erfassen“ erstellt bei explizitem
   Speichern eine normale, unabhaengige Verkostung im Flight. Die urspruengliche
   Planung bleibt als Liste erhalten.
3. **Abgeschlossen:** Nach mindestens einer erfassten Verkostung kann der
   Flight abgeschlossen werden. Weitere Flight-Eintraege sind gesperrt.

Bestehende Flights ohne `phase` und `planItems` sind unveraendert weiterhin
historische Flights. Die optionalen Felder werden im bestehenden JSON-Schema 5
gespeichert. Die Servervalidierung begrenzt neue Planungen auf sechs
unterschiedliche Abfuellungen und erlaubt keine ungueltigen Statuswechsel.

## API

- `POST /api/tasting-flights` mit `phase:"planned"` und `planItems` erstellt
  eine reine Planung; bisherige POST-Anfragen ohne `phase` bleiben unveraendert.
- `PATCH /api/tasting-flights/:id` kann geplante `planItems` aktualisieren.
  `phase:"inProgress"` startet, `phase:"completed"` schliesst den Flight.
- `POST /api/tasting-flights/:id/tastings` erfasst erst nach dem Start eine
  echte Verkostung. Das Anlegen waehrend der Planung oder nach Abschluss wird
  abgewiesen.
- `PUT /api/settings/saved-views` nimmt `{ "views": [...] }` entgegen
  und schreibt die gespeicherten Ansichten atomar zu den Sammlungsdaten.

Neue API-Aufrufe erfordern dieselben Berechtigungen wie die bisherigen
Sammlungs- und Verkostungsaktionen.
