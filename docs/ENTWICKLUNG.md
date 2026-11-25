# Entwicklung

## Schnellstart

Node.js ≥ 20. `npm start` startet den Setup-/Starthelfer; `npm run dev` startet den Node-Server im Watch-Modus. Für Browser-Tests zusätzlich Chromium installieren:

```bash
npm ci
npm run check
npm test
npx playwright-core install --with-deps chromium
npm run test:browser
npm run test:visual
```

`npm run hooks:install` installiert optional die lokale Commit-Nachrichtenprüfung. npm-Abhängigkeiten und Modelldateien können beim erstmaligen Setup Internetzugang benötigen. Die Anwendung nutzt native Browser-ES-Module ohne Frontend-Build.

## Wo ist die Änderung richtig?

- UI-Views und Ereignisse: `public/js/views/`, `public/js/events.js`; Zuständigkeiten des Designsystems in [Designsystem-Entwicklung](DESIGNSYSTEM_ENTWICKLUNG.md).
- API und serverseitige Anwendungsfälle: `server/routes.js`, `server/services/`, `server/domain/`; JSON-Zugriff: `server/storage/`.
- Domänenreine Logik: `shared/` und `public/js/domain/`; kein DOM in `shared/`.
- Sprachtexte: `public/locales/de.json` und `en.json`, im Renderer `t(key)`; Benutzereingaben für HTML escapen, keine fest einkodierten deutschen GUI-Texte.
- CSS: gemeinsame Komponenten/Tokens unter `public/styles/`, Fachstile nur für spezielle Ansichten. Den äußeren Seitenrahmen nicht pro Fachansicht redefinieren.
- Lager: `server/services/warehouse.js`, `public/js/views/warehouse.js`, `public/js/views/warehouse-presentation.js`, `public/styles/warehouse.css`.

Fehlerfälle zuerst anhand der tatsächlich gerenderten Oberfläche oder API nachstellen. Automatische Tests greifen nicht auf fremde Datenverzeichnisse zu; Integrationstests starten eigene Serverprozesse mit isolierten Dateien.

## Code-Stil und dokumentierte Schnittstellen

Für JavaScript gilt verbindlich der [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html). Das Repository behält reine JavaScript-ES-Module bei (keine Umstellung auf Java oder TypeScript). Vor jeder Abgabe:

```bash
npm run format:js
npm run format:check
npm run check:line-width
npm run check:jsdoc
npm run check
```

Jede benannte Funktion, auch interne Funktionen, benannte Arrow-Funktionen, Klassenmethoden, Accessors und benannte Objekthandler, benötigt **vollständige, typisierte JSDoc** ohne Alt-Ausnahmen. In sämtlichen JavaScript-Dateien gelten dieselben Regeln: aussagekräftiger Zweck, jeder Parameter mit korrektem Namen, Typ und Erklärung, `@return` bei einem Rückgabewert, bei Bedarf `@throws`, Nebenwirkungen und Vertrauensgrenzen. Dies gilt auch für Server- und Testcode. Anonyme Inline-Callbacks ohne eigene Schnittstelle benötigen keine separaten JSDoc-Blöcke. Keine erfundenen Typen oder Kommentare, die nur den Namen wiederholen. `check:jsdoc` prüft **sämtliche JavaScript-Dateien** auf fehlende oder unvollständige JSDoc-Verträge für alle benannten Funktionen sowie die öffentlichen Exportverträge. Funktionen und Methoden werden durch Leerzeilen getrennt. Alle JavaScript-Zeilen unterliegen dem 80-Zeichen-Limit ohne Altzeilenausnahmen. Der Formatter erhält bewusst gesetzte Umbrüche an Template-Interpolationen.

Der bereits vorhandene TypeScript-Formatter wird zusammen mit syntaxbewussten Umbruch- und Leerzeilenregeln nur zur **Formatierung** eingesetzt. HTML-Templates, RegExps und lange Literale dürfen nicht blind aufgeteilt werden. Bei nicht automatisch prüfbaren Google-Konventionen ist die Code-Review-Prüfung verpflichtend.

## Zeilenenden

Alle Textdateien verwenden plattformübergreifend LF. `.gitattributes` erzwingt LF beim Git-Checkout, auch unter Windows. Die VS-Code-Workspace-Einstellung `files.eol` und `.editorconfig` geben LF für neue Dateien vor. Bereits geöffnete CRLF-Dateien bei Bedarf über die Statusleiste von CRLF auf LF umstellen und speichern. Binärdateien werden von Git nicht als Text normalisiert.

## HTML-Template-Formatierung

Externe HTML-Templates werden mit `npm run format:html` formatiert und mit
`npm run format:html:check` geprüft. Die Formatierung bewahrt Inline-Text,
Attributwerte, Platzhalter und whitespace-sensitive Elemente. Sie wird auch
in `npm run check` geprüft. Neue dynamische HTML-Strings sind unzulässig;
Views kombinieren RenderPläne und montieren native DOM-Nodes.

## CSS-Formatierung

CSS wird einheitlich gemäß dem CSS-Teil des [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html) formatiert: zwei Leerzeichen, eine Deklaration je Zeile, getrennte Selektoren in Listen und Leerzeilen zwischen Regeln. Neue oder veränderte CSS-Dateien vor dem Commit formatieren:

```bash
npm run format:css
npm run format:css:check
```

`npm run check` erzwingt die Formatierung auch in CI. Der Formatter verändert keine Selektoren, Werte oder Deklarations- und Importreihenfolgen. Für Änderungen am tatsächlichen Layout zusätzlich `npm run test:visual` ausführen; Formatierung allein darf keine UI-Änderung verursachen.

## Änderungen und Dokumentation

Bei einem PR die Gesamtheit aller enthaltenen Commits auf Dokumentationsbedarf prüfen und nur tatsächlich betroffene aktuelle `.md`-Dateien aktualisieren. Eine gesonderte Änderung pro Commit oder Patch ist nicht nötig. Ist keine Dokumentation betroffen, muss das weder im Commit noch im PR begründet werden. **Die PR-Beschreibung ist optional und darf leer bleiben**; GitHub Actions prüft ihren Inhalt nicht. Nur `CHANGELOG.md` enthält Änderungshistorie. [Projektregeln](../AGENTS.md).

Der statische `npm run check` prüft Dokumentationslinks und ausgewählte Inkonsistenzen; fachliche Richtigkeit muss beim Review gegen den Code geprüft werden. `docs/TESTSTATUS.md` zeigt **keine** automatisch stets aktuellen CI-Resultate; nur tatsächlich bestätigte Läufe eintragen.

## Tests

- `npm run check`: Syntax, Imports, Sprachdateien, Links, Deploymentregeln.
- `npm test`: Unit- und Integrationstests (OpenSSL für einzelne TLS-Tests).
- `npm run test:browser`: Playwright/Chromium einschließlich echter History/Reload (nicht im DOM-only-Modus).
- `npm run test:visual`: lokale Aufnahmen mit Überlauf- und Interaktionsprüfungen. PR-CI vergleicht Basis und Merge-Kandidat mit demselben Browser; Geometrie- und Pixeländerungen benötigen eine gezielte Freigabe. Details: [Visuelle Tests](DESIGNSYSTEM_VISUELLE_TESTS.md).
- `npm run verify`: `npm run check && npm test`.

Screenshotdateien für die README nur aus geeigneten Demo-Daten erstellen. Bei visuellen Änderungen 390/768/1024/1440 px, beide Themes, lange Texte und leere Zustände prüfen. Chromium-Emulation ist kein Ersatz für Safari/iOS-/Android-Hardware.
