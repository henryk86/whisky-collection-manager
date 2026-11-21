import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function pngSize(path) {
    const png = fs.readFileSync(path);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} must be PNG`);
    return {width:png.readUInt32BE(16), height:png.readUInt32BE(20)};
}

test('iOS home-screen icon uses the actual full-size logo via apple-touch-icon', () => {
    assert.deepEqual(pngSize('public/apple-touch-icon.png'), {width:180,height:180});
    assert.deepEqual(fs.readFileSync('public/apple-touch-icon.png'),
        fs.readFileSync('public/assets/apple-touch-icon.png'));
    assert.deepEqual(pngSize('public/assets/icon-192.png'), {width:192,height:192});
    assert.deepEqual(pngSize('public/assets/icon-512.png'), {width:512,height:512});
    const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
    assert.ok(manifest.icons.some(icon => icon.src === '/assets/icon-192.png'));
    assert.ok(manifest.icons.some(icon => icon.src === '/assets/icon-512.png'));
});

// The browser tab icon is intentionally black; PWA and home-screen icons
// keep their own artwork and are not recolored by this change.
test('browser tab favicon uses a black SVG and a separate 32px PNG fallback', () => {
    const html = fs.readFileSync('public/index.html','utf8');
    const svg = fs.readFileSync('public/assets/app-icon.svg','utf8');
    assert.match(html,/app-icon\.svg\?v=black-1/);
    assert.match(html,/favicon-32\.png\?v=black-1/);
    assert.match(svg,/stroke="#000000"/);
    assert.doesNotMatch(svg,/#E9C082/i);
    assert.deepEqual(pngSize('public/assets/favicon-32.png'),{width:32,height:32});
});
