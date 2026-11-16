# Release-Workflow: geschuetztes main, develop und automatische Versionen

## Commits und Entwicklung

- Alle normalen Aenderungen gehen direkt oder per PR nach `develop`. Der repo-lokale
  `commit-msg`-Hook (`npm run hooks:install`) und der CI-Check pruefen Conventional Commits.
- Auf `develop` wird **keine** Versionsnummer angehoben. `fix` bewirkt Patch,
  `feat` Minor, `!`/`BREAKING CHANGE` Major, wartungsreine Releases Patch.
- Ein Release beginnt **nur** nach einem manuell freigegebenen GitHub-PR
  `develop -> main` mit **Create a merge commit**. Dependabot-PRs werden
  niemals automatisch von diesem Workflow gemergt.

## Geschuetztes main und Versions-PR

1. Der GitHub-Release-Workflow validiert den gemergten `develop -> main`-PR,
   baut und prueft Anwendung, Browser-Suite, ZIP, Offline-Paket und Docker-Images.
2. Er erzeugt einen **eigenen getaggten Snapshot** `vMAJOR.MINOR.PATCH`.
   Darin stimmen `package.json`, Lockfile, README, Changelog, Teststatus/-historie
   und Quellmanifest mit der Version ueberein. Die Tag- und Image-Versionen sind gleich.
3. **Erst nach erfolgreichen Artefaktchecks** erstellt der Workflow von dem
   unveraenderlichen Tag den Branch `release/version-vX.Y.Z` und einen PR nach `main`.
   Exakt dieser automatische **Versions-PR darf von GitHub gemergt werden**; der
   Benutzer-PR `develop -> main` bleibt weiterhin manuell. Das Repository muss
   fuer `main` **Require a pull request before merging** beibehalten.
4. Die Action verwendet `gh pr merge --merge` oder GitHubs normales Auto-Merge
   (`--auto --merge`), **niemals** einen Admin-Bypass oder einen Direktpush nach
   `main`. Ein erforderlicher PR-Check darf nicht uebersprungen werden. GitHub
   darf den Versions-PR nur nach Erfuellung seiner Regeln mergen.
5. Erst wenn der Versions-PR wirklich gemergt ist, synchronisiert die Action
   **ausschliesslich `develop`**. Wenn dort weitere Commits vorliegen, bleiben
   sie erhalten; bei konkurrierenden Versionsdatei-Aenderungen oder einem
   drohenden Merge-Konflikt stoppt der Workflow und verlangt Klaerung.
6. Danach werden `latest` und das GitHub-Release aus dem Draft freigegeben.
   Der naechste Versionssprung findet erst beim naechsten *menschlichen*
   Release-Merge statt. Ein Versions-PR-Merge wird vom Release-Gate erkannt
   und darf **keinen** weiteren Release starten.

Die historischen Versionsangaben in Fachdokumenten werden nicht pauschal
ueberschrieben. Die aktuelle Version erscheint nach dem Release auf `main`
und `develop`, im Tag, ZIP, Docker-Image und im App-Footer.

## Einmalige GitHub-Einstellungen

1. **Settings -> Branches -> Branch protection rules -> main**:
   `Require a pull request before merging` **aktiv lassen**. Fuer diesen
   automatischen Version-PR muss `Create a merge commit` erlaubt sein.
   Kein Force-Push und keine Loeschung von `main` erlauben.
2. **Settings -> General -> Pull Requests**: `Allow auto-merge` aktivieren.
   Ein erforderlicher menschlicher Review fuer *jeden* `main`-PR ist mit einem
   vollstaendig automatisch gemergten Bot-PR nicht vereinbar; Statuschecks
   koennen dagegen bestehen bleiben.
3. **Settings -> Actions -> General -> Workflow permissions**:
   `Allow GitHub Actions to create and approve pull requests` aktivieren.
   Der Workflow fordert `contents: write` und `pull-requests: write` nur
   fuer die Version-PR-Aktion an.
4. **Wenn `main` erforderliche Statuschecks hat:** Mit dem normalen
   `GITHUB_TOKEN` erzeugte PRs koennen genehmigungspflichtige Workflow-Runs
   ausloesen. Fuer vollautomatische Pruefung und Merge kann optional das
   Repository-Secret **`WCM_RELEASE_PR_TOKEN`** mit einem Fine-Grained PAT
   (nur dieses Repository, Contents: Read/Write, Pull requests: Read/Write)
   angelegt werden. Es kostet nichts und wird ausschliesslich fuer den
   Versions-PR verwendet. Ohne Token wartet die Action bei blockierten
   Checks auf GitHub-Auto-Merge und endet mit einem klaren Fehler, falls die
   Checks nicht rechtzeitig freigeschaltet werden. Keine Schutzregel wird
   umgangen. `main`-Entwicklungs-PRs mergt der Bot nie.
5. **Settings -> General -> Default branch -> develop** (einmalig):
   GitHub eroeffnet **Sicherheitsupdates von Dependabot immer gegen den
   Default-Branch**. Nur wenn `develop` der Default-Branch ist, gehen somit
   sowohl Sicherheits- als auch Versionsupdate-PRs nach `develop`. Die
   `.github/dependabot.yml` setzt `target-branch: develop` fuer npm und Actions.
   Diese Datei muss auf dem Default-Branch vorhanden sein. Bereits offene
   Dependabot-PRs gegen `main` werden durch die Konfigurationsaenderung nicht
   automatisch umgestellt; diese bitte manuell umstellen oder schliessen.

## Wiederaufnahme eines zuvor gescheiterten Releases

Falls der alte Workflow bereits Tag, Draft, ZIP und Docker-Images erstellt hat,
aber erst beim verbotenen Direktpush auf `main` mit `GH006` scheiterte, **kein
neues Release dafuer berechnen**. Nach Aktivierung dieses Workflows auf dem
Default-Branch `develop` die Action **Recover previously built draft release**
manuell starten; erforderlich sind der vorhandene Tag und die 40-stellige SHA
seines urspruenglichen genehmigten `develop -> main`-Merges. Die Action prueft
PR-Ursprung, Tag, den vorhandenen Draft und dessen Artefakte und fuehrt dann
nur noch Versions-PR, `develop`-Abgleich und Veroeffentlichung durch. Falls
`main` seit dem urspruenglichen Merge bereits andere Commits erhalten hat,
stoppt die Wiederaufnahme bewusst statt fremde Aenderungen zu ueberschreiben.

Die beiden Standard-Release-Jobs sind idempotent; ein bereits gemergter
Versions-PR wird bei einer Wiederholung nicht erneut erstellt.

## Verifikation

```bash
npm run check
npm test
npm run hooks:install
node scripts/release-automation.js validate --range BASE..HEAD
node scripts/release-automation.js plan --json  # nur beim Release-Merge
```

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
