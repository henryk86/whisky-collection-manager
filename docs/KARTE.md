# Destilleriekarte

Die Karte zeigt Destillerien auf **OpenStreetMap** und unterstützt Filter sowie die Navigation von Abfüllungsdetails zur jeweiligen Destillerie. Der Bestandsbezug unterscheidet vorhandene Flaschen von Katalogstandorten; nicht bekannte Koordinaten werden nicht erfunden.

- Kartenmarker können abhängig von Zoom und Anzahl zu Clustern zusammengefasst werden. Die Legende und Seitenleiste erläutern die angezeigten Filter und Bestandsinformationen.
- Änderungen an Destilleriekoordinaten wirken auf Marker und Kartenposition. Beim Öffnen aus den Abfüllungsdetails wird der Zielstandort fokussiert, sofern Koordinaten vorhanden sind.
- Die interaktive Karte lädt Kacheln externer OpenStreetMap-Dienste; diese erhalten technisch notwendige Anfragen des Browsers. Der übrige Sammlungsdatenbestand wird dadurch nicht übertragen.
- Der lokale Server liefert die eigenen Kartenmodule mit seinen Sicherheits-/CSP-Headern aus. Für Offline-Nutzung sind öffentliche OSM-Kacheln nicht automatisch lokal vorhanden.

Code: `public/js/views/map.js`, `public/styles/map.css` und die zugehörigen Kartenmodule. Tests in `tests/browser/map-analytics.test.js` und fachlichen Unit-Tests. Die Sondergeometrie der Karte gehört **nicht** zu den allgemeinen Designsystem-Panels.
