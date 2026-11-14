import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function pngSize(path) {
    const png = fs.readFileSync(path);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} must be PNG`);
    return {width:png.readUInt32BE(16), height:png.readUInt32BE(20)};
}

test('iOS home-screen icon uses the actual full-size logo via apple-touch-icon', () => {
    const html = fs.readFileSync('public/index.html', 'utf8');
    assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png\?v=0\.23\.0">/);
    assert.deepEqual(pngSize('public/apple-touch-icon.png'), {width:180,height:180});
    assert.deepEqual(fs.readFileSync('public/apple-touch-icon.png'),
        fs.readFileSync('public/assets/apple-touch-icon.png'));
    assert.deepEqual(pngSize('public/assets/icon-192.png'), {width:192,height:192});
    assert.deepEqual(pngSize('public/assets/icon-512.png'), {width:512,height:512});
    const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
    assert.ok(manifest.icons.some(icon => icon.src === '/assets/icon-192.png'));
    assert.ok(manifest.icons.some(icon => icon.src === '/assets/icon-512.png'));
});
