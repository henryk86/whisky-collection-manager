import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startTestServer} from '../helpers/server.js';

test('the supplied SVG is used by header, favicon and home-screen icons', async () => {
  // Asset byte contracts and HTTP integration are tested here; actual header
  // appearance, SVG rendering and placeholder dimensions are checked in Chromium.
  const context = await startTestServer();
  try {
    for (const resource of ['/assets/logo.svg', '/assets/app-icon.svg', '/assets/apple-touch-icon.png', '/assets/favicon-32.png', '/assets/icon-192.png', '/assets/icon-512.png', '/manifest.webmanifest']) {
      const response = await fetch(context.base + resource);
      assert.equal(response.status, 200, resource);
      assert.ok((await response.arrayBuffer()).byteLength > 100, resource);
    }
    const fallback = fs.readFileSync('public/assets/favicon-32.png');
    assert.equal(fallback[25], 6, "PNG fallback must have RGBA transparency");
    const response = await fetch(context.base + '/manifest.webmanifest');
    assert.match(response.headers.get('content-type'), /application\/manifest\+json/);
    const manifest = await response.json();
    assert.equal(manifest.icons.length, 2);
    assert.equal(manifest.start_url, '/');
    const index = await (await fetch(context.base + '/')).text();
    assert.match(index, /href="\/assets\/app-icon\.svg\?v=black-1"/);
    assert.match(index, /href="\/assets\/favicon-32\.png\?v=black-1"/);
    assert.match(index, /rel="apple-touch-icon"[^>]*href="\/apple-touch-icon\.png\?v=0\.23\.0"/);
    assert.match(index, /name="apple-mobile-web-app-title" content="Whisky Collection Manager"/);
    const appleIcon = await fetch(context.base + '/apple-touch-icon.png');
    assert.equal(appleIcon.status, 200);
    const png = Buffer.from(await appleIcon.arrayBuffer());
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 180);
    assert.equal(png.readUInt32BE(20), 180);
    assert.equal(png[25], 2, 'Apple icon is opaque RGB, not a transparent rounded rectangle');
    assert.deepEqual(png, fs.readFileSync('public/assets/apple-touch-icon.png'));
    assert.match(index, /rel="manifest"/);
  } finally {
    await context.stop();
  }
});
