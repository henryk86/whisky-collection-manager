import test from 'node:test';
import assert from 'node:assert/strict';
import { availableOverviewDistilleries, collectionOverviewEntries } from '../../public/js/domain/collection-overview.js';
import { homePageUrl, overviewModeFromSearch, paginate } from '../../public/js/domain/pagination.js';
import { createHomeView } from '../../public/js/views/home.js';

const sample = () => ({
    bottlings: [
        {
            id: 'a', name: 'Islay Malt', bottler: 'Independent Bottler',
            distilleryIds: [], completionStatus: 'complete', ageYears: 12,
            createdAt: '2026-11-01T00:00:00Z', bottles: [
                { id: 'a-1', inventoryNumber: '000101', status: 'closed', volumeType: 'standard', volumeMl: 700, photos: [{ path: 'one.jpg' }], createdAt: '2026-11-01' },
                { id: 'a-2', inventoryNumber: '000102', status: 'open', volumeType: 'sample', volumeMl: 50, photos: [{ path: 'two.jpg' }], createdAt: '2026-11-03' },
                { id: 'a-3', inventoryNumber: '000103', status: 'empty', volumeType: 'standard', photos: [], createdAt: '2026-11-02' },
            ],
        },
        { id: 'z', name: 'Empty Bottling', distilleryIds: [], completionStatus: 'incomplete', bottles: [], createdAt: '2026-11-01' },
    ],
});
const selectors = { distilleryNames: () => 'Keine Destillerie angegeben' };

test('bottling mode remains one entry per bottling, bottle mode uses individual physical bottles', () => {
    const collection = sample();
    const bottlings = collectionOverviewEntries(collection, { mode: 'bottlings', ...selectors });
    const bottles = collectionOverviewEntries(collection, { mode: 'bottles', ...selectors });
    assert.deepEqual(bottlings.map(item => item.bottling.id), ['z', 'a']);
    assert.deepEqual(bottlings.map(item => item.bottle), [null, null]);
    assert.equal(bottles.length, 3);
    assert.deepEqual(bottles.map(item => item.bottle.id), ['a-1', 'a-2', 'a-3']);
    assert.equal(bottles.every(item => item.bottling.id === 'a'), true);
    assert.equal(paginate(bottles, 2, 2).items[0].bottle.id, 'a-3');
});

test('bottle filters operate on each bottle, not on its entire bottling', () => {
    const collection = sample();
    const open = collectionOverviewEntries(collection, { mode: 'bottles', status: 'open', ...selectors });
    assert.deepEqual(open.map(item => item.bottle.id), ['a-2']);
    const closed = collectionOverviewEntries(collection, { mode: 'bottles', status: 'closed', ...selectors });
    assert.deepEqual(closed.map(item => item.bottle.id), ['a-1']);
    const search = collectionOverviewEntries(collection, { mode: 'bottles', search: '000102', ...selectors });
    assert.deepEqual(search.map(item => item.bottle.id), ['a-2']);
    assert.deepEqual(collectionOverviewEntries(collection, { mode: 'bottles', search: 'Sample', ...selectors }).map(item => item.bottle.id), ['a-2']);
    assert.equal(collectionOverviewEntries(collection, { mode: 'bottles', completion: 'incomplete', ...selectors }).length, 0);
    assert.equal(collectionOverviewEntries(collection, { mode: 'bottlings', search: '000102', ...selectors }).length, 1);
    assert.equal(collectionOverviewEntries(collection, { mode: 'bottlings', status: 'open', ...selectors }).length, 1);
    assert.deepEqual(collectionOverviewEntries(collection, { mode: 'bottles', sort: 'newest', ...selectors }).map(item => item.bottle.id), ['a-2', 'a-3', 'a-1']);
});

test('quick distillery options contain only distilleries used by a bottling, including blends', () => {
    const collection = {
        distilleries: [
            { id: 'unrelated', name: 'Unused' }, { id: 'second', name: 'Zweite' },
            { id: 'first', name: 'Erste' }, { id: 'legacy', name: 'Legacy' },
        ],
        bottlings: [
            { id: 'blend', name: 'Blend', distilleryIds: ['second', 'first'], bottles: [] },
            { id: 'old', name: 'Old', distilleryId: 'legacy', bottles: [] },
        ],
    };
    assert.deepEqual(availableOverviewDistilleries(collection).map(d => d.id), ['first', 'legacy', 'second']);
    assert.deepEqual(collectionOverviewEntries(collection, { distillery: 'first' }).map(e => e.bottling.id), ['blend']);
    assert.deepEqual(collectionOverviewEntries(collection, { distillery: 'legacy' }).map(e => e.bottling.id), ['old']);
    assert.equal(collectionOverviewEntries(collection, { distillery: 'unrelated' }).length, 0);
});

test('standard/sample quick filter is applied before pagination in both overview modes', () => {
    const collection = sample();
    collection.distilleries = [{ id: 'islay', name: 'Islay' }, { id: 'other', name: 'Other' }];
    collection.bottlings[0].distilleryIds = ['islay'];
    collection.bottlings.push({ id: 'other', name: 'Other', distilleryIds: ['other'],
        completionStatus: 'complete', bottles: [{ id: 'other-1', status: 'closed', volumeType: 'standard' }] });
    const options = { distillery: 'islay', ...selectors };
    assert.deepEqual(collectionOverviewEntries(collection, { mode: 'bottles', volumeType: 'sample', ...options }).map(e => e.bottle.id), ['a-2']);
    assert.deepEqual(collectionOverviewEntries(collection, { mode: 'bottles', volumeType: 'standard', ...options }).map(e => e.bottle.id), ['a-1', 'a-3']);
    assert.deepEqual(collectionOverviewEntries(collection, { mode: 'bottlings', volumeType: 'sample', ...options }).map(e => e.bottling.id), ['a']);
    assert.deepEqual(collectionOverviewEntries(collection, { mode: 'bottlings', volumeType: 'standard', ...options }).map(e => e.bottling.id), ['a']);
    assert.equal(collectionOverviewEntries(collection, { mode: 'bottlings', volumeType: 'sample', distillery: 'other' }).length, 0);
    assert.equal(collectionOverviewEntries(collection, { mode: 'bottlings', volumeType: 'standard', distillery: 'other' }).length, 1);
    assert.equal(collectionOverviewEntries(collection, { mode: 'bottlings', volumeType: 'sample', completion: 'incomplete', ...options }).length, 0);
    assert.equal(collectionOverviewEntries(collection, { mode: 'bottles', volumeType: 'sample', status: 'closed', ...options }).length, 0);
    assert.equal(collectionOverviewEntries(collection, { mode: 'bottlings', volumeType: 'sample', status: 'closed', ...options }).length, 0,
        'a closed standard bottle and open sample must not satisfy both filters');
    assert.equal(collectionOverviewEntries(collection, { mode: 'bottlings', volumeType: 'sample', status: 'open', ...options }).length, 1);
    assert.equal(paginate(collectionOverviewEntries(collection, { mode: 'bottles', volumeType: 'standard', ...options }), 1, 1).total, 2);
});

test('bottle mode is bookmarkable and the default bottling URL is backward compatible', () => {
    assert.equal(homePageUrl(1), '/');
    assert.equal(homePageUrl(4), '/?page=4');
    assert.equal(homePageUrl(1, 'bottles'), '/?mode=bottles');
    assert.equal(homePageUrl(4, 'bottles'), '/?mode=bottles&page=4');
    assert.equal(overviewModeFromSearch('?mode=bottles&page=2'), 'bottles');
    assert.equal(overviewModeFromSearch('?mode=unknown'), 'bottlings');
});

test('physical bottle cards use their own photo, identifier, status and volume; table rows stay distinct', () => {
    const collection = sample();
    const original = {
        document: globalThis.document, history: globalThis.history, location: globalThis.location,
    };
    const field = { addEventListener() {} };
    let html = '';
    const state = {
        collection, overviewMode: 'bottles', view: 'cards', search: '', status: 'all',
        completion: 'all', distillery: 'all', volumeType: 'all', sort: 'name', pageNumber: 1, pageSize: 24,
    };
    try {
        globalThis.document = { querySelector: () => field, querySelectorAll: () => [] };
        globalThis.history = { replaceState() { throw new Error('No history change expected'); } };
        globalThis.location = { pathname: '/', search: '?mode=bottles' };
        const view = createHomeView({ state, selectors: {
            allBottles: () => collection.bottlings.flatMap(b => b.bottles),
            bottles: id => collection.bottlings.find(b => b.id === id)?.bottles || [],
            coverPhoto: () => 'bottling-cover.jpg',
            distilleryNames: selectors.distilleryNames,
        }, shell(value) { html = value; } });
        view();
        assert.equal((html.match(/<article\b/g) || []).length, 3);
        assert.equal((html.match(/data-bottle-id=/g) || []).length, 3);
        assert.match(html, /data-bottle-id="a-1"[\s\S]*?one\.jpg/);
        assert.match(html, /data-bottle-id="a-2"[\s\S]*?two\.jpg/);
        const cardFor = id => (html.match(/<article\b[\s\S]*?<\/article>/g) || [])
            .find(card => card.includes(`data-bottle-id="${id}"`));
        assert.match(cardFor('a-1'), /src="\/one\.jpg"/);
        assert.match(cardFor('a-2'), /src="\/two\.jpg"/);
        // Only bottles with no photo inherit the displayed bottling cover.
        assert.match(cardFor('a-3'), /src="\/bottling-cover\.jpg"/);
        assert.doesNotMatch(cardFor('a-1'), /bottling-cover\.jpg/);
        assert.doesNotMatch(cardFor('a-2'), /bottling-cover\.jpg/);
        assert.equal((html.match(/class="collection-mode-toggle"/g) || []).length, 1);
        assert.match(html, /class="section-head collection-heading"[\s\S]*class="collection-mode-toggle"[\s\S]*class="stats"/);
        assert.ok(html.indexOf('class="collection-mode-toggle"') < html.indexOf('class="stats"'));
        assert.match(html, /#000102 · 50 ml/);
        assert.match(html, /<span class="badge open">Geöffnet<\/span>/);
        assert.match(html, /<span class="badge sample">Sample<\/span>/);
        assert.match(html, /1–3 von 3 Flaschen/);
        assert.match(html, /id="filter-distillery"/);
        assert.match(html, /id="filter-volume-type"/);
        assert.match(html, /<option value="sample"\s*>Samples<\/option>/);
        const toolbar = html.match(/<div class="toolbar">([\s\S]*?)<\/div>/)?.[1];
        assert.ok(toolbar, 'overview toolbar must exist');
        assert.doesNotMatch(toolbar, /overview-quick-filters|overview-quick-field|Schnellfilter/,
            'quick filters must not have a separate labelled row');
        assert.equal((toolbar.match(/<select\b/g) || []).length, 5,
            'all five filter and sort dropdowns belong directly in one toolbar');
        assert.ok(toolbar.indexOf('id="filter-sort"') < toolbar.indexOf('id="filter-distillery"'));
        assert.ok(toolbar.indexOf('id="filter-volume-type"') < toolbar.indexOf('data-act="toggle-view"'));
        assert.match(toolbar, /<select id="filter-distillery" aria-label="Destillerie filtern">/);
        assert.match(toolbar, /<select id="filter-volume-type" aria-label="Flaschentyp filtern">/);
        state.view = 'table';
        view();
        assert.equal((html.match(/<tr class="clickable"/g) || []).length, 3);
        assert.match(html, /<th>Flasche<\/th>/);
        assert.match(html, /data-bottle-id="a-2"/);
        assert.match(html, /#000102/);
    } finally {
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete globalThis[key];
            else globalThis[key] = value;
        }
    }
});

test('pagination in bottle mode counts physical bottles rather than their shared bottling', () => {
    const collection = { bottlings: [{
        id: 'one', name: 'One Whisky', createdAt: '2026-11-08',
        bottles: Array.from({ length: 28 }, (_, i) => ({
            id: `b-${i}`, status: 'closed', volumeType: 'standard', inventoryNumber: String(i + 1).padStart(5, '0'),
        })),
    }] };
    const bottlingEntries = collectionOverviewEntries(collection, { mode: 'bottlings', ...selectors });
    const bottleEntries = collectionOverviewEntries(collection, { mode: 'bottles', ...selectors });
    assert.equal(paginate(bottlingEntries).total, 1);
    assert.equal(paginate(bottleEntries).total, 28);
    assert.equal(paginate(bottleEntries).pageCount, 2);
    assert.equal(paginate(bottleEntries, 2).items.length, 4);
});
