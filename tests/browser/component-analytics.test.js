import {domElements, domText, domScope, assertDom} from './component-dom.js';
import {composeMarkup} from '../../public/js/ui/render-plan.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnalyticsView, ANALYSIS_PAGES} from '../../public/js/views/analytics.js';
import {parseRoute, routeUrl} from '../../public/js/navigation/routes.js';
import {MAIN_PAGES} from '../../public/js/navigation/pages.js';

/**
 * Derives the collection result from the supplied values.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const collection = () => ({
  schemaVersion: 10,
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
  'analytics page headline keeps its overview punchline on every tab',
  async () => {
    const state = {
      collection: {schemaVersion: 10, distilleries: [], bottlings: []},
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
      await assertDom(html, "p.intro", {"text": new RegExp("^Das Wichtigste auf einen Blick\\.$")}, false, `the header subtitle must not change on the ${page.id} tab`);
    }
  }
);

test(
  'analytics: the eight views have descriptive titles without index numbers and all analytics URLs are reloadable',
  async () => {
    assert.equal(ANALYSIS_PAGES.length, 8);
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
      assert.equal(route.selected, p.id);
      assert.deepEqual(route.filters, state.analyticsFilters);
      state.selected = p.id;
      createAnalyticsView({
        state,
        /**
         * Derives the shell result from the supplied values.
         *
         * @param {*} html Captured render content to inspect.
         * @return {!Map<*, *>} Result computed from the supplied inputs.
         */
        shell: html => visited.set(p.id, html),
      })();
    }
    const all = composeMarkup([...visited.values()]);
    await assertDom(all, "h1,h2,h3,h4,h5,h6,span", {"text": new RegExp("^\\s*\\d{1,2}\\s*·")}, true);
    for (const label of [
      'Herkunftsländer',
      'Whiskyregionen',
      'Fehlende Abfüllungsangaben',
      'Originalabfüllungen und weitere Abfüller',
      'Teuerste Flaschen je Währung',
    ]) assert.match(await domText(all), new RegExp(label));
    await assertDom(visited.get('overview'), ".analytics-section-grid");
    assert.match(await domText(visited.get('finance')), /Dokumentierte Ausgaben/);
    assert.match(await domText(visited.get('timeline')), /Erfasste Flaschen/);
    assert.match(await domText(visited.get('quality')), /Whiskybase-Verknüpfung/);
    assert.match(await domText(visited.get('inventory')), /Standardflaschen und Samples/);
    assert.doesNotMatch(await domText(all), /Infinity|NaN|undefined/);
    const nodes = await domElements(all, '*');
    assert.ok(nodes.every(node => Object.values(node.attributes).every(value => !/Infinity|NaN|undefined/.test(value))));
  }
);

test('analytics: date range applies to actual days, not entire months', async () => {
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
  const registered = domScope(html, 'section.analytics-panel', 'Erfasste Flaschen');
  assert.match(await domText(registered), /Für diese Auswertung sind keine passenden Daten vorhanden/);
  const opened = domScope(html, 'section.analytics-panel', 'Geöffnete Flaschen');
  assert.match(await domText(opened), /2025-04/);
  assert.ok((await domElements(html, '[type="date"][id="analytics-start-date"]')).length > 0);
  assert.ok((await domElements(html, '[value="2025-04-10"]')).length > 0);
});

test('analytics: last ranked distillery stays an interactive link', async () => {
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
  const top = domScope(html, 'section.analytics-panel', 'Top-Destillerien');
  const links = await domElements(top, 'button.analytics-bar-label.analytics-link');
  assert.equal(links.length, distilleries.length, 'every ranked distillery is a button, including the final one');
  assert.equal(links.at(-1).text, 'Springbank');
  assert.equal(links.at(-1).attributes['data-id'], 'site-6');
});

test(
  'analytics: duration and emptying timeline are visible even without a usable pair of dates',
  async () => {
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
    assert.match(await domText(html), /Verbrauchsdauer/);
    assert.match(await domText(html), /Geleerte Flaschen/);
    assert.match(await domText(html), /Berechnungsgrundlage: 0 leere Flaschen/);
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
    assert.match(await domText(html), /Berechnungsgrundlage: 1 leere Flaschen/);
    assert.match(await domText(html), /42 Tage/);
    assert.match(await domText(html), /2026-02/);
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
    assert.match(await domText(html), /Berechnungsgrundlage: 0 leere Flaschen/, 'the displayed duration follows the selected emptying-date range');
  }
);
