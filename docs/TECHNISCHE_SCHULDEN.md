# Offene technische Prüfungen

Hier stehen ausschließlich **aktuell offene** Risiken und Prüfungen; keine früheren Review- oder Releaseprotokolle. Änderungen am Prüfumfang gehören bei Betroffenheit in dieselbe Änderung.

- **Browserplattformen:** Chromium-/Playwright-Tests sind vorhanden; vollständige manuelle Abnahmen mit Safari/iOS, Android, Firefox und Screenreadern sind noch nicht nachgewiesen.
- **Hardware und Dauerbetrieb:** 3D/WebGL, Kamera/Scanner, Raspberry-Pi-Performance und längerfristiger Betrieb benötigen weiterhin echte Zielhardware und repräsentative Laufzeitdaten.
- **Designsystem:** Fachlayouts dürfen eigene Geometrie haben; verbleibende fachliche CSS-Overrides und direkte Button-Templates sollten nur bei konkretem Änderungsbedarf reduziert werden. Keine pauschale weitere Abstraktion.
- **Datenfreigabe:** Der vorhandene Bestand ist Entwicklungs-/Testmaterial. Vor erstmaliger Nutzung mit erhaltenswerten Daten müssen Backup/Restore sowie unterstützte Datenmigrationen und das Rollback-Verfahren gegen echte Datensätze getestet werden.
- **Aktuelle CI:** Ein grüner `npm test`-Lauf ist kein Beleg für erfolgreiche Browser-CI oder Hardware. Offene Läufe im [Teststatus](TESTSTATUS.md) benennen.

Maßnahmen im Zuge betroffener Features umsetzen und dann diesen Abschnitt **entfernen oder aktualisieren**. Historische Bearbeitungen stehen ausschließlich im [Changelog](../CHANGELOG.md).
