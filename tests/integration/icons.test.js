import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startTestServer } from '../helpers/server.js';

test('the supplied SVG is used by header, favicon and home-screen icons', async () => {
    const original = fs.readFileSync('public/assets/logo-original.svg', 'utf8');
    const adapted = fs.readFileSync('public/assets/logo.svg', 'utf8');
    assert.match(original, /viewBox="0 0 80 80"/);
    assert.match(original, /stroke="#E9C082"/);
    assert.match(original, /<ellipse cx="40" cy="64\.30" rx="7\.33" ry="2"\/>/);
    assert.match(original, /stroke-width="1\.8"/);
    assert.match(original, /x="7\.73" y="22\.35"/);
    assert.match(original, /M3 61\.50H28\.5/);
    assert.equal(adapted, original, 'header logo must be the original, unchanged SVG');
    const appIcon = fs.readFileSync('public/assets/app-icon.svg', 'utf8');
    assert.match(appIcon, /fill="#102b48"/);
    assert.ok(appIcon.includes(original.slice(original.indexOf('  <g fill='))));

    const shell = fs.readFileSync('public/js/ui/shell.js', 'utf8');
    assert.match(shell, /src="\/assets\/logo\.svg"/);
    assert.doesNotMatch(shell, /M9 13h30/);
    const context = await startTestServer();
    try {
        for (const resource of ['/assets/logo.svg', '/assets/app-icon.svg', '/assets/apple-touch-icon.png', '/assets/favicon-32.png', '/assets/icon-192.png', '/assets/icon-512.png', '/manifest.webmanifest']) {
            const response = await fetch(context.base + resource);
            assert.equal(response.status, 200, resource);
            assert.ok((await response.arrayBuffer()).byteLength > 100, resource);
        }
        const response = await fetch(context.base + '/manifest.webmanifest');
        assert.match(response.headers.get('content-type'), /application\/manifest\+json/);
        const manifest = await response.json();
        assert.equal(manifest.icons.length, 2);
        assert.equal(manifest.start_url, '/');
        const index = await (await fetch(context.base + '/')).text();
        assert.match(index, /rel="apple-touch-icon"/);
        assert.match(index, /rel="manifest"/);
    } finally {
        await context.stop();
    }
});
