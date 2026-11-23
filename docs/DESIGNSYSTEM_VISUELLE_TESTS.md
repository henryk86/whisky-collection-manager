# Visuelle Regressionen – Bedienungsanleitung

Die visuellen Tests verwenden die bereits in CI vorhandene Chromium-Installation. Sie benötigen **keine zusätzliche npm-Abhängigkeit** für Bilddiffs und rufen keine externen Dienste auf. Die funktionalen Playwright-Browsertests bleiben unabhängig davon bestehen.

## Ausführen

```bash
npm run check
npm test
npm run test:browser
npm run test:visual
```

Auf einem Rechner ohne Playwright-Installationspfad kann eine vorhandene Chromium-Binärdatei gewählt werden:

```bash
WCM_VISUAL_BROWSER_PATH=/usr/bin/chromium npm run test:visual
```

Die CI konfiguriert den Pfad zur gepinnten Chromium-Binärdatei selbst. `npm run test:visual` startet einen isolierten Testserver und kontrollierte Browser-Sitzungen; die Anwendung wird nicht verändert.

## Bildreferenzen bewusst ändern

1. Die relevante Produktänderung und die alte/nachfolgende Darstellung in einem PR dokumentieren.
2. Lokal `npm run visual:update` **bewusst** ausführen. Dieser Befehl ist unter `CI=true` gesperrt.
3. Die geänderten PNGs und JSON-Geometrien unter `tests/visual/baselines/` vergleichen und manuell freigeben.
4. `npm run test:visual` erneut ausführen, dann den PR durch alle regulären Tests prüfen lassen.

Ein fehlgeschlagener visueller Test aktualisiert **niemals** eine Referenz. Die geprüften Screenshots sind nicht die historischen Phase-0-Dokumentationsbilder: Der automatisierte Referenzstand entspricht dem korrigierten Phase-5-Layout mit deterministischen Testdaten.

## Fehlersuche

`test-artifacts/designsystem-visual/report.json` enthält pro Bild ID, Differenzprozente, Bounding-Box-Abweichungen und Pass/Fail. Nur bei Fehlern werden zusätzlich `actual/` und rot hervorgehobene `diff/`-PNG-Dateien geschrieben. Diese Dateien werden von GitHub Actions für PRs als Artefakte hochgeladen. Die Bilder werden nicht nach einem Fehltest automatisch als neue Goldens akzeptiert.

**Schwellen:** RGB-Summendifferenz über 36 je Pixel; maximal 2 % geänderte Pixel im Bild; höchstens 2 px Unterschied bei relevanten Bounding Boxes; kein horizontaler Dokumentüberlauf. Diese Schwellen sind im Skript dokumentiert und sind kein Ersatz für manuelle visuelle Kontrollen.

## Ausnahmen

Der Test arbeitet mit einem Desktop-Chromium bei 390/768/1024/1440 px, nicht mit echtem iOS Safari/Android Chrome. Fonts/Animationen, die Browserzeit (23.11.2026, 12:00 UTC), Zeitzone Europe/Berlin und Locale de-DE werden für die Aufnahmen stabilisiert. Fotoeditor, WebGL-3D-Lager und Screenreader benötigen zusätzlich manuelle/gerätebasierte Prüfungen. Phase-0-Screenshots waren teils Full-Page und nutzen andere Datenfixtures; ihre Differenzen sind historische Beobachtungen und **kein** CI-Grenzwert.

Weitere Grenzen und die Gesamt-Testmatrix: [Abschlussaudit](DESIGNSYSTEM_ABSCHLUSSAUDIT.md).
