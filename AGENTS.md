# Projektregeln fuer Quellcodeaenderungen

## Release-Versionierung

- Einzelne Aenderungen auf `develop` erhalten **keine Versionsaenderung**. Stattdessen sind Conventional Commits Pflicht: `fix:`, `feat:`, `refactor:`, `test:`, `docs:`, `chore:` usw.; `!` oder ein `BREAKING CHANGE:`-Footer kennzeichnet inkompatible Aenderungen.
- Direkte Commits nach `develop` sind der normale Weg; spaetere PRs sind moeglich. Die Checks validieren beide Varianten.
- Einmal pro lokalem Git-Checkout `npm run hooks:install` ausfuehren: der repo-lokale `commit-msg`-Hook lehnt neue ungueltige Commit-Nachrichten sofort ab. Der GitHub-Check bleibt notwendig (Hooks sind optional und mit `--no-verify` umgehbar).
- **Nur der manuell genehmigte `develop -> main`-Merge** startet den Release; als echten Merge-Commit. Ein getaggter Versions-Snapshot wird nach Tests durch einen automatisch erstellten **Version-PR** in das geschuetzte `main` eingebracht. Nur diesen PR darf der GitHub-Bot automatisch mergen. `develop` wird anschliessend ohne Force-Push synchronisiert.
- Keine direkten Pushes der GitHub-Release-Action auf `main`, kein Admin-Bypass. Ein Version-PR-Merge darf nicht erneut einen Release ausloesen.
- Das Repository verwendet `develop` als Default-Branch, damit auch Dependabot-Sicherheitsupdates (neben regulaeren Versionsupdates) nach `develop` gehen.
- `npm run release:bump` nicht mehr bei Implementierungsaufgaben ausfuehren; `release:check` dient der Pruefung fertiger Tags. Fuer konkrete Releases nur Git-Tags oder GitHub-Release-Artefakte verteilen.

Details: [Release-Workflow](docs/RELEASE_WORKFLOW.md).

## Einheitliche Bestaetigungsdialoge

- Rueckfragen, Zustimmung zu Aenderungen und Warnbestaetigungen **immer** als Anwendungsmodal rendern, niemals native Browserdialoge (`window.confirm`, `window.prompt` oder `window.alert`) verwenden.
- Wenn aus einem vorhandenen Bearbeitungsdialog eine Bestaetigung geoeffnet wird, muss die Rueckfrage verschachtelt erscheinen und beim Abbruch die urspruenglichen Formulareingaben erhalten.
- Bei Abbruch oder Schliessen der Rueckfrage darf keine Datenaenderung erfolgen. Mausklick, Tastaturbedienung und die beiden Sprachkataloge beruecksichtigen.

## Dokumentation und Tests

- Bei jedem Release README, `docs/TESTSTATUS.md` und betroffene Fachdokumente an die **tatsächlich implementierten** Funktionen anpassen.
- Den aktuellen Teststatus nicht mit früheren Testläufen vermischen; historische Protokolle gehören in `docs/TESTHISTORIE.md`.
- Nicht ausgeführte Browser-, iOS-/Android- oder Docker-Prüfungen ausdrücklich als offen kennzeichnen.
- Änderungen an mobilen Formularen zusätzlich bei schmalen Viewports prüfen; ein Chromium-Test ersetzt keine Prüfung mit iOS Safari.

## Architektur und Dokumentationspflege

- Reine Darstellung, UI-Zustand, serverseitige Anwendungsfälle, Validierung und Persistenz getrennt halten (siehe `docs/ARCHITEKTUR.md`).
- `README.md` ist der Einstieg; Release-Nachträge in `CHANGELOG.md`, aktuelle Prüfungen in `docs/TESTSTATUS.md`, Historie in `docs/TESTHISTORIE.md`.
- `npm run check` überprüft auch relative Dokumentationslinks. Vor einem Release alle Markdown-Dateien auf fachlich veraltete Angaben prüfen.
- Bei einem Refactoring ohne Funktionsänderung Datenformate, API, Browser-Interaktion und Deployment unverändert lassen; Tests nach jedem Schritt ausführen.
