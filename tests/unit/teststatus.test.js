import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync(
  new URL('../../docs/TESTSTATUS.md', import.meta.url),
  'utf8'
);
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json',
  import.meta.url), 'utf8'));

test(
  'current test status separates completed runs from pending browser CI and \
does not duplicate release history',
  () => {
    assert.match(
      doc,
      new RegExp(`^# Teststatus .+ v${pkg.version.replace(/\./g, '\\.')}\\n`)
    );
    assert.match(doc, /npm run check/);
    // A status for another command cannot satisfy the npm test contract.
    const status = doc.match(/`npm test`(?: *\| *|: *)\*\*([^*\n]+)\*\*/);
    assert.ok(status, 'npm test must have its own reported result');
    assert.match(
      status[1],
      /^(?:\d+\/\d+ bestanden|Noch nicht ausgeführt|unterbrochen)$/i
    );
    assert.match(doc, /CI|Browser/i);
    assert.doesNotMatch(doc, /TESTHISTORIE|^## Nachtrag v/m);
  }
);
