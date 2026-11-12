import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { paginate } from '../../public/js/domain/pagination.js';

/** The number of results must never force a smaller desktop column count. */
test('all desktop collection result counts use the same four-column grid', () => {
    const home = fs.readFileSync('public/js/views/home.js', 'utf8');
    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    assert.match(home, /<div class="grid">\$\{cards\}<\/div>/);
    assert.doesNotMatch(home, /cardGridClass|grid--three/);
    assert.doesNotMatch(css, /grid--three/);
    assert.match(css, /\.grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4,/);
    assert.match(css, /@media\(max-width:1020px\)[\s\S]*?\.grid\s*\{\s*grid-template-columns:\s*repeat\(3,/);
});

test('six search results and final pages preserve the fixed chosen page size', () => {
    const entries = Array.from({ length: 450 }, (_, i) => ({ id: String(i) }));
    const filtered = entries.slice(0, 6);
    assert.equal(paginate(filtered, 1, 24).items.length, 6);
    assert.equal(paginate(filtered, 1, 24).pageSize, 24);
    assert.equal(paginate(entries, 1, 24).items.length, 24);
    assert.equal(paginate(entries, 19, 24).items.length, 18);
});


test('cards stretch only within their responsive grid row, without global uniform row heights', () => {
    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    const mainGrid = css.match(/\.grid\s*\{([^}]+)\}/)?.[1];
    assert.ok(mainGrid, 'Main collection grid rule must exist');
    assert.match(mainGrid, /align-items:\s*stretch\s*;/, 'Cards need to fill the height of their individual grid row');
    assert.doesNotMatch(mainGrid, /grid-auto-rows:\s*1fr|grid-template-rows:\s*repeat\(/,
        'Do not equalize heights across different rows');
    assert.match(css, /\.card-body h3\s*\{[^}]*min-height:\s*0\s*;/, 'Do not reserve title height');
    assert.match(css, /@media\(max-width:740px\)[\s\S]*?\.grid\s*\{\s*grid-template-columns:\s*repeat\(2,/);
    assert.match(css, /@media\(max-width:380px\)[\s\S]*?\.grid\s*\{\s*grid-template-columns:\s*minmax\(0,1fr\)/);
});
