# Visuelle Tests

`npm run test:visual` nimmt die definierten Zustände frisch auf und prüft
Überlauf und Modalinteraktionen. Die GitHub-PR-CI erzeugt beide Vergleichsstände
mit derselben Chromium-Version und veröffentlicht einen HTML-Differenzbericht.
Optische und geometrische Änderungen werden im PR per Kommentar freigegeben.

Die vorhandenen Bilder und Geometriedateien unter `baselines/` sind nur noch
optionale lokale historische Referenzen für `npm run test:visual:strict`.
`npm run visual:update` aktualisiert sie ausschließlich nach bewusster lokaler
Freigabe; die normale PR-CI benötigt keine Aktualisierung dieser Dateien.

Details: [Visuelle Tests](../../docs/DESIGNSYSTEM_VISUELLE_TESTS.md).
