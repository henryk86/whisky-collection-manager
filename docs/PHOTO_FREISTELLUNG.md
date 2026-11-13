# Flaschenfotos automatisch freistellen (ab v0.16.0)

## Funktionsumfang

In **Sammlung → Abfüllung → physische Flasche → Fotos** können Bilder über **„Fotos hinzufügen“** oder **„Foto aufnehmen“** hinzugefügt werden. **Ein einzelnes Stift-Symbol öffnet den Bildeditor**: Auf der linken beziehungsweise oberen Seite ist **eine einzige Vorschau**, nicht mehr der alte Zwei-Bilder-Vergleich. Der Button **„Flasche freistellen“** beziehungsweise **„Neu freistellen“** berechnet die Freistellung innerhalb des Editors; das transparente Ergebnis erscheint direkt in derselben Vorschau. Die **Bildfläche links bleibt beim Umschalten unverändert groß**; rechts stehen die Tabs **Anpassungen** (Belichtung, Kontrast, Lichter/Tiefen, Weißabgleich, Details) und **Freistellung** (Erkennung, Auswahl, Radierer, Wiederherstellen, Pinselgröße und Undo) zur Verfügung. Auf schmalen Bildschirmen stehen die Tabs unter dem Bild. Erst **„Speichern“** übernimmt Freistellung und Bildkorrekturen gemeinsam. **„Abbrechen“** verwirft alle noch nicht gespeicherten Änderungen. Ab v0.17.5 wechseln **„Original anzeigen“** und **„Freistellung anzeigen“** ausschließlich die Vorschau im geöffneten Editor; der Dialog bleibt offen und die gespeicherte Anzeigeauswahl bleibt bis **„Speichern“** unverändert. Die beiden Varianten behalten ihre eigenen Reglerwerte. Zoom und **„Vorher anzeigen“** liegen platzsparend als Bedienelemente am unteren Bildrand; sie beeinflussen nur die Vorschau, nicht die exportierten Bildpixel. Seit v0.17.7 vergleicht **„Vorher anzeigen“ bei aktiver Freistellung das vollständige, noch nicht freigestellte Originalfoto** mit dem aktuellen, transparenten Ergebnis. Das gilt unmittelbar nach der ersten Freistellung ohne Farbkorrekturen und ebenso nach dem späteren erneuten Öffnen. Es erzeugt keine weiteren Dateien und verändert weder Auswahl noch Farbregler. Der Hinweistext erstreckt sich über die ganze Editorbreite, sodass rechts mehr Platz für die Regler bleibt. Die gespeicherte Freistellung lässt sich weiterhin über **„Original anzeigen“** deaktivieren oder mit **„Freistellung entfernen“** löschen. Ab v0.17.3 können die Ränder einer ausgewählten oder gerade erzeugten Freistellung mit **Radierer** und **Wiederherstellen** (Pinselgröße 1–15 %) nachgebessert werden. **Pinselstrich rückgängig** entfernt die letzte lokale Änderung. Wiederherstellen setzt nur Alpha zurück, das in der aktuellen Freistellungsbasis vorhanden war; vom Modell vollständig ausgeschnittene Bereiche können ohne erneute Segmentierung nicht rekonstruiert werden. Eine manuelle Drehkorrektur gibt es weiterhin nicht.

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
- Der Browser rendert das 2:3-Ergebnis zunächst in der **nativen Pixelhöhe des Zuschnitts**, maximal 4096 px. Nur falls das resultierende PNG die Upload-Grenze von 10 MB überschreiten würde, wird stufenweise verkleinert. Das Original bleibt immer unverändert. Höhere Pixelauflösung verbessert die RGB-Schärfe, nicht die begrenzte Genauigkeit des 320 × 320 großen KI-Maskenmodells.
- `Content-Security-Policy` erlaubt gezielt `wasm-unsafe-eval` für WebAssembly, nicht allgemeines `unsafe-eval`; der KI-Worker ist deaktiviert. Kameraaufnahme braucht HTTPS im Browser.
- Der Testlauf ohne die heruntergeladenen KI-Dateien kann API, Einzelvorschau, Bildauswahl, Backups und das reine Masken-/Tensorformat prüfen, **nicht** echte ONNX-Inferenz oder Freistellqualität. Diese müssen nach dem einmaligen Asset-Download auf PC und Smartphone visuell abgenommen werden.

## Bildkorrekturen (ab v0.17.0)

In der Flaschengalerie öffnet das **Stift-Symbol** einen lokalen, nicht-destruktiven Bildeditor. Die Vorschau reagiert unmittelbar auf neun Regler: Belichtung (−2 bis +2 EV), Kontrast, Lichter, Tiefen, Farbtemperatur, Tönung (Grün/Magenta), Sättigung, Klarheit und Schärfe. Die Regler sind nach Licht, Farbe und Details gegliedert. **„Automatisch“** ermittelt eine bewusst zurückhaltende Korrektur aus den sichtbaren, deckenden Bildpunkten; **„Vorher anzeigen“** wechselt zwischen Originalquelle und aktuellem Ergebnis. **„Zurücksetzen“** setzt alle neun Werte auf null. Das kleine Reset-Symbol oben rechts in jedem Reglerblock setzt dagegen nur **Licht**, **Farbe** oder **Details** zurück; die anderen beiden Gruppen bleiben erhalten. Die **Weißabgleich-Pipette** im Block *Farbe* aktiviert eine Bildbereichsauswahl: Eine möglichst neutralgraue oder weiße, nicht überbelichtete Fläche auf dem Foto mit Maus oder Finger markieren (ein einfaches Tippen verwendet eine kleine Umgebung). Die markierten Originalpixel bestimmen ausschließlich die Werte *Temperatur* und *Tönung*, während Belichtung, Kontrast und sämtliche anderen Regler erhalten bleiben. Halbtransparente Bereiche, zu dunkle Pixel und ausgebrannte Lichter werden verworfen. Falls kein geeigneter Referenzbereich erkennbar ist, bleiben die bisherigen Werte unverändert. Eine farbige Fläche, z. B. ein Etikett, ist **kein** geeigneter Weißabgleich-Referenzpunkt. Erst **„Speichern“** überträgt das gerenderte Bild. **„Abbrechen“** verändert die Sammlung nicht.

Der Editor lädt als Ausgangspunkt das aktuell ausgewählte Original oder das gespeicherte Freistellungsbild. Korrekturen werden stets **aus dieser unveränderten Quelle neu gerechnet**, nicht auf die letzte Ableitung angewendet. Neben der Quelle bleiben die neun Zahlenwerte und ein separat generiertes WebP gespeichert. Ein erneutes Öffnen stellt die Regler wieder her; wiederholtes Speichern überschreibt niemals das Original. Ein komplettes Rücksetzen und Speichern entfernt nur die Ableitung der **aktiven** Bildvariante.

**Freistellen nach dem Bearbeiten:** Das KI-Modell erhält für seine Objekterkennung die aktuell korrigierten Farben, erzeugt aber die transparente **Basismaske auf der unveränderten Originalquelle**. Die Vorschau und das gespeicherte WebP wenden die Reglerwerte genau einmal auf die transparente Maske an. So werden die Änderungen weder ignoriert noch beim nächsten Öffnen doppelt angewendet. Original und Freistellung behalten **getrennte Korrekturwerte und gerenderte Ableitungen**. Beim Wechsel der aktiven Bildvariante werden die passenden gespeicherten Reglerwerte geladen. Ältere Freistellungen ohne eigene gespeicherte Korrekturen können beim Öffnen des Editors auf die Reglerwerte des Originals zurückgreifen; die transparente Bildquelle bleibt dabei unverändert, und **Speichern** erzeugt die fehlende korrigierte Freistellableitung. Das bestehende JSON-Schema 4 bleibt kompatibel: Die optionale `adjustment` unter dem Foto beschreibt das Original; `cutout.adjustment` beschreibt die Freistellung. Altbestände, deren bisherige `photo.adjustment.sourcePath` auf eine Freistellung verweist, werden beim nächsten Speichern ohne Datenverlust übernommen. Beim Ersetzen einer Freistellung wird nur deren veraltete Ableitung gelöscht; die Bearbeitung des Originals bleibt erhalten. Ein gelöschtes Foto entfernt alle zugehörigen Varianten.

Das unveränderte Sammlungsschema **4** erhält pro Foto optional:

```json
{
  "adjustment": {
    "path": "images/<bottleId>/photo-<photoId>-edit-<uuid>.webp",
    "sourcePath": "images/<bottleId>/photo-<photoId>.jpg",
    "settings": {
      "exposure": 0.5,
      "contrast": 12,
      "highlights": -20,
      "shadows": 25,
      "temperature": -4,
      "tint": 2,
      "saturation": 3,
      "clarity": 10,
      "sharpen": 15
    }
  }
}
```

Das Vergrößern der Vorschau (100–600 %, Mausrad, Schaltflächen, Finger-Zoom) und Verschieben des Ausschnitts verändert ausschließlich die Anzeige, nicht das gespeicherte Bild. Pinselstriche werden in normierten Bildkoordinaten festgehalten und auf die PNG-Maske in Exportauflösung angewendet. Maske, Farbeinstellungen und transparenter Export werden gemeinsam gespeichert; das ursprüngliche Bild wird niemals überschrieben. Der **Wiederherstellen-Pinsel** kann in der laufenden Sitzung durch den Radierer entfernte Bereiche zurückholen; nach dem Speichern dient die neue PNG-Maske als neue Grundlage.

Die Vorschau ist auf maximal 1050 Pixel Kantenlänge begrenzt; für den gespeicherten WebP-Export rendert der Browser aus dem unveränderten Ausgangsbild neu mit bis zu **4096 Pixeln**. Er versucht erst eine leicht höhere WebP-Kompression bei unveränderten Abmessungen, bevor die bestehende 10-MB-Obergrenze ein Herunterskalieren erfordert. Die Bildverarbeitung läuft vollständig im Browser, ohne Fremdserver. Transparenz wird beibehalten. Bei 100 % ausgebrannten Reflexionen lassen sich fehlende Bilddetails nicht rekonstruieren; die Lichter-Regelung kann nur noch vorhandene Abstufungen korrigieren. Die automatische Farbtemperaturkorrektur ist eine vorsichtige Heuristik, kein farbmetrischer Abgleich mit einer Graukarte.

Die WebP-Ableitung befindet sich wie alle Foto-Dateien unter `images/` und wird in vollständigen ZIP-Backups mitgesichert; ein reiner JSON-Export enthält nur die Pfade und Parameter, keine Bildbytes. Die neuen API-Endpunkte sind unter [API.md](API.md#bildkorrekturen) beschrieben.

### Dialoglayout ab v0.17.8

Bildvorschau und Regler-/Tabbereich schließen auf Desktop bündig ab; ihre Höhe ist für dieselbe Fenstergröße identisch. Nur die Einstellungen innerhalb des jeweiligen Tabs scrollen. Statusmeldungen und die Aktionen **Automatisch**, **Zurücksetzen**, **Abbrechen** und **Speichern** stehen jeweils unterhalb des gemeinsamen Arbeitsbereichs. Mobile Fenster behalten die einspaltige Darstellung. Der Bildinhalt, die Freistellmaske, Zoom- und Exportauflösung werden durch diese Layoutänderung nicht verändert.
