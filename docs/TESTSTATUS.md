# Teststatus - Whisky Collection Manager v0.27.10

**Stand:** 2026-11-15. **Status:** Statische Projektpruefungen und 545 Unit-/Integrationstests erfolgreich. Vorherige Testberichte: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Release-Metadaten der Version 0.27.10 stimmen ueberein. |
| `npm run check` | **Bestanden** | Syntax, Modulimporte, Uebersetzungen und Dokumentationslinks. |
| `npm test` | **545/545 bestanden** | Unit- und Integrationstests, inklusive Lesemodus-/Bearbeitungsmodus-Regression. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | Visuelle Browserpruefung steht aus. |
| iOS Safari, Android, Docker/ARM64 | **Nicht lokal ausgeführt** | Endgeraete- und Deployment-Pruefungen stehen aus. |

## Aenderungen v0.27.10

- In gespeicherten Verkostungen lautet die Titelbeschriftung im Lesemodus nur noch „Titel“ (englisch „Title“); bei der Bearbeitung bleibt „Titel (optional)“ (englisch „Title (optional)“).
- Regressionstest stellt die unterschiedlichen Beschriftungen in beiden Modi sicher.

Die tatsaechliche Browserdarstellung wurde hier nicht visuell abgenommen.
