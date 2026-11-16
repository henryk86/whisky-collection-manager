# Teststatus - Whisky Collection Manager v1.4.0

**Stand:** 2026-11-16. **Status:** B-5-Umsetzung lokal mit Node- und Chromium-Verhaltenstests bestanden. Die GitHub-CI fuer **v1.4.0** wurde vom Projektbetreiber als bestanden bestaetigt; Zielsystempruefungen stehen noch aus. Fruehere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version, Metadaten und Quellmanifest v1.4.0 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Module, Uebersetzungen, Links, Verbot von Anwendungsquelltexttests und Deployment-Vertraege. |
| `npm test` | **532/532 bestanden** | Fach-Unit- und Integrationstests; ehemals statische Quelltexttests wurden entfernt, fachliche Verhaltenspruefungen beibehalten bzw. ersetzt. |
| `npm run test:browser` (Chromium DOM-Modus, 9 getrennte Fachsuiten) | **109 bestanden, 0 fehlgeschlagen, 1 uebersprungen** | Alle Fachsuiten einzeln vollstaendig abgeschlossen; die gemeinsame Ausfuehrung erreichte die lokale Zeitgrenze. Uebersprungen: echte HTTP-History-Navigation im DOM-Modus. |
| Neue B-5-Verhaltenstests | **8/8 bestanden** | Browser-Messungen fuer Lager/3D-nahe Layouts, Verkostungen, Import, Dialoge, Branding und Bildplatzhalter. |
| Deployment-Vertragstests | **8/8 bestanden** | Positivtest und sieben absichtlich verletzte Docker-/CI-Sicherheitsbedingungen. |
| GitHub Actions / regulaere Browsernavigation v1.4.0 | **Bestanden (Nutzerbestaetigung)** | GitHub-CI fuer v1.4.0 erfolgreich; andere Commits benoetigen eigene Abnahme. |
| Docker-Image / Raspberry Pi ARM64 / echte WebGL- und Mobilgeraete | **Nicht lokal ausgefuehrt** | Bei entsprechenden Aenderungen auf Zielsystemen separat pruefen. |

## Aenderungen v1.4.0

- Historische Tests, die CSS-/JS-Quelldateien anhand von Regex-Implementierungsdetails kontrollierten, entfernt; gerenderte HTML-Ausgaben und fachliche Datenregeln bleiben durch ihre bestehenden Verhaltenstests abgesichert.
- Neue Browserregressionen pruefen berechnete Lagerfachgeometrie, responsives Verkostungsformular, Import-Checkboxen, Modalzustaende, Bildplatzhalter und tatsaechlich geladene Bild-/Icon-Dateien.
- 3D-Mesh-Hervorhebung und Material-Ruecksetzung als ausgefuehrtes Domainverhalten geprueft statt per Quelltextsuche.
- Deklarative Docker-, HTTPS-, Backup-, Offline-Release- und GitHub-CI-Vertraege aus alten Unit-Quelltexttests in `scripts/check-deployment-config.js` ausgelagert und durch gezielte Negativtests abgesichert.
- `scripts/source-regex-budgets.json` entfernt; `npm run check` untersagt neue CSS-/JS-Anwendungsquelltexttests in Unit- und Integrationstests. [B-5-Teststrategie](TESTSTRATEGIE.md) und [TECHNISCHE_SCHULDEN.md](TECHNISCHE_SCHULDEN.md) aktualisiert.

## Offene Freigabe

- Das Code-Review-Thema B-5 ist **implementierungsseitig abgeschlossen**. Die regulare GitHub-Actions-Suite fuer diesen Commit ist vor einem Merge noch auszufuehren.
- Keine Aenderungen an Schema, Migration, Sammlung, Lagerdaten, API oder produktiver Fachlogik.

## Laufende Entwicklung: Release-Automatisierung nach v1.4.0 (B-6)

- Die GitHub-CI fuer **v1.4.0** wurde vom Projektbetreiber als bestanden bestaetigt.
- Die neue Release-Automatik ist noch **kein neues veroeffentlichtes Release**; der Semantic-Version-Sprung erfolgt erst beim naechsten freigegebenen Merge `develop -> main`.
- Lokal: `npm run check`, `npm run release:check` und **540/540 Node-Tests bestanden** (einschliesslich Git-Repositories fuer Merge-/Tag-/Retry-Faelle).
- Die erste GitHub-PR-Pruefung der B-6-Aenderungen fand eine fehlerhafte Annahme zur bereits vorhandenen Version auf `develop`. Der einmalige Uebergang wurde korrigiert, einschliesslich Git-Integrationstests fuer Version 1.4.0 auf `develop` und alte `main`-Staende. Ruleset-Abhaengigkeit entfernt; Release nur nach API-Nachweis eines echten `develop -> main`-PRs. Der regulaere Browser-CI-Lauf fuer die korrigierten B-6-Aenderungen steht aus; `npm ci` zum Nachinstallieren des lokalen Playwright-Pakets war in dieser Umgebung nicht erfolgreich (Zeitgrenze). Ein lokal nicht durchgefuehrter Browserlauf gilt nicht als bestanden.
- Kein Docker-/Raspberry-Pi-/Hardwaretest fuer diese Entwicklungsaenderung durchgefuehrt.
