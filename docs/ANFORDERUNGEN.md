# Funktionsumfang und Anforderungen

WhiskyCollectionManager ist eine lokale, responsive Whisky-Sammlungsverwaltung mit Deutsch/Englisch, Hell-/Dunkelmodus und optionaler Anmeldung. Der aktuelle technische Vertrag steht in [Architektur](ARCHITEKTUR.md); die folgenden Punkte beschreiben **implementierte** Funktionen, keine Planung.

| Bereich | Aktuelles Verhalten |
|---|---|
| Sammlung | Abfüllungen mit Destillerien, einzelne Standard-/Sample-Flaschen, Inventarnummer, Filter, Foto, Kauf-/Lagerdaten, Nachweise, Scanner |
| Verkostung | 0–n Verkostungen je Abfüllung; zusätzlich einzelne Verkostungen externer Whiskys; Datum, 10 Profilachsen, Farbe, Notizen, Bewertung 0–100 |
| Tasting-Flights | Dokumentation einer geordneten Verkostungsgruppe und deterministische Planung auf Basis vorhandener Flaschen; keine externe KI |
| Lager | Räume, Möbel, Fächer, Kapazitäten, Zuweisungen/Umlagerung, 2D-/3D-Raumplan, Möbel-/Fachfotos, Suche |
| Analysen | Sechs Themenbereiche mit Filtern, Kennzahlen und Diagrammen, respektieren unbekannte Werte und Währungen |
| Karte | OpenStreetMap mit Destilleriestandorten, Bestandsbezug und Detailnavigation |
| Fotos | Reihenfolge, Original und optionale Freistellung, nicht-destruktiver Bildeditor; Dokumente pro physischer Flasche |
| Daten | Collection-JSON/CSV, vollständiges verschlüsseltes ZIP, Backup-Zeitpläne und Restore; kein eigener XLSX-Export |
| Anmeldung | Optionales Login; Administrator verwaltet Nutzer, andere Nutzer verwalten ihre Sammlung |

## Grundregeln

- Eine **Abfüllung** ist kein physischer Lagergegenstand; ein Lagerplatz referenziert eine konkrete Flasche.
- `collection.json` nutzt **Schema 6**, `warehouse.json` **Schema 1**. Eigene Verkostungen liegen in `bottlings[].tastings[]`; externe Verkostungen und Flights sind getrennte Datensätze.
- Die Abfüllungsbewertung stammt ausschließlich aus der Verkostung mit dem neuesten Datum. Fehlt deren Bewertung, wird keine ältere als Ersatz verwendet.
- Fehlende Profilachsen und unbekannte Analyse-/Preiswerte werden nicht stillschweigend als 0 interpretiert.
- Formulare validieren Eingaben; schreibende Operationen validieren zusätzlich serverseitig. Bestätigungen erfolgen als Anwendungsmodals, nicht in nativen Browserdialogen.
- UI-Texte sind übersetzbar, Benutzerinhalte bleiben unverändert; Abfüllungsnamen bekommen **keine automatisch angehängte Interpunktion**.
- Bei späterer Nutzung mit erhaltenswerten Daten Restore, Schema-Migration und Hardware vor einem Produktionswechsel gesondert abnehmen.

Details: [Lager](LAGER.md), [Geschmacksprofil](GESCHMACKSPROFIL.md), [Flight-Planung](FLIGHT_PLANUNG.md), [Analysen](ANALYSE.md), [Karte](KARTE.md), [API](API.md).
