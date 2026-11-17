# Technische Schulden und offene Abnahmen

**Aktueller Stand:** Die Fehler- und Architekturpunkte des Reviews v0.28.6 wurden im aktuellen Entwicklungsstand bearbeitet. Diese Datei ist eine Bestandsaufnahme **offener Restrisiken**, keine zweite Release-Chronik. Einzelne historische Entscheidungen und ihre Versionsnummern stehen im [Changelog](../CHANGELOG.md). Verbindliche Testresultate stehen in [TESTSTATUS.md](TESTSTATUS.md).

## Urspruengliches Code-Review

| Befund | Umgesetzte Gegenmassnahme | Noch zu beachten |
| --- | --- | --- |
| A-1 Mehrfachuploads | Upload-Ereignisse zentral delegiert, Browser-Regression | Weitere neue Widgets duerfen keine Listener bei jeder Aktualisierung stapeln |
| A-2 Browser-Fehlschlaege | Browser-Fixtures und visuelle Regressionen korrigiert | Je Release vollstaendige GitHub-CI-Browser-Suite erforderlich |
| A-3 Verschluckte Fehler | Explizite Aktionsergebnisse, erfolgreiche Navigation nur nach bestaetigter Mutation | Fehler- und Retry-Pfade testen |
| A-4 Cache statischer Assets | HTTP-ETags, Last-Modified, 304 | Grosse Modellassets ohne stabilen Hashpfad bleiben revalidierungspflichtig |
| B-1 Uneinheitliches Rendering | Gemeinsamer DOM-Abgleich fuer Views, delegierte normale Ereignisse, Widget-Islands mit explizitem Neuaufbau | Karten-, Lager-, 3D- und Drag-Widgets brauchen ihre getrennten Browser-/Lebenszyklustests |
| B-2 Teure Datenabrufe | Validierte Store-Caches, HTTP-ETags, revisionsgebundene API-Mutationsdeltas und sicherer GET-Fallback | Mehrprozessschreiber sind nicht vorgesehen; grosse Bestandsdaten weiterhin auf Zielhardware messen |
| B-3 Alte Schemagenerationen | Schema 5, Originalbackup, Erhalt von Sammlung und Lager, saemtliche bisherige Verkostungsdaten einschliesslich aktueller Verkostungen, Geschmacksprofile und Farben entfallen bewusst | Aeltere Clients duerfen neue Dateien nicht oeffnen |
| B-4 Server-Frontend-Abhaengigkeit | Gemeinsame DOM-freie `shared/`-Module und Importgrenzen in `npm run check` | Neue Shared-Module nur nach browserseitiger Freigabe ausliefern |
| B-5 Fragile Quelltexttests | **Technisch abgeschlossen:** historisches CSS-/JS-Quelltext-Screening aus Unit-/Integrationstests entfernt; Lager-/3D-/Layout-Verhalten durch Domain- und Chromiumtests gesichert; Deployment-Konfiguration separat geprueft; Verbot neuer Quelltext-Tests in `npm run check` | Vollstaendige GitHub-CI-Browserabnahme fuer den jeweiligen Commit und Hardware-WebGL-Pruefungen weiterhin erforderlich; siehe [Teststrategie](TESTSTRATEGIE.md) |
| B-6 Releases und Altdateien | Gebuendelte Releases mit Conventional Commits, getaggtem Versions-Snapshot, geschuetztem Versions-PR, anschliessender `develop`-Synchronisierung, kompakter Testhistorie und SHA-256-Upgrade-Audit | Fehlgeschlagene Version-PR-/Synchronisierungsjobs kontrolliert wiederaufnehmen; Docker/Pi separat pruefen |

## Unabhaengige verbleibende Risiken

- **Browser-Abnahme:** Chromium-DOM-Modus prueft reale Module und API-Interaktionen, aber nicht History-Verhalten mit HTTP-Seitennavigation. GitHub Actions muss fuer den konkreten Commit gruen sein; WebGL und echte iOS-/Android-Geraete benoetigen eigene Abnahme.
- **B-5-Abnahmekriterium:** Keine Unit-/Integrationstests lesen Anwendungs-JavaScript oder CSS, um Quelltextmuster zu suchen. Das Regex-Budget wurde beseitigt; die verbleibenden Regex pruefen *erzeugte Ergebnisse*. Aenderungen an Docker-/GitHub-Konfigurationen unterliegen expliziten Deployment-Vertraegen und deren Negativtests. Die [Teststrategie](TESTSTRATEGIE.md) ordnet jeder ersetzten Pruefklasse beobachtbares Verhalten zu.
- **Widget-Lebenszyklen:** Direkte Listener fuer kurzfristige SVG-, 3D-, Drag- und Dialoginteraktion sind bewusst isoliert und in `scripts/check.js` mengenmaessig begrenzt. Bei jeder Aenderung dieser Komponenten ist ein gezielter Browser-Test erforderlich.
- **Speichern ueber zwei JSON-Dateien:** Sammlung und Lager haben unabhaengige atomare Schreibwarteschlangen, aber keine gemeinsame Dateisystemtransaktion. Das Restore-Verfahren muss beide Dateien und Medien konsistent handhaben.
- **Sicherheit und Betrieb:** Keine oeffentliche Benutzeranmeldung, daher nur in vertrauenswuerdigen Netzen oder hinter expliziter Zugriffskontrolle betreiben. ARM64-, HTTPS-, WebGL- und Restore-Live-Abnahmen sind von CI-Unit-Tests getrennt.

## Verbindliche Freigabekette

1. `npm run check` und `npm test` einschliesslich Datenmigration und Backup-Restore.
2. `npm run check` und Conventional-Commit-Pruefung auf `develop`; `npm run release:check` einschliesslich Source-Manifest und Dateiversion erst auf dem getaggten Release-Snapshot.
3. `npm run test:browser` komplett mit echter Navigation in GitHub Actions, fuer **diesen** Commit.
4. Release-ZIP und Upgrade-Audit pruefen; Nutzdaten duerfen niemals in einem Quellcode-ZIP enthalten sein.
5. Pi-/Docker-/Mobilgeraete-Ergebnisse im [Teststatus](TESTSTATUS.md) gesondert dokumentieren.

## GitHub-Branch-Schutz und Dependabot-Sicherheitsupdates

Das Repository ist **oeffentlich**. Der PR-Schutz von `main` ist wirksam: ein direkter Versions-Push wurde mit `GH006` abgelehnt. Statt ihn abzuschalten, erstellt der Release-Workflow nach erfolgreichen Artefaktchecks einen Versions-PR aus dem Tag. **Nur diesen PR** darf GitHub automatisch per normaler Merge-API mergen; der Benutzer mergt den eigentlichen `develop -> main`-Release-PR selbst. Die Synchronisierung pusht anschliessend nur `develop` und verwendet weder Force-Push noch `--admin`. Statuschecks und ein gegebenenfalls benoetigtes `WCM_RELEASE_PR_TOKEN` sind in [RELEASE_WORKFLOW.md](RELEASE_WORKFLOW.md) dokumentiert.

`main` bleibt der gewuenschte Default-Branch. `.github/dependabot.yml` richtet **regulaere** Updates nach `develop`, nicht aber Dependabot-**Sicherheitsupdates**: Diese werden von GitHub weiterhin gegen `main` angelegt. Eine automatische, sichere Uebertragung nach `develop` ist **noch nicht implementiert**. Bis dahin muss die Korrektur manuell zuerst nach `develop` uebernommen werden; ein direkter Security-PR-Merge nach `main` wuerde die normale Release-Kette umgehen.

## Unabhaengige Review-Pruefung v1.5.2

- **N-3 Speichern/Nachladen:** Der Erfolg eines abgeschlossenen Schreibvorgangs ist vom nachfolgenden Ressourcen-Refresh getrennt. Fehlschlagende GETs duerfen kein erneutes POST derselben Formularaktion provozieren. Unit- und Chromium-Regressionstests sichern diesen Fall.
- **N-4 Fehlercodes:** Serverseitige API-Fehler tragen explizite Codes und benannte Parameter. Englische Rueckfalltexte liegen im DOM-freien `shared/`-Katalog, nicht im UI-Verzeichnis. Die verbleibende deutsche Textzuordnung im Backup-Job-Frontend ist ein Legacy-Kompatibilitaetspfad, nicht Teil der HTTP-Fehlerantwort.
- **N-5 Hardware/GitHub:** Reale Raspberry-Pi-Latenzen und live konfigurierte Branch-Rulesets/Required-Checks koennen nicht aus einem Quellcodearchiv heraus bestaetigt werden. Die Schritte stehen in der Teststrategie.
- **B-6 Release-Wirkung:** Die Release-Frequenz ist nach Einfuehrung der Automation ueber mehrere echte Releases zu bewerten. Erfolgreiche einmalige Ausfuehrung belegt die Mechanik, nicht die langfristige Wirkung.
