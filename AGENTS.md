# Projektregeln für KI und Mitwirkende

## Arbeitsgrundlage

- Vor jeder Änderung den **aktuellen** Repository-Stand prüfen. Keine älteren ZIPs, Patches oder Annahmen als Ersatz verwenden.
- Fachlogik, Datenformat, API und UI-Gestaltung nur ändern, wenn die Aufgabe es erfordert. Bei UI-Refactorings bestehendes Verhalten und beide Sprachen erhalten.
- Nur zentral dokumentierte Designsystem-Komponenten wiederverwenden; Spezialdarstellungen (Lager 2D/3D, Glencairn, Radar, Karte, Charts, Bildeditor) bleiben fachlich eigenständig. Siehe [Designsystem](docs/DESIGNSYSTEM.md).
- Bestätigungen ausschließlich als Anwendungsmodal, niemals per `window.alert/confirm/prompt`. Bei verschachtelten Modals Formularzustand, Fokus und Hintergrundscroll erhalten.

## JavaScript-Stil und JSDoc (verpflichtend)

- Für **JavaScript** gilt der [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html), nicht der Java-only-Guide. Dies gilt für **jeden neuen und geänderten JavaScript-Code**, einschließlich Tests, Server, Browser und Skripten.
- Einheitlich zwei Leerzeichen, Semikolons, einfache String-Anführungszeichen, `const`/`let`, konsistente ES-Module und klar benannte Funktionen. Keine automatische Änderung von HTML in Template-Literalen oder Fachlogik beim Formatieren.
- Vor dem Commit `npm run format:js` ausführen; `npm run check` (einschließlich `format:check` und `check:jsdoc`) muss grün sein. Der TypeScript-Formatter deckt mechanisch prüfbare Regeln ab; nicht automatisch überprüfbare Google-Regeln müssen beim Review kontrolliert werden.
- Neue exportierte Funktionen und Klassen brauchen **typisierte JSDoc-Verträge**: Zweck, `@param`, `@return` oder `@constructor`, und bei Bedarf `@throws`, Nebenwirkungen, Datenformat und Vertrauensgrenzen. In komplexen internen APIs ebenso; keine tautologischen Kommentare. Nicht jede triviale lokale Variable kommentieren.
- `scripts/jsdoc-legacy-baseline.json` enthält ausschließlich vorhandene nicht dokumentierte Export-Ausnahmen. **Neue Einträge sind verboten**; bestehende Ausnahmen bei Bearbeitung schrittweise durch gute JSDoc ersetzen.
- Für CSS/HTML/JSON die bestehenden Projektkonventionen nutzen; JavaScript-Formatierungsregeln nicht blind darauf übertragen.

## Dokumentation: verpflichtende Prüfung bei jeder Änderung

1. Jede Änderung darauf prüfen, ob sie Bedienung, Datenformat, API, Konfiguration, Installation, Sicherheit, Tests oder Entwicklerabläufe betrifft.
2. Betroffene **aktuelle** Markdown-Dokumente **im selben Commit/PR** aktualisieren; Dateien nicht mit Änderungsnotizen erweitern. Für rein historische Information ist **ausschließlich `CHANGELOG.md`** zuständig.
3. Ist keine Dokumentationsänderung nötig, ausdrücklich begründen: Commit-Footer `Docs-Impact: none - <konkreter Grund>` oder bei PRs im PR-Text dieselbe Zeile. Der CI-Dokumentationscheck erzwingt Änderung **oder** begründete Ausnahme bei relevanten Codeänderungen.
4. `README.md` beschreibt Funktionen und Einstieg; `docs/ARCHITEKTUR.md` Architektur, `docs/API.md` API, Fachdokumente den aktuellen Funktionsstand, `docs/TESTSTATUS.md` nur den zuletzt **nachweislich** geprüften Stand. Keine Testzahlen aus älteren Zwischenständen übernehmen.
5. `npm run check` prüft Links, Dokumentstruktur und ausgewählte aktuelle Schema-/Versionsverträge. Automatische Prüfungen ersetzen nicht den fachlichen Abgleich mit dem Code.
6. Historische Beispiele sind **nur hier im KI-Harness** zulässig, wenn sie eine aktuell gültige Regel verdeutlichen: Ein automatischer Punkt hinter einem nutzergegebenen Abfüllungsnamen ist unzulässig; `pageHeader({period:false})` muss wirksam sein. Eine Modal-Größenvariante muss Vorrang vor generischem `wide` haben. Solche Beispiele nicht als Fachhistorie in andere Dokumente kopieren.

## Tests und Abnahme

- `npm run check`, `npm test` und bei UI-Arbeit `npm run test:browser` ausführen; für Geometrie/Layout zusätzlich `npm run test:visual`. Fehlende Abdeckung klar kennzeichnen; CI-Grün nicht behaupten, solange sie nicht bestätigt ist.
- Bevor Tests angepasst werden, Verhalten gegen den erwarteten Vertrag prüfen; Assertions nicht bloß lockern, damit sie grün sind.
- Visuelle CI-Prüfung: **Geometrie, Überlauf und Interaktionen blockieren**, Pixelabweichungen sind derzeit reine Diagnosen (Referenzen/CI haben unterschiedliche Chromium-Versionen). `npm run test:visual:strict` nur nach bewusster Freigabe passender Browser-Baselines einsetzen. Bei Referenzänderungen Baselines **nur bewusst** mit `npm run visual:update` aktualisieren; keine automatischen Überschreibungen bei Fehlern.
- Mobile Formulare auch bei schmalen Viewports prüfen. Chromium ist kein Ersatz für echte iOS-/Android-Geräte.

## Git, Versionierung, Release

- Einzelne Änderungen auf `develop` ändern die Versionsnummer **nicht**. Conventional Commits verwenden (`fix:`, `feat:`, `docs:`, `refactor:`, `test:`; inkompatibel: `!`/`BREAKING CHANGE:`).
- Pro Checkout `npm run hooks:install` installiert die optionale lokale Commit-Prüfung; GitHub prüft unabhängig davon.
- `main` ist geschützter Standardbranch, `develop` Integrationsbranch. Der **manuell freigegebene Merge** `develop -> main` startet den Releaseprozess; nur ein vom Workflow erzeugter, geprüfter Versions-PR darf durch den Bot automatisch gemergt werden. Nie Entwicklungs-PRs automatisch mergen.
- `npm run release:bump` nicht für Entwicklungsarbeiten ausführen. Weitere Details: [Release-Workflow](docs/RELEASE_WORKFLOW.md).
