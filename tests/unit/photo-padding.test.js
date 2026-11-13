import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('existing photo previews have inner spacing to the border', () => {
    const gallery = fs.readFileSync('public/styles/collection.css', 'utf8');
    const detail = fs.readFileSync('public/styles/core.css', 'utf8');
    const importPreview = fs.readFileSync('public/styles/bottle-details.css', 'utf8');

    assert.match(gallery, /\.photo-tile \.photo-open\s*\{[^}]*padding:\s*8px\s*;/s);
    assert.match(detail, /\.hero-photo\s*\{[^}]*padding:\s*8px 8px 12px\s*;/s);
    assert.match(importPreview, /\.import-photo img\s*\{[^}]*padding:\s*8px\s*;/s);
});
