# Teststatus - Whisky Collection Manager v1.3.1

**Stand:** 2026-11-16. **Status:** Node-Tests und alle acht Chromium-Browser-Fachsuiten im lokalen DOM-Modus erfolgreich. Regulare Browsernavigation in GitHub Actions und Zielsystempruefungen sind fuer diesen Stand noch offen. Fruehere Ergebnisse: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| `npm run release:check` | **Bestanden** | Version 1.3.1, Release-Metadaten und Source-Manifest geprueft. |
| `npm run check` | **Bestanden** | Syntax, Architektur-, Dokumentations-, Dialog- und Quelltexttest-Regeln. |
| `npm test` | **546/546 bestanden** | Vollstaendige Node-Unit-/Integrationstests. Die niedrigere Anzahl ist Folge entfernter reiner Quelltext-/CSS-Tests, nicht ausgefallener Tests. |
| `npm run test:browser` (acht Fachsuiten einzeln im Chromium-DOM-Modus) | **99 bestanden, 0 fehlgeschlagen, 1 uebersprungen** | Echte Browser-Runtime mit berechneten Styles, Layout und Navigation; der History-Test setzt echte Seitenaufrufe voraus. |
| Gemeinsamer lokaler Browserlauf | **Nicht abgeschlossen** | Die Ausfuehrung aller Fachsuiten in einem lokalen Testprozess erreichte nach 29 Erfolgen die Zeitgrenze; danach wurden alle acht Fachsuiten einzeln vollstaendig erfolgreich ausgefuehrt. |
| GitHub Actions / regulaere Browsernavigation | **Ausstehend** | CI fuer genau diese Version pruefen, einschliesslich Browser-History-Test. |
| Docker / Raspberry Pi ARM64 / echte Mobilgeraete | **Nicht lokal ausgefuehrt** | Zielsystem- und Safari-Abnahme getrennt durchfuehren. |

## Aenderungen v1.3.1

- B-5: Bestehende doppelte CSS-/Quelltextassertions in Unit-Tests reduziert; funktionale Daten- und Rendererpruefungen erhalten.
- Acht neue Chromium-Verhaltenspruefungen fuer mobiles und Desktop-Layout, Header, Seitentitel, Formularfelder, Kartenstile und Settings-Navigation.
- `npm run check` blockiert die erneute Einfuehrung nativer Browserdialoge und historischer Versionsueberschriften in aktuellen Fachdokumenten.
- Das Budget der bestehenden Regex-Assertions wurde von 933 auf 754 gesenkt. Verbleibende alte Source-Assertions werden weiterhin als technische Schuld gefuehrt.

## Noch offen

- Die verbleibenden historischen Quelltext-/CSS-Regex-Tests, insbesondere in den Lager-/3D-Suiten, nur mit nachgewiesener gleichwertiger Laufzeitabdeckung ersetzen.
- Die regulaere GitHub-CI-Browserabnahme und Hardwarepruefungen fuer v1.3.1 abwarten.
