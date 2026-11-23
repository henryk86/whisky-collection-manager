# Visuelle Tests und Freigabe

## Prüfungen

```bash
npm run test:browser        # Playwright: Navigation, Fokus, Bedienung, Scroll
npm run test:visual         # verpflichtend: Geometrie, Überlauf, Modalinteraktion
npm run test:visual:strict  # optional: Pixelvergleich bei exakt passender Browser-Version
npm run visual:update       # ausschließlich manuelle Baseline-Freigabe
```

`test:visual` erzeugt **136 Aufnahmen** (17 Zustände × vier Breiten
390/768/1024/1440 px × Hell-/Dunkelmodus) mit festen Testdaten,
Browserzeit, Locale, Fonts und deaktivierten Animationen. Der Lauf prüft:

- Positionen und Abmessungen wichtiger UI-Bereiche gegen die freigegebenen
  Geometrie-Dateien; Abweichungen über 2 px schlagen fehl.
- Horizontalen Überlauf und Screenshotabmessungen.
- Modal-Fokus, Tab-Falle, Escape, Wiederherstellung verschachtelter Flight-Formulare,
  Hintergrundscroll und wiederholtes Öffnen/Schließen.

**Verpflichtend für PRs:** funktionale Browserprüfungen und die genannten
Geometrie-/Interaktionsprüfungen. Sie können einen PR blockieren.

**Nur Diagnose:** Pixeländerungen an den Bildern. Der bisherige globale
2-%-Grenzwert ist kein CI-Fehlerkriterium mehr. Ein Farb- oder Iconfehler kann
unter 2 % liegen, während eine andere Schrift-Engine ohne UI-Fehler deutlich
mehr Pixel ändern kann. Bei jeder erkannten Pixeländerung werden aktuelle Screenshots und rote
Differenzbilder als CI-Artefakte gesichert; sämtliche Pixelwerte stehen im
JSON-Bericht. Auch kleine Icon-Änderungen bleiben so erkennbar.

## Browser und Baselines

Die CI installiert Chromium über die in `package-lock.json` gepinnte
`playwright-core`-Version und verwendet genau deren Executable. Die ursprünglichen
Baselines wurden mit einer anderen Chromium-Version aufgezeichnet. Der
JSON-Bericht nennt **beide** Versionen und warnt verständlich bei Abweichung.

`test:visual:strict` verweigert den Vergleich bei abweichenden Versionen
*bevor* Einzelbilder geprüft werden. Strikte Pixelprüfungen dürfen erst nach
bewusster Referenzfreigabe mit passender CI-/Font-Umgebung verbindlich werden.
Anschließend müssen sie in mehreren unveränderten CI-Läufen reproduzierbar sein.

**Keine automatische Referenzaktualisierung.** `visual:update` ist in CI
verboten. Bildreferenzen werden nur nach Sichtprüfung mit einem expliziten
Commit aktualisiert. Nicht einfach Schwellenwerte erhöhen oder Unterschiede
pauschal maskieren: tatsächliche Fehler an Fokusrahmen, Text und Icons müssen
im Vergleich erkennbar bleiben.

Diagnose unter `test-artifacts/designsystem-visual/`:
`report.json`, `actual/*.png` und `diff/*.png`. Screenshots zeigen nur den
1100-px-Ausschnitt; längere Seiten sowie Safari, Firefox und echte Mobilgeräte
benötigen weiterhin gesonderte Prüfungen.
