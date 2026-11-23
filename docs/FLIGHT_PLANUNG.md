# Geplante Tasting Flights

Der Verkostungsbereich unterscheidet zwischen **Flight dokumentieren**
(bisherige Zusammenstellung vorhandener und neu angelegter Verkostungen) und
**Flight planen** (Zukunftsplanung auf Basis vorhandener Flaschen).

## Vorschlagslogik

Der Algorithmus in `public/js/domain/flight-planner.js` berechnet ausschließlich
lokale, deterministische Vorschläge. Er benutzt keine externen Dienste und
macht keine Aussagen über nicht erfasste Geschmacksmerkmale.

### 1. Kandidaten

- Physische, nicht leere Flaschen, je nach Auswahl nur geöffnete, alle oder
  nur Samples; optional eingeschränkt auf die gefilterte Sammlung.
- Höchstens eine Flasche je Abfüllung. Bei mehreren Flaschen werden zuerst
  geöffnete, dann Samples und schließlich die stabile Flaschen-ID berücksichtigt.
- Verwendet wird das jüngste **vorhandene** Geschmacksprofil; die jüngste
  Verkostung muss nicht selbst ein Profil enthalten.
- Die zehn Radarachsen unterscheiden zwischen **0** (bewertet: nicht vorhanden)
  und **nicht bewertet** (fehlender Wert, nicht als 0 zu interpretieren).
- Aromengruppen werden anhand der höchsten tatsächlich bewerteten Werte gebildet:
  Rauch/Torf/medizinisch, Frucht/Blüte, Holz/Getreide, Wein sowie
  alkoholisch/schwefelig. Eine dominante Gruppe erfordert einen Wert ab 2.
- `caskType` ist **Freitext** an der Abfüllung und wird zur Laufzeit interpretiert;
  `ageYears` ist optional. Beide Originalwerte werden nicht überschrieben.

### 2. Fassart und Alter

`public/js/domain/flight-casks.js` ordnet bekannte Hinweise einer oder mehreren
Fassgruppen zu: **Bourbon**, **Sherry**, **Wein**, **Exotisch**. Zu Sherry werden
**PX (Pedro Ximénez), Oloroso, Fino, Amontillado, Palo Cortado und Manzanilla**
als Untertypen erkannt. Beispiele für Wein sind Port, Madeira, Sauternes und
Bordeaux; Exotisch umfasst ausdrücklich identifizierbare Fassarten wie Rum,
Cognac, Tequila, Mizunara, Virgin Oak oder Bier. Ein unbekannter Text wird
**nicht** ersatzweise als Exotisch einsortiert.

Gemischte Angaben werden mehreren Gruppen zugeordnet. Eine erkannte Hauptreifung
hat Gewicht 1, ein anhand der Formulierung erkanntes Finish Gewicht 0,5.
Daraus entsteht der **gewichtete Jaccard-Abstand** der Fassgruppen:

`dF = 1 - Σ min(wA(g), wB(g)) / Σ max(wA(g), wB(g))`

Bei zwei Sherry-Profilen mit jeweils bekannten Untertypen gilt zusätzlich:

`dF = 0,75 × Gruppenabstand + 0,25 × Untertypenabstand`

Fehlt bei einer Abfüllung eine erkennbare Fassgruppe, ist `dF` unbekannt (`null`).
Fehlt einem Sherry-Profil ein Untertyp, wird kein unbekannter Untertyp erfunden.

Das **Altersdelta** ist ohne Altersangaben ebenfalls unbekannt; andernfalls:

`dA = min(|Alter_A − Alter_B| / 15, 1)`

Bei ähnlichen/kontrastreichen Flights gilt die Grundgewichtung **65 % Radarprofil,
25 % Fassart, 10 % Alter**. Dazu werden die Komponenten jeweils auf 0–1 normiert:

`dG = mittlerer Radarachsen-Abstand / 10`

`Dsigned = 10 × Σ(w_i × Vorzeichen_i × d_i) / Σ(w_i der bekannten Merkmale)`

Die bekannte Teilmenge wird neu auf 100 % gewichtet. Ein fehlender Wert wird nicht
als Null gewertet; der bisherige Abzug von 14 Punkten für Paare ohne zwei
vergleichbare Radarachsen bleibt zusätzlich bestehen. Ähnlich verwendet
standardmäßig negative Vorzeichen, Kontrast positive. Explizite Wünsche nach
ähnlichen/verschiedenen Fassarten oder Altern kehren nur deren jeweiligen
Faktor um, nicht das gesamte Flight-Ziel.

Die **Altersklassen** für Vielfalt/Entdeckung sind 0–5, 6–10, 11–15,
16–20 und ab 21 Jahren. Sie dienen nicht als Qualitätsbewertung.

### 3. Zusammenstellung des Flights

Für alle Strategien werden zunächst mehrere mögliche Startflaschen geprüft.
Bei der späteren Auswahl berücksichtigt der Algorithmus die bereits gewählte
**gesamte Gruppe** statt nur das unmittelbar vorherige Element. Danach wird
mit bis zu zwei Durchläufen nach besseren Austausch-Kandidaten gesucht.
Eine begrenzte Kandidatenvorauswahl berücksichtigt gut passende Flaschen,
Vertreter jeder Aromengruppe und für „Ausgewogen“/„Kontrastreich“ auch die
Extremwerte der Radarachsen. Das ist eine heuristische Näherung, **keine**
garantiert global optimale Zusammenstellung. Wiederholte Destillerien
werden generell geringfügig abgewertet.

Die vier Strategien bewerten Kombinationen unterschiedlich:

1. **Ausgewogen:** belohnt unterschiedliche belegte Aromengruppen und vorhandene
   Geschmacksprofile. Sehr kleine oder sehr große Profilunterschiede sind
   weniger erwünscht als ein mittlerer Abstand. Große Lücken zwischen den
   Intensitätswerten werden abgewertet. Leichte Neuheit fließt ein. Bei
   automatischen Fass-/Altersoptionen kommen **+4 je bekannter Fassgruppe** und
   **+2 je bekannter Altersklasse** dazu.
2. **Thematisch ähnlich:** minimiert den gewichteten gemeinsamen Radar-, Fass-
   und Altersabstand (`3,2 × Dsigned` pro Paar mit negativen Standardvorzeichen).
   Ein optionaler Aromenschwerpunkt (Rauch, Torf, Frucht, Wein oder Holz)
   bevorzugt erfasste Werte der gewünschten Achse. Ohne zwei gemeinsam
   bewertete Radarachsen gibt es weiterhin **−14 Punkte** je Paar.
3. **Kontrastreich:** maximiert den gewichteten gemeinsamen Radar-, Fass-
   und Altersabstand (`2,5 × Dsigned` pro Paar mit positiven Standardvorzeichen)
   und belohnt verschiedene Aromengruppen. Sehr große Intensitätslücken werden
   abgewertet; ohne zwei vergleichbare Radarachsen gibt es **−14** je Paar.
4. **Entdecken:** bevorzugt noch nie verkostete (+30) oder lange nicht
   verkostete Abfüllungen (bis +10), geöffnete Flaschen (+3) und Abfüllungen
   ohne Geschmacksprofil (+4). Die zusätzliche Option „Wenig vertraute
   Geschmacksprofile“ bevorzugt bei vorhandenen Vergleichen Profile mit größerem
   Abstand zu den Profilen bereits verkosteter Abfüllungen. Dabei werden
   nicht erfasste Aromen nicht geschätzt. Zusätzlich erhält jede bisher
   **nicht verkostete bekannte Fassgruppe +5** und jede bislang **nicht
   verkostete Altersklasse +3**. Die Historie umfasst auch momentan nicht
   verfügbare Flaschen und soweit erfasst externe Verkostungen.

#### Optionale Präferenzen im Planungsdialog

Der einklappbare Bereich **Fassart & Alter** bietet folgende Optionen:

- **Automatisch:** Die vier Strategien berücksichtigen Fass/Alter wie oben.
- **Ähnliche / unterschiedliche Fassarten oder Alterswerte:** bei
  Ähnlich/Kontrastreich wird jeweils nur das Vorzeichen dieser Komponente
  angepasst. Bei Ausgewogen/Entdecken werden pro vergleichbarem Paar
  **±4 × dF** bzw. **±2 × dA** addiert.
- **Bestimmte Fassgruppe:** Jeder Treffer erhält **+9**. Bei Sherry kann
  zusätzlich ein Untertyp gewählt werden; ein Treffer erhält weitere **+4**.
- **Altersbereich:** Jeder Treffer im angegebenen Bereich erhält **+3**.
  Unter- und Obergrenze können unabhängig festgelegt werden.
- **Nur passende Abfüllungen:** Erst durch diese ausdrücklich gewählte Option
  werden vorab alle Flaschen entfernt, die die gewählte Fassgruppe mit
  Untertyp bzw. das angegebene Alter nicht erfüllen. Ohne harte Filter sind
  die Angaben lediglich Präferenzen. Ohne konkrete Vorgabe wird nicht
  gefiltert. Dadurch dürfen Vorschläge kürzer als die gewünschte Anzahl werden.

`Pref` bezeichnet die Summe dieser manuellen Bonus-/Malusbeiträge. Alle
Strategien ziehen außerdem 2 Punkte je wiederholter Destillerie ab. Eine
fehlende Fassinformaton zählt weder als passende Fassart noch als Exotisch.
Die individuelle 0–100-Bewertung und der Preis beeinflussen die Auswahl nicht.

### 4. Abfolge der Verkostung

Die Intensität wird grob geschätzt als:

`I = ABV / 12 + Profilmittelwert + Rauchig / 4 + Torfig / 4`

Für die ausgewählten maximal sechs Flaschen werden alle möglichen
Reihenfolgen (höchstens `6! = 720`) verglichen. Bewertet werden:

- Ein möglichst milder Beginn,
- kleine Intensitätsschritte ohne starke Rücksprünge,
- Vermeidung sehr großer Intensitätsanstiege und
- geringe Geschmacksabstände zwischen direkt benachbarten Whiskys,
- bei bekannten Fassarten einen **Zusatz von 0,65 × dF** je Nachbarpaar,
- bei bekanntem Alter einen kleinen **Zusatz von 0,025 × min(Altersdelta, 15)**.

Die billigste Abfolge nach dieser Heuristik wird vorgeschlagen, bei gleichem
Wert deterministisch anhand der IDs entschieden. Sie muss nicht streng nach
Intensität sortiert sein, wenn ein sensorisch ähnlicherer Übergang besser
bewertet wird. Diese Kostenfunktion ist **keine wissenschaftlich validierte
Verkostungsreihenfolge**.

### 5. Bedienung und Grenzen

Im Bereich „Verkostungsnotizen“ erklärt ein Hilfebutton am Abschnitt
„Tasting-Flights“ die Regeln und Grenzen in einem Modal. Im Planungsdialog
werden der Aromenschwerpunkt nur bei „Thematisch ähnlich“ und die Option für
unbekannte Profile nur bei „Entdecken“ angeboten. Weitere Fass- und Altersoptionen
können in einem einklappbaren Bereich kombiniert werden. Jede Änderung der Optionen
verwirft die noch nicht gespeicherte Vorschlagsliste bis zu einer erneuten
Berechnung. Der Nutzer kann die Liste nach dem Speichern manuell ersetzen,
ergänzen, entfernen und umsortieren.

Ein gespeicherter Plan enthält weiterhin ausschließlich Referenzen auf
`bottlingId`/`bottleId` und einen kurzen Begründungscode. Die Kriterien gelten
für die Generierung, werden **nicht** als zusätzliche Plan-Metadaten gespeichert.
Die neue Berechnung verändert **weder API noch Collection-Schema**. Ein Plan erstellt erst beim
späteren expliziten Speichern einer Verkostung wirkliche Verkostungsdaten.

## Lebenszyklus

1. **Geplant:** Nur Flaschenreferenzen; keine Verkostungsdatensaetze.
2. **In Durchfuehrung:** „Verkostung erfassen“ erstellt bei explizitem
   Speichern eine normale, unabhaengige Verkostung im Flight. Die urspruengliche
   Planung bleibt als Liste erhalten.
3. **Abgeschlossen:** Nach mindestens einer erfassten Verkostung kann der
   Flight abgeschlossen werden. Weitere Flight-Eintraege sind gesperrt.

Bestehende Flights ohne `phase` und `planItems` sind unveraendert weiterhin
historische Flights. Die optionalen Felder werden im bestehenden JSON-Schema 6
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
