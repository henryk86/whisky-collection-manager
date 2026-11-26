import {renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyzeCollection, filterAnalyticsCollection, analyticsFilterOptions}
  from '../../public/js/domain/analytics.js';
import {createAnalyticsView, ANALYSIS_PAGES}
  from '../../public/js/views/analytics.js';
import {parseRoute, routeUrl} from '../../public/js/navigation/routes.js';
import {MAIN_PAGES} from '../../public/js/navigation/pages.js';

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
    assert.equal(renderedText(de['analytics.summary.highlights']), 'Das Wichtigste auf einen Blick.');
    assert.equal(renderedText(en['analytics.summary.highlights']), 'Key figures at a glance.');
    assert.equal(renderedText(ANALYSIS_PAGES[0].sub), renderedText(de['analytics.summary.highlights']));
  }
);

test(
  'analytics page headline keeps its overview punchline on every tab',
  () => {
    const state = {
      collection: {schemaVersion: 6, distilleries: [], bottlings: []},
      analyticsFilters: {},
      analyticsPeriod: 'month',
      analyticsStartDate: '',
      analyticsEndDate: '',
      selected: 'overview',
    };
    let html = '';
    const render = createAnalyticsView({
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
       */
      shell: value => {
        html = value;
      },
    });
    for (const page of ANALYSIS_PAGES) {
      state.selected = page.id;
      render();
      assert.match(
        renderedText(html),
        /<p class="intro">Das Wichtigste auf einen Blick\.<\/p>/,
        `the header subtitle must not change on the ${page.id} tab`
      );
    }
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
    assert.equal(renderedText(a.scope.volumeLitres), 1.45);
    assert.equal(renderedText(a.provenance.byDistilleryBottles.find(d => d.id === 'a').bottles), 3);
    assert.equal(renderedText(a.provenance.byDistilleryBottles.find(d => d.id === 'b').bottles), 2);
    assert.equal(renderedText(a.provenance.byDistilleryBottlings.find(d => d.id === 'b').bottlings), 1);
    assert.equal(renderedText(a.profile.age.avg), 12);
    assert.equal(renderedText(a.profile.abv.avg), 46);
    assert.deepEqual(a.profile.edition.map(d => d.value), [1000]);
    assert.equal(renderedText(a.quality.missing.find(d => d.name === 'Alter').count), 2);
    assert.equal(renderedText(a.quality.whiskybase.find(d => d.name === 'Verknüpft').count), 1);
    assert.equal(renderedText(a.tasting.notes.find(d => d.name === 'Mit Notizen').count), 1);
    assert.equal(renderedText(a.tasting.rating.avg), 85);
    assert.equal(renderedText(a.timeline.opened[0].name), '2025-04');
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
    assert.equal(renderedText(a.scope.bottles), 5);
    assert.equal(renderedText(a.finance.priceCoverage), 4);
    assert.deepEqual(a.finance.prices.map(p => p.currency), ['EUR', 'UNBEKANNT', 'USD']);
    assert.equal(renderedText(a.finance.prices.find(p => p.currency === 'EUR').total), 58);
    assert.equal(renderedText(a.finance.prices.find(p => p.currency === 'EUR').litrePrice), 58 / .75);
    assert.equal(renderedText(a.finance.prices.find(p => p.currency === 'USD').total), 30);
    assert.equal(renderedText(a.finance.prices.find(p => p.currency === 'UNBEKANNT').total), 20);
    assert.equal(renderedText(a.finance.merchants.find(p => p.name === 'Bottle Shop').count), 2);
    assert.equal(a.finance.costMonthly.filter(p => p.currency === 'EUR').length, 2);
    assert.equal(renderedText(a.quality.missingPurchase.find(p => p.name === 'Kaufpreis').count), 1);
    assert.equal(renderedText(a.quality.missingPurchase.find(p => p.name === 'Kaufdatum').count), 3);
    assert.equal(
      a.finance.byDistillery.filter(d => d.currency === 'EUR').length,
      2,
      'blended bottling costs are allocated to both distilleries'
    );
  }
);

test(
  'analytics: the seven views have descriptive titles without index numbers and all analytics URLs are reloadable',
  () => {
    assert.equal(ANALYSIS_PAGES.length, 7);
    assert.ok(MAIN_PAGES.some(p => p.id === 'analytics' && p.action === 'goto-analysis'));
    const state = {
      collection: collection(),
      analyticsFilters: {
        distillery: 'b',
        volumeType: 'sample',
        status: 'open',
        country: 'Schottland',
      },
      analyticsPeriod: 'month',
      analyticsStartDate: '',
      analyticsEndDate: '',
    };
    const visited = new Map();
    for (const p of ANALYSIS_PAGES) {
      const url = routeUrl('analytics', p.id, state.analyticsFilters);
      const route = parseRoute(new URL(url, 'http://localhost').search);
      assert.equal(renderedText(route.selected), renderedText(p.id));
      assert.deepEqual(route.filters, state.analyticsFilters);
      state.selected = p.id;
      createAnalyticsView({
        state,
        /**
         * Derives the shell result from the supplied values.
         *
         * @param {*} html HTML markup to render or inspect.
         * @return {!Map<*, *>} Result computed from the supplied inputs.
         */
        shell: html => visited.set(p.id, html),
      })();
    }
    const all = [...visited.values()].map(renderedText).join('\n');
    assert.doesNotMatch(renderedText(all), /<(?:h[1-6]|span)[^>]*>\s*\d{1,2}\s*·/);
    for (const label of [
      'Herkunftsländer',
      'Whiskyregionen',
      'Fehlende Abfüllungsangaben',
      'Originalabfüllungen und weitere Abfüller',
      'Teuerste Flaschen je Währung',
    ]) assert.match(renderedText(all), new RegExp(label));
    assert.match(renderedText(visited.get('overview')), /analytics-section-grid/);
    assert.match(renderedText(visited.get('finance')), /Dokumentierte Ausgaben/);
    assert.match(renderedText(visited.get('timeline')), /Erfasste Flaschen/);
    assert.match(renderedText(visited.get('quality')), /Whiskybase-Verknüpfung/);
    assert.match(renderedText(visited.get('inventory')), /Standardflaschen und Samples/);
    assert.doesNotMatch(renderedText(all), /Infinity|NaN|undefined/);
  }
);


test('analytics: date range applies to actual days, not entire months', () => {
  const state = {
    collection: collection(),
    selected: 'timeline',
    analyticsFilters: {},
    analyticsPeriod: 'month',
    analyticsStartDate: '2025-04-10',
    analyticsEndDate: '2025-04-30',
  };
  let html = '';
  createAnalyticsView({
    state,
    /**
     * Captures the rendered page in the fixture for later assertions.
     *
     * @param {import('../../public/js/ui/render-plan.js').RenderContent} output Page content passed by the view.
     */
    shell: output => {html = output;},
  })();
  const registered = renderedText(html).split('<h3>Erfasste Flaschen</h3>')[1]?.split('</section>')[0] || '';
  assert.match(renderedText(registered), /Für diese Auswertung sind keine passenden Daten vorhanden/);
  const opened = renderedText(html).split('<h3>Geöffnete Flaschen</h3>')[1]?.split('</section>')[0] || '';
  assert.match(renderedText(opened), /2025-04/);
  assert.ok(domElements(html, '[type="date"][id="analytics-start-date"]').length > 0);
  assert.ok(domElements(html, '[value="2025-04-10"]').length > 0);
});

test('analytics: last ranked distillery stays an interactive link', () => {
  const distilleries = [
    'Ardbeg',
    'Lagavulin',
    'Kilchoman',
    'Laphroaig',
    'Bowmore',
    'Bunnahabhain',
    'Springbank',
  ]
    .map((name, i) => ({id: `site-${i}`, name}));
  const bottlings = distilleries.map((site, i) => ({
    id: `bottling-${i}`, name: `Bottling ${i}`, distilleryIds: [site.id],
    bottles: Array.from({length: distilleries.length - i}, (_, j) => ({
      id: `bottle-${i}-${j}`,
      status: 'closed',
      volumeType: 'standard',
      volumeMl: 700,
    })),
  }));
  const state = {
    collection: {distilleries, bottlings},
    selected: 'overview',
    analyticsFilters: {},
  };
  let html = '';
  createAnalyticsView({
    state,
    /**
     * Captures the rendered page in the fixture for later assertions.
     *
     * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
     */
    shell: value => {html = value;},
  })();
  const top = renderedText(html).match(
    new RegExp(
      '<section class="analytics-panel" data-ds-p' + 'anel="analytics"><h3>Top-Destillerien<\\/h' +
      '3>([\\s\\S]*?)<\\/section>'
    ))?.[1];
  assert.ok(top, 'the top-distilleries panel is rendered');
  const links = [...renderedText(top).matchAll(
    new RegExp('<button[^>]*class="analytics-bar-label ana' + 'lytics-link"[^>]*>([^<]*)<\\/button>', 'g'))];
  assert.equal(links.length, distilleries.length, 'every ranked distillery is a button, including the final one');
  assert.equal(renderedText(links.at(-1)[1]), 'Springbank');
  assert.ok(domElements(links.at(-1)[0], '[data-id="site-6"]').length > 0);
});


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
    assert.equal(renderedText(closed.consumption.count), 0);
    assert.equal(renderedText(closed.consumption.avg), null);
    const empty = analyzeCollection(c, {status: 'empty'});
    assert.equal(renderedText(empty.consumption.count), 3);
    const others = analyzeCollection(c, {distillery: 'b'});
    assert.equal(renderedText(others.consumption.count), 3, 'multi-distillery bottling is filtered consistently');
    const in2026 = analyzeCollection(c, {consumptionStartDate: '2026-01-01', consumptionEndDate: '2026-12-31'});
    assert.deepEqual(in2026.consumption, {count: 2, avg: 5, min: 0, max: 10});
    const inMarch = analyzeCollection(c, {consumptionStartDate: '2026-03-01', consumptionEndDate: '2026-03-01'});
    assert.deepEqual(inMarch.consumption, {count: 1, avg: 0, min: 0, max: 0}, 'date range includes both boundaries');
  }
);

test(
  'analytics: duration and emptying timeline are visible even without a usable pair of dates',
  () => {
    const c = collection();
    let html = '';
    const state = {
      collection: c, selected: 'timeline', analyticsFilters: {},
      analyticsPeriod: 'month', analyticsStartDate: '', analyticsEndDate: '',
    };
    createAnalyticsView({
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
       */
      shell: value => {html = value;},
    })();
    assert.match(renderedText(html), /Verbrauchsdauer/);
    assert.match(renderedText(html), /Geleerte Flaschen/);
    assert.match(renderedText(html), /Berechnungsgrundlage: 0 leere Flaschen/);
    c.bottlings[1].bottles[0].openedAt = '2026-01-01';
    c.bottlings[1].bottles[0].emptiedAt = '2026-02-12';
    createAnalyticsView({
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
       */
      shell: value => {html = value;},
    })();
    assert.match(renderedText(html), /Berechnungsgrundlage: 1 leere Flaschen/);
    assert.match(renderedText(html), /42 Tage/);
    assert.match(renderedText(html), /2026-02/);
    state.analyticsStartDate = '2026-03-01';
    createAnalyticsView({
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
       */
      shell: value => {html = value;},
    })();
    assert.match(renderedText(html), /Berechnungsgrundlage: 0 leere Flaschen/,
      'the displayed duration follows the selected emptying-date range');
  }
);
