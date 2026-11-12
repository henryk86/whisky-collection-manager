# Projektregeln fuer Quellcodeaenderungen

## Release-Versionierung

- **Kleine Aenderungen** (Bugfixes, kleinere UI-Aenderungen, Anpassungen bestehender Funktionen) erhoehen den **Patchlevel**: `X.Y.Z` -> `X.Y.(Z+1)`.
- **Groessere funktionale Aenderungen**, insbesondere **neue Seiten**, erhoehen die **Minor-Version**: `X.Y.Z` -> `X.(Y+1).0`.
- Inkompatible Aenderungen an bestehenden Schnittstellen oder Datenformaten erhoehen die Major-Version.
- Diese Regel ist bei jeder kuenftigen Codeaenderung anzuwenden. Vor jedem Merge von `develop` nach `main` die passende Version erhoehen.
- Immer `npm run release:bump -- patch|minor|major "Beschreibung"` benutzen und `npm run release:check` ausfuehren.
- `package.json`, `package-lock.json`, `README.md` und `CHANGELOG.md` muessen dieselbe Release-Version abbilden.

Weitere Details: `docs/RELEASE_WORKFLOW.md`.

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
