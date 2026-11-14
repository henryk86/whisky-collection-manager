# Entwicklung

## Schnellstart

```bash
npm start               # npm ci bei Bedarf, cutout:prepare, lokale TLS-Ersteinrichtung, Server
```

Der Starter liegt in `scripts/start.js`. Er vergleicht die installierten npm-Pakete mit `package-lock.json` und installiert nur fehlende oder abweichende Versionen; `scripts/prepare-cutout-assets.js` prüft die ONNX-/WASM-Dateien vor jedem Serverstart. Eine fehlende `.env` wird beim lokalen Erststart aus `.env.example` übernommen; bei fehlenden Standard-TLS-Dateien wird `scripts/setup-https.js` verwendet (benötigt `mkcert` oder OpenSSL). Individuelle Zertifikatspfade werden nie überschrieben. Ein Fehler beim Installieren oder Vorbereiten verhindert den Serverstart. `npm start` ist kein CI-Lauf und führt weder `npm run verify` noch Browser-Tests aus; diese gehören vor einen Merge.

Die Anwendung startet ohne Frontend-Build. `npm run dev` verwendet den Node-Watch-Modus für den Server und setzt eine vorherige Vorbereitung durch `npm start` voraus; Frontend-Änderungen durch Neuladen im Browser anzeigen. Die Standardkonfiguration aktiviert ausschließlich HTTPS auf 3543. Tests starten ihre eigenen kurzlebigen Server, Ports und Datenverzeichnisse und ändern nicht die produktive Sammlung.

## Konventionen

1. Eine Datei hat eine erkennbare Verantwortung. Funktionen und lokale Variablen beschreiben fachliche Begriffe (`bottling`, `bottle`, `inventoryNumber`) statt technische Abkürzungen. `bottling` und `bottle` sind nicht austauschbar.
2. Fachregeln gehören in `server/domain/`, Anwendungsfälle in `server/services/`, HTTP-Zuordnung in `routes.js`. Keine Dateischreibzugriffe in Routen oder Browsercode.
3. Persistente Änderungen erfolgen über `change()`. Vor jedem Commit wird das Gesamtdokument validiert. Niemals nur im Formular validieren.
4. Benutzertexte vor HTML-Ausgabe mit `escapeHtml()` oder der HTML-Template-Uebersetzung `tHtml()` behandeln. **Bei Umstellung von `t()` auf `tHtml()` bereits vorhandenes `escapeHtml()`/`safe()`/`h()` am uebergebenen Parameter gleichzeitig entfernen**, damit `&` nicht doppelt zu `&amp;amp;` maskiert wird. `tHtml()` ausschliesslich in HTML-Templates verwenden; fuer reine Textkontexte bleibt `t()` richtig. Sichtbare Texte im deutschen Sprachkatalog `public/locales/de.json` pflegen; Codebezeichner und technische Kommentare sind englisch. Dynamische Eigennamen (`data-i18n-ignore`) und Benutzerdaten nicht automatisch übersetzen.
5. Abhängigkeiten über klare Parameter an Controller übergeben. Keine gegenseitigen Modulimporte als versteckte Initialisierungsreihenfolge. Keine globalen neuen Browservariablen für Fachlogik.
6. Fachliche Fehler bekommen einen passenden HTTP-Status über `fail()`. Unerwartete Fehler werden zentral protokolliert, nicht mit Stacktrace an den Browser geliefert. UI zeigt fehlgeschlagene Aktionen sichtbar an.
7. Kein unnötiger Framework-/Bibliothekswechsel im selben Commit wie ein Bugfix. Neue Abhängigkeiten begründen, Version und Lockfile gemeinsam aktualisieren.

Vier Leerzeichen in JavaScript, UTF-8, LF-Zeilenenden, geschweifte Klammern auch bei einzeiligen Bedingungen. `.editorconfig` legt die Basis fest. Kommentare erklären insbesondere Randfälle und Entscheidungen, nicht jede offensichtliche Zuweisung.

## GUI-Sprache und gemeinsames Seitenlayout

`public/locales/de.json` enthält ausschließlich **stabile, benannte Schlüssel** (z. B. `common.actions.save`, `warehouse.selection.count`) mit deutschen Texten. `public/js/i18n/index.js` importiert diesen Basiskatalog direkt, lädt zusätzliche Sprachen aus `public/locales/index.json` und bietet `t(key, params)` an. Die GUI erzeugt sichtbare Beschriftungen direkt über diese Schlüssel; es gibt **keine DOM-Textsuche, Textmusterübersetzung oder MutationObserver-Nachübersetzung** mehr.

Beispiel:

```js
t('warehouse.selection.count', {selected: 2, total: 5}); // 2 von 5 ausgewählt
```

Englisch ist mit `public/locales/en.json` vollständig enthalten und in `public/locales/index.json` registriert. Weitere Sprachen mit **denselben Schlüsseln** als zusätzliche JSON-Datei ablegen und registrieren. Fehlende übersetzte Schlüssel fallen auf Deutsch zurück; vom Benutzer angegebene Bezeichnungen wie Raum-, Whisky- und Destillerienamen bleiben davon unberührt. `{count}` bzw. `{name}` sind benannte Parameter; ein begrenzter ICU-Pluralformat-Teil (`{count, plural, one {# Flasche} other {# Flaschen}}`) wird mittels `Intl.PluralRules` unterstützt. Beim Sprachwechsel über Einstellungen lädt die App neu, sodass alle dynamischen Ansichten konsistent neu aufgebaut werden.

**Schlüsselkonvention (ab v0.15.2):** Jeder Key benennt die fachliche Funktion auf Englisch, nicht die deutsche Beschriftung. Beispiele: `analytics.quality.title`, `backups.restore.confirmReplaceCollection`, `warehouse.furniture.types.cabinet`. Neue Kennungen müssen stabil und sprachneutral sein. Bei gespeicherten Möbeltypen, Frontarten und Kamerarichtungen erfolgt der Zugriff über explizite Lookup-Tabellen (`FURNITURE_TYPE_KEYS`, `FRONT_KEYS`, `CAMERA_KEYS`, `ROOM_SECTION_KEYS`); ein Übersetzungsschlüssel darf nicht durch Stringverkettung zusammengebaut werden. Methoden der Browser-History, Dateipfade und technische Konstanten sind **keine** UI-Übersetzungen. `npm run check` erkennt fehlende und automatisch erzeugt wirkende Schlüssel sowie verbotene Stringverkettungen.

**Verbindliche Konvention:** Keine neuen deutschen GUI-Literale in Views, Formularen oder Benachrichtigungen; neue Texte in `de.json` mit fachlichem Schlüssel ergänzen und `t()` nutzen. Benutzerinhalte weiterhin vor HTML-Injektion mit `escapeHtml()` absichern. Übersetzungen aus Dateikatalogen sind statische UI-Ressourcen und sollten keine HTML-Tags enthalten. `npm run check` prüft referenzierte Schlüssel, Schlüsselformat und die Platzhalter in zusätzlichen Sprachdateien. Für serverseitig generierte API-Fehler ist eine spätere Erweiterung mit stabilen API-Fehlercodes sinnvoll; bisherige Fehlertexte aus dem Backend bleiben unverändert und werden nicht über deutsche Satzmuster übersetzt.

Bei Browser-Layouttests ist die effektive Breite des Body-Layoutbereichs (`document.body.getBoundingClientRect().width`) ausschlaggebend. **Nicht** `body.clientWidth`, `innerWidth` oder `document.documentElement.clientWidth` verwenden: bei dauerhaft reservierter Scrollbar-Spur koennen diese die volle Fensterbreite melden, obwohl der Body-Layoutbereich schmaler ist. Horizontalen Ueberlauf als `document.body.scrollWidth - document.body.getBoundingClientRect().width` messen (bis 1 px Rundung tolerieren). Der Regressionstest haengt einen 8 px breiteren **in-flow**-Block an den Body; eine absolut positionierte Testflaeche kann in einzelnen Browsern die gemessene Body-Scrollbreite nicht vergroessern. Fixierte Seitenleisten gegen ihren Backdrop positionieren, nicht pauschal gegen `innerWidth`.

GUI-Beispielaufnahmen fuer die README liegen unter `docs/images/`. Sie duerfen
nur mit Demo- oder Testdaten erstellt werden. Neue Screenshots sollten die
aktuelle Oberflaeche zeigen; die Test-Screenshots unter `test-artifacts/`
sind nur temporaere Pruefartefakte und werden nicht als dauerhafte
README-Links verwendet. Beim 3D-Raumplan den initialen Kamera-Ausschnitt
auch auf einem echten WebGL-Browser visuell pruefen.

Die Breite aller Hauptseiten wird allein vom gemeinsamen `main` in `public/styles/core.css` bestimmt. `.analytics-page` wird sowohl bei **Analyse** als auch bei **Lager** verwendet und darf keine zusätzlichen horizontalen Innenabstände oder eigene Maximalbreite bekommen. Bei Änderungen den Browser-Test für Desktop und Mobil ausführen.

## Tests

`npm test` entdeckt alle `*.test.js` unter `tests/unit/` und `tests/integration/` mit Node-eigenem Test-Runner. Keine Bash-Globs, damit derselbe Aufruf auch unter Windows funktioniert. OpenSSL ist für den TLS-Integrationstest erforderlich; ohne OpenSSL wird dieser Test explizit ausgelassen.

`npm run check` prüft JavaScript-Syntax, statische relative ES-Modulimporte, Übersetzungsschlüssel und lokale Markdown-Links. Es meldet fehlende Zieldateien, Importzyklen und nicht auflösbare Dokumentationslinks. Es ist **kein** vollständiger Linter, TypeScript-Compiler oder Security-Audit. JSDoc in `shared/types.js` dokumentiert das Datenmodell, erzwingt aber keine statische Typprüfung.

Browser-Tests:

```bash
npx playwright-core install chromium
npm run test:browser
```

Ein vorhandenes Chromium kann durch `PLAYWRIGHT_EXECUTABLE_PATH` gewählt werden. Unter Linux sind ggf. Systembibliotheken für Chromium erforderlich (`npx playwright-core install --with-deps chromium`). Screenshots landen in `test-artifacts/`, nicht im Repository.

Die Browser-Tests legen Abfüllungen an, bearbeiten Flaschen, laden Fotos hoch, schalten Themes um und prüfen Scan-Navigation sowie den Formular-Rückweg. Der Decoder wird kontrolliert ersetzt: getestet wird das Verhalten **nach** einer Erkennung, nicht das optische Lesen eines echten Etiketts.

Für verwaltete Umgebungen, die jede Top-Level-URL im Browser blockieren, gibt es den ausdrücklichen Schalter `WHISKY_BROWSER_DOM_ONLY=true`. Nur dort werden die HTML-Seite und echte Module in einen leeren Browser-DOM geladen und History-Aufrufe durch eine Testaufzeichnung ersetzt. Der echte Back-/Forward-/Reload-Test wird in diesem Modus als ausgelassen gemeldet. Nicht mit einem normalen End-to-End-Test verwechseln; lokal und in CI ist dieser Modus standardmäßig **aus**.

## Neue Funktion testen

Ein Bugfix sollte zuerst einen Test bekommen, der mit dem alten Verhalten scheitert. Reine Stringsuche im Quellcode beweist keine Funktion. Für Zuordnung/Formatierung reine Funktionen testen; für persistente Regeln einen isolierten API-Server; für Formular-/DOM-Verhalten einen Browser-Test.

Für neue Datenfelder Normalisierung, Laufzeitvalidierung, JSDoc, Formular, Import/Export und gegebenenfalls Migration gemeinsam betrachten. Besonders: UUIDs und Inventarnummern nicht verlieren; alte Daten sichern; Flaschen nicht aus ihrer Abfüllung herauslösen.

## GitHub

`.github/workflows/check.yml` ist für Syntax-/Modulprüfung, Unit-/Integrationstests und Browser-Tests eingerichtet. Der Workflow wurde in dieser Umgebung nicht auf GitHub ausgeführt. Keine `.env`, privaten Zertifikate, Sammlungsdaten oder Fotos committen. `package-lock.json` dagegen mit einchecken.


## Analyse weiterentwickeln

Neue Auswertungen gehören als reine Funktionen in `public/js/domain/analytics.js`, die zugehörige Darstellung in `public/js/views/analytics.js`, Styles in `public/styles/analytics.css`. Daten werden nicht verändert. Separate Tests (`tests/unit/analytics.test.js`) sichern Filterkombinationen, Währungstrennung und fachliche Kennzahlen. Details: [ANALYSE.md](ANALYSE.md).

Die Zeitreihen werden in der Anzeige nach Monat/Jahr aggregiert, ihre beiden **Datumsgrenzen** jedoch nach tatsächlichem Tag angewandt. `analytics-period.js` prüft das Eingabeformat, `analytics.js` stellt tägliche Reihen bereit und `analytics.css` begrenzt native Datumsfelder insbesondere für schmale Viewports. Nach Änderungen an Zeitfiltern nicht nur Unit-Tests, sondern die Browser-Regression zu Von/Bis und die responsive Eingabeprüfung ausführen. Ein Test mit echter iOS-/Android-Hardware ist nicht durch Chromium-Emulation ersetzt.


## Lagerverwaltung weiterentwickeln

Für Lagerfunktionen `server/storage/warehouse-store.js`, `server/domain/warehouse-fields.js`, `server/services/warehouse.js`, `public/js/views/warehouse.js`, `public/js/views/warehouse-presentation.js` und `public/styles/warehouse.css` beachten. Pure Geometriemodule in `public/js/domain/warehouse-compartments.js` und `warehouse-placement.js` werden von Browser **und** Server importiert; DOM-/Netzwerkabhängigkeiten dort vermeiden. Separates Datenformat unter `data/warehouse.json`, keine neuen Lagerfelder in `collection.json` einführen. Tests: `tests/integration/warehouse.test.js`, `tests/unit/warehouse-ui.test.js`; API-/ZIP- und UI-Regressionsprüfungen durchführen. Details: [LAGER.md](LAGER.md).

### Sprach-Regressionstests

Neue GUI-Beschriftungen müssen in beiden Katalogen (`public/locales/de.json`, `public/locales/en.json`) stehen und beim Rendering über `t(key, params)` aufgelöst werden. `tests/unit/i18n-render-english.test.js` prüft echtes englisches HTML aus Sammlung, Analyse, Lager und Möbelformular. Der Chromium-Test `complete English locale renders collection controls and analytics filters` prüft die reale Sprachdatei in der Oberfläche. Gespeicherte Raum-, Möbel- und Whiskynamen bleiben unverändert. Backend-Fehlermeldungen benötigen perspektivisch übersetzbare Fehlercodes.

## Dokumentationspflege

- `README.md` ist ein kurzer Einstieg, **kein** Sammelplatz für changelogartige Funktionsnachträge. Technische Modulgrenzen stehen in [ARCHITEKTUR.md](ARCHITEKTUR.md), Verhalten in [ANFORDERUNGEN.md](ANFORDERUNGEN.md) und den Fachdokumenten.
- `docs/TESTSTATUS.md` beschreibt nur den aktuell geprüften Release; ältere Protokolle bleiben in `docs/TESTHISTORIE.md`.
- Der Codecheck ruft `scripts/check-docs.js` auf. Er überprüft relative Markdown-Ziele, aber keine externen URLs oder die Semantik von Überschriften.
- Bewusst verbleibende technische Schulden und nicht ohne Funktionstest mögliche Umbauten stehen in [TECHNISCHE_SCHULDEN.md](TECHNISCHE_SCHULDEN.md).

## Security-Regressionen (v0.15.10)

`tests/integration/security-review.test.js` prueft JSON-Medientypen,
CSRF-/Host-Abwehr, HTML-Sicherheitsheader und ungueltige Pfade.
`tests/unit/security-review.test.js` prueft CSV-Formeln, Extension-Allowlist,
HTML-Parameterescaping und Streamfehler. Bei neuen schreibenden Endpunkten
`readJson()` und die gemeinsame `request-security.js`-Sperre verwenden.
Bei neuen externen Ressourcen die CSP in `server/http/static-files.js`
und deren Anbieterbedingungen pruefen. Die Anwendung bleibt ohne Login.
Der Scrollbar-Browser-Test muss klassische Scrollbars sehen oder sich
explizit ueberspringen; `--hide-scrollbars` darf nicht verwendet werden.

## KI-Freistellung von Flaschenfotos

Siehe [PHOTO_FREISTELLUNG.md](PHOTO_FREISTELLUNG.md). `public/js/features/cutout/` berechnet die Masken ausschließlich im Browser. `server/services/bottles.js` speichert lediglich geprüfte PNG-Ableitungen; eine externe KI-API gibt es nicht. Bei Änderungen an Modell-Vorverarbeitung und Maskierung Referenzbilder und die Modelldateien in einem echten Browser prüfen. Offline-Testläufe ohne Modell sind kein Nachweis korrekter KI-Ausgabe.
