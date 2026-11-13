# Teststatus - Whisky Collection Manager v0.17.11

**Stand:** 13.11.2026. **Basis:** v0.17.10 (ohne die verworfene Etikettenerkennung). Interne Importverarbeitung ist quellunabhängig; Datenformate und Endpunkte bleiben kompatibel. Frühere Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgeführte Prüfungen

| Prüfung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Paket, Lockfile, README, Changelog und Teststatus verwenden v0.17.11. |
| `npm run check` | **Bestanden** | 229 JavaScript-Dateien, 962 referenzierte Übersetzungsschlüssel und 101 relative Dokumentationslinks. |
| `npm test` (identische Testsuite mit begrenzter Parallelität) | **378/378 bestanden** | Vollständiger Node-Testlauf mit `--test-concurrency=4` über `tests/unit` und `tests/integration`. Der stärker parallelisierte Standard-Aufruf überschritt lokal das Zeitlimit. |
| Neue Import-Regressionstests | **Bestanden** | Anbieterneutrale Feldübernahme, Payload-Validierung, Referenzbildauswahl und Quellenmarkierung sowie bisheriger Importpfad. |
| `npm run test:browser` | **Nicht lokal ausgeführt** | `playwright-core` ist in der Prüfungsumgebung nicht installiert; `npm ci --offline` scheitert am fehlenden npm-Paketcache (`ENOTCACHED`). Die vorhandenen Browser-Regressionen wurden auf die neuen Selektoren angepasst, aber nicht ausgeführt. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht ausgeführt** | Auf dem Zielsystem noch zu prüfen. |

## Änderungen v0.17.11

- Die generische Importlogik für Feldvorschau, Auswahl, Übernahme, Destillerie-Abgleich und Importfoto lebt unter `public/js/features/import/`.
- Allgemeine Importvariablen, Formularnamen, DOM-Selektoren, CSS-Klassen, Ereignisse und Übersetzungen tragen keine anbieterspezifischen Namen mehr.
- Nur der Quelladapter prüft spezifische Kennungen und URLs. Der gemeinsame Payload-Normalisierer beschränkt Feldtypen und erlaubte Importdaten; Originalformate bleiben gültig.
- Der Server kann Referenzfotos ohne spezifische Quellenmarkierung übernehmen. Bestehende Erweiterungsbilder behalten ihre bisherigen Quellenangaben.
- Keine Funktionen aus der verworfenen 0.18.x-Reihe übernommen.
