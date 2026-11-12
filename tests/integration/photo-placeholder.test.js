import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('custom SVG photo placeholder is used instead of the old glyph', () => {
    const asset = fs.readFileSync('public/assets/photo-placeholder.svg', 'utf8');
    assert.match(asset, /<svg/i);

    const home = fs.readFileSync('public/js/views/home.js', 'utf8');
    const detail = fs.readFileSync('public/js/views/detail.js', 'utf8');
    assert.match(home, /\/assets\/photo-placeholder\.svg/);
    assert.match(detail, /\/assets\/photo-placeholder\.svg/);
    assert.doesNotMatch(home, /'◈'/);
    assert.doesNotMatch(detail, /'◈'/);

    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    assert.match(css, /\.image-placeholder/);
}
);
