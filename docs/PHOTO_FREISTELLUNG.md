# Fotos freistellen und bearbeiten

Die Flaschengalerie hält Originalfotos, optionale transparente PNG-Freistellungen und nicht-destruktive WebP-Bildkorrekturen getrennt. Sortieren und Auswahl einer Variante verändern nicht das Original. Ein vollständiges Backup enthält Originale und Ableitungen unter `images/`; der reine JSON-Export enthält nur Metadaten und Dateipfade.

## Lokale KI-Freistellung

Das Modell U²-Netp und ONNX Runtime Web laufen **im Browser**; Bilddaten werden dafür nicht an einen externen Inferenzdienst übertragen. Die Modell-/Runtime-Dateien müssen beim Setup einmalig verfügbar sein:

```bash
npm run cutout:prepare
npm run cutout:verify
```

Für den erstmaligen Download kann Internet nötig sein; im laufenden Betrieb funktioniert die Funktion offline. Fehlen Modell-Dateien, bleibt die normale Fotoverwaltung verfügbar. Modell- und Runtime-Lizenzbedingungen sind für Weiterverteilung zu beachten; die Apache-2.0-Lizenz befindet sich unter [`public/ai/licenses/Apache-2.0.txt`](../public/ai/licenses/Apache-2.0.txt).

Die Freistellung erzeugt ein transparentes PNG und hält das Original unverändert. Die Auswahl der aktuellen Darstellung ist in den Fotometadaten gespeichert (`cutout.selected`). Rotation wird nur bei plausiblen Schräglagen bis 20° automatisch angewendet. Der Export begrenzt die Dateigröße auf 10 MB und die Bildabmessungen auf maximal 4096 px.

## Bildeditor

Neun nicht-destruktive Parameter: Belichtung, Kontrast, Lichter, Tiefen, Temperatur, Tönung, Sättigung, Klarheit und Schärfe. Auto-Korrektur, Zurücksetzen, Gruppen-Reset, Vorher-Ansicht und Weißabgleich-Auswahl sind verfügbar. Weißabgleich passt nur Temperatur und Tönung anhand einer geeigneten neutralen Bildfläche an.

Das Bild wird bei jedem Speichern aus der **unveränderten gewählten Quelle** neu berechnet; Korrekturen werden nicht wiederholt auf zuvor korrigierte Pixel angewendet. Original und Freistellung besitzen je eigene Korrekturparameter und Ableitungen (`photo.adjustment`, `photo.cutout.adjustment`). Vorschau-Zoom, Bildverschiebung und Maskenpinsel sind nicht-destruktiv. Abbrechen speichert nichts.

## Datenformat und Sicherheit

Alle optionalen Fotofelder gehören zum aktuellen **Collection-Schema 7**. Bild-Dateipfade und IDs werden serverseitig geprüft; schreibende Operationen unterliegen den geltenden CSRF-/Host-Regeln. Die lokalen Modelle benötigen die freigegebene WebAssembly-CSP-Einstellung; Kameraaufnahme benötigt HTTPS.

Die API für Fotokorrektur und Dateien ist unter [API](API.md#bildkorrekturen) aufgeführt. Bei Problemen mit `.mjs`-Modulen muss der Server `text/javascript` ausliefern; Modelldateien separat mit `npm run cutout:verify` prüfen. Funktionstests ohne heruntergeladene Modellbytes beweisen keine reale ONNX-Inferenzqualität.
