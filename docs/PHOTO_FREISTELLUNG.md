# Flaschenfotos automatisch freistellen (ab v0.16.0)

## Funktionsumfang

In **Sammlung → Abfüllung → physische Flasche → Fotos** kann eine eigene Aufnahme mit **„Foto aufnehmen“** über die Smartphone-Kamera erstellt oder über **„Fotos hinzufügen“** hochgeladen werden. Der neue Foto-Button „Freistellen“ öffnet einen Vergleich zwischen Original und KI-Freistellung. Das Ergebnis wird erst beim Klick auf **„Freistellung übernehmen“** in der Sammlung gespeichert. Bei bestehenden Freistellungen lassen sich Original/Freistellung als aktive Variante umschalten oder die Freistellung entfernen. Der bisherige Button „Neu freistellen“ entfällt, da die Berechnung bei gleichem Ausgangsfoto und Modell deterministisch ist. Nur bei einem Berechnungsfehler wird „Erneut versuchen“ angeboten. Die Vergleichsansicht skaliert beide Bilder stets vollständig in ihre Vorschaurahmen (kein weiterer Beschnitt durch die Oberfläche). Auf schmalen Displays stehen die Vorschauen untereinander; der Dialog ist bei Bedarf scrollbar. Es gibt aktuell keinen manuellen Maskenpinsel und keine manuelle Drehkorrektur.

Die Berechnung läuft lokal auf dem Gerät des Browsers. Das Original wird **nie überschrieben**. Nach der Segmentierung wird die zentrale, ausreichend große zusammenhängende Hauptkomponente bestimmt. Nur diese Komponente (zuzüglich eines schmalen Antialias-Rands) wird im gespeicherten Alphakanal behalten; lose Randfragmente werden entfernt. Die vertikale Hauptachse wird anhand der tatsächlichen Originalbild-Proportionen bestimmt und eine leichte bis mäßige Schräglage (maximal 20°) korrigiert. Nahezu quadratische und stark geneigte Masken werden vorsichtshalber nicht gedreht. Danach wird **ohne absichtlich reservierten Abstand oben und unten** auf das exakte Seitenverhältnis **2:3** zugeschnitten; einzelne durch Canvas-Interpolation verbliebene transparente Zeilen werden durch einen zweiten Zuschnitt beseitigt. Transparenz links und rechts ergibt sich bei schlanken Flaschen zwangsläufig aus dem fest vorgegebenen Format. Nur bei außergewöhnlich breiten Motiven hat die vollständige Kontur Vorrang; solche Bilder benötigen notwendigerweise auch transparente Bereiche oben und unten. Nach der Drehung und Skalierung wird der **Alphakanal auf Endbildauflösung nachgeschärft**: sehr schwache Randpixel (Alpha ≤ 110/255) werden vollständig transparent, nahezu deckende Randpixel (Alpha ≥ 190/255) deckend; dazwischen bleibt eine schmale, geglättete Übergangszone statt eines breiten U²-Netp-Halos. Es wird ausschließlich Alpha verändert, nicht der ursprüngliche RGB-Inhalt oder das Originalfoto. Dieser Schritt verringert sichtbare Farbsäume am Glasrand, ersetzt aber keine perfekte Segmentierung; fehlerhaft eingeschlossene Hintergrundflächen können weiterhin auftreten. Ein neues PNG mit echtem Alpha-Kanal wird nur nach Bestätigung zum Server übertragen. Der Browser verwendet das quelloffene U²-Netp-Segmentierungsmodell mit ONNX Runtime Web (WASM/CPU, 1 Thread). Bei Glas/Reflexionen können Fehler auftreten; deshalb ist der Vergleich vor dem Speichern Pflicht. Es gibt **keinen** externen KI-Dienst und keine Browser-CDN-Aufrufe.

## Einmalige Bereitstellung der KI-Dateien

Die Modell- und Laufzeitdateien gehören **nicht** in Git (insgesamt mehrere MB). Sie werden beim Docker-Image-Build reproduzierbar heruntergeladen und im Image gespeichert. Der Raspberry Pi lädt oder berechnet die KI **nicht**: Er liefert nur die lokalen Dateien und empfängt das bestätigte Bild. Beim `docker compose pull` des fertigen GHCR-Images ist kein zusätzlicher Modell-Download nötig.

Bei **lokalem Betrieb ohne Docker** nach `npm ci` **einmalig** ausführen:

```bash
npm run cutout:prepare
npm run cutout:verify
```

Für die einmalige Vorbereitung bzw. den Docker-Build ist Internetzugriff zu Hugging Face oder GitHub (Modell) und jsDelivr oder unpkg (versionierte ONNX-Runtime-Dateien) nötig. Im laufenden Betrieb funktioniert die Freistellung offline. Falls die Dateien fehlen, schlägt die KI-Vorschau fehl, aber Originalfoto und bisherige Sammlungsfunktionen bleiben verfügbar. Ein vorhandenes Modell mit falscher SHA-256-Prüfsumme wird abgelehnt. Die angegebene Runtime-Version ist fest auf `1.31.1` gesetzt; die URL enthält die Versionsnummer. Die Dateien liegen danach unter `public/ai/` und werden vom lokalen WCM-Server ausgeliefert.

Lizenzhinweise: U²-Net / U²-Netp: Apache-2.0 (Original: <https://github.com/xuebinqin/U-2-Net>, Modell-Mirror: <https://huggingface.co/edgetools/u2netp>, SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`). ONNX Runtime Web: MIT, <https://github.com/microsoft/onnxruntime>. Apache-Lizenztext: [`public/ai/licenses/Apache-2.0.txt`](../public/ai/licenses/Apache-2.0.txt). Prüfe die Lizenzhinweise vor Weiterverbreitung geänderter KI-Modelle.

## Datenmodell

Das bestehende `collection.json`-Schema **4** bleibt bestehen. Ein Foto kann optional ein Feld `cutout` erhalten:

```json
{
  "id": "<photoId>",
  "path": "images/<bottleId>/photo-<photoId>.jpg",
  "cutout": {
    "path": "images/<bottleId>/photo-<photoId>-cutout-<uniqueId>.png",
    "model": "u2netp-v1",
    "selected": true
  }
}
```

`selected=true` steuert die Anzeige in Sammlung, Detail und Lager, nicht die Originaldatei. Bei `false` erscheint wieder das Original. Die Anzeigepräferenz bleibt beim Sortieren erhalten. Ein bereits gespeichertes Ergebnis wird nicht automatisch erneut berechnet; es kann entfernt und anschließend aus dem unveränderten Original neu erstellt werden. Das Original bleibt unverändert. Beim Löschen eines Fotos werden Original **und** Ableitung gelöscht. AES-256-ZIP-Backups enthalten beide Dateien automatisch (`images/` wird vollständig gesichert). Ein reiner Export von `collection.json` enthält **keine** Bilddateien.

## Fehlersuche

Falls der Browser `Failed to fetch dynamically imported module: .../ai/vendor/ort.wasm.min.mjs` meldet und die Entwicklerkonsole `application/octet-stream` als MIME-Typ anzeigt, ist mindestens **v0.16.1** erforderlich: `.mjs` muss als `text/javascript` ausgeliefert werden. Nach dem Update den Container neu bereitstellen und die Seite neu laden. Fehlende KI-Dateien dagegen separat mit `npm run cutout:verify` bei lokalen Installationen oder über den Docker-Image-Build prüfen.

## Sicherheit und Grenzen

- Nur registrierte Foto-/Flaschen-IDs werden akzeptiert; relative Dateipfade sind serverseitig validiert.
- Schreibend gelten die bisherigen CSRF-/Host-Regeln. Die Freistellung wird nur als PNG (max. 10 MB) angenommen; JPEG/WebP/GIF bleiben als **Originalfoto** weiter zulässig.
- Die automatische Ausrichtung wird nur bei plausibler, leichter bis mäßiger Schräglage (maximal 20°) angewendet; eine starke Schräglage wird nicht automatisch korrigiert. Die 0-px-Regel für obere/untere Ränder gilt für normal schlanke, vollständig erkannte Flaschen.
- Der Browser begrenzt die Höhe des 2:3-Ergebnisses auf maximal 1.600 px und reduziert sie erforderlichenfalls stufenweise bis auf 800 px, wenn das PNG sonst zu groß für die bestehende Upload-Grenze würde. Originalauflösung und Originalbytes bleiben erhalten.
- `Content-Security-Policy` erlaubt gezielt `wasm-unsafe-eval` für WebAssembly, nicht allgemeines `unsafe-eval`; der KI-Worker ist deaktiviert. Kameraaufnahme braucht HTTPS im Browser.
- Der Testlauf ohne die heruntergeladenen KI-Dateien kann API, Vergleichsansicht, Bildauswahl, Backups und das reine Masken-/Tensorformat prüfen, **nicht** echte ONNX-Inferenz oder Freistellqualität. Diese müssen nach dem einmaligen Asset-Download auf PC und Smartphone visuell abgenommen werden.
