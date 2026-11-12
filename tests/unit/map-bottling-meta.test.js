import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDistilleryMap } from '../../public/js/domain/distillery-map.js';
import { mapBottlingFacts } from '../../public/js/domain/map-bottling-meta.js';

test('map list displays age, ABV and clearly labelled years to distinguish identical names', () => {
    const collection = {
        distilleries: [{ id: 'kilchoman', name: 'Kilchoman' }],
        bottlings: [
            { id: 'a', name: 'Kilchoman Loch Gorm', distilleryIds: ['kilchoman'], ageYears: 8, abv: 46.2, distillationYear: 2012, bottlingYear: 2020, bottles: [{ id: 'p1' }] },
            { id: 'b', name: 'Kilchoman Loch Gorm', distilleryIds: ['kilchoman'], ageYears: 10, abv: 50, distillationYear: 2013, bottlingYear: 2023, bottles: [{ id: 'p2' }] },
        ],
    };
    const items = buildDistilleryMap(collection).located[0].bottlings;
    assert.equal(items.length, 2);
    assert.equal(items[0].bottleCount, 1);
    assert.equal(items[1].bottleCount, 1);
    assert.equal(mapBottlingFacts(items[0]), '8 Jahre · 46,2 % Vol. · Dest. 2012 · Abgef. 2020');
    assert.equal(mapBottlingFacts(items[1]), '10 Jahre · 50 % Vol. · Dest. 2013 · Abgef. 2023');
});

test('map metadata renders only present values and labels the release year fallback', () => {
    assert.equal(mapBottlingFacts({ ageYears: null, abv: '', distillationYear: undefined, bottlingYear: null }), '');
    assert.equal(mapBottlingFacts({ abv: 46.3, releaseYear: 2024 }), '46,3 % Vol. · Ersch. 2024');
    assert.equal(mapBottlingFacts({ ageYears: 1, bottlingYear: 2019, releaseYear: 2020 }), '1 Jahr · Abgef. 2019');
    assert.equal(mapBottlingFacts({ distillationYear: 2015 }), 'Dest. 2015');
    assert.equal(mapBottlingFacts({ ageYears: 0, abv: 0 }), '0 Jahre · 0 % Vol.');
});
