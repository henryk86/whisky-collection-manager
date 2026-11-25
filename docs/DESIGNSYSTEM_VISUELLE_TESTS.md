# Visuelle Tests und Freigabe

## Prüfungen

```bash
npm run test:browser        # Playwright: Navigation, Fokus, Bedienung, Scroll
npm run test:visual         # frische Aufnahmen, Überlauf, Modalinteraktion
npm run test:visual:strict  # optionaler Vergleich mit historischen Baselines
npm run visual:update       # nur lokal, für den optionalen historischen Vergleich
```

Die visuelle Suite erzeugt 144 Aufnahmen (18 Zustände × vier Breiten
390/768/1024/1440 px × Hell-/Dunkelmodus) mit festen Testdaten,
Browserzeit, Locale, Fonts und deaktivierten Animationen. Sie prüft Überlauf,
Modal-Fokus, Tab-Falle, Escape, verschachtelte Formulare und Hintergrundscroll.
Der zusätzliche Zustand `modal-flight-expanded` öffnet sämtliche Fassgruppen
und Untertypen über die echten Bedienelemente, aktiviert die Altersspanne und
harte Filter und erfasst den vollständigen Dialog mit bedarfsgerechter Höhe.
Abgeschnittene Inhalte und horizontaler Dialogüberlauf sind Fehler.
Die Browser- und Aufnahmetests sind unabhängig von der visuellen Freigabe.
Aufnahmefehler, horizontaler Überlauf und Interaktionsfehler lassen sich nicht
mit einer visuellen Freigabe umgehen.

## Dynamischer PR-Vergleich

`Visual Comparison` läuft bei PRs nach `develop` und `main`. Der Workflow
checkt den exakten Basis-Commit und den von GitHub erzeugten Merge-Kandidaten
in getrennten Verzeichnissen aus. Beide Versionen erhalten ihre eigenen
npm-Abhängigkeiten und verwenden denselben, anhand des Kandidaten gepinnten
Playwright-Chromium auf demselben Runner. Die Testserver benutzen temporäre
Datenverzeichnisse. Bei Änderungen der Testfixtures sind die fachlichen Zustände
kompatibel zu halten; bewusst neue oder entfernte Szenarien erscheinen separat.
Unvereinbare Browser-, Zeit-, Locale- oder Zeitzonen-Einstellungen schlagen fehl.

Die Auswertung vergleicht die gemessene Geometrie und die gerenderten Pixel
mit einer konservativen Rauschtoleranz. Bei unveränderter Geometrie und
identischen Bildmaßen werden höchstens 0,01 % abweichende Pixel toleriert,
unabhängig von ihrer Nachbarschaft. Größere Pixelabweichungen und
Geometrieänderungen bleiben freigabepflichtig. Kleine echte Änderungen
unterhalb der Toleranz können dadurch ebenfalls akzeptiert werden. Es gibt keine pauschale Farbtoleranz. Tolerierte
Abweichungen erscheinen mit Bildern im Bericht und unter `ignored` in
`changes.json`, blockieren die Freigabe aber nicht. Gewollte Verschiebungen
oder neue Felder dürfen nach Sichtprüfung freigegeben werden. Das Artefakt
`visual-review-<attempt>` enthält einen portablen HTML-Bericht (`index.html`), Vorher-/Nachher-/Diff-PNGs
für Abweichungen, bei Geometrieänderungen zusätzlich Vorher-/Nachher-Rechtecke
als JSON sowie die Aufnahmeberichte. Neue bzw. entfernte Szenarien
haben nur das jeweils vorhandene Bild. Die Vorschau umfasst 1100 px Höhe;
Safari, Firefox und echte Mobilgeräte benötigen gesonderte Prüfungen.

Die lokalen historischen Referenzen sind nicht Bestandteil dieses CI-Vergleichs.
Für ältere Basisstände mit der bisherigen visuellen Suite wird ausschließlich
im wegwerfbaren Checkout der lokale Aufnahmemodus verwendet; es werden keine
Referenzänderungen committed. Fehlt die Suite im Basisstand ganz, scheitert der
Vergleich ausdrücklich. `visual:update` bleibt außerhalb dieser Übergangslösung
in CI verboten. `test:visual:strict` benötigt weiterhin identische historische
Browser-Baselines, ist aber kein Pflichtcheck.

## Freigabe im Pull Request

Der Controller `Visual Approval Controller` veröffentlicht einen PR-Kommentar
mit Berichts-ID, Status je Screenshot und Link zum Actions-Lauf. Das ZIP aus
Artifacts herunterladen, entpacken und `index.html` öffnen. Ohne Abweichungen
wird `Visual Approval` automatisch erfolgreich.

Die Freigabeauswertung startet erst nach einem erfolgreichen, abgeschlossenen
`Visual Comparison`. Der separate Workflow `Visual Comparison Status` setzt
eine alte Freigabe bei einem laufenden oder fehlgeschlagenen Vergleich zurück.
Freigabekommentare während eines laufenden Vergleichs können keine Freigabe
erteilen; der erfolgreiche Abschluss wertet die Kommentare erneut aus.

Bei gewollten Abweichungen einen normalen PR-Kommentar schreiben (Beispiele
mit fiktiver Berichts-ID):

```text
/visual-approve 123456789.1 modal-edit__390__dark
/visual-approve 123456789.1 modal-edit modal-new
/visual-approve 123456789.1 all
```

Ein Szenarioname umfasst alle geänderten Breiten und Themes dieses Szenarios.
`all` gilt nur für den angegebenen Bericht. Unbekannte Selektoren verwerfen
den gesamten Befehl. Nur Benutzer mit Repository-Schreibrechten können
freigeben. Die PR-Beschreibung darf weiterhin leer bleiben.

Weitere Commits erfordern einen neuen Vergleich. Bereits freigegebene identische
Vorher-/Nachher-Pixel und Geometrien werden innerhalb desselben PR wiedererkannt;
neue oder veränderte Abweichungen bleiben offen. Berichts-ID und Prüfsummen
verhindern die pauschale Freigabe eines neueren Berichts durch einen alten
Kommentar. Freigabekommentare und Bot-Berichte bis zum Merge nicht löschen.
Bearbeitete bzw. gelöschte Freigabekommentare werden bei erneuter Auswertung
berücksichtigt. Nach Ablauf der Artefakte den Vergleich erneut ausführen.

Ein ausschließlich aus verifizierten, unveränderlichen Release-Metadaten
bestehender automatischer Versions-PR nach `main` erhält eine automatische
visuelle Freigabe, sofern der bestehende Release-Verifizierer ihn bestätigt.
Der Vergleich selbst und alle übrigen Pflichtchecks bleiben erforderlich.

## Einmalige GitHub-Konfiguration

1. Den Workflow zunächst regulär über `develop` nach `main` übernehmen.
   Beide Controller-Workflows müssen im Standardbranch `main` vorhanden sein, weil GitHub
   `workflow_run` und `issue_comment` von dort ausführt. Die erste Einführung
   kann deshalb noch nicht durch den neuen Controller bestätigt werden.
2. Einen Folge-PR öffnen und die Workflows samt PR-Kommentar und Status prüfen.
3. Unter **Settings → Rules → Rulesets** (oder Branch protection rules) für
   `main` und gegebenenfalls `develop` die vorhandenen Prüfungen beibehalten
   und `Visual Comparison` sowie `Visual Approval` als Required status checks
   ergänzen. Als Quelle GitHub Actions auswählen, sofern verfügbar. Nicht den
   Controller-Job `review` als Pflichtcheck auswählen.
4. **Require branches to be up to date before merging** aktivieren. Wird die
   Basis nach einer Aufnahme weiterentwickelt, den PR-Branch aktualisieren;
   dies löst einen neuen Vergleich aus. Ohne diese Einstellung können alte
   Vergleiche bei einer fortgeschriebenen Basis noch als gültig erscheinen.
5. Beim automatischen Versions-PR sicherstellen, dass der vorhandene Release-
   Workflow weiterhin einen echten PR-Lauf auslösen darf. Keine Admin-Bypässe.

Der Controller benutzt ausschließlich den Standardbranch-Code und verarbeitete
JSON-Daten, keine ausführbaren PR-Artefakte. Der Vergleich läuft ohne
Schreibrechte und ohne Release-Secrets. Die Freigabe ist kein Sicherheitsnachweis
gegen vorsätzlich manipulierten PR-Code: Änderungen an Workflows, Testharness
oder Vergleichslogik müssen weiterhin im Code-Review geprüft werden.
