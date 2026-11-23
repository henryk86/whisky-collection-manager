# Analysen und Statistiken

Die Analyse (`/?view=analysis`) hat einen Überblick und **sechs Themenbereiche mit insgesamt 38 Auswertungen**. Die Seitennavigation wechselt mobil zum Auswahlfeld. Alle Daten werden aus der aktuellen Collection (Schema 6) **nur gelesen**.

| Abschnitt (`section`) | Inhalt |
|---|---|
| `overview` | Kennzahlen, Status, Ranglisten und Themenkarten |
| `inventory` | Bestand, Flaschenstatus, Samples, Destillerien, Nennfüllmengen (1–6) |
| `origins` | Destillerien, Länder, Regionen, Whiskytypen, Abfüllertypen (7–12) |
| `profile` | Alter/NAS, Alkoholgehalt, Jahrgänge, Fassart, Auflage (13–20) |
| `finance` | Kaufpreise, Händler, Literpreis, monatliche/jährliche Ausgaben (21–27) |
| `timeline` | Erwerb, Erfassung, Öffnen, Leeren, Verbrauchsdauer, Verkostungsbewertung (28–34) |
| `quality` | Vollständigkeit, fehlende Angaben, WB-Verknüpfungen (35–38) |

## Filter und Berechnung

Destillerie, Land, Flaschentyp und Status kombinieren sich auf **derselben physischen Flasche**. Filter werden über URL-Parameter erhalten. Für Finanzen und Entwicklung gelten optionale Tagesgrenzen (`Von`/`Bis`, native Datumsfelder), die **vor** monatlicher/jährlicher Aggregation wirken. Gesamtsummen bleiben von der Zeitbereichsfilterung unberührt. Diagramme und Ranglisten verlinken auf die jeweils passenden Ansichten.

- Bestand unterscheidet physische Flaschen und eindeutige Abfüllungen; eine leere Flasche zählt weiter zur inventarisierten **Nennmenge**. Fehlende ml-Angaben werden nicht addiert.
- Länder und Regionen stammen aus den beteiligten Destillerien. Bei Blends kann eine Abfüllung in mehreren Herkunftsgruppen erscheinen; Summen müssen deshalb nicht der Zahl unterschiedlicher Flaschen entsprechen.
- Originalabfüllungen werden anhand der Abfüllerbezeichnung bzw. der zugeordneten Destillerie bestimmt; uneindeutige Angaben werden nicht als unabhängige Abfüllung geraten.
- Finanzen zeigen dokumentierte **Anschaffungspreise**, keine Marktwerte. Unbekannte Beträge sind nicht null; unterschiedliche Währungen werden nie ohne Kurs konvertiert oder summiert. Literpreis nur bei bekanntem Preis **und** Volumen.
- Zeitreihen verwenden gültige Datumsfelder. Bewertungsstatistiken nutzen die **letzte datierte Verkostung je Abfüllung**; ist diese unbewertet, wird keine ältere Bewertung übernommen.
- Leere/fehlende Angaben erscheinen als Unbekannt/Empty State, nicht als `NaN` oder erfundener Durchschnitt. Qualitätskategorien können sich überlappen.

## Umsetzung und Abnahme

`public/js/domain/analytics.js` berechnet, `public/js/views/analytics.js` rendert, `public/styles/analytics.css` gestaltet. Gemeinsame Panels und der Seitenrahmen kommen aus dem Designsystem. Tests: `tests/unit/analytics.test.js`, `tests/unit/analytics-origin.test.js`, `tests/unit/analytics-period.test.js` und `tests/browser/map-analytics.test.js`. iOS-spezifische native Datumsfelder brauchen reale Geräteprüfung.
