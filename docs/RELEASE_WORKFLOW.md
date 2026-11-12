# GitHub-Workflow: develop -> main = Release

## Ziel

- **`develop`** ist der Entwicklungsbranch. Jeder Push und Pull Request nach `develop` wird durch `.github/workflows/check.yml` getestet.
- **`main`** ist nur fuer Releases. Ein Pull Request **`develop` -> `main`** muss die Checks bestehen und eine neue, konsistente Version enthalten.
- **Nach dem Merge nach `main`** erzeugt `.github/workflows/release.yml` automatisch einen Tag `vX.Y.Z` und einen **Draft-Release**. Nach erneutem Testen werden ein Projekt-ZIP (+ SHA-256) und **ein kombiniertes Docker-Image** fuer `linux/arm64` (Pi 4) und `linux/amd64` erzeugt. Erst wenn der Image-Build und der ZIP-Upload erfolgreich sind, wird der Draft als GitHub Release veroeffentlicht.
- **Manuell veroeffentlichte Releases** (`release.published`) loesen denselben Paket- und Container-Build aus. Der Release-Tag muss auf einem Commit liegen, der bereits nach `main` gemergt wurde, und mit der Version in `package.json` uebereinstimmen.
- **Kein Docker-Publish von `develop` oder bei normalen Code-Pushes**. Der fruehere `docker-publish.yml`-Workflow wurde entfernt, um doppelte Builds zu vermeiden.

### Einmalig GitHub einrichten

1. `main` und `develop` als Branches anlegen. Empfohlen: `main` als Default-Branch setzen (Pull Requests zielen dann standardmaessig auf `main`); Commits und Entwicklung erfolgen auf `develop`. Die Workflow-Dateien muessen auch auf dem Default-Branch existieren, damit manuelle Releases den `release.published`-Workflow ausloesen koennen.
2. Unter **Settings -> Rules -> Rulesets** `main` gegen direkte Pushes schuetzen, Pull Requests und die Checks verlangen. `main` nur aus `develop` mergen; die CI prueft das ebenfalls. **Keinen Branch-Protection-Bypass fuer normale Entwickler** einrichten.
3. Unter **Settings -> Actions -> General** die Ausfuehrung der verwendeten Actions erlauben. Der Token braucht fuer den Release-Workflow `contents: write` (Tag, Release, ZIP) und `packages: write` (GHCR). Beide Rechte sind **nur den entsprechenden Jobs** zugewiesen. Falls eine Organisationsrichtlinie GitHub-Token auf Lesen begrenzt, muss diese zunaechst angepasst werden.
4. In GHCR gegebenenfalls die Zugriffsberechtigung des Repositorys fuer das Image aktivieren. Bei privaten Images auf dem Pi `docker login ghcr.io` mit einem Token mit `read:packages`.
5. **Auf dem Raspberry Pi das Repository immer auf `main` auschecken**, auch wenn auf `develop` entwickelt wird (`git clone --branch main ...`). So bleiben die Deployment-Skripte auf dem freigegebenen Stand.
6. GHCR-Image ist `ghcr.io/henryk86/whisky-collection-manager` (Tag `latest` oder `vX.Y.Z`). Die vollständige Compose-Datei im Projektstamm enthält den Pfad bereits.

### Verbindliche Versionsrichtlinie

- **Patch (`X.Y.Z` → `X.Y.(Z+1)`):** kleinere Aenderungen, Fehlerbehebungen, UI-Feinschliff und begrenzte Verbesserungen bestehender Funktionen.
- **Minor (`X.Y.Z` → `X.(Y+1).0`):** groessere funktionale Erweiterungen, insbesondere neue Seiten oder umfangreiche neue Funktionen.
- **Major (`X.Y.Z` → `(X+1).0.0`):** inkompatible Aenderungen, die vorhandene Schnittstellen, Konfiguration oder Datenformate brechen.

Jeder Release erhaelt eine neue Version. Der Versionstyp wird vor dem Bump anhand des Aenderungsumfangs festgelegt, nicht erst nach dem Merge. Interne Aufräumarbeiten ohne Funktionsänderung sind Patch-Releases; neue Seiten oder größere Funktionen sind Minor-Releases.

### Version auf develop vorbereiten

Vor **jedem Merge nach `main`** die Version einmal erhoehen, da jeder Merge genau einen neuen Release erzeugt. Der Befehl aktualisiert `package.json`, `package-lock.json`, den README-Titel, den Changelog und `docs/TESTSTATUS.md`. Dabei wird der vorherige Testbericht nach `docs/TESTHISTORIE.md` archiviert. Der neue Teststatus wird wahrheitsgemaess auf **noch nicht ausgefuehrt** gesetzt:

```bash
# Auf develop; Beispiel fuer einen Patch-Release:
npm run release:bump -- patch "Fehlerbehebungen und Verbesserungen"
npm run release:check
npm run verify
git add package.json package-lock.json README.md CHANGELOG.md docs/TESTSTATUS.md docs/TESTHISTORIE.md
git commit -m "chore(release): prepare vX.Y.Z"
git push origin develop
```

Nach `npm run verify` die tatsaechlichen Ergebnisse in `docs/TESTSTATUS.md` eintragen (zuvor keine pauschale Erfolgsmeldung). `npm run release:check` validiert auch die Teststatus-Version, sodass eine Abweichung bereits vor CI auffaellt.

Wenn `README.md enthaelt nicht die Release-Version im Titel` gemeldet wird, kann `npm run release:sync` den README-Titel aus der Version in `package.json` korrigieren. Anschliessend `npm run release:check` ausfuehren und die README-Aenderung committen. `release:bump` kann einen abweichenden README-Titel ebenfalls selbst korrigieren; der CI-Check bleibt strikt und aendert nie Dateien.

Alternativ `minor` oder `major` anstelle von `patch`. `npm run release:bump` **niemals nachtraeglich auf `main`** ausfuehren. Die PR-Checks fuer `main` verhindern, dass eine bereits benutzte Version erneut veroeffentlicht wird. Der automatische Release-Prozess schreibt keine Commit-Aenderungen auf `main` (funktioniert mit geschuetztem Release-Branch).

**Wichtig:** Wenn noch kein Release-Tag existiert, wird die Version aus `package.json` für den ersten Tag verwendet. Danach muss jeder Merge nach `main` eine neue, noch unbenutzte Version enthalten. Bestehende Release-Tags nicht überschreiben.

### Release-Ablauf

1. Pull Request `develop` -> `main` erstellen.
2. `Checks` abwarten, PR mergen.
3. Workflow `Release (main -> GitHub Release -> ZIP + GHCR)` laeuft automatisch:
   - Version/Tag pruefen; `npm ci`, `npm run verify`, Playwright-Browsertests.
   - Tag auf **genau den Merge-Commit** setzen, GitHub Release als **Draft** anlegen. Das kann bei einem abgebrochenen Lauf erneut gestartet werden, solange der Draft zum selben Commit gehoert.
   - `whisky-collection-manager-vX.Y.Z.zip` und `.zip.sha256` aus **getrackten Dateien des Tags** erzeugen; private Runtime-Dateien werden vor dem Upload geprueft.
   - Ein Multiarchitektur-Image `ghcr.io/henryk86/whisky-collection-manager:vX.Y.Z` (auch ohne `v`) nach GHCR pushen.
   - **Erst nachdem das Container-Image und das ZIP erfolgreich erstellt wurden**, GHCR-Image auf `latest` setzen und den GitHub Release veroeffentlichen.
4. Auf dem Pi im Projektstamm `docker compose pull` und `docker compose up -d --remove-orphans` ausfuehren. Der Container verwendet `IMAGE_TAG` (`latest` oder fest `vX.Y.Z`).

### Warum alles innerhalb eines Workflows?

GitHub blockiert Folge-Workflows, deren Event von `GITHUB_TOKEN` erzeugt wurde. Ein automatisch mit diesem Token veroeffentlichter Release loest deshalb **nicht** zuverlaessig einen separaten `on: release`-Workflow aus. Durch `prepare -> package + docker -> publish` im selben Lauf entsteht dieses Problem nicht. Der `release.published`-Trigger bleibt fuer manuell veroeffentlichte Releases erhalten.

### Fehlerbehandlung

- **Fehler bei Tests:** Kein Release/Tag wird erstellt. Tests auf `develop` korrigieren und erneut mergen (mit neuer Version).
- **Fehler nach Draft-/Tag-Erstellung:** Release bleibt **Draft**. Workflow fuer **denselben Commit** erneut ausfuehren; bereits existierende Tags werden nur mit identischem SHA und vorhandenem Draft wiederverwendet.
- **Tag bereits veroeffentlicht:** Ein zweiter automatischer Release mit derselben Version wird verweigert.
- **Fehler beim manuell veroeffentlichten Release:** Paket-/Image-Jobs koennen durch erneutes Ausfuehren des Workflows wiederholt werden.
- **Version auf main passt nicht zum Tag:** Build stoppt, statt ein falsch beschriftetes Image zu erzeugen.

### Sicherheit und Daten

Im GitHub Release landen nur die im Repository getrackten Quellcodedateien. **`collection.json`, Fotos, Belege, Zertifikate, Cloud-Tokens, Restic-Schluessel und alle `deploy`-Laufzeitverzeichnisse duerfen nicht ins Repository eingecheckt werden.** Das ZIP wird zusaetzlich auf solche Dateien geprueft. **Persistente Daten liegen unter `${WCM_DATA_DIR}` außerhalb des Git-Checkouts** und bleiben bei `docker compose pull && docker compose up -d --remove-orphans` erhalten. Mit `--remove-orphans` wird beim Wechsel von v0.6.33 der nicht mehr benoetigte zweite Container entfernt, ohne die Datenordner zu loeschen.

**Hinweis:** Der `latest`-Tag wird erst nach erfolgreichem ZIP-Upload und Image-Build aktualisiert. Fuer einen reproduzierbaren Rollout `IMAGE_TAG=vX.Y.Z` verwenden.

### Ruleset fuer main importieren

Die versionierte Ruleset-Vorlage liegt unter **`.github/rulesets/main.json`**. GitHub wendet diese Datei **nicht automatisch** an, nur weil sie im Repository vorhanden ist. Einmalig im Repository unter **Settings -> Rules -> Rulesets -> New ruleset -> Import a ruleset** die JSON-Datei auswaehlen und als aktives Ruleset speichern. Alternativ mit GitHub CLI (Rechte: Repository-Administration/Write):

```bash
gh auth login
gh api --method POST repos/OWNER/REPO/rulesets --input .github/rulesets/main.json
```

`OWNER/REPO` durch den tatsaechlichen Repository-Pfad ersetzen. Nicht beides ausfuehren: ein bereits importiertes Ruleset nicht doppelt erstellen.

**Ruleset "main - release branch (develop -> main)":**

- Gilt ausschliesslich fuer `refs/heads/main`, aktiv, **kein Bypass** (auch nicht fuer Administratoren).
- **Pull Request ist Pflicht**; Merge-Commit oder Squash-Merge sind erlaubt. Direkte Pushes nach `main`, Force-Pushes und Loeschen von `main` sind blockiert.
- **Pflichtcheck `test`** (der konkrete Jobname in `check.yml`, nicht der Anzeigename `Checks`). Er beinhaltet Syntax-/Unit-/Integrationstests, Playwright und beim PR nach `main` zusaetzlich den Check, dass der Quellbranch `develop` **aus demselben Repository** stammt und die Release-Version noch unbenutzt ist. Somit duerfen nur PRs `develop -> main` gemergt werden.
- **Require branches to be up to date** ist eingeschaltet. Offene Review-Diskussionen muessen geloest sein.
- **0 verpflichtende Approvals:** geeignet fuer einen allein entwickelnden Repository-Besitzer. Wer mindestens einen anderen Reviewer hat, kann `required_approving_review_count` auf `1` setzen; der PR-Autor kann sich nicht selbst genehmigen.
- Kein Tag-Ruleset fuer `v*`, weil der vorhandene GitHub-Actions-Release-Workflow die Tags mit `GITHUB_TOKEN` selbst erstellen muss. Das Branch-Ruleset verbietet keine von diesem Workflow angelegten Release-Tags.
- Keine Ruleset-Regel fuer `develop`; Pushes nach `develop` sollen weiter die Entwicklung triggern. Fuer `develop` ist ein separates, optionales Schutz-Ruleset moeglich.

**Vor Aktivierung pruefen:** `main` und `develop` existieren, und `Checks / test` ist mindestens einmal auf einem PR nach `main` gelaufen. Bei einem privaten Repository sind GitHub Rulesets laut GitHub-Planbedingungen ggf. nicht verfuegbar bzw. nicht durchgesetzt (fuer private Repositories mindestens GitHub Pro/Team/Enterprise, fuer oeffentliche auch GitHub Free). Nach der Aktivierung einen PR `develop -> main` ausprobieren. Der Actions-Release-Workflow muss Tag und Release weiterhin schreiben duerfen (`contents: write`, `packages: write`).

## GHCR-Image vor Veroeffentlichung pruefen

Seit v0.6.42 validiert der Docker-Build die `package.json` und
`package-lock.json` vor `npm ci` sowie die Node-Einstiegsdatei im fertigen Image.
Nach dem Push der versionierten GHCR-Images zieht der Release-Workflow beide
Plattformvarianten (`linux/amd64`, `linux/arm64`) und laedt die
`/app/package.json` jeweils in Node. Nur wenn die Versionsnummer stimmt und
`docker/entrypoint.js` geprueft werden kann, darf der `publish`-Job
den Tag `latest` aktualisieren. Damit wird ein Fehler wie
`ERR_INVALID_PACKAGE_CONFIG` vor der produktiven Aktualisierung entdeckt.

Dieser Check weist nach, dass die Paketdatei in den veroeffentlichten Images
lesbar ist. Er ist kein Ersatz fuer den HTTPS- und Backup-Lauf auf dem Pi.
Bei einem bereits fehlerhaften Image koennen die Logs allein nicht klaeren,
ob das GitHub-Image, der lokale Cache oder ein Compose-Override verantwortlich
ist. Die Datei muss aus dem betreffenden Image mit `docker run --entrypoint cat`
oder `docker cp` gelesen werden.

**Seit v0.16.9:** Die Browser-Erweiterung liegt in einem gesonderten privaten Projekt und ist nicht mehr Bestandteil des öffentlichen Release-ZIPs. Der Release-Check prüft deshalb nur `package.json` und `package-lock.json` und lehnt versehentlich beigefügte `extension/`-Dateien ab.
