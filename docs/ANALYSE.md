# Analysen und Statistiken

Die Analyse (`/?view=analysis`) hat einen Überblick und **sieben Themenbereiche** (38 bisherige fachliche Auswertungen und die Versicherungsdokumentation). Die Seitennavigation wechselt mobil zum Auswahlfeld. Die Auswertungen lesen die aktuelle Collection (Schema 10) und für die Versicherungsdokumentation auch das Lager.

| Abschnitt (`section`) | Inhalt |
|---|---|
| `overview` | Kennzahlen, Status, Ranglisten und Themenkarten |
| `inventory` | Bestand, Flaschenstatus, Samples, Destillerien, Nennfüllmengen (1–6) |
| `origins` | Destillerien, Länder, Regionen, Whiskytypen, Abfüllertypen (7–12) |
| `profile` | Alter/NAS, Alkoholgehalt, Jahrgänge, Fassart, Auflage (13–20) |
| `finance` | Kaufpreise, Händler, Literpreis, monatliche/jährliche Ausgaben (21–27) |
| `timeline` | Erwerb, Erfassung, Öffnen, Leeren, Verbrauchsdauer, Verkostungsbewertung (28–34) |
| `quality` | Vollständigkeit, fehlende Angaben, WB-Verknüpfungen (35–38) |
| `insurance` | Bestand, Nachweisvollständigkeit, Kaufpreise und PDF-/ZIP-Export |

## Filter und Berechnung

Destillerie, Land, Flaschentyp und Status kombinieren sich auf **derselben physischen Flasche**. Filter werden über URL-Parameter erhalten. Für Finanzen und Entwicklung gelten optionale Tagesgrenzen (`Von`/`Bis`, native Datumsfelder), die **vor** monatlicher/jährlicher Aggregation wirken. Gesamtsummen bleiben von der Zeitbereichsfilterung unberührt. Diagramme und Ranglisten verlinken auf die jeweils passenden Ansichten.

- Bestand unterscheidet physische Flaschen und eindeutige Abfüllungen; eine leere Flasche zählt weiter zur inventarisierten **Nennmenge**. Fehlende ml-Angaben werden nicht addiert.
- Länder und Regionen stammen aus den beteiligten Destillerien. Bei Blends kann eine Abfüllung in mehreren Herkunftsgruppen erscheinen; Summen müssen deshalb nicht der Zahl unterschiedlicher Flaschen entsprechen.
- Originalabfüllungen werden anhand der Abfüllerbezeichnung bzw. der zugeordneten Destillerie bestimmt; uneindeutige Angaben werden nicht als unabhängige Abfüllung geraten.
- Finanzen zeigen dokumentierte **Anschaffungspreise**, keine Marktwerte. Unbekannte Beträge sind nicht null; unterschiedliche Währungen werden nie ohne Kurs konvertiert oder summiert. Literpreis nur bei bekanntem Preis **und** Volumen.
- Zeitreihen verwenden gültige Datumsfelder. Bewertungsstatistiken nutzen die **letzte datierte Verkostung je Abfüllung**; ist diese unbewertet, wird keine ältere Bewertung übernommen.
- Leere/fehlende Angaben erscheinen als Unbekannt/Empty State, nicht als `NaN` oder erfundener Durchschnitt. Qualitätskategorien können sich überlappen.

## Versicherungsdokumentation

Der Bereich betrachtet den aktuellen physischen Bestand unabhängig von den allgemeinen Analysefiltern. Leere Flaschen sind ausgeschlossen, Samples optional. Geöffnete und geschlossene Flaschen werden separat ausgewiesen. Die Anschaffungskosten werden nur bei bekanntem Kaufpreis und Währung je Währung summiert; es sind keine Markt- oder Wiederbeschaffungswerte.

Die Vollständigkeit erfordert Inventarnummer, Kaufpreis mit Währung, Kaufdatum, eigenes Originalfoto (keine Whiskybase-Referenz), ausdrücklich markierten Kaufnachweis und Lagerzuordnung. Die Schaltflächen bei den Kennzahlen filtern die Liste fehlender Angaben; der Flaschenlink führt zur jeweiligen Flasche. In den Flaschendetails lässt sich jeder Anhang als Kaufnachweis markieren oder die Markierung entfernen. Bestehende Anhänge bleiben zunächst unklassifiziert. Die Prüfung bewertet die erfassten Angaben, nicht deren Echtheit oder rechtliche Anerkennung.

Die Kurzübersicht als PDF enthält Stichtag, Bestand, Anschaffungskosten, Nachweisquoten und Aufschlüsselung nach Lagerräumen. Der Detailreport enthält zusätzlich die einzelnen Flaschen mit Kaufdaten, Lagerort, einem eigenen Originalfoto und Anhängenamen. Das ZIP enthält zusätzlich alle eigenen Originalfotos und Anhänge sowie `manifest.json` mit Zuordnung, Originaldateinamen und Dokumentprüfsummen. Es enthält keine Benutzerkonfiguration, Verkostungen oder Referenzbilder. Exporte entstehen lokal im Browser, PDF-Texte sind auswählbar und durchsuchbar (Flaschenfotos bleiben Bildobjekte; für Zeichen außerhalb der Standard-PDF-Schriften werden Unicode-zugeordnete lokale Glyphen eingebettet), ZIP-Pakete sind unverschlüsselt und auf 2 GiB bzw. 65.535 Einträge beschränkt; weniger verfügbarer Browserspeicher kann eine kleinere praktische Grenze bedingen. Fehlende oder nicht abrufbare Dateien brechen den betroffenen Export ab. Die Exporte ersetzen kein verschlüsseltes Backup.

## Umsetzung und Abnahme

`public/js/domain/analytics.js` berechnet, `public/js/views/analytics.js` rendert, `public/styles/analytics.css` gestaltet. Gemeinsame Panels und der Seitenrahmen kommen aus dem Designsystem. Tests: `tests/unit/analytics.test.js`, `tests/unit/analytics-origin.test.js`, `tests/unit/analytics-period.test.js` und `tests/browser/map-analytics.test.js`. Versicherungslogik: `public/js/domain/insurance.js`, Ansicht: `public/js/views/insurance.js`, Export: `public/js/features/insurance/`. iOS-spezifische native Datumsfelder brauchen reale Geräteprüfung.
