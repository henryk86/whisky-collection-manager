# Verkostungen, Geschmacksprofil und Bewertung

## Zuordnung und Navigation

Eine Sammlungsabfüllung hat 0–n eigenständige, datierte Verkostungen in `bottlings[].tastings[]` (Collection-Schema 7). Die Verkostung gehört zur **Abfüllung**, nicht zu einer physischen Flasche. Eine externe, nicht besessene Whisky-Verkostung ist ein eigener Eintrag ohne verwaltete Abfüllung. Einzelverkostung und Liste unterstützen direkte URLs und Browser-History. Bestehende Einträge öffnen lesend und werden über die Bearbeiten-Aktion editierbar; neue Einträge werden explizit gespeichert.

Für die **letzte Bewertung** ist das neueste Verkostungsdatum entscheidend, bei Gleichstand Erstellungszeit und ID. Ist dieser Eintrag unbewertet, bleibt die Abfüllung unbewertet, auch wenn frühere Bewertungen vorliegen. Analysen zählen nicht mehrfach pro Abfüllung.

## Eingaben

| Feld | Vertrag |
|---|---|
| Datum `tastedOn` | `YYYY-MM-DD`, Pflicht |
| Titel | optional, maximal 120 Zeichen |
| Nase/Geschmack/Abgang | `tastingNotes.nose/palate/finish`, frei |
| Gesamtkommentar | `ratingComment`, optional bis 10.000 Zeichen |
| Bewertung | `null` oder 0–100; UI zeigt anteilig gefüllte Glencairn-Gläser |
| Farbe | zwölf feste Whiskyfarben oder geprüfter `custom:#rrggbb`-Farbwert; kein Grün/Blau |
| Profil | zehn 0–10-Achsen oder `null`; fehlende Achsen bleiben unbekannt (`null`), nicht Nullbewertung |

Die zehn Profilachsen: `woody`, `smoky`, `cereal`, `peaty`, `fruity`, `floral`, `medicinal`, `winey`, `feinty`, `sulphury`. Radarprofil und Regler sind vom eigenen Farbblock getrennt. Farbwähler und Glencairn zeigen die ausgewählte Whiskyfarbe; unbekannte Werte werden im Radar nicht erfunden. Rückgängig/Wiederholen gilt je geöffnetem Verkostungseintrag.

## Flights

Eine Verkostung kann höchstens einem Flight angehören. Flights enthalten eine explizit sortierte Liste von IDs; das Löschen eines Flights löscht die individuellen Verkostungen nicht. Die Reihenfolge ist per Drag und Tastaturaktionen veränderbar. Es gibt dokumentierte und geplante Flights. [Planungslogik](FLIGHT_PLANUNG.md).

## Code und Tests

- Fachregeln: `shared/tasting-records.js`, `server/services/tastings.js`, `server/domain/validation.js`.
- UI: `public/js/views/tastings.js`, `public/js/ui/flavor-profile.js`, `whisky-color-selector.js`, `glencairn-rating.js`.
- Regression: `tests/unit/tasting-records.test.js`, `tests/integration/tastings.test.js`, `tests/browser/tastings.test.js`.

Das aktuelle Schema ist **6**. Für das Verhalten beim Laden sehr alter Testformate siehe [Architektur](ARCHITEKTUR.md); diese Formate sind keine Voraussetzung für produktive Datenkompatibilität.
