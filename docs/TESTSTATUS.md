# Teststatus - Whisky Collection Manager v1.4.0

**Stand:** 2026-11-16. **Status:** B-5-Umsetzung lokal mit Node- und Chromium-Verhaltenstests bestanden. Der regulaere GitHub-Actions-Browserlauf fuer **v1.4.0** und Zielsystempruefungen stehen noch aus. Fruehere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version, Metadaten und Quellmanifest v1.4.0 konsistent. |
| `npm run check` | **Bestanden** | Syntax, Module, Uebersetzungen, Links, Verbot von Anwendungsquelltexttests und Deployment-Vertraege. |
| `npm test` | **532/532 bestanden** | Fach-Unit- und Integrationstests; ehemals statische Quelltexttests wurden entfernt, fachliche Verhaltenspruefungen beibehalten bzw. ersetzt. |
| `npm run test:browser` (Chromium DOM-Modus, 9 getrennte Fachsuiten) | **109 bestanden, 0 fehlgeschlagen, 1 uebersprungen** | Alle Fachsuiten einzeln vollstaendig abgeschlossen; die gemeinsame Ausfuehrung erreichte die lokale Zeitgrenze. Uebersprungen: echte HTTP-History-Navigation im DOM-Modus. |
| Neue B-5-Verhaltenstests | **8/8 bestanden** | Browser-Messungen fuer Lager/3D-nahe Layouts, Verkostungen, Import, Dialoge, Branding und Bildplatzhalter. |
| Deployment-Vertragstests | **8/8 bestanden** | Positivtest und sieben absichtlich verletzte Docker-/CI-Sicherheitsbedingungen. |
| GitHub Actions / regulaere Browsernavigation v1.4.0 | **Ausstehend** | Der lokale DOM-Modus ersetzt keinen gruenen CI-Lauf fuer den neuen Commit. |
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
