# Teststrategie und B-5-Abnahme

## Grundsatz

Tests pruefen **beobachtbares Verhalten**, Fachregeln, persistierte Daten, HTTP-Antworten und das im Browser gerenderte Ergebnis. Ein Test, der lediglich den Quelltext einer CSS- oder Anwendungs-JavaScript-Datei nach einer bestimmten Schreibweise durchsucht, ist kein Verhaltenstest. Solche historischen Tests wurden im B-5-Umbau entfernt und durch die unten genannten Tests ersetzt.

Der normale Check (`npm run check`) verbietet neue Quellcode-Leseassertions in `tests/unit/` und `tests/integration/`. Die fruehere Obergrenze `scripts/source-regex-budgets.json` ist entfernt: Es gibt keinen erlaubten Restbestand an Quelltext-CSS/JS-Tests mehr. **Regex auf erzeugtem HTML, API-Ergebnissen, Fehlermeldungen oder normalisierten Daten sind dagegen weiterhin legitime Verhaltenstests.**

## Abdeckung nach Bereich

| Frueher als Quelltext getestete Eigenschaft | Pruefung des tatsaechlichen Verhaltens |
| --- | --- |
| Lagerwand: Fachhoehen, Scrollen, Markierung, unbenutzbare Faecher und Inset-Rand | `tests/browser/b5-runtime-contracts.test.js`, `tests/browser/warehouse.test.js`, `tests/unit/warehouse-room-wall.test.js` |
| Lager/3D: Moebelgeometrie, Drehung, Sichtbarkeit, Hervorhebung und Anwahl | `tests/unit/warehouse-3d.test.js` (echtes Geometriemodell und simulierte Mesh-Materialien), `tests/browser/warehouse.test.js` (Navigation und Sichtbarkeit) |
| Verkostungsformular: Spalten, Aktionen, responsives Verhalten | `tests/browser/b5-runtime-contracts.test.js`, `tests/browser/tastings.test.js`, die Renderer-/Fachtests in `tests/unit/` |
| Fotobearbeitung, Bildplatzhalter, Icons und Markenlogo | `tests/browser/photos.test.js`, `tests/browser/b5-runtime-contracts.test.js`, `tests/integration/icons.test.js` (HTTP und echte Bildbytes) |
| Responsive Header, Abstaende, Kartenfarben und Seitennavigation | `tests/browser/layout-runtime.test.js`, `tests/browser/map-analytics.test.js`, `tests/browser/b5-runtime-contracts.test.js` |
| Whiskybase-Auswahl, Importsteuerung und Sicherungsdialoge | `tests/browser/b5-runtime-contracts.test.js`, `tests/integration/api.test.js`, `tests/integration/backups.test.js` |
| Daten-, Cache-, Migrations-, Restore- und Sicherheitsregeln | Fach-Unit-Tests sowie HTTP-/Datei-Integrationstests; keine Suchen nach Implementierungszeilen |
| Release-, Docker-, HTTPS- und GitHub-Workflow-Vertraege | `scripts/check-deployment-config.js` in `npm run check`, Negativtests unter `tests/integration/deployment-contracts.test.js`; echter CI- und Image-Build bleiben separate Laufzeitpruefungen |

## Zusaetzliche Designsystem-Snapshot-Abnahme

In Pull Requests prueft `npm run test:visual` den kontrollierten Chromium-Zustand gegen **reviewte** PNG- und Geometriereferenzen (`tests/visual/baselines`). Screenshots und rote Pixel-Differenzbilder werden bei Abweichungen als GitHub-CI-Artefakte bereitgestellt. **Keine automatische Baseline-Aktualisierung bei Testfehlern.** Eine Referenzaktualisierung erfolgt nur lokal und explizit (`npm run visual:update`) mit PR-Sichtpruefung; die CI lehnt Aktualisierungen ab. Details: [Visuelle Tests](DESIGNSYSTEM_VISUELLE_TESTS.md) und [Abschlussaudit](DESIGNSYSTEM_ABSCHLUSSAUDIT.md). Der Screenshotlauf ergaenzt, ersetzt aber nicht die bestehenden Playwright-Browsertests.

## Verbindlicher Ablauf

1. `npm run check` prueft Syntax, Modulgrenzen, Sprachdateien, Links, das Verbot neuer Quelltexttests und deklarative Deployment-Vertraege.
2. `npm test` prueft Fachregeln, Rendering-Ausgaben, API, Persistenz, Restore, Sicherheitsreaktionen und Negativfaelle.
3. `npm run test:browser` prueft die Anwendung und ihre CSS-Geometrie in Chromium. Im eingeschraenkten DOM-Modus ist der echte HTTP-History-Fall uebersprungen; ein solcher Lauf ist daher **keine vollstaendige CI-Freigabe**.
4. Die PR-Pflicht auf dem **oeffentlichen, geschuetzten `main`** bleibt aktiv. Der Benutzer prueft den gruennen PR-Status, bevor er `develop -> main` selbst mergt; die Release-Action verifiziert die PR-Herkunft und den Merge-Commit erneut. `npm run check`, `npm test` und die vollstaendige Browser-CI pruefen den Merge-Quellstand **vor** der Tag-Erstellung; der getaggte Snapshot besteht anschliessend eigene Metadaten-/Manifestchecks und ZIP-/Offline-/Docker-Pruefungen. Die Version wird **nicht direkt** auf `main` gepusht: Nach den Artefaktchecks entsteht ein Versions-PR aus dem unveraenderlichen Tag, den der Bot nur bei erfuellten PR-Regeln mergen darf. Erst dann synchronisiert die Action `develop`. Abweichungen und Metadatenkonflikte stoppen den Vorgang, statt die Branches atomar zu ueberschreiben. Docker-/ARM64-/WebGL-Hardware pruefen, wenn die betroffenen Laufzeitkomponenten veraendert werden.

Ein fehlgeschlagener Test darf nicht durch blosses Entfernen seiner Assertion behoben werden. Beim Ersatz einer Quelltextpruefung muss der Zweck in mindestens einem vorhandenen oder neu hinzugefuegten Verhaltens-/Deployment-Test wiederzufinden sein.

## Laufzeit- und Betriebsabnahme (N-5)

Auf einem Raspberry Pi mit dem tatsaechlich eingesetzten Datenbestand die Antwortzeiten fuer `GET /api/collection`, `GET /api/warehouse` und den bedingten GET (`If-None-Match` aus der vorherigen Antwort) messen. Auch eine Schreiboperation mit einem Test-/Backup-Datenstand pruefen; nicht blind in der produktiven Sammlung ausfuehren. Hardwaremodell, Node-Version, Datenmenge und Messwerte festhalten. Beispielbefehle direkt auf dem Pi (ausschliesslich gegen die Loopback-Adresse; `-k` ignoriert nur dort das lokale Zertifikat):

```bash
curl -ksS -o /dev/null -w 'collection GET: %{http_code} %{time_total}s\n' https://127.0.0.1:3543/api/collection
curl -ksS -o /dev/null -w 'warehouse GET: %{http_code} %{time_total}s\n' https://127.0.0.1:3543/api/warehouse
ETAG=$(curl -ksS -D - -o /dev/null https://127.0.0.1:3543/api/collection | sed -n 's/^[Ee][Tt][Aa][Gg]:[[:space:]]*//p' | tr -d '\r')
curl -ksS -o /dev/null -w 'collection 304: %{http_code} %{time_total}s\n' -H "If-None-Match: $ETAG" https://127.0.0.1:3543/api/collection
```

Alle drei GET-Messungen mehrfach wiederholen; Median statt Einzelwerte ausweisen. Eine Schreiboperation nur in einem getrennten Test-Datenverzeichnis messen.

Im GitHub-Repository `main` als Default, Required-Checks, PR-Schutz, kein Force-Push, `Allow auto-merge` und die Einhaltung der Versions-PR-Beschraenkung kontrollieren. Die Quellcodepruefungen belegen die Live-Einstellungen **nicht**. Mit angemeldetem GitHub CLI kann der Betreiber die Rulesets und die Branch-Protection rein lesend inspizieren:

```bash
gh api repos/henryk86/whisky-collection-manager/rulesets
gh api repos/henryk86/whisky-collection-manager/branches/main/protection
```

Je nach verwendetem Ruleset kann die zweite Abfrage 404 liefern, obwohl die erste aktiv geschuetzte Regeln zeigt. Daher beide Ergebnisse und die GitHub-Oberflaeche gemeinsam pruefen. Weitere Freigaben bleiben beim Repository-Eigentuemer; ein Assistent fuehrt keine normalen PR-Merges aus.

Ein Develop-Commit aendert den Quellcode, aber nicht den zuvor veroeffentlichten `wcm-source-manifest.json`. Erst die Release-Snapshot-Erstellung erzeugt ein neues Manifest; `release:check` prueft unveraenderliche Release-Staende und ist kein allgemeiner Develop-Check.
