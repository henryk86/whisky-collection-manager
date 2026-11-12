import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { backToCollectionButton } from '../../public/js/ui/navigation-controls.js';
import { createSettingsView } from '../../public/js/views/settings.js';

const source = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

test('main content expands equally for collection and map, while keeping the map split layout', () => {
    const core = source('public/styles/core.css');
    const map = source('public/styles/map.css');
    assert.match(core, /main\s*\{\s*width:\s*100%;\s*max-width:\s*1350px;/);
    assert.match(map, /\.map-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)\s+minmax\(265px,325px\)/);
    assert.doesNotMatch(map, /\.map-layout\s*\{[^}]*max-width:/);
});

test('navigation drawer is anchored on the right with matching shadow', () => {
    const css = source('public/styles/map.css');
    assert.match(css, /\.site-drawer\s*\{[^}]*inset:\s*0 0 0 auto;/);
    assert.match(css, /\.site-drawer\s*\{[^}]*box-shadow:\s*-6px 0/);
});

test('settings and map share the same return-to-collection button', () => {
    const settings = createSettingsView({ collection: { settings: {}, distilleries: [] } })();
    assert.match(String(backToCollectionButton), /data-act="goto-home"/);
    assert.match(String(backToCollectionButton), /← Zur Sammlung/);
    assert.ok(settings.includes(backToCollectionButton));
    assert.match(source('public/js/views/map.js'), /\$\{backToCollectionButton\}/);
});
