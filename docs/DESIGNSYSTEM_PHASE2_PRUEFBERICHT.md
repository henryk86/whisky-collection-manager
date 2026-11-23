# Prüfergebnis Designsystem Phase 2

**Prüfbasis:** `WCM_Phase1_Projekt.zip` (bereitgestelltes Phase-1-Gesamtprojekt) und für visuelle Quervergleiche die Phase-0-Referenzscreenshots vom 23.11.2026. Synthetische, temporäre Testdaten; keine produktiven Daten geändert. Projektversion `1.12.0` unverändert.

## Statische und funktionale Tests

| Prüfung | Ergebnis | Einschränkung |
|---|---|---|
| `npm run check` | Bestanden | Syntax, Übersetzungsreferenzen, Architektur- und Dokumentationschecks |
| `npm test` (vollständig) | **678/678 bestanden** | Nach Anpassung historischer HTML-Strukturerwartungen an den neuen Komponentenvertrag |
| Neue Unit-Tests für PageHeader, SectionHeader, BackNavigation, HeaderActions, HelpIconButton | **5/5 bestanden** | Escaping, Klassenverträge, getrennte Icons, Disabled-State, Sprachen |
| Neue Browser-Regressionstests `designsystem-headers.test.js` | **4/4 bestanden** | Echte Bounding-Boxes und berechnete Abstände bei 390, 768, 1024, 1440px und zwei Themes, Flight-Hilfe, de/en |
| Gezielter Kartentest `map-analytics.test.js` | **1/1 bestanden** | Alte direkte `.btn`-Suche im Header auf zentrale Zurücknavigation umgestellt |
| Vollständige Browser-Suite vor Aktualisierung des Kartentests | **126 bestanden, 3 fehlgeschlagen, 1 übersprungen (130 gesamt)** | Fehler: zwei bereits in Phase 1 lokal beobachtete konkurrierende Submit-Timeouts und eine veraltete Selektor-Erwartung im Kartentest. Der Kartenfall wurde korrigiert und separat grün nachgetestet; vollständiger Gesamtlauf danach nicht wiederholt. |

**Transparenz:** Die zwei Submit-Timeouts stammen aus einer Testumgebung mit DOM-only-Chromium und einer extern bereitgestellten Playwright-Laufzeit; sie waren bereits auf dem unveränderten Ausgangscode in der vorherigen Phase reproduziert worden. Der 30-s-Wartefehler auf verschwindende Formulare betrifft keine in Phase 2 veränderte Formular- oder Geschäftslogik. Eine **vollständig grüne Browser-Gesamtsuite auf regulärer CI-Laufzeit** kann hier nicht behauptet werden. Die neue spezifische Regression ist behoben und gezielt nachgewiesen.

## Visuelle Prüfung

| Quelle | Abdeckung | Ergebnis |
|---|---|---|
| Phase-1-Basis (direkter identischer Testdatensatz) | 5 Zustände × 4 Breiten × 2 Themes = **40 Vorher/Nachher-Paare** | **32 pixelidentisch**; nur **8** Screenshots der Einstellungen unterscheiden sich durch die neue Pfeil-SVG-Darstellung des Rückbuttons. Kein horizontaler Überlauf, keine JS-Seitenfehler. |
| Phase-0-Referenzen (unabhängig generierter synthetischer Datensatz) | **11 Ansichten/Zustände × 2 Breiten × 2 Themes = 44 neue Screenshots**; 40 davon besitzen gleichnamige Phase-0-Referenzen | **27 der 40 direkt vergleichbaren Aufnahmen pixelidentisch**. Weitere Unterschiede lokal auf beabsichtigte Header-/Navigationsicons, Aktionsbereiche oder einen Hoverzustand der Lagerbereichsnavigation begrenzt; kein horizontaler Überlauf, keine JS-Seitenfehler. |

**Explizit behobene Abweichungen:**

- Der mobile Zurück-Button hatte durch das SVG zunächst zusätzlichen Platz beansprucht und die Einstellungsüberschrift eingeengt. Die bestehende kompakte Aktionsbreite (99px) ist wiederhergestellt.
- Die Einführung des später geladenen `headers.css` überschattete im Detail-Header den fachspezifischen `12px`-Flexabstand mit `14px`. Die fachliche Regel hat jetzt eine eindeutige Variantenbindung; dadurch sind **alle acht** Abfüllungsdetail-Screenshots bei vier Breiten und zwei Themes erneut **pixelidentisch** zur Phase-1-Basis. Ebenso sind die erneut geprüften vier Phase-0-Abfüllungsdetail-Referenzen pixelidentisch.

Die 44 neuen Aufnahmen (40 direkte Phase-0-Quervergleiche) decken u. a. Sammlung, Abfüllungsdetails, Verkostungsliste, -detail und -editor, Analyse, Einstellungen, Lager, Karte, Hilfe sowie den Dialog für eine neue Flasche ab. Für die vier neuen Hilfeansicht-Aufnahmen fehlen gleichnamige Phase-0-Dateien; sie wurden auf Rendering- und Überlaufprobleme geprüft, nicht pixelweise verglichen. Der Flight-Planungsdialog wurde zusätzlich als Interaktion und anhand seiner gemessenen Titel-/Hilfeicon-Zentrierung geprüft.

## Restliche Risiken

- Chromium-DOM-only-Browserläufe ersetzen nicht Safari auf iOS, Android-Chrome oder WebGL-/Scanner-Geräteprüfungen.
- Spätere CSS-Phasen dürfen die gebundenen Fachvarianten nicht ungeprüft auf generische `.section-head`-Styles zurücksetzen.
- Andere fachliche, sehr spezielle Dialoge sind nicht einzeln visuell mit identischen Testdaten nachgestellt. Der gemeinsame Dialog-Host ist getestet; eine vollständige Modal-Matrix gehört zur weiteren Regression.

Diese Aussagen beschreiben den tatsächlich ausgeführten Prüfumfang; offene Tests gelten **nicht** als bestanden.
