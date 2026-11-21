# Historie der Testergebnisse (kompakter Index)

Die folgenden Eintraege enthalten historische Pruefwerte bzw. den ersten dokumentierten Befund je Stand. Vollstaendige Berichte und damalige Befunde bleiben unveraendert im Git-Verlauf der Datei erhalten. **Nicht erwaehnte Pruefungen sind nicht als bestanden zu verstehen.** Der aktuelle Stand ist ausschliesslich [TESTSTATUS.md](TESTSTATUS.md).

- **Nachtrag v0.16.3 - Isolierung und Geraderichten (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 369/369.
- **Nachtrag v0.16.2 - Freistellungs-Zuschnitt und Bildvorschau (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 365/365.
- **Nachtrag v0.15.15 - Scrollbar, 3D und README-Galerie (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 354/354.
- **Nachtrag v0.15.14 - Browser-Ueberlaufkorrektur (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 9/9bestanden.
- **Nachtrag v0.15.13 - CI-Regression im Ueberlaufstest (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 353/353.
- **Nachtrag v0.15.11 - Security-Review-Nachpruefung (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 351/351.
- **Nachtrag v0.15.10 - Security-Review (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 347/347.
- **Nachtrag v0.15.9 - Stabiler Scrollbar-Gutter (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 1/1bestanden.
- **Nachtrag v0.8.17 - Kompakte Kartenlegende (08.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 230/230.
- **Nachtrag v0.8.16 - Einheitliche Statuslegende und Hexagon-Cluster (08.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 230/230.
- **Nachtrag v0.8.15 - Kartenlegende mit Status und echten Groessen (08.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 1/10.
- **Nachtrag v0.8.14 - Kartenlegende vereinfacht (08.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 1/10.
- **Nachtrag v0.8.13 - Metadaten der Abfüllungen in der Kartenliste (08.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 227/227.
- **Nachtrag v0.8.12 - Seitengröße und Cluster-Legende (08.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 12/24.
- **Nachtrag v0.8.11 - Karten-Einzelmarker und kompakte Legende (08.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 221/221.
- **Nachtrag v0.8.10 - Karten-Clustering (08.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 219/219.
- **Geprüftes Verhalten:** Anlegen, Bearbeiten und Löschen, verschachtelte physische Flaschen, eindeutige und reservierte Inventarnummern.
- **Grenzen der Prüfung:** Historischer Eintrag; Details im Git-Verlauf.
- **Archivierter Teststand v0.8.20 (09.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 234/234.
- **v0.9.0 – letzter Stand vor der Herkunftskorrektur (09.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 238/238.
- **v0.15.12 – archivierter CI-Status (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 353/353.
- **v0.16.0 - Vor der MIME-Korrektur (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 360/360erfolgreich.
- **v0.16.1 – vor dem automatischen Zuschnitt (12.11.2026):** Node-/Testzaehlung laut damaligem Bericht: 361/361bestanden.
- **Archivierter Teststatus v0.16.8 (12.11.2026):** Historischer Eintrag; Details im Git-Verlauf.
- **Durchgeführte Prüfungen (v0.16.8):** Node-/Testzaehlung laut damaligem Bericht: 14/14bestanden.
- **Änderungen v0.16.8:** Fehlenden ES-Modul-Import von `analyzeBottleMask` im bereits vorhandenen Regressionstest für transparente Flaschen ergänzt. Dadurch tritt der GitHub-Actions-Fehler `ReferenceError: analyzeBottleM.
- **Änderungen v0.16.7:** Automatische Drehung für Flaschenmasken von maximal 12° auf maximal 20° ausgeweitet. Oberhalb dieses Winkels sowie bei kaum länglichen Konturen bleibt die bisherige Schutzlogik aktiv.
- **Änderungen v0.16.6:** Docker-Laufzeitbasis von `node:22-alpine` auf `node:22-bookworm-slim` umgestellt. Die vorherige ARM64-Alpine-Variante stürzte auf Raspberry Pi 4 bereits bei `node --version` mit Exit 139 ab, währ.
- **Änderungen v0.16.5:** Klick auf eine Flasche im angezeigten Regalfach öffnet ein schreibgeschütztes Detail-Modal statt unmittelbar den Umlagerungseditor.
- **Änderungen v0.16.4:** Die Freistellung reduziert die breite Alpha-Überblendung **nach** Rotation, Skalierung und Rasterisierung durch eine Smoothstep-Kurve (Alpha 110–190). Schwache Hintergrund-Restwerte entfallen, wä.
- **Änderungen v0.16.3:** Nach der KI-Segmentierung wird nur die zentrale Hauptkomponente behalten, einschließlich eines ein Pixel breiten Antialias-Randes. Abgetrennte Maskenfragmente werden auch aus der **exportierten t.
- **Vorherige Änderungen v0.16.2:** Nach der Segmentierung wird die zusammenhängende Flaschenmaske zur transparenten Ausgabe im exakten Seitenverhältnis 2:3 zugeschnitten. Bei breiten Objekten kann transparenter Rand verbleiben, um.
- **Korrektur v0.16.1:** Der statische Server liefert `.mjs`-Module jetzt mit `text/javascript; charset=utf-8` aus. Mit `X-Content-Type-Options: nosniff` waren sie zuvor fälschlich `application/octet-stream` und wurden v.
- **Funktionsumfang und Grenzen:** v0.16.0:** Die physische Flasche kann eine transparente PNG-Ableitung neben einem weiterhin unveränderten Originalfoto speichern. `selected` steuert die Anzeige im Sammlungskatalog, in Details un.
- **Testbericht v0.16.12 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 343/343bestanden.
- **Testbericht v0.16.13 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 345/345bestanden.
- **Testbericht v0.16.14 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 345/345bestanden.
- **Testbericht v0.16.15 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 347/347bestanden.
- **Testbericht v0.16.16 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 347/347bestanden.
- **Testbericht v0.16.17 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 348/348bestanden.
- **Testbericht v0.17.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 353/353bestanden.
- **Testbericht v0.17.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 357/357bestanden.
- **Testbericht v0.17.2 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 358/358bestanden.
- **Testbericht v0.17.3 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 362/362bestanden.
- **Testbericht v0.17.4 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 364/364bestanden.
- **Testbericht v0.17.5 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 364/364bestanden.
- **Testbericht v0.17.6 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 366/366bestanden.
- **Testbericht v0.17.7 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 366/366bestanden.
- **Testbericht v0.17.8 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 366/366bestanden.
- **Testbericht v0.17.9 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 366/366bestanden.
- **Testbericht v0.17.10 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 371/371bestanden.
- **Testbericht v0.17.11 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 378/378bestanden.
- **Testbericht v0.17.12 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 376/376bestanden.
- **Testbericht v0.17.13 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 376/376bestanden.
- **Testbericht v0.17.14 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 378/378bestanden.
- **Testbericht v0.17.15 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 386/386bestanden.
- **Testbericht v0.18.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 394/394bestanden.
- **Testbericht v0.18.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 402/402bestanden.
- **Testbericht v0.18.2 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 407/407bestanden.
- **Testbericht v0.18.3 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 413/413bestanden.
- **Testbericht v0.18.4 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 418/418bestanden.
- **Testbericht v0.18.5 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 422/422bestanden.
- **Testbericht v0.18.6 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 422/422bestanden.
- **Testbericht v0.19.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 433/433bestanden.
- **Testbericht v0.19.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 437/437bestanden.
- **Testbericht v0.19.2 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 442/442bestanden.
- **Testbericht v0.19.3 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 446/446bestanden.
- **Testbericht v0.19.4 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 446/446bestanden.
- **Testbericht v0.19.5 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 447/447bestanden.
- **Testbericht v0.19.6 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 448/448bestanden.
- **Testbericht v0.19.7 (vor dem naechsten Versionswechsel):** Browser: 452 bestanden, 0 fehlgeschlagen.
- **Testbericht v0.19.8 (vor dem naechsten Versionswechsel):** Browser: 454 bestanden, 0 fehlgeschlagen.
- **Testbericht v0.19.9 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 456/456bestanden.
- **Testbericht v0.19.10 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 457/457bestanden.
- **Testbericht v0.19.11 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 458/458bestanden.
- **Testbericht v0.19.12 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 458/458bestanden.
- **Testbericht v0.19.13 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 460/460bestanden.
- **Testbericht v0.19.14 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 460/460bestanden.
- **Testbericht v0.19.15 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 460/460bestanden.
- **Testbericht v0.19.16 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 462/462bestanden.
- **Testbericht v0.20.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 468/468bestanden.
- **Testbericht v0.20.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 469/469bestanden.
- **Testbericht v0.21.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 473/473bestanden.
- **Testbericht v0.21.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 473/473bestanden.
- **Testbericht v0.21.2 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 474/474bestanden.
- **Testbericht v0.21.3 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 474/474bestanden.
- **Testbericht v0.21.4 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 478/478bestanden.
- **Testbericht v0.22.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 481/481bestanden.
- **Testbericht v0.23.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 482/482bestanden.
- **Testbericht v0.23.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 483/483bestanden.
- **Testbericht v0.23.2 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 484/484bestanden.
- **Testbericht v0.23.3 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 485/485bestanden.
- **Testbericht v0.23.4 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 486/486bestanden.
- **Testbericht v0.23.5 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 487/487bestanden.
- **Testbericht v0.23.6 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 487/487bestanden.
- **Testbericht v0.24.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 495/495bestanden.
- **Testbericht v0.25.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 502/502bestanden.
- **Testbericht v0.25.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 504/504bestanden.
- **Testbericht v0.25.2 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 505/505bestanden.
- **Testbericht v0.25.3 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 505/505bestanden.
- **Testbericht v0.25.4 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 505/505bestanden.
- **Testbericht v0.25.5 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 505/505bestanden.
- **Testbericht v0.26.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 510/510bestanden.
- **Testbericht v0.27.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 513/513bestanden.
- **Testbericht v0.27.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 515/515bestanden.
- **Testbericht v0.27.2 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 516/516bestanden.
- **Testbericht v0.27.3 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 519/519bestanden.
- **Testbericht v0.27.4 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 523/523bestanden.
- **Testbericht v0.27.5 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 529/529bestanden.
- **Testbericht v0.27.6 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 534/534bestanden.
- **Testbericht v0.27.7 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 541/541bestanden.
- **Testbericht v0.27.8 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 544/544bestanden.
- **Testbericht v0.27.9 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 545/545bestanden.
- **Testbericht v0.27.10 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 545/545bestanden.
- **Testbericht v0.27.11 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 545/545.
- **Testbericht v0.27.12 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 545/545bestanden.
- **Testbericht v0.28.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 551/551bestanden.
- **Testbericht v0.28.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 553/553bestanden.
- **Testbericht v0.28.2 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 554/554bestanden.
- **Testbericht v0.28.3 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 557/557bestanden.
- **Testbericht v0.28.4 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 557/557bestanden.
- **Testbericht v0.28.5 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 557/557bestanden.
- **Testbericht v0.28.6 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 557/557bestanden.
- **Testbericht v0.28.7 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 558/558bestanden.
- **Testbericht v0.28.8 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 558/558bestanden; Browser: 80 bestanden, 0 fehlgeschlagen, 1 uebersprungen.
- **Testbericht v0.28.9 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 562/562bestanden.
- **Testbericht v1.0.0 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 557/557bestanden.
- **Testbericht v1.0.1 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 559/559bestanden; Browser: 82 bestanden, 7 fehlgeschlagen.
- **Testbericht v1.0.2 (vor dem naechsten Versionswechsel):** Node-/Testzaehlung laut damaligem Bericht: 561/561bestanden; Browser: 82 bestanden, 7 fehlgeschlagen.
- **Testbericht v1.1.0:** Node-/Testzaehlung laut damaligem Bericht: 569/569bestanden.
- **Testbericht v1.2.0:** Node-/Testzaehlung laut damaligem Bericht: 568/568bestanden; Browser: 83 bestanden, 0 fehlgeschlagen, 1 uebersprungen.

---

## Testbericht v1.2.1

- npm run release:check: Erfolgreich; npm run check: Erfolgreich; npm test: 568/568 bestanden; npm run test:browser: 85 bestanden, 0 fehlgeschlagen, 1 uebersprungen; GitHub Actions / CI fuer v1.2.1: Ausstehend

---

## Testbericht v1.3.0

- npm run release:check: Erfolgreich; npm run check: Erfolgreich; npm test: 572/572 bestanden; npm run test:browser: 91 bestanden, 0 fehlgeschlagen, 1 uebersprungen; GitHub Actions / CI v1.3.0: beim lokalen Bericht noch ausstehend; anschliessend vom Betreiber als gruen bestaetigt

---

## Testbericht v1.3.1

- npm run release:check: Bestanden; npm run check: Bestanden; npm test: 546/546 bestanden; npm run test:browser (acht Fachsuiten einzeln im Chromium-DOM-Modus): 99 bestanden, 0 fehlgeschlagen, 1 uebersprungen; GitHub Actions / regulaere Browsernavigation: Gruen (Rueckmeldung)

---

## Testbericht v1.3.2

- npm run release:check: Bestanden; npm run check: Bestanden; npm test: 545/545 bestanden; npm run test:browser: Nicht lokal ausgeführt; GitHub Actions / regulaere Browsernavigation: Ausstehend

---

## Testbericht v1.3.3

- npm run release:check: Bestanden; npm run check: Bestanden; npm test: 546/546 bestanden; npm run test:browser: Nicht lokal ausgeführt; GitHub Actions / reguläre Browsernavigation: Ausstehend

---

## Testbericht v1.4.0

- npm run release:check: Bestanden; npm run check: Bestanden; npm test: 532/532 bestanden; npm run test:browser (Chromium DOM-Modus, 9 getrennte Fachsuiten): 109 bestanden, 0 fehlgeschlagen, 1 uebersprungen; GitHub Actions / regulaere Browsernavigation v1.4.0: Bestanden (Nutzerbestaetigung)

---

## Testbericht v1.5.0

- kein maschinenlesbares Testergebnis im alten Status

---

## Testbericht v1.5.1

- kein maschinenlesbares Testergebnis im alten Status

---

## Testbericht v1.5.2

- kein maschinenlesbares Testergebnis im alten Status

---

## Testbericht v1.5.3

- kein maschinenlesbares Testergebnis im alten Status

---

## Testbericht v1.6.0

- kein maschinenlesbares Testergebnis im alten Status

---

## Testbericht v1.6.1

- kein maschinenlesbares Testergebnis im alten Status

---

## Testbericht v1.6.2

- kein maschinenlesbares Testergebnis im alten Status

---

## Testbericht v1.7.0

- kein maschinenlesbares Testergebnis im alten Status

---

## Testbericht v1.8.0

- kein maschinenlesbares Testergebnis im alten Status
