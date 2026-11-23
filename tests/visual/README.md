# Approved visual baselines

The 136 `.png`/`.json` pairs are snapshots of the corrected Phase-5 UI using
17 deterministic scenarios, four viewport widths and both themes.
`manifest.json` records capture settings and the original Chromium build.

**Never auto-update baselines on CI failure.** A deliberate UI change is reviewed
locally using `npm run visual:update`, then committed as an explicit source diff.
`npm run test:visual` reads but does not alter these files and uploads red diff
images under `test-artifacts/designsystem-visual/` on failure.

See [the testing guide](../../docs/DESIGNSYSTEM_VISUELLE_TESTS.md).
