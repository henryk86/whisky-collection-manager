# Lagerverwaltung

Das Lager ist ein **eigenes Datenmodell** (`warehouse.json`, Schema 1); es referenziert physische Flaschen in `collection.json` (Schema 9) über stabile IDs. Räume enthalten Möbel, Möbel enthalten Fächer; die Zuweisungen liegen getrennt von den Flaschendaten. Ein reiner Collection-JSON-Export enthält **kein** vollständiges Lagerbackup; das vollständige ZIP enthält beide Datenmodelle und Fotos.

## Räume und Raumplan

- Räume werden mit Breite und Tiefe verwaltet. Übersichtskarten zeigen bei verfügbarem WebGL eine statische 3D-Vorschau. Ohne WebGL bleibt die Navigation nutzbar.
- 3D ist die voreingestellte interaktive Raumansicht; der 2D-Plan ermöglicht Positionieren und Auswählen. Das Raster zeigt 10 cm mit Markierungen für 50 cm/1 m; Verschieben rastet nicht zwangsweise ein.
- Möbel haben X/Y-Position, Breite, Tiefe, Drehung, Unterkante und Höhe. Kollisionen werden sowohl für gedrehte Grundflächen als auch für **überlappende Höhenintervalle** geprüft. Kantenkontakt ist zulässig, Überschreiten der Raumgrenzen nicht.
- Mehrfachauswahl und Ausblenden sind gesonderte Funktionen. Höhen-/Planebenen erleichtern die Auswahl übereinander platzierter Möbel.

## Möbel, Fächer und Flaschen

- Regale, Hängeregale, Vitrinen, Schränke, Kommoden/Schubladen, Kisten und sonstige Möbel werden unterstützt; ihre Fächer können Front-/Tür-/Schubladenvarianten erhalten.
- Eine Fachkapazität von `null` bedeutet unbegrenzt, `0` verbietet Belegung, positive Ganzzahlen geben die Obergrenze an. Belegte Lagerorte können nicht unbemerkt gelöscht werden.
- Fächer zeigen zugewiesene Flaschen und ermöglichen Vorschau, Umlagerung und Mehrfachbearbeitung. Nach Kapazitätsänderungen aktualisiert sich die bereits offene Fach-/Möbelansicht.
- Fachbearbeitung schützt ungespeicherte Eingaben bei Navigation und verschachtelten Rückfragen. Bestätigungen bleiben Anwendungsmodals.
- Möbel können eigene Fotos besitzen (bis zu 24); die Fotos sind Teil des vollständigen Backups. Möbelkopien übernehmen keine Fotos.
- Die Flaschensuche verbindet Inventarnummern und Lagerorte, ohne die physische Lagerzuordnung in die Abfüllungsdaten zu kopieren.

## Verantwortung und Tests

- Fachvalidierung: `server/domain/warehouse-fields.js`, `server/services/warehouse.js`, `server/storage/warehouse-store.js`.
- Gemeinsame Geometrie: `shared/warehouse-placement.js`, `shared/warehouse-compartments.js`.
- Oberfläche: `public/js/views/warehouse.js`, `warehouse-presentation.js`, Spezialstyles `public/styles/warehouse.css`; 3D-Renderer in `public/js/ui/warehouse-three-scene.js`.
- Tests: `tests/integration/warehouse.test.js`, `tests/browser/warehouse.test.js` und zugehörige Unit-Tests. Reale WebGL- und Mobilgeräte bleiben als eigene Hardwareprüfung notwendig.

Weitere Schnittstellen: [API](API.md#lager-api), [Datensicherung](DOCKER_BACKUP.md).
