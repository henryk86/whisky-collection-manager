# Designsystem Phase 1 – Prüfbericht

**Stand:** 23.11.2026. **Ausgang:** ausschließlich `whisky-collection-manager-develop(2).zip` (SHA-256 `10f70703020bba0896c6f98ae4b140282f8e5ec7e28d94f90faae72f44f067a5`), Anwendungsversion `1.12.0`. Einzelentwicklung auf `develop`: kein Versionsbump nach `AGENTS.md`.

## Automatisierte Prüfung des geänderten Projektstands

| Prüfung | Ergebnis | Einschränkung |
|---|---|---|
| `npm run check` | **bestanden** | 370 JS-Dateien, 23 Markdown-Dateien, Module, Links, Deployment-Verträge |
| `npm test` | **673 bestanden, 0 fehlgeschlagen** | Node v22.16.0 |
| `npm run test:browser` | **122 bestanden, 2 fehlgeschlagen, 1 übersprungen** (125 gesamt) | Chromium im projektinternen `WHISKY_BROWSER_DOM_ONLY=true`-Modus; Playwright-Core-Laufzeit aus vorhandenem Python-Playwright `1.57.0-beta`, nicht die im Projekt festgeschriebene `1.65.1` |
| `node --test tests/browser/designsystem-tokens.test.js` | **1 bestanden, 0 fehlgeschlagen** | dieselbe DOM-only-Browserumgebung; Theme-/Token-/Geometrievertrag bei 390/768/1024/1440px in Hell/Dunkel |
| Vorher/Nachher-Bildvergleich | **40/40 pixelidentisch** (0 geänderte Pixel) | fünf synthetische Zustände × vier Breiten × zwei Themes; oberer 900/844px-Viewport, keine Vollseiten- oder Hardware-Abnahme |
| Horizontaler Überlauf | **0px in allen 40 Vergleichen** | dieselben fünf Zustände |

### Zwei bestehende Browserfehlschläge

- `browser: concurrent bottling submits and Enter repeat create only one record` (`tests/browser/collection.test.js:1346`): Timeout beim Warten auf das Entfernen von `#bottling-form`.
- `browser: concurrent bottle submits create once; HTTP POST failure allows another attempt` (`tests/browser/collection.test.js:1372`): Timeout beim Warten auf das Entfernen von `#bottle-form`.

**Gegenprobe:** Beide Tests wurden isoliert, mit **derselben Chromium-/DOM-only-/Playwright-Konfiguration**, direkt auf einer unmodifizierten Entpackung des Upload-ZIPs erneut ausgeführt. **Beide schlugen dort ebenfalls mit demselben 30-Sekunden-Timeout und demselben verbleibenden Formular fehl.** Daraus folgt: Für diese Testumgebung liegt **keine neu eingeführte Regression durch Phase 1** vor. Nicht daraus folgt, dass die Formulare in jeder Umgebung fehlerfrei sind. Der reguläre GitHub-CI-Lauf mit dem in `package.json` gepinnten Playwright `1.65.1` bleibt für eine uneingeschränkte Freigabe erforderlich.

Ein `npm ci`-Versuch im isolierten Container erreichte das Zeitlimit. Um dennoch Browsertests auszuführen, wurde ausschließlich in der **temporären lokalen Testkopie**, nicht in den auszuliefernden Projektquellen oder in der ZIP-Datei, ein Symlink auf das vorhandene Playwright-Core-Paket der Python-Umgebung gesetzt. Es wurden keine zusätzlichen Projektabhängigkeiten registriert.

### Visuelle Stichprobe

Verglichen wurden die Ansichten `empty-collection`, `collection`, `bottling-detail`, `analysis` und `settings` bei **390, 768, 1024, 1440px**, jeweils `light` / `dark`. Quelle war ein temporärer Testserver mit synthetischen Daten und dem projektinternen DOM-only-Lademodus. Die 40 Referenzpaare sind bildpunktgenau gleich; die alten Variablen, Schriften, Buttons, Panels und Seitengeometrien ergaben dieselben beobachteten Werte. Der Vergleich schließt keine Änderungen an allen verdeckten/gescrollten Bereichen aus; diese werden durch die zusätzlich bestandenen Layout- und Komponententests teilweise abgedeckt.

### Weiterhin offene Freigaben

- Browser-CI mit den **exakt gepinnten** npm-Abhängigkeiten (insbesondere Playwright `1.65.1`), normalem `page.goto()` statt DOM-only-Modus.
- Physische Geräteprüfungen in iOS Safari und Android Chrome, unter 390px zusätzlich 320/360px Grenzfälle.
- Interaktive 3D-Lageransicht, Scanner, WebGL, extern geladene Kartentiles, verschachtelte Dialoge, Bildsortierung und Bilderlöschung mit Scrollrestore; hierbei besonders auf Fokus/Scrollposition und Themewechsel achten.
- Vollseiten-Screenshot-Diffs und echte Datenzustände über die fünf getesteten Erstansichten hinaus.

**Bewertung:** Die bei dieser CSS-Tokens-/Layout-Primitiven-Einführung geprüften Layouts sind unverändert. Die zwei gezielten Browserfehlschläge sind auf dem **unveränderten Ausgangsstand reproduzierbar** und daher kein Phase-1-spezifischer Befund. Der vollständige Browser-CI-Gate ist in dieser Umgebung gleichwohl **nicht grün**; dies bleibt ausdrücklich dokumentiert.
