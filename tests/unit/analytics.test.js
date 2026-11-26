import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyzeCollection, filterAnalyticsCollection, analyticsFilterOptions} from '../../public/js/domain/analytics.js';
import {ANALYSIS_PAGES} from '../../public/js/views/analytics.js';

/**
 * Derives the collection result from the supplied values.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const collection = () => ({
  schemaVersion: 6,
  distilleries: [
    {id: 'a', name: 'Alpha', country: 'Schottland', region: 'Islay'},
    {id: 'b', name: 'Beta', country: 'Irland'},
    {id: 'c', name: 'Unused'},
  ],
  bottlings: [
    {
      id: 'blend',
      name: 'Two Distillery Blend',
      distilleryIds: ['a', 'b'],
      bottler: 'Indie',
      whiskyType: 'blended_malt',
      ageYears: 12,
      abv: 46,
      country: 'Scotland',
      region: 'Islay',
      caskType: 'Sherry',
      distillationYear: 2005,
      bottlingYear: 2017,
      releaseYear: 2018,
      limitedEditionCount: 1000,
      completionStatus: 'complete',
      whiskybaseId: '123',
      tastings: [{
        id: 'taste1',
        tastedOn: '2026-01-01',
        createdAt: '2026-01-01T00:00:00Z',
        rating: 85,
        tastingNotes: {nose: 'Sherry', palate: '', finish: ''},
      }],
      bottles: [
        {
          id: 'one',
          volumeType: 'standard',
          volumeMl: 700,
          status: 'closed',
          purchasePrice: 50,
          currency: 'EUR',
          merchant: 'Bottle Shop',
          purchaseDate: '2025-03-01',
          createdAt: '2025-02-28T12:00:00Z',
        },
        {
          id: 'two',
          volumeType: 'sample',
          volumeMl: 50,
          status: 'open',
          purchasePrice: 8,
          currency: 'EUR',
          merchant: 'Bottle Shop',
          purchaseDate: '2025-04-01',
          createdAt: '2025-04-01T12:00:00Z',
          openedAt: '2025-04-15',
        },
      ],
    },
    {
      id: 'single',
      name: 'Alpha Distillery',
      distilleryIds: ['a'],
      bottler: 'Alpha',
      country: 'Ireland',
      completionStatus: 'incomplete',
      bottles: [{
        id: 'three',
        volumeType: 'standard',
        volumeMl: 700,
        status: 'empty',
        purchasePrice: 30,
        currency: 'USD',
        createdAt: '2026-01-01',
      }],
    },
    {
      id: 'no-bottle',
      name: 'Limited Ghost',
      distilleryIds: [],
      bottles: [],
      completionStatus: 'incomplete',
    },
  ],
});

test(
  'analytics overview subtitle is a complete sentence in German and English',
  () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(de['analytics.summary.highlights'], 'Das Wichtigste auf einen Blick.');
    assert.equal(en['analytics.summary.highlights'], 'Key figures at a glance.');
    assert.equal(ANALYSIS_PAGES[0].sub, de['analytics.summary.highlights']);
  }
);

test(
  'analytics: global filters match the same physical bottle and keep multi-distillery allocations honest',
  () => {
    const c = collection();
    const result = filterAnalyticsCollection(c, {distillery: 'b', volumeType: 'sample', status: 'closed'});
    assert.equal(result.bottleEntries.length, 0);
    assert.equal(result.bottlings.length, 0);
    const matched = filterAnalyticsCollection(c, {distillery: 'b', volumeType: 'sample', status: 'open'});
    assert.deepEqual(matched.bottles.map(b => b.id), ['two']);
    assert.equal(matched.bottlings.length, 1);
    const options = analyticsFilterOptions(c);
    assert.deepEqual(options.distilleries.map(d => d.name), ['Alpha', 'Beta']);
    assert.deepEqual(options.countries, ['Irland', 'Schottland', 'Unbekannt']);
  }
);

test(
  'analytics: totals use physical bottles, multiple distilleries count toward each site',
  () => {
    const a = analyzeCollection(collection());
    assert.deepEqual([a.scope.bottlings, a.scope.bottles, a.scope.distilleries], [3, 3, 2]);
    assert.equal(a.scope.volumeLitres, 1.45);
    assert.equal(a.provenance.byDistilleryBottles.find(d => d.id === 'a').bottles, 3);
    assert.equal(a.provenance.byDistilleryBottles.find(d => d.id === 'b').bottles, 2);
    assert.equal(a.provenance.byDistilleryBottlings.find(d => d.id === 'b').bottlings, 1);
    assert.equal(a.profile.age.avg, 12);
    assert.equal(a.profile.abv.avg, 46);
    assert.deepEqual(a.profile.edition.map(d => d.value), [1000]);
    assert.equal(a.quality.missing.find(d => d.name === 'Alter').count, 2);
    assert.equal(a.quality.whiskybase.find(d => d.name === 'Verknüpft').count, 1);
    assert.equal(a.tasting.notes.find(d => d.name === 'Mit Notizen').count, 1);
    assert.equal(a.tasting.rating.avg, 85);
    assert.equal(a.timeline.opened[0].name, '2025-04');
    assert.deepEqual(a.timeline.openedDaily.map(row => row.name), ['2025-04-15']);
    assert.deepEqual(
      a.finance.costDaily.filter(row => row.currency === 'EUR').map(row => row.name),
      ['2025-03-01', '2025-04-01']
    );
  }
);

test(
  'analytics: missing prices are not zero, currencies remain separate and volume-normalised costs use only matching data',
  () => {
    const c = collection();
    c.bottlings[1].bottles.push({
      id: 'missing', status: 'open', volumeType: 'sample',
      volumeMl: 50,
    });
    c.bottlings[1].bottles.push({
      id: 'unpriced-currency',
      status: 'closed',
      volumeType: 'standard',
      purchasePrice: 20,
    });
    const a = analyzeCollection(c);
    assert.equal(a.scope.bottles, 5);
    assert.equal(a.finance.priceCoverage, 4);
    assert.deepEqual(a.finance.prices.map(p => p.currency), ['EUR', 'UNBEKANNT', 'USD']);
    assert.equal(a.finance.prices.find(p => p.currency === 'EUR').total, 58);
    assert.equal(a.finance.prices.find(p => p.currency === 'EUR').litrePrice, 58 / .75);
    assert.equal(a.finance.prices.find(p => p.currency === 'USD').total, 30);
    assert.equal(a.finance.prices.find(p => p.currency === 'UNBEKANNT').total, 20);
    assert.equal(a.finance.merchants.find(p => p.name === 'Bottle Shop').count, 2);
    assert.equal(a.finance.costMonthly.filter(p => p.currency === 'EUR').length, 2);
    assert.equal(a.quality.missingPurchase.find(p => p.name === 'Kaufpreis').count, 1);
    assert.equal(a.quality.missingPurchase.find(p => p.name === 'Kaufdatum').count, 3);
    assert.equal(
      a.finance.byDistillery.filter(d => d.currency === 'EUR').length,
      2,
      'blended bottling costs are allocated to both distilleries'
    );
  }
);

test(
  'analytics: consumption uses only valid completed bottle intervals, including leap days and same-day emptying',
  () => {
    const c = collection();
    c.bottlings[0].bottles.push(
      {
        id: 'done-a',
        status: 'empty',
        openedAt: '2024-02-28',
        emptiedAt: '2024-03-01',
      }, // leap day: 2 days
      {
        id: 'done-b',
        status: 'empty',
        openedAt: '2026-03-01',
        emptiedAt: '2026-03-01',
      }, // 0 days
      {
        id: 'done-c',
        status: 'empty',
        openedAt: '2026-11-01',
        emptiedAt: '2026-11-11',
      }, // 10 days
      {id: 'missing-opened', status: 'empty', emptiedAt: '2026-05-01'},
      {id: 'missing-emptied', status: 'empty', openedAt: '2026-05-01'},
      {
        id: 'reversed',
        status: 'empty',
        openedAt: '2026-04-04',
        emptiedAt: '2026-04-03',
      },
      {
        id: 'invalid-date',
        status: 'empty',
        openedAt: '2026-02-29',
        emptiedAt: '2026-03-01',
      },
      {
        id: 'still-open',
        status: 'open',
        openedAt: '2026-01-01',
        emptiedAt: '2026-06-01',
      },
    );
    const all = analyzeCollection(c);
    assert.deepEqual(all.consumption, {count: 3, avg: 4, min: 0, max: 10});
    assert.deepEqual(all.timeline.emptiedDaily.map(row => row.name),
      ['2024-03-01', '2026-03-01', '2026-04-03', '2026-05-01', '2026-11-11']);
    assert.equal(
      all.timeline.emptiedDaily.some(row => row.name === '2026-06-01'),
      false,
      'dates recorded for a bottle that is not empty are not counted as emptied'
    );
    const closed = analyzeCollection(c, {status: 'closed'});
    assert.equal(closed.consumption.count, 0);
    assert.equal(closed.consumption.avg, null);
    const empty = analyzeCollection(c, {status: 'empty'});
    assert.equal(empty.consumption.count, 3);
    const others = analyzeCollection(c, {distillery: 'b'});
    assert.equal(others.consumption.count, 3, 'multi-distillery bottling is filtered consistently');
    const in2026 = analyzeCollection(c, {consumptionStartDate: '2026-01-01', consumptionEndDate: '2026-12-31'});
    assert.deepEqual(in2026.consumption, {count: 2, avg: 5, min: 0, max: 10});
    const inMarch = analyzeCollection(c, {consumptionStartDate: '2026-03-01', consumptionEndDate: '2026-03-01'});
    assert.deepEqual(inMarch.consumption, {count: 1, avg: 0, min: 0, max: 0}, 'date range includes both boundaries');
  }
);
