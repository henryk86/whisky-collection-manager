import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync(new URL('../../docs/TESTSTATUS.md', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

test('current test status describes the release, explicitly separates browser checks and links the history', () => {
    assert.match(doc, new RegExp(`^# Teststatus .+ v${pkg.version.replace(/\./g, '\\.')}\\n`));
    // The suite grows between releases; do not freeze the count at a past version.
    assert.match(doc, /npm test[^\n]*\*\*(\d+)\/\1 bestanden\*\*/);
    // A suite that started but timed out is neither "passed" nor "not executed".
    assert.match(doc, /npm run test:browser[^\n]*(?:[Nn]icht lokal ausgeführt|[Nn]och nicht lokal ausgeführt|[Nn]icht abgeschlossen|Bestanden|Blockiert)/);
    assert.match(doc, /TESTHISTORIE\.md/);
    assert.doesNotMatch(doc, /^## Nachtrag v/m, 'historical release reports belong in TESTHISTORIE.md');
});
