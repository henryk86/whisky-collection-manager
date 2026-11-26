import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHomeView} from '../../public/js/views/home.js';
import {createAnalyticsView} from '../../public/js/views/analytics.js';
import {shelfContents} from '../../public/js/views/warehouse-shelf-details.js';

test(
  'M5: collection summary cards use the shared panel renderer without nesting panels',
  () => {
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
      assert.equal((renderedText(html).match(/class="panel stat" data-ds-panel="standard"/g) || []).length, 4);
      assert.match(renderedText(html), /class="empty-state" data-ds-empty-state="collection"/);
      assert.doesNotMatch(renderedText(html), /class="panel stat"[^>]*>\s*<div class="panel"/);
    } finally {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
      }
    }
  }
);

test(
  'M5: analytics KPIs use the same panel contract but keep chart-specific styles separate',
  () => {
    let html = '';
    const state = {
      collection: {schemaVersion: 6, bottlings: [], distilleries: []},
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
    assert.match(renderedText(html), /class="panel stat analytics-metric" data-ds-panel="standard"/);
    assert.match(renderedText(html), /class="analytics-panel" data-ds-panel="analytics"/);
    assert.match(renderedText(html), /data-ds-empty-state="inline"/);
  }
);

test(
  'M5: warehouse shelf actions share the toolbar renderer and keep bottle event bindings',
  () => {
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
    assert.match(
      renderedText(html),
      new RegExp('class="actions warehouse-shelf-detail-acti' + 'ons" data-ds-action-toolbar="inline"')
    );
    assert.match(renderedText(html), /data-act="warehouse-assign" data-id="p1"/);
    assert.match(renderedText(html), /href="\/\?bottling=b1"/);
    assert.match(renderedText(html), /A&amp;B/);
  }
);
