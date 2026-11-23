# Phase 3 – vollständiger lokaler Prüfbericht

**Stand:** Implementierung Phase 3 auf dem unveränderten `WCM_Phase2_Projekt.zip`. Version `1.12.0` gemäß `AGENTS.md` unverändert. Keine API-, Persistenz- oder Collection-Schema-Änderungen.

## Prüfmatrix

| Prüfung | Ergebnis / genaue Abdeckung |
|---|---|
| `npm run check` | **Bestanden**: Imports/Syntax, Übersetzungen, Dokumentationslinks, Deployment-Verträge. |
| Unit-Tests | **507/507 bestanden**, 0 fehlgeschlagen, nach der letzten CSS-Korrektur erneut vollständig grün. Enthält **3 neue** Komponenten-/Formtests. |
| Integrationstests | **174/174 bestanden**, 0 fehlgeschlagen, im zuvor abgeschlossenen Gesamtlauf. Ein zusätzlich gestarteter Wiederholungslauf nach der reinen CSS-Reihenfolgekorrektur wurde vom Ausführungslimit beendet, ohne ein neues Gesamtergebnis zu liefern. |
| Zusammen Unit/Integration | **681/681 bestanden**, 0 fehlgeschlagen. |
| Neue Browser-Regressionen | **4/4 bestanden**: Modallayout/Fokus/Escape in vier Viewports und beiden Themes; verschachtelte Flight-Hilfe erhält identisches DOM und Werte; Breitendefinition der Bearbeitung; echte von Null abweichende Hintergrund-Scrollposition einschließlich Shift+Tab. |
| Phase-2-Designsystem-Browserregressionen | **5/5 bestanden** (Header/Token). |
| Selektierte kritische Bestandsfälle | **4/4 bestanden**: Lagerplatz-Bearbeitung mit Drei-Wege-Bestätigung, verschachtelte mobile Modals, abgelehnter Verkostungs-DELETE, belegtes Lagerzimmer löschen mit Abbruch. |
| Datei-/Scroll-Bestandsfälle | **3/3 bestanden**: PDF-Vorschau, Bild-Blob und Klartext/Fallback, Dateien hochladen/entfernen und kein Scrollsprung beim Löschen. |
| Größerer bestehender Browserlauf | **Nicht abgeschlossen**: Nach **24 erfolgreichen Tests und keinem bis dahin aufgezeichneten Fehler** am Ausführungslimit der Umgebung beendet. Dieser Lauf gilt **nicht** als vollständig bestanden. |
| Vollständige CI-Browsersuite | **Offen**. Die vom Nutzer für Phase 2 gemeldeten grünen CI-Ergebnisse gelten nicht als Phase-3-Testergebnis. |

**Laufzeitbedingungen:** Chromium/Playwright im projektinternen `WHISKY_BROWSER_DOM_ONLY=true`-Modus; Chromium ausführbar unter `/usr/bin/chromium`, Playwright-Laufzeit aus der verfügbaren Arbeitsumgebung (nicht durch ein frisches `npm ci` exakt auf die im Projekt fixierte Version 1.65.1 installiert). API-Aufrufe wurden an einen temporären lokalen Projektserver weitergeleitet. Dies ersetzt keine echte Browsernavigation, keinen regulären Linux/Windows-CI-Lauf und keine iOS-Safari-/Android-Prüfung.

## Browser-Interaktion – gemessene Aussagen

- **Vier Breiten (390/768/1024/1440px), hell/dunkel:** `main.getBoundingClientRect().left` und `.width` vor/bei/nach einem Standardmodal bleiben auf maximal **1px** gleich; keine horizontale Dokumentüberbreite über 1px in den geprüften Fällen.
- Beim Öffnen übernimmt der Vordergrunddialog den Fokus; der Hintergrund wird `inert`. `Tab` bleibt im Vordergrund; `Escape` schließt den Dialog und setzt den Fokus auf den auslösenden Header-Button zurück.
- **Mit echtem Hintergrundscroll >400px:** Der Body wird am ursprünglichen `scrollY` fixiert, Main-Linksposition und -Breite bleiben erhalten, der nach Escape wiederhergestellte `scrollY` weicht höchstens 1px ab. Der Test benutzt eine absichtlich längere Sammlungssituation, um diese Anforderung zuverlässig zu prüfen.
- Die Flight-Hilfe wird als Unterdialog geöffnet und mit Escape geschlossen; der **exakte ursprüngliche Formular-DOM** (`data-identity`) und ungespeicherte Name-/Notizen-/Auswahlwerte bleiben vorhanden. Fokus kehrt zur ursprünglichen Hilfeaktion zurück.
- Selektierte fachliche Regressionen prüfen außerdem Drei-Wege-Bestätigungen, Lagerlöschung nur nach Entscheidung, Undo/Redo eines Verkostungsblocks, Bildkorrekturen sowie die Datei-/PDF-Vorschau.

## Visuelle Referenzen: Phase 2 gegen Phase 3

Für **6 Zustände** (`collection`, `bottling-detail`, `settings`, `modal-new`, `modal-flight`, `modal-flight-help`) wurden jeweils vier Breiten und zwei Themes mit identischen Testdaten fotografiert: **48 Vorher-/Nachher-Paare (96 PNGs)**. Bei allen 48 Phase-3-Aufnahmen wurde **kein horizontaler Dokumentüberlauf** festgestellt.

- **12/48 Pixelvergleiche vollständig identisch**, darunter Sammlung, Abfüllungsdetails und Einstellungen im Hellmodus jeweils bei allen vier Breiten.
- Die übrigen Aufnahmen weisen höchstens **0,91% geänderte Bildpixel** auf. Sichtbare Unterschiede liegen unter anderem im nun bewusst sichtbaren Anfangsfokus-Rahmen der Eingabefelder und geringfügigen Theme-/Textpixeln; eine vollständige optische Gleichheit wird deshalb ausdrücklich **nicht** behauptet.
- **Echte Abweichung entdeckt und beseitigt:** Nachdem die zentralen Feldregeln vor `core.css` geladen wurden, überschrieb ein späteres `font:inherit` deren explizite Feldschriftgröße. Im Flight-Modal waren Inputhöhe (44→46px), Selectbereich (73→77px) und Modalhöhe (712→718px) verändert. Die allgemeine `font:inherit`-Regel wurde vor die Felddetailregeln in `controls.css` verlegt. Der erneute DOM-Messvergleich ergibt **Flight-Modal 712px und 44px Eingabehöhe wie vorher** sowie identische Koordinaten aller geprüften Formularfelder.
- Modalbreiten bleiben in den Referenzen gleich, u.a. Flight-Modal am Desktop **860px**. Ein echter Datei-Upload, Lager-/Raum-3D-Rendering oder native mobile Softkeyboard-Effekte wurden nicht durch das Screenshotset abgedeckt.

## Keine unbelegten Freigaben

- **Nicht getestet:** reale iOS-/Android-Geräte, native Screenreader, Browser-Back/Forward bei tief verschachtelten Modals, Offline-/Docker-Lauf, GPU/WebGL-Vollabnahme.
- **Nicht abgeschlossen:** gesamte Browser-Suite mit projektgepinntem Playwright 1.65.1 auf Standard-CI. Der langlaufende lokale Browserlauf wurde beendet, bevor ein Endergebnis vorlag. Die erfolgreichen Einzelprüfungen ersetzen diesen Gesamttest nicht.
- **Kein Release:** Version bleibt 1.12.0 auf `develop`; ein künftiger Release ist ausschließlich vom Releaseprozess freizugeben.

### Wiederholen

```sh
npm run check
npm test
npm run test:browser
```

Für isolierte gezielte Tests in der hier verfügbaren DOM-Testumgebung:

```sh
WHISKY_BROWSER_DOM_ONLY=true PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium node --test tests/browser/designsystem-dialog-controls.test.js
```

Siehe [Implementierungsdokument](DESIGNSYSTEM_PHASE3.md) und die mitgelieferten Screenshots.
