# Visuelle Referenzen

136 freigegebene Referenzbilder und Geometriedateien für 17 definierte Zustände,
vier Viewportbreiten und beide Themes. `manifest.json` dokumentiert die
ursprüngliche Browser-Version.

- `npm run test:visual`: **verpflichtende** Geometrie-, Überlauf- und
  Modal-Interaktionsprüfungen. Pixelabweichungen werden **nur diagnostiziert**.
- `npm run test:visual:strict`: optionaler **strenger Pixelvergleich** ohne
  pauschale Prozenttoleranz. Er startet nur, wenn die Chromium-Version exakt
  der Version in `manifest.json` entspricht. Eine Abweichung ist ein
  Konfigurationsfehler, kein angeblicher Layoutfehler.
- `npm run visual:update`: nur lokal nach bewusster UI-Freigabe; in CI verboten.
  Referenzen mit der **gleichen gepinnten Chromium-Version und CI-Umgebung**
  erstellen und den Bilddiff ausdrücklich im PR prüfen.

Die CI speichert `test-artifacts/designsystem-visual/report.json` sowie aktuelle
Screenshots und rot markierte Differenzbilder für jede erkannte Pixeländerung.
Der Prozentwert im Bericht ist ein **Diagnosewert, kein Akzeptanzkriterium**.
Eine bestandene Geometrieprüfung bedeutet nicht automatisch identische Optik.

Details: [Visuelle Tests](../../docs/DESIGNSYSTEM_VISUELLE_TESTS.md).
