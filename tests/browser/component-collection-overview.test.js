import {domElements, domText, domIndex, domScope, assertDom, assertDomOrder} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHomeView} from '../../public/js/views/home.js';

/**
 * Derives the sample result from the supplied values.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const sample = () => ({
  bottlings: [
    {
      id: 'a', name: 'Islay Malt', bottler: 'Independent Bottler',
      distilleryIds: [], completionStatus: 'complete', ageYears: 12,
      createdAt: '2026-11-01T00:00:00Z', bottles: [
        {
          id: 'a-1',
          inventoryNumber: '000101',
          status: 'closed',
          volumeType: 'standard',
          volumeMl: 700,
          photos: [{path: 'one.jpg'}],
          createdAt: '2026-11-01',
        },
        {
          id: 'a-2',
          inventoryNumber: '000102',
          status: 'open',
          volumeType: 'sample',
          volumeMl: 50,
          photos: [{path: 'two.jpg'}],
          createdAt: '2026-11-03',
        },
        {
          id: 'a-3',
          inventoryNumber: '000103',
          status: 'empty',
          volumeType: 'standard',
          photos: [],
          createdAt: '2026-11-02',
        },
      ],
    },
    {
      id: 'z',
      name: 'Empty Bottling',
      distilleryIds: [],
      completionStatus: 'incomplete',
      bottles: [],
      createdAt: '2026-11-01',
    },
  ],
});

const selectors = {
  /**
   * Supplies the fixed distillery label used by this fixture.
   * @return {string} Fixture label 'Keine Destillerie angegeben'.
   */
  distilleryNames: () => 'Keine Destillerie angegeben',
};

test(
  'physical bottle cards use their own photo, identifier, status and volume; table rows stay distinct',
  async () => {
    const collection = sample();
    const original = {
      document: globalThis.document,
      history: globalThis.history,
      location: globalThis.location,
    };
    const field = {
      /**
       * Ignores listener registration in this DOM-free test double.
       */
      addEventListener() {},
    };
    let html = '';
    const state = {
      collection,
      overviewMode: 'bottles',
      view: 'cards',
      search: '',
      status: 'all',
      completion: 'all',
      distillery: 'all',
      volumeType: 'all',
      sort: 'name',
      pageNumber: 1,
      pageSize: 24,
    };
    try {
      globalThis.document = {
        /**
         * Derives the query selector result from the supplied values.
         * @return {!Object} Result computed from the supplied inputs.
         */
        querySelector: () =>
          field,
        /**
         * Simulates an element query with no matches.
         * @return {Array<never>} Empty match list; the simulated root has no matching elements.
         */
        querySelectorAll: () => [],
      };
      globalThis.history =
      {
        /**
         * Reports the replace state error condition.
         */
        replaceState() {throw new Error('No history change expected');},
      };
      globalThis.location = {pathname: '/', search: '?mode=bottles'};
      const view = createHomeView({
        state, selectors: {
          /**
           * Derives the all bottles result from the supplied values.
           * @return {!Array<*>} Resulting entries in their output order.
           */
          allBottles: () => collection.bottlings.flatMap(b => b.bottles),
          /**
           * Derives the bottles result from the supplied values.
           *
           * @param {*} id Identifier of the affected record.
           * @return {!Array<*>} Resulting entries in their output order.
           */
          bottles: id => collection.bottlings.find(b => b.id === id)?.bottles || [],
          /**
           * Supplies a fixed cover-photo path for the image rendering assertion.
           * @return {string} Fixture photo path 'bottling-cover.jpg'.
           */
          coverPhoto: () => 'bottling-cover.jpg',
          distilleryNames: selectors.distilleryNames,
        },
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
         */
        shell(value) {html = value;},
      });
      view();
      assert.equal((await domElements(html, 'article')).length, 3);
      assert.equal((await domElements(html, '[data-bottle-id]')).length, 3);
      await assertDom(html, "[data-bottle-id=\"a-1\"] img[src*=\"one.jpg\"]");
      await assertDom(html, "[data-bottle-id=\"a-2\"] img[src*=\"two.jpg\"]");
      /**
       * Finds the rendered article for one physical bottle.
       *
       * @param {*} id Identifier of the affected record.
       * @return {!Object} Fixture scope selecting the article with the requested physical-bottle ID.
       */
      const cardFor = id => domScope(html, `article[data-bottle-id="${id}"]`);
      assert.ok((await domElements(cardFor('a-1'), '[src="/one.jpg"]')).length > 0);
      assert.ok((await domElements(cardFor('a-2'), '[src="/two.jpg"]')).length > 0);
      // Only bottles with no photo inherit the displayed bottling cover.
      assert.ok((await domElements(cardFor('a-3'), '[src="/bottling-cover.jpg"]')).length > 0);
      await assertDom(cardFor('a-1'), "img[src*=\"bottling-cover.jpg\"]", {}, true);
      await assertDom(cardFor('a-2'), "img[src*=\"bottling-cover.jpg\"]", {}, true);
      assert.equal((await domElements(html, '[class="collection-mode-toggle"]')).length, 1);
      await assertDomOrder(html, ".section-head.ds-page-header.collection-heading", ".collection-mode-toggle", ".stats");
      assert.ok(await domIndex(html, '.collection-mode-toggle') < await domIndex(html, '.stats'));
      assert.match(await domText(html), /#000102 · 50 ml/);
      await assertDom(html, "span[class=\"badge open\"]", {"text": new RegExp("^Geöffnet$")});
      await assertDom(html, "span[class=\"badge sample\"]", {"text": new RegExp("^Sample$")});
      assert.match(await domText(html), /1–3 von 3 Flaschen/);
      assert.ok((await domElements(html, '[id="filter-distillery"]')).length > 0);
      assert.ok((await domElements(html, '[id="filter-volume-type"]')).length > 0);
      await assertDom(html, "option[value=\"sample\"]", {"text": new RegExp("^Samples$")});
      const toolbar = domScope(html, '.toolbar.collection-filters');
      assert.ok(toolbar, 'overview toolbar must exist');
      assert.equal((await domElements(toolbar, 'select[id^="filter-"]')).length, 6,
        'all six existing selectors remain available');
      assert.ok((await domElements(toolbar, '[data-flavor-profile-status]')).length > 0, 'profile status lives in the flavor overlay');
      assert.ok((await domElements(toolbar, '[data-act="toggle-collection-filters"][aria-expanded="false"]')).length > 0);
      assert.ok((await domElements(toolbar, '[id="collection-filter-extra"]')).length > 0);
      assert.ok(await domIndex(toolbar, '[id="filter-sort"]') < await domIndex(toolbar, '[id="filter-distillery"]'));
      assert.ok(await domIndex(toolbar, '[data-act="toggle-view"]') < await domIndex(toolbar, '[id="filter-distillery"]'));
      assert.ok((await domElements(toolbar, 'select[id="filter-distillery"][aria-label="Destillerie filtern"]')).length > 0);
      assert.ok((await domElements(toolbar, 'select[id="filter-volume-type"][aria-label="Flaschentyp filtern"]')).length > 0);
      assert.ok((await domElements(toolbar, 'select[id="filter-rating"][aria-label="Nach Bewertung filtern"]')).length > 0);
      state.view = 'table';
      view();
      assert.equal((await domElements(html, 'tr[class="clickable"]')).length, 3);
      assert.match((await domElements(html, 'button[data-act="collection-sort-column"][data-column="inventory"]'))[0].text.trim(), /^Flasche/);
      assert.ok((await domElements(html, '[data-bottle-id="a-2"]')).length > 0);
      assert.match(await domText(html), /#000102/);
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  }
);

test(
  'glencairn rating is drawn over the bottle image with five proportional fills and unique IDs per bottle',
  async () => {
    const {collectionCardRating} = await import('../../public/js/views/home.js');
    const bottling = {
      id: 'own',
      tastings: [{id: 'new', tastedOn: '2026-11-15', rating: 87.5}],
    };
    const a = collectionCardRating(bottling, 'bottle-1');
    const b = collectionCardRating(bottling, 'bottle-2');
    assert.ok((await domElements(a, '[class="collection-card-rating"]')).length > 0);
    assert.equal((await domElements(a, '.glencairn-rating-symbol')).length, 5);
    assert.ok((await domElements(a, '[y="236.125"][width="220"][height="94.875"]')).length > 0);
    await assertDom(a, "[id=\"overview-rating-bottle-1-0\"]");
    await assertDom(b, "[id=\"overview-rating-bottle-2-0\"]");
    await assertDom(b, "[id=\"overview-rating-bottle-1-0\"]", {}, true);
    assert.equal(collectionCardRating({id: 'no-score', tastings: []}), '');
  }
);

test(
  'collection filters expand in place and active chips reset a single selection',
  async () => {
    const collection = {settings: {}, bottlings: [], distilleries: []};
    const state = {
      page: 'home',
      collection,
      search: '',
      status: 'open',
      completion: 'all',
      sort: 'name',
      distillery: 'all',
      rating: 'all',
      volumeType: 'all',
      view: 'cards',
      overviewMode: 'bottlings',
      pageNumber: 1,
      pageSize: 12,
    };
    let html = '';
    const original = {
      document: globalThis.document,
      location: globalThis.location,
      history: globalThis.history,
    };
    const filterElement = {dataset: {expanded: 'false'}};
    try {
      globalThis.location = {pathname: '/', search: ''};
      globalThis.history = {
        /**
         * Suppresses history replacement in the simulated browser.
         */
        replaceState() {},
        /**
         * Suppresses history insertion in the simulated browser.
         */
        pushState() {},
      };
      globalThis.document = {
        /**
         * Derives the query selector result from the supplied values.
         * @return {!Object} Result computed from the supplied inputs.
         */
        querySelector: () => filterElement,
      };
      const view = createHomeView({
        state, selectors: {
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
           * Simulates a missing cover photo.
           * @return {null} No photo path.
           */
          coverPhoto: () => null,
          /**
           * Derives the distillery names result from the supplied values.
           * @return {!Array<*>} Resulting entries in their output order.
           */
          distilleryNames: () => [],
        },
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
         */
        shell: markup => {html = markup;},
      });
      view();
      assert.ok((await domElements(html, '[data-expanded="false"]')).length > 0);
      assert.ok((await domElements(html, '[data-reset-collection-filter="status"]')).length > 0);
      const toggle = {
        dataset: {act: 'toggle-collection-filters'},
        /**
         * Updates attribute in the current state.
         *
         * @param {*} name Environment variable or setting name.
         * @param {*} value Value to process.
         */
        setAttribute(name, value) {this[name] = value;},
      };
      view.handleClick(toggle);
      assert.equal(filterElement.dataset.expanded, 'true');
      assert.equal(toggle['aria-expanded'], 'true');
      view();
      assert.ok((await domElements(html, '[data-expanded="true"]')).length > 0);
      view.handleClick({dataset: {resetCollectionFilter: 'status'}});
      assert.equal(state.status, 'all');
      assert.equal((await domElements(html, '[data-reset-collection-filter="status"]')).length, 0);
      assert.ok((await domElements(html, '[data-expanded="true"]')).length > 0, 'expanded filters stay open when values change');
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  }
);

test(
  'sort options include price, score, changed and tasting dates and are selectable in both modes',
  async () => {
    const collection = sample();
    const original = {
      document: globalThis.document,
      location: globalThis.location,
      history: globalThis.history,
    };
    const state = {
      collection,
      page: 'home',
      overviewMode: 'bottlings',
      view: 'cards',
      sort: 'tastedDesc',
      search: '',
      status: 'all',
      completion: 'all',
      distillery: 'all',
      volumeType: 'all',
      rating: 'all',
      pageNumber: 1,
      pageSize: 24,
    };
    let markup = '';
    try {
      globalThis.document = {
        /**
         * Simulates an element lookup that finds nothing.
         * @return {null} Null to represent a missing element.
         */
        querySelector: () => null,
      };
      globalThis.location = {pathname: '/', search: ''};
      globalThis.history = {
        /**
         * Suppresses history replacement in the simulated browser.
         */
        replaceState() {},
      };
      const view = createHomeView({
        state, selectors: {
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
        },
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} html Page content passed by the view.
         */
        shell: html => {markup = html;},
      });
      view();
      for (const value of [
        'nameDesc',
        'distillery',
        'distilleryDesc',
        'priceAsc',
        'priceDesc',
        'scoreDesc',
        'scoreAsc',
        'updatedDesc',
        'updatedAsc',
        'tastedDesc',
        'tastedAsc',
      ]) {
        await assertDom(markup, `option[value="${value}"]`);
      }
      assert.ok((await domElements(markup, 'option[value="tastedDesc"][selected]')).length > 0);
      assert.match(await domText(markup), /Ø Kaufpreis aufsteigend/);
      state.overviewMode = 'bottles';
      view();
      assert.match(await domText(markup), /Kaufpreis aufsteigend/);
      assert.doesNotMatch(await domText(markup), /Ø Kaufpreis aufsteigend/);
    } finally {
      for (const [name, value] of Object.entries(original)) {
        if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
      }
    }
  }
);
