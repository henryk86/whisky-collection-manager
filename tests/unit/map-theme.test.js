import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../public/styles/map.css', import.meta.url), 'utf8');
const viewer = fs.readFileSync(new URL('../../public/js/features/map/tile-map.js', import.meta.url), 'utf8');

test('OpenStreetMap tile layer follows the theme without filtering markers', () => {
    assert.match(css, /:root\[data-theme="dark"\] \.map-tiles\s*\{\s*filter:/);
    assert.match(css, /invert\(\.91\) hue-rotate\(180deg\) brightness\(1\.02\) saturate\(\.80\) contrast\(\.96\)/,
        'map tiles use a lighter yet still dark palette');
    assert.match(css, /:root\[data-theme="dark"\] \.map-canvas\s*\{\s*background:\s*#2a4052/,
        'map loading background should match the brighter dark palette');
    assert.match(css, /:root\[data-theme="dark"\] \.map-controls button\s*\{/);
    assert.match(css, /:root\[data-theme="dark"\] \.map-attribution\s*\{/);
    assert.doesNotMatch(css, /:root\[data-theme="dark"\] \.map-movable\s*\{[^}]*filter:/);
    assert.match(viewer, /tile\.openstreetmap\.org/);
});

test('wheel obtains cursor coordinates relative to the map viewport, not event target', () => {
    assert.match(viewer, /viewport\.getBoundingClientRect\(\)/);
    assert.match(viewer, /const x = event\.clientX - rect\.left, y = event\.clientY - rect\.top/);
    assert.match(viewer, /setZoom\(zoom \+ \(event\.deltaY < 0 \? 1 : -1\), \{ x, y \}\)/);
});
