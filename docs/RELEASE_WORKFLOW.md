# GitHub-Workflow: Sammeln auf develop, Release beim Merge nach main

## Grundregel

- **Direkte Commits auf `develop`** sind der Normalfall; spaetere PRs nach `develop` sind ebenfalls moeglich. `Checks / test` prueft beide Varianten.
- **Kein Versionssprung pro Commit oder PR:** `package.json`, `package-lock.json`, README-Versionskopf, Teststatus und Quellmanifest werden in `develop` nicht fuer jede Aenderung aktualisiert. Dort steht die letzte eingecheckte Basisversion; die gueltige veroeffentlichte Version ist der neueste Release-Tag.
- **Nur der Benutzer merged `develop -> main`:** fuer Releases einen PR ueber GitHub mit *Create a merge commit* (kein Squash) verwenden. Auf privaten GitHub-Free-Repositories sind Branch-Schutz und Rulesets nicht durchgesetzt: GitHub kann einen direkten Push auf `main` daher nicht verhindern. Die Release-Action verweigert jedoch ohne nachweislich gemergten `develop -> main`-PR jede Veroeffentlichung. Keine Action fuehrt automatisch einen Merge aus.
- **Der Merge ist der einzige normale Release-Ausloeser.** `.github/workflows/release.yml` erstellt nach erneut erfolgreichen Tests einen versionierten Snapshot-Commit, dessen Parent der freigegebene Merge-Commit ist. Ausschliesslich der Tag verweist auf diesen Snapshot. Weder `main` noch `develop` erhalten Bot-Commits.
- Das vorhandene Release-Verfahren (Draft, Quell-ZIP, Offline-ZIP, SHA-256, GHCR fuer ARM64/AMD64, Offline-Docker-Archive und `latest` erst zum Schluss) laeuft anschliessend auf dem getaggten Snapshot weiter.

### Warum ein Release-Snapshot und keine vierte Versionsstelle?

`MAJOR.MINOR.PATCH` bleibt erhalten. Die Versionsdateien werden **erst fuer den getaggten Release-Zustand** aktualisiert. So stehen in ZIP und Docker-Image die exakte Versionsnummer und das passende SHA-256-Quellmanifest, obwohl `main` und `develop` vorerst die letzte eingecheckte Basisversion anzeigen. Ein Git-Tag `vX.Y.Z` zeigt auf einen echten Commit mit konsistenten Release-Metadaten. Der Versions-Snapshot ist ein Kind des freigegebenen Merge-Commits, liegt aber auf keinem Branch.

**Wichtig fuer Quellcodeinstallationen:** `main` ist der Entwicklungsstand fuer den Release-Merge, nicht der unveraenderliche Versions-Snapshot. Fuer einen bestimmten Softwarestand den **Release-Tag** auschecken (`git fetch --tags && git checkout vX.Y.Z`) oder das Release-ZIP verwenden. Docker-Installationen verwenden das veroeffentlichte Image mit Tag `vX.Y.Z` bzw. `latest`. Ein direkter Start vom Branch `main` kann im angezeigten Versionskopf die eingecheckte Basisversion enthalten; fuer versionierte Deployments daher den Release-Tag nutzen.

## Conventional Commits

Jeder **neue nicht-Merge-Commit ab Einfuehrung dieser Automatik** muss folgendes Format haben:

```text
fix(warehouse): Fachzuordnung beim Umlagern korrigieren
feat(tasting): neue Bewertungsansicht ergaenzen
refactor(api): Zustandsaktualisierung vereinfachen
test: Browserregression fuer Bildeditor ergaenzen
docs: Lagerdokumentation aktualisieren
feat!: inkompatibles API-Format einfuehren
```

| Typ | Release-Wirkung |
| --- | --- |
| `fix`, `perf`, `revert` | Patch |
| `feat` | Minor |
| `!` hinter Typ/Scope oder `BREAKING CHANGE:` im Commit-Body | Major |
| `refactor`, `test`, `docs`, `ci`, `build`, `chore`, `style` | Keine eigenstaendige Erhoehung |

Bei mehreren Commits wird **einmalig die hoechste Stufe** verwendet (Major vor Minor vor Patch). Enthaelt ein freigegebener Release-Merge ausschliesslich Wartungs-, Dokumentations- oder Testcommits, erfolgt **ein Patch-Sprung**, weil jeder Merge nach `main` einen eindeutigen Release-Tag bekommen soll. Unbekannte Commit-Typen fuehren zu einem Fehler und werden nicht still als Minor eingestuft. Bei neuen Features bewusst `feat:` verwenden, bei kompatiblen Korrekturen `fix:`.

**Einmaliger Umstieg bei bestehender Git-Historie:** Beim ersten PR `develop -> main`, der `scripts/release-automation.js` einfuehrt, sucht die Release-Planung den ersten Commit, der diese Datei hinzugefuegt hat. Nur dieser Commit und nachfolgende Commits muessen die neue Namenskonvention einhalten. Historische Commits davor (z. B. `Refactor unit tests ...`) werden weder abgelehnt noch erneut fuer einen Minor-/Major-Sprung ausgewertet; ihre bereits manuell veroeffentlichten Aenderungen bleiben in der Git-Historie und bisherigen Changelogs erhalten. Die Anzahl solcher Alt-Commits steht im Release-Plan. Ab dem zweiten Release werden alle neuen Commits strikt geprueft. Keine Aenderung der Git-Historie, kein Force-Push erforderlich.

### Lokale Commit-Validierung (einmal pro Checkout einrichten)

```bash
npm run hooks:install
```

Der Befehl setzt **nur fuer dieses Repository** `git config --local core.hooksPath .githooks` und aktiviert `.githooks/commit-msg`. Neue nicht-konventionelle Nachrichten werden bei `git commit` abgelehnt, bevor Git den Commit schreibt. Der Hook ruft denselben `classifyCommit()`-Validator wie `scripts/release-automation.js` auf, einschliesslich `BREAKING CHANGE` im Nachrichtenkoerper. Echte Merge-Commits werden anhand von `MERGE_HEAD` ausgenommen; ein willkuerlicher Commit mit dem Betreff `Merge ...` dagegen nicht.

Bei vorhandener eigener `core.hooksPath`-Konfiguration oder einem bestehenden `commit-msg`-Hook wird die Installation abgelehnt, statt andere Hooks still zu ersetzen. In diesem Fall die Hooks manuell integrieren. Die Einstellung liegt in `.git/config` und muss nach einem neuen Klonen erneut vorgenommen werden. Der Installer aendert keine globale Git-Konfiguration und ist keine Voraussetzung fuer die Anwendung zur Laufzeit.

**Grenze bei GitHub Free:** Ein lokaler Hook ist **keine serverseitige Zugangssperre**. `git -c core.hooksPath=/dev/null commit` oder `git commit --no-verify` umgehen ihn. GitHub Actions validiert daher weiter direkte Pushes nach `develop` und jeden Release-PR; bei Fehlern wird die Pipeline rot, aber ein bereits gepushter Commit kann auf einem nicht geschuetzten Branch nicht rueckwirkend abgelehnt werden. Historische Commits werden weder umgeschrieben noch durch die Hook-Einrichtung geprueft.

Bei spaeteren PRs nach `develop` kann per Squash gemergt werden; der entstehende Commit muss konventionell benannt sein. Fuer den **Release-PR `develop -> main`** dagegen ausschliesslich `Create a merge commit` verwenden, sonst kann die Herkunft der Einzelcommits nicht zuverlaessig ermittelt werden.

## Ablauf in GitHub

1. Einmal lokal `npm run hooks:install` ausfuehren. Danach Commits mit Conventional-Commit-Betreff direkt nach `develop` pushen. Die Checks auf `develop` pruefen den neuen Push-Bereich; optionale PRs nach `develop` werden ebenfalls geprueft. Versionsdateien nicht manuell erhoehen.
2. Wenn ausreichend Aenderungen gesammelt sind, einen PR **`develop -> main`** oeffnen. `Checks / test` prueft Unit-/Integrationstests, den Browser und **berechnet die geplante neue Version** bereits auf dem PR-Merge-Stand. Quellbranch und Zielbranch werden geprueft.
3. **Nur du** startest den Merge ueber GitHub, als *Create a merge commit*. Die Actions haben keine Rechte, Branches zu mergen.
4. GitHub startet auf `main` den Release-Workflow. Zunaechst prueft er ueber die GitHub-API, ob genau dieser Commit aus einem gemergten `develop -> main`-PR stammt. Ohne diesen Nachweis werden **weder Tag noch ZIP oder Docker-Image** erstellt. Vor Erstellen des Tags werden alle Tests auf dem freigegebenen Merge-Quellstand erneut ausgefuehrt. Danach werden die Versionsdateien nur im Detached-HEAD-Snapshot angelegt und durch `release:check` und `check` geprueft.
5. Das Git-Tag `vX.Y.Z` und ein Draft-Release werden erzeugt. Die vorhandenen ZIP-/Offline-/Docker-Jobs arbeiten mit diesem Tag. Erst nach bestandenen Artefakt- und Image-Pruefungen wird der Draft veroeffentlicht und das Docker-Tag `latest` aktualisiert.
6. Ein abgebrochener oder erneut gestarteter Workflow auf **demselben Merge-Commit** nutzt denselben existierenden Tag und Entwurf. Kein doppeltes Bumping oder Ueberschreiben bereits veroeffentlichter Tags. Nach einem Fehler den Workflow in GitHub erneut starten, nicht manuell die Version auf `main` erhoehen.

**Keine neue kostenpflichtige Infrastruktur, kein PAT und kein Token mit Branch-Bypass:** Die Release-Action benoetigt `contents: write` lediglich fuer Tag und Release; `packages: write` fuer GHCR. Das von GitHub bereitgestellte `GITHUB_TOKEN` genuegt. Ein Tag oder Draft, den dieses Token erzeugt, startet keinen zweiten Workflow; alle Builds bleiben daher absichtlich in `.github/workflows/release.yml`.

## Einmalige GitHub-Einstellungen

1. `main` und `develop` beibehalten. Direkte Commits nach `develop` sind erlaubt. Releases ausschliesslich ueber einen GitHub-PR `develop -> main` mit *Create a merge commit* ausloesen. Vor dem Merge den erfolgreichen Status `Checks / test` kontrollieren.
2. **Private GitHub-Free-Repositories:** Rulesets und klassische Branch-Protection werden nicht durchgesetzt. Es ist keine Ruleset-Konfiguration erforderlich und auch keine vorhanden, auf die sich der Releaseprozess verlaesst. Die Action kann einen unerlaubten Push auf `main` nicht verhindern, aber ihre Tag-/ZIP-/Docker-Veroeffentlichung blockieren, wenn kein gemergter PR aus `develop` mit identischem Merge-SHA ueber die GitHub-API nachweisbar ist.
3. Unter **Settings -> Actions -> General** die erforderlichen Actions und Schreibrechte fuer das `GITHUB_TOKEN` sicherstellen. Der Release-Workflow nutzt `contents: write`, `pull-requests: read` und fuer GHCR `packages: write`; kein PAT und kein Branch-Bypass notwendig.
4. Das bestehende GHCR-Repository fuer GitHub Actions und Docker-Installationen erreichbar halten. Auf dem Raspberry Pi bei privaten Images mit einem `read:packages`-Token anmelden.
5. **Einmaliger Umstieg:** Wenn `main` noch z. B. v1.3.3 enthaelt, `develop` aber schon die bisher manuell versionierte v1.4.0, akzeptiert die Automatik diesen Unterschied **nur beim erstmaligen Hinzufuegen** von `scripts/release-automation.js` auf `main`. Ein `v1.4.0`-Tag ist dafuer hilfreich, aber nicht zwingend erforderlich. Danach werden manuelle Versionsspruenge wieder abgelehnt. Vorhandene Changelog- und Testhistorie bleiben beim ersten Release erhalten.

## Verifikation

```bash
npm run check
npm test
npm run hooks:install  # einmal pro lokalem Klon
node scripts/release-automation.js validate --range BASE..HEAD
node scripts/release-automation.js plan --json  # Nur auf einem Merge-Commit
```

Die neuen Integrationstests erzeugen temporaere lokale Git-Repositories und pruefen Versionsprioritaet, Tag-Snapshot ohne Branch-Push, Retry ohne Doppel-Release und Ablehnung ungueltiger Commits bzw. direkter `main`-Pushes. Docker-/Offline-Pruefungen bleiben unveraendert Teil der GitHub-Release-Jobs. Das alte `npm run release:bump` ist fuer den Normalablauf **nicht mehr zu verwenden**; es bleibt nur als historisches Hilfswerkzeug erhalten.

---

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

## Offline-Artefakte ab v0.20.0

Bei jedem Release wird zusätzlich ein vollständiges Offline-Installations-ZIP (npm-Cache, ONNX/WASM, Modell und Lizenzen) gebaut, in einem frischen Verzeichnis mit `npm_config_offline=true` installiert und anhand SHA-256 versiegelt. Außerdem werden die publizierten Images als separate ARM64-/AMD64-Docker-TARs gesichert und ohne Netzwerkverbindung getestet. Das `latest`-Tag wird erst nach erfolgreichem Abschluss aller Release-Jobs befördert.

Für Archivierung und Wiederherstellung siehe [Offline-Releases](OFFLINE_RELEASES.md). Ein normales `git archive` enthält weiterhin **keine** großen KI-Dateien oder npm-Cache; diese sind ausschließlich im Offline-Artefakt enthalten.
