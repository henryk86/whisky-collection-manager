import test from 'node:test';
import assert from 'node:assert/strict';
import { csv } from '../../server/exports/csv.js';
import { allowedExtensionOrigin } from '../../server/http/request-security.js';
import { createTranslator, tHtml } from '../../public/js/i18n/index.js';

test('CSV export escapes spreadsheet formulas without changing numeric negatives', () => {
    const output = csv([['=HYPERLINK("https://example.test")', '+SUM(1,1)', '-5', '@import', '\tcmd', '\rformula', -5]]);
    assert.ok(output.includes(`"'=HYPERLINK(""https://example.test"")"`));
    assert.ok(output.includes('"\'+SUM(1,1)"'));
    assert.ok(output.includes('"\'-5"'));
    assert.ok(output.includes('"-5"'));
    assert.ok(output.includes('"\'@import"'));
    assert.ok(output.includes('"\'\tcmd"'));
    assert.ok(output.includes('"\'\rformula"'));
});

test('optional Chrome extension allowlist does not trust unrelated extensions', () => {
    const first = `chrome-extension://${'a'.repeat(32)}`;
    const other = `chrome-extension://${'b'.repeat(32)}`;
    assert.equal(allowedExtensionOrigin(first, ''), true); // backwards compatible
    assert.equal(allowedExtensionOrigin(first, 'a'.repeat(32)), true);
    assert.equal(allowedExtensionOrigin(other, 'a'.repeat(32)), false);
    assert.equal(allowedExtensionOrigin('https://evil.example', ''), false);
});

test('tHtml escapes parameter strings, t remains plaintext for non-HTML contexts', () => {
    const actual = tHtml('warehouse.shelves.doorAcross', { from: '<img onerror=alert(1)>', to: 3 });
    assert.ok(!actual.includes('<img'));
    assert.ok(actual.includes('&lt;img'));
    const lookup = createTranslator({ demo: 'Hello {name}' });
    assert.equal(lookup('demo', { name: '<b>' }), 'Hello <b>');
});


test('static streaming handles a source read failure without an unhandled event', async () => {
    const fs = await import('node:fs');
    const { Readable, Writable } = await import('node:stream');
    const { serveStatic } = await import('../../server/http/static-files.js');
    const original = fs.default.createReadStream;
    fs.default.createReadStream = () => Readable.from((async function* () {
        throw new Error('Simulated file removed during read');
    })());
    const response = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    response.writeHead = () => response;
    try {
        await assert.rejects(
            serveStatic({}, response, new URL('http://localhost/index.html')),
            /Simulated file removed during read/
        );
        assert.equal(response.destroyed, true);
    } finally {
        fs.default.createReadStream = original;
    }
});

test('tHtml renders a raw ampersand as exactly one HTML entity', () => {
    const rendered = tHtml('warehouse.shelves.doorAcross', { from: 'A&B', to: 3 });
    assert.ok(rendered.includes('A&amp;B'));
    assert.ok(!rendered.includes('A&amp;amp;B'));
});
