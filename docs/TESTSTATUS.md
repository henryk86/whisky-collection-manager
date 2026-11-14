# Teststatus - Whisky Collection Manager v0.20.1

**Stand:** 2026-11-14. Die lokalen Quellcode- und Node-Pruefungen wurden nach der Workflow-Korrektur erfolgreich ausgefuehrt. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Versionsmetadaten v0.20.1 konsistent. |
| `npm run check` | **Bestanden** | 256 JavaScript-Dateien und 19 Markdown-Dateien, Sprachschluessel und relative Links geprueft. |
| `npm test` | **469/469 bestanden** | Unit- und Integrationstests, einschliesslich neuem Regressionstest fuer die GitHub-Release-Uploads ohne Checkout. |
| YAML-Syntax | **Bestanden** | `.github/workflows/release.yml` mit Ruby YAML-Parser geladen. |
| `node --test tests/unit/offline-release.test.js tests/unit/release-workflow.test.js` | **15/15 bestanden** | Workflow-Abhaengigkeiten, explizite Repository-Auswahl, Offline-Bundle-Verifikation. |
| GitHub Actions Release-Workflow | **Noch nicht ausgefuehrt** | Ob der Upload auf GitHub erfolgreich ist, muss nach Merge und neuem Release v0.20.1 bestaetigt werden. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | UI- und WebGL-Verhalten wurde nicht veraendert. |
| Docker-Archiv-Erstellung und ARM64-/AMD64-Import | **Nicht lokal ausgefuehrt** | Keine lokale Docker Engine; Build und Upload in GitHub Actions offen. |

## Aenderungen v0.20.1

- Der `docker-offline`-Job besitzt bewusst keinen Checkout; `gh release upload` konnte deshalb das Repository nicht aus `.git` ermitteln.
- Beide Asset-Upload-Schritte uebergeben `--repo "$GITHUB_REPOSITORY"`, sodass das Repository unabhaengig vom Arbeitsverzeichnis eindeutig feststeht.
- Regressionstest sichert die explizite Repository-Angabe fuer beide Upload-Schritte ab.

**Offen:** Vollstaendigen GitHub-Actions-Lauf und erfolgreiche Veroeffentlichung der Offline-Archive beobachten. Ein erneuter Lauf des alten v0.20.0-Workflows enthaelt diese Aenderung noch nicht.
