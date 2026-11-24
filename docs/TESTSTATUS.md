# Teststatus - Whisky Collection Manager v1.12.1

**Stand:** 24. November 2026. Entwicklungsstand; keine Produktionsfreigabe. Die CI des jeweiligen Pull Requests ist für die Abnahme maßgeblich.

| Prüfung | Ergebnis auf diesem Quellstand |
|---|---|
| `npm run check` | **Bestanden**: Syntax, Imports, Dokumentation, Deployment, JavaScript-/CSS-Formatierung, Zeilenlängen und JSDoc |
| Unit- und Integrationstests (getrennte Läufe) | **556/556 und 174/174 bestanden** (Integrationstests in fünf getrennten Gruppen ausgeführt) |
| `npm run test:browser` | **Lokal nicht ausgeführt**: `playwright-core` in der Testumgebung nicht installiert; GitHub-CI erforderlich |
| `npm run test:visual` | **136/136 Geometrie- und Interaktionszustände bestanden** (Chromium 144); 62 rein diagnostische Pixeldifferenzen auch im unveränderten Ausgangsstand vorhanden |
| Reale Mobilgeräte, Firefox/Safari, Screenreader und Dauerbetrieb | **Nicht abgenommen** |

Der CSS-Formatter prüft alle 18 CSS-Dateien und erhält die Regeln, Deklarationen und Importreihenfolge. Die Stilprüfung hält noch **3.443 unveränderte Zeilen über 80 Zeichen** als fingerprint-gebundene Alt-Ausnahmen fest. JSDoc ist für **alle benannten Funktionen** einschließlich interner Funktionen, Arrow-Funktionen, Klassenmethoden und Objekthandler verpflichtend. Die statische Prüfung umfasst 396 JavaScript-Dateien und meldet keine fehlenden Verträge. Anonyme Inline-Callbacks sind ausgenommen. Wo der Parametertyp nicht zuverlässig aus der Implementierung ableitbar ist, bleibt der Wildcard-Typ `*`; die fachliche Präzision dieser Typen und Beschreibungen muss zusätzlich im Review geprüft werden.

Das `wcm-source-manifest.json` dokumentiert den veröffentlichten Quellstand und wird bei Änderungen auf `develop` nicht überschrieben. `npm run release:check` dient der Prüfung unveränderter Release-Snapshots, nicht des weiterentwickelten Branches.

Testverfahren: [Teststrategie](TESTSTRATEGIE.md). Versionshistorie: [Changelog](../CHANGELOG.md).
