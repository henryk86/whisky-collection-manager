# Analyse und Statistiken

Die Hauptnavigation enthält **Analyse** (`/?view=analysis`). Das Dashboard führt zu sechs Unterseiten:

| Unterseite | URL-Parameter `section` | Auswertungen |
| --- | --- | --- |
| Dashboard | nicht gesetzt / `overview` | Kennzahlen, Flaschenstatus, Rangliste, Bereichskarten |
| Sammlungsbestand | `inventory` | 1–6 |
| Herkunft & Destillerien | `origins` | 7–12 |
| Whiskyprofil | `profile` | 13–20 |
| Finanzen | `finance` | 21–27 |
| Entwicklung & Verkostung | `timeline` | 28–34 |
| Datenqualität | `quality` | 35–38 |

Die zentrale Auswertung liegt in `public/js/domain/analytics.js` (reine Berechnungen). Die Darstellung in `public/js/views/analytics.js` wird durch `public/styles/analytics.css` gestaltet. Die bestehende Sammlung (`schemaVersion: 4`) wird nur gelesen; weder Datenmigration noch neue serverseitige Abhängigkeiten sind erforderlich.

## Filter und Navigation

Gemeinsame Filter nach Destillerie, Land, Flaschentyp und Flaschenstatus gelten für alle Unterseiten. Filterkombinationen müssen sich auf **dieselbe physische Flasche** beziehen; die Abfüllung zählt nur einmal. Der Zustand wird als Query-Parameter gespeichert, sodass Links direkt geöffnet und nach F5 wiederhergestellt werden können. Die Seiten bleiben auch ohne vorhandene Datensätze nutzbar. Das Zurücksetzen löscht die Analysefilter und die Zeitbegrenzung. Auf **Finanzen** und **Entwicklung/Verkostung** gibt es zusätzlich eine zeitliche Gruppierung (**monatlich** oder **jährlich**) und die beiden Grenzen **„Von“** und **„Bis“**. Jede Grenze ist **ein einzelnes natives Datumsfeld** (`<input type="date">`, intern `JJJJ-MM-TT`) und auf kleinen Bildschirmen gleich breit und gleich hoch wie der Zeitraum-Selektor dargestellt. Die Grenzen wirken **tagegenau auf die zugrunde liegenden Kauf-, Erfassungs- und Öffnungsdaten**, bevor diese für die Darstellung nach Monat/Jahr gruppiert werden. Ein leeres Feld hebt die jeweilige Grenze auf; nur gültige Kalenderdaten werden berücksichtigt. Zeitgrenzen betreffen die **Zeitreihen**, nicht die Gesamtsummen der Sammlung. Die Datumsfelder verwenden gemeinsame Safari-kompatible Größenregeln (insbesondere `appearance: none`, `border-box`, linksbündige Datumswerte) mit einem nativen Kalenderdialog. Ein realer iOS-Gerätetest ist weiterhin offen.

Klickbare Destillerien übertragen die Destillerieauswahl zur Sammlung; Status und Samples ebenso. Länder in der Herkunftsverteilung filtern den Analysebereich. Flaschenrankings verlinken auf die bestehende Abfüllungsdetailseite mit hervorgehobener Flasche. In der Datenqualität führt „Ansehen“ beispielhaft zu einem betroffenen Datensatz.

**Links in Diagrammen und Tabellen** erscheinen standardmäßig ohne Unterstreichung; bei Hover oder Tastaturfokus werden sie erkennbar hervorgehoben. Für alle klickbaren Analyse-Elemente gilt derselbe Stil. Bei Top-Destillerien löst ein Hover über die gesamte Zeile die Unterstreichung des Destilleriennamens aus, auch beim letzten Eintrag.

## Kennzahlen und Bedeutung

- **1–6 Bestand:** unterschiedliche Abfüllungen, physische Flaschen, Status (geschlossen/geöffnet/leer), Standardflaschen/Samples, beteiligte Destillerien, Summe der **Nennfüllmengen**. Leere Flaschen zählen zur inventarisierten Nennmenge; nur Mengen mit gültiger ml-Angabe werden addiert und ihre Datenabdeckung ausgewiesen.
- **7–12 Herkunft:** Top-Destillerien nach physischen Flaschen und Abfüllungen, Länder, Regionen, Whiskytypen und Abfüllertyp. Bei mehreren Destillerien wird eine Abfüllung/Flasche jeder beteiligten Destillerie zugerechnet. **Herkunftsland und Whiskyregion stammen von den beteiligten Destillerien** (`distillery.country`/`distillery.region`) und nicht von den früher manuell gepflegten Abfüllungsfeldern. Eine physische Flasche kann bei einem länderübergreifenden Blend mehreren Ländern zugeordnet sein; innerhalb desselben Landes bzw. derselben Region wird sie nur einmal gezählt. Die Balkensummen können entsprechend höher sein als der Flaschenbestand.

Die Referenzliste enthält für **alle 450 Destillerien** ein Herkunftsland, die schottischen Einträge explizit als **Schottland** (nicht UK/GB). Für 287 der 292 schottischen Referenzdestillerien ist die Whiskyregion (Highland, Lowland, Speyside, Islay oder Campbeltown) hinterlegt; historische oder nicht eindeutig regionale Standorte bleiben ohne Regionszuordnung. Bestehende Sammlungen erhalten fehlende Katalogangaben beim Laden durch eine idempotente Migration. Eigene Koordinaten, Status- und konkrete Herkunftsangaben werden dabei nicht überschrieben; generische UK-/GB-Länderwerte bekannter schottischer Destillerien werden zu „Schottland“ korrigiert. Bei nicht zuordenbaren Bestandsdaten wird eine ältere Herkunftsangabe der Abfüllung lediglich als Kompatibilitätsfallback angezeigt. Neue Abfüllungen erfordern **keine manuelle Herkunftsangabe**.

**Originalabfüllung:** „Distillery Bottling“ (unabhängig von Groß-/Kleinschreibung und Leerzeichen), „Original Bottling“, „Originalabfüllung“ oder ein Abfüller, der namentlich einer zugeordneten Destillerie entspricht, zählt als Originalabfüllung. Andere Namen sind ohne weitere Informationen **nicht eindeutig**, nicht automatisch als unabhängig klassifiziert.
- **13–20 Profil:** Altersklassen inklusive NAS/unbekannt, Durchschnitt/Minimum/Maximum (nur bekannte Alter), ABV-Klassen und Kennzahlen, Destillations- und Abfülljahre, originale Fasstypangaben sowie dokumentierte limitierte Auflagen. Das Erscheinungsjahr wird **nicht** als Abfülljahr behandelt. Gruppierungsbasis ist die unterschiedliche Abfüllung, nicht die physische Flaschenanzahl.
- **21–27 Finanzen:** bekannte Kaufpreise, Preisstatistiken, Summen nach Destillerie, Monats-/Jahresausgaben, teuerste Flaschen **je Währung**, Literpreis sowie Händler. Fehlende Preise werden **nicht** als 0 gewertet; fehlende Währungen werden ausdrücklich separat ausgewiesen, und unterschiedliche Währungen nie automatisch summiert. Literpreis = Summe der bekannten Kaufpreise für Flaschen mit ebenfalls bekannter physischer Größe, geteilt durch deren Gesamtvolumen in Litern. Kaufdatum fehlt: der Kauf zählt in die Gesamtsumme, nicht aber in die Zeitreihe. Händlerstatistik basiert nur auf Käufen mit Preisangabe.
- **28–34 Entwicklung & Verkostung:** erfasste, gekaufte und geöffnete Flaschen nach Monat/Jahr anhand von `createdAt`, `purchaseDate` bzw. `openedAt`. Bewertungen beziehen sich auf die physischen Flaschen (0–100). Durchschnitt nur aus vorhandenen Bewertungen; Destillerie-Mittelwerte ordnen Bewertungen bei mehrdestilligen Abfüllungen allen Destillerien zu. Mindestens ein gefülltes Tasting-Feld zählt als Verkostungsnotiz.
- **35–38 Datenqualität:** gespeicherter Vollständigkeitsstatus der Abfüllungen, fehlende Stammdaten je Feld (Herkunft und schottische Whiskyregion aus den Destilleriedaten), vorhandene WB-ID/URL sowie fehlende Preis-, Kaufdatum- und Bewertungsangaben pro physischer Flasche. Jede fehlende Eigenschaft wird separat gezählt, sodass sich Balken **nicht** zu 100 % summieren müssen.

## Umgang mit fehlenden Daten

Nicht erfasste Werte werden als unbekannt gekennzeichnet oder von einem Mittelwert ausgenommen. Bei Auswertungen ohne Daten erscheint eine verständliche Leeranzeige, kein `NaN`. Die Finanzwerte sind Anschaffungskosten, **keine Marktwertschätzung**. Zeitreihen umfassen nur gültige **tagegenaue** Datumsangaben; die Monats-/Jahresaggregation erfolgt erst nach der Von-/Bis-Filterung. Währungskurse werden nicht angenommen. Die Darstellung folgt dem bestehenden Light-/Dark-Theme und ist responsiv.

## Qualitätssicherung

Die Unit-Tests liegen in `tests/unit/analytics.test.js`, `tests/unit/analytics-origin.test.js` und `tests/unit/analytics-period.test.js`. Der Browser-Regressionstest liegt in `tests/browser/app.test.js`; er muss in GitHub Actions mit Playwright ausgeführt werden. Der aktuelle Ergebnisstand ist in [TESTSTATUS.md](TESTSTATUS.md) dokumentiert.

**Layout ab v0.15.0:** Die Seite nutzt die volle Inhaltsbreite des gemeinsamen `main` (wie Sammlung, Einstellungen und Landkarte) ohne zusätzliche horizontale Seitenränder im `.analytics-page`-Wrapper.
