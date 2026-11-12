import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    DEFAULT_PAGE_SIZE,
    PAGE_SIZE_OPTIONS,
    GRID_COLUMN_OPTIONS,
    homePageUrl,
    pageFromSearch,
    paginate,
    visiblePages,
} from '../../public/js/domain/pagination.js';

const bottlings = Array.from({ length: 450 }, (_, index) => ({
    id: `bottling-${String(index + 1).padStart(4, '0')}`,
    name: `Whisky ${String(index + 1).padStart(4, '0')}`,
}));

test('450 bottlings fill 19 pages at a fixed size of 24, regardless of layout', () => {
    assert.equal(DEFAULT_PAGE_SIZE, 24);
    assert.deepEqual(PAGE_SIZE_OPTIONS, [12, 24, 48, 96]);
    const first = paginate(bottlings, 1);
    assert.equal(first.pageCount, 19);
    assert.equal(first.items.length, 24);
    assert.deepEqual([first.from, first.to], [1, 24]);
    assert.equal(first.items[0].id, 'bottling-0001');
    const last = paginate(bottlings, 19);
    assert.equal(last.items.length, 18);
    assert.deepEqual([last.from, last.to], [433, 450]);
    assert.equal(last.items.at(-1).id, 'bottling-0450');
});

test('every supported responsive column count exactly divides every offered page size', () => {
    assert.deepEqual(GRID_COLUMN_OPTIONS, [1, 2, 3, 4]);
    for (const size of PAGE_SIZE_OPTIONS) {
        assert.equal(paginate(bottlings, 1, size).items.length, size);
        for (const columns of GRID_COLUMN_OPTIONS) {
            assert.equal(size % columns, 0, `${size} entries in ${columns} columns`);
        }
    }
    assert.ok(!GRID_COLUMN_OPTIONS.includes(5));
    assert.ok(!GRID_COLUMN_OPTIONS.includes(6));
    assert.doesNotMatch(fs.readFileSync('public/styles/core.css', 'utf8'), /grid-template-columns:\s*repeat\(6,/);

    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    assert.match(css, /\.grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4,/);
    assert.doesNotMatch(css, /grid--three/);
    assert.match(css, /@media\(max-width:1020px\)[\s\S]*?\.grid\s*\{\s*grid-template-columns:\s*repeat\(3,/);
    assert.match(css, /@media\(max-width:740px\)[\s\S]*?\.grid\s*\{\s*grid-template-columns:\s*repeat\(2,/);
    assert.match(css, /@media\(max-width:380px\)[\s\S]*?\.grid\s*\{\s*grid-template-columns:\s*minmax\(0,1fr\)/);
    assert.doesNotMatch(css, /grid-template-columns:\s*repeat\(auto-fill/);

    const home = fs.readFileSync('public/js/views/home.js', 'utf8');
    assert.match(home, /t\("home.pagination.bottlingsPerPage"\)/);
    assert.doesNotMatch(home, /Reihen pro Seite|ResizeObserver|gridColumns/);
});

test('page size stays exactly selected instead of being multiplied by responsive columns', () => {
    for (const size of PAGE_SIZE_OPTIONS) {
        const page = paginate(bottlings, 2, size);
        assert.equal(page.items.length, size);
        assert.equal(page.from, size + 1);
        assert.equal(page.to, size * 2);
        assert.equal(page.pageCount, Math.ceil(450 / size));
    }
    assert.equal(paginate(bottlings, 1, 24).pageCount, 19);
});

test('pagination slices after filtering and sorting, not before', () => {
    const matching = bottlings.filter(item => item.name.endsWith('5'));
    const sorted = [...matching].sort((a, b) => b.name.localeCompare(a.name));
    const first = paginate(sorted, 1, 24);
    assert.equal(first.total, 45);
    assert.equal(first.pageCount, 2);
    assert.equal(first.items[0].name, 'Whisky 0445');
    assert.equal(paginate(sorted, 2, 24).items.length, 21);
});

test('invalid, empty and out-of-range page values are clamped', () => {
    assert.equal(paginate(bottlings, 99).page, 19);
    assert.equal(paginate(bottlings, -4).page, 1);
    assert.equal(paginate(bottlings, 'broken').page, 1);
    assert.equal(paginate([], 12).page, 1);
    assert.equal(paginate([], 12).items.length, 0);
    assert.equal(paginate(bottlings, 3, 13).pageSize, 13);
    assert.equal(paginate(bottlings, 3, 999).pageSize, 24);
});

test('page URLs preserve page selection and safely reject malformed query strings', () => {
    assert.equal(homePageUrl(1), '/');
    assert.equal(homePageUrl(19), '/?page=19');
    assert.equal(pageFromSearch('?page=19'), 19);
    assert.equal(pageFromSearch('?page=0003'), 1);
    assert.equal(pageFromSearch('?page=-3'), 1);
    assert.equal(pageFromSearch('?page=1234567'), 1);
    assert.equal(pageFromSearch(''), 1);
});

test('visible page navigation stays compact for a large collection', () => {
    assert.deepEqual(visiblePages(1, 19), [1, 2, 3, 4, '…', 19]);
    assert.deepEqual(visiblePages(10, 19), [1, '…', 9, 10, 11, '…', 19]);
    assert.deepEqual(visiblePages(19, 19), [1, '…', 16, 17, 18, 19]);
});
