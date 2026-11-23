# Visuelle Regressionstests

```bash
npm run test:visual   # Vergleichen, Referenzen bleiben unverändert
npm run visual:update # Nur nach bewusster Freigabe neuer UI-Baselines
```

Die Baselines liegen in `tests/visual/baselines/` und decken **17 deterministische Zustände × 4 Breiten (390/768/1024/1440 px) × 2 Themes = 136 Referenzen** ab. Browserbedingungen, Schrift-Fallback, Animationen und Testdaten sind kontrolliert. Tests prüfen sowohl Screenshots als auch relevante DOM-Geometrien.

Bei Abweichungen entstehen aktuelle Screenshots, Differenzbilder und maschinenlesbare Berichte unter `test-artifacts/designsystem-visual/`; GitHub Actions lädt diese bei PR-Prüfungen hoch. **CI aktualisiert Baselines niemals automatisch.** Änderungen müssen lokal überprüft, als expliziter Diff committet und im PR bewertet werden.

Der visuelle Vergleich ersetzt weder Playwright-Interaktionstests noch iOS-/Android-/Safari-Prüfungen. Historische Vergleichsbilder sind keine fortlaufenden Dokumentationsdateien; nur die aktuell freigegebenen Baselines sind maßgeblich.
