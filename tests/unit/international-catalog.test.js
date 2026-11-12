import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrateInternationalDistilleries, migrateDistilleryOrigins } from '../../server/storage/migrations.js';
const catalog = JSON.parse(fs.readFileSync(new URL('../../seed/distillery.json', import.meta.url), 'utf8'));
test('international catalog migration adds missing sites once without replacing edits', () => {
  const db = { distilleries: [{id: 'my-yamazaki', name: 'Yamazaki', status: 'closed', latitude: 12, longitude: 23 }] };
  assert.equal(migrateInternationalDistilleries(db), true);
  assert.equal(db.distilleries.find(d => d.name === 'Yamazaki').id, 'my-yamazaki');
  assert.equal(db.distilleries.find(d => d.name === 'Yamazaki').status, 'closed');
  assert.ok(db.distilleries.some(d => d.name === 'Kavalan'));
  assert.equal(migrateInternationalDistilleries(db), false);
  assert.equal(db.distilleries.length, catalog.filter(d => d.country).length);
});

test('published distilleries have countries; Scottish names are not UK/GB and key regions are curated', () => {
    assert.equal(catalog.length, 450);
    assert.ok(catalog.every(site => site.country));
    assert.ok(catalog.filter(site => site.region).length >= 180);
    for (const [name, region] of [['Ardbeg', 'Islay'], ['Springbank', 'Campbeltown'],
        ['Glenfiddich', 'Speyside'], ['Auchentoshan', 'Lowland'], ['Highland Park', 'Highland']]) {
        const site = catalog.find(entry => entry.name === name);
        assert.equal(site.country, 'Schottland');
        assert.equal(site.region, region);
    }
    assert.equal(catalog.find(site => site.name === 'Yamazaki').country, 'Japan');
    assert.equal(catalog.find(site => site.name === 'Penderyn').country, 'Wales');
});

test('origin backfill upgrades existing distilleries without replacing custom coordinates or status', () => {
    const db = { distilleries: [{ id: 'mine', name: 'Ardbeg', latitude: 42, longitude: -6, status: 'closed' },
        { id: 'custom', name: 'My Custom Distillery', country: 'Irland' },
        { id: 'legacy', name: 'Springbank', country: 'Eigenes Land' },
        { id: 'uk', name: 'Kilchoman', country: 'UK' }, { id: 'welsh', name: 'Penderyn', country: 'Wales' }] };
    assert.equal(migrateDistilleryOrigins(db), true);
    assert.deepEqual([db.distilleries[0].country, db.distilleries[0].region], ['Schottland', 'Islay']);
    assert.deepEqual([db.distilleries[0].status, db.distilleries[0].latitude], ['closed', 42]);
    assert.deepEqual([db.distilleries[2].country, db.distilleries[2].region], ['Eigenes Land', 'Campbeltown']);
    assert.equal(db.distilleries[1].country, 'Irland');
    assert.deepEqual([db.distilleries[3].country, db.distilleries[3].region], ['Schottland','Islay']);
    assert.equal(db.distilleries[4].country, 'Wales');
    assert.equal(migrateDistilleryOrigins(db), false);
});
