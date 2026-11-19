# Teststatus - Whisky Collection Manager v1.6.2 (Entwicklungsstand)

**Stand:** 2026-11-19. Geprüft wurde die Erweiterung um die optionale Anmeldung auf Basis des bereitgestellten `develop`-Snapshots v1.6.2. Der Projektstand bleibt bis zum regulären Release-Merge ohne Versionsbump.

## Ausgeführte Prüfungen

- `npm run check`: **erfolgreich** (Syntax, Modulgrenzen, Übersetzungen, Dokumentationslinks und Deployment-Verträge).
- `npm test`: **594/594 bestanden** (Unit- und Integrationstests einschließlich 2 neuer Authentifizierungs-/Admin-Wiederherstellungstests).
- `node --test tests/integration/auth.test.js`: **2/2 bestanden** (Initialbenutzer, Login an/aus, Passwortwechsel, Rechte, direkter API-/Bildzugriff, Sessionwiderruf, Recovery-Befehl).

## Noch offen

- `npm run test:browser`: **nicht ausgeführt**. In dieser Umgebung war `npm ci` weder aus dem Offline-Cache noch aus der npm-Registry möglich (`ENOTCACHED`/`EAI_AGAIN`). Visuelle/mobile Prüfungen einschließlich iOS Safari und Android fehlen.
- Docker-Build und Startprüfung im tatsächlichen Container sowie End-to-End-Test auf dem Raspberry Pi und mit Let's Encrypt: **nicht ausgeführt**.
- GitHub-Release-Workflow: durch diese Entwicklungsänderung nicht angestoßen; der Versionsbump bleibt dem manuell freigegebenen Release vorbehalten.

## Funktionale Änderung

- `feat(auth)`: Optionaler Login mit getrenntem `data/user.json`, zufälligem initialem Administratorpasswort, Pflicht zum ersten Passwortwechsel, scrypt-Hashes, HttpOnly-Cookie-Sessions, Benutzerverwaltung und Rollenbegrenzung; Recovery-CLI und dokumentierter Schutz direkter Endpunkte.

Frühere Release-/CI-Prüfungen: [TESTHISTORIE.md](TESTHISTORIE.md).
