import {domElements, domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHomeView} from '../../public/js/views/home.js';
import {createAnalyticsView} from '../../public/js/views/analytics.js';
import {shelfContents} from '../../public/js/views/warehouse-shelf-details.js';

test(
  'M5: collection summary cards use the shared panel renderer without nesting panels',
  async () => {
    const previous = {
      document: globalThis.document,
      location: globalThis.location,
      history: globalThis.history,
    };
    let html = '';
    try {
      const placeholder = {
        /**
         * Ignores listener registration in this DOM-free test double.
         */
        addEventListener() {},
        /**
         * Suppresses focus changes in the simulated DOM.
         */
        focus() {},
      };
      globalThis.document = {
        /**
         * Derives the query selector result from the supplied values.
         * @return {!Object} Result computed from the supplied inputs.
         */
        querySelector: () =>
          placeholder,
        /**
         * Simulates an element query with no matches.
         * @return {Array<never>} Empty match list; the simulated root has no matching elements.
         */
        querySelectorAll: () => [],
      };
      globalThis.location = {pathname: '/', search: ''};
      globalThis.history = {
        /**
         * Suppresses history replacement in the simulated browser.
         */
        replaceState() {},
      };
      const state = {
        collection: {bottlings: [], distilleries: [], settings: {}},
        page: 'home', pageNumber: 1, pageSize: 24, search: '', status: 'all',
        completion: 'all', sort: 'name', view: 'cards',
      };
      const selectors = {
        /**
         * Provides an empty collection inventory.
         * @return {Array<never>} Empty physical inventory in this fixture.
         */
        allBottles: () => [],
        /**
         * Provides an empty physical-bottle list.
         * @return {Array<never>} No physical bottles for the requested bottling.
         */
        bottles: () => [],
        /**
         * Simulates a bottling without a cover photo.
         * @return {string} Empty path to exercise the no-photo state.
         */
        coverPhoto: () => '',
        /**
         * Omits distillery labels for this test.
         * @return {string} Empty label; no distillery name is supplied by this fixture.
         */
        distilleryNames: () => '',
      };
      createHomeView({
        state, selectors,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
         */
        shell: markup => {html = markup;},
      })();
      assert.equal((await domElements(html, '[class="panel stat"][data-ds-panel="standard"]')).length, 4);
      assert.ok((await domElements(html, '[class="empty-state"][data-ds-empty-state="collection"]')).length > 0);
      await assertDom(html, ".panel.stat > .panel", {}, true);
    } finally {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
      }
    }
  }
);

test(
  'M5: analytics KPIs use the same panel contract but keep chart-specific styles separate',
  async () => {
    let html = '';
    const state = {
      collection: {schemaVersion: 8, bottlings: [], distilleries: []},
      selected: 'overview', analyticsFilters: {}, analyticsPeriod: 'month',
    };
    createAnalyticsView({
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
       */
      shell: markup => {html = markup;},
    })();
    assert.ok((await domElements(html, '[class="panel stat analytics-metric"][data-ds-panel="standard"]')).length > 0);
    assert.ok((await domElements(html, '[class="analytics-panel"][data-ds-panel="analytics"]')).length > 0);
    assert.ok((await domElements(html, '[data-ds-empty-state="inline"]')).length > 0);
  }
);

test(
  'M5: warehouse shelf actions share the toolbar renderer and keep bottle event bindings',
  async () => {
    const room = {
      id: 'r1',
      name: 'Lager',
      furniture: [{
        id: 'f1',
        name: 'Regal',
        shelves: [{id: 's1', name: 'Fach', capacity: 5}],
      }],
    };
    const bottle = {
      id: 'p1',
      bottlingId: 'b1',
      name: 'A&B',
      number: '000111',
      status: 'closed',
    };
    const html = shelfContents({rooms: [room], bottles: [bottle], assignments: {p1: 's1'}}, 's1', [{id: 'b1', abv: 46}])?.html || '';
    await assertDom(html, "[class=\"actions warehouse-shelf-detail-actions\"][data-ds-action-toolbar=\"inline\"]");
    assert.ok((await domElements(html, '[data-act="warehouse-assign"][data-id="p1"]')).length > 0);
    assert.ok((await domElements(html, '[href="/?bottling=b1"]')).length > 0);
    assert.match(await domText(html), new RegExp("A&B"));
  }
);
