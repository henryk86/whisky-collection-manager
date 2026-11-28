import {domElements} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TABLE_COLUMNS, loadTableColumns} from '../../public/js/domain/collection-table-columns.js';
import {createHomeView} from '../../public/js/views/home.js';

/**
 * Constructs store from the supplied data.
 * @return {!Object} Structured result assembled from the input data.
 */
const makeStore = () => {
  const items = new Map();
  return {
    /**
     * Retrieves item from the available state.
     *
     * @param {*} key Key used to select or group values.
     * @return {*} Result computed from the supplied inputs.
     */
    getItem(key) {return items.get(key) ?? null;},
    /**
     * Updates item in the current state.
     *
     * @param {*} key Key used to select or group values.
     * @param {*} value Value to process.
     */
    setItem(key, value) {items.set(key, String(value));},
  };
};

const collection = {
  settings: {}, distilleries: [], bottlings: [
    {
      id: 'a',
      name: 'Malt A',
      completionStatus: 'complete',
      distilleryIds: [],
      ageYears: 10,
      abv: 43,
      releaseYear: 2009,
      updatedAt: '2026-08-01',
      tastings: [{id: 'ta', rating: 86, tastedOn: '2026-09-12'}],
      bottles: [
        {
          id: 'a1',
          inventoryNumber: '000020',
          status: 'closed',
          volumeType: 'standard',
          volumeMl: 700,
          purchasePrice: 100,
          currency: 'EUR',
        },
        {
          id: 'a2',
          inventoryNumber: '000003',
          status: 'open',
          volumeType: 'sample',
          volumeMl: 50,
          purchasePrice: 200,
          currency: 'EUR',
        },
      ],
    },
    {
      id: 'b',
      name: 'Malt B',
      completionStatus: 'incomplete',
      distilleryIds: [],
      ageYears: 20,
      abv: 50,
      releaseYear: 1999,
      updatedAt: '2026-10-01',
      tastings: [{id: 'tb', rating: 92, tastedOn: '2026-08-02'}],
      bottles: [{
        id: 'b1',
        inventoryNumber: '000010',
        status: 'empty',
        volumeType: 'standard',
        volumeMl: 500,
        purchasePrice: 30,
        currency: 'EUR',
      }],
    },
  ],
};

const selectors = {
  /**
   * Derives the all bottles result from the supplied values.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  allBottles: () => collection.bottlings.flatMap(item => item.bottles),
  /**
   * Derives the bottles result from the supplied values.
   *
   * @param {*} id Identifier of the affected record.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  bottles: id => collection.bottlings.find(item => item.id === id).bottles,
  /**
   * Simulates a missing cover photo.
   * @return {null} No photo path.
   */
  coverPhoto: () => null,
  /**
   * Omits distillery labels for this test.
   * @return {string} Empty label; no distillery name is supplied by this fixture.
   */
  distilleryNames: () => '',
};

test(
  'table columns can be enabled and removed and header sorting synchronizes the dropdown',
  async () => {
    const original = {
      document: globalThis.document,
      location: globalThis.location,
      history: globalThis.history,
      window: globalThis.window,
    };
    const storage = makeStore();
    const state = {
      page: 'home',
      collection,
      view: 'table',
      overviewMode: 'bottlings',
      search: '',
      status: 'all',
      completion: 'all',
      distillery: 'all',
      rating: 'all',
      volumeType: 'all',
      sort: 'name',
      pageNumber: 1,
      pageSize: 24,
    };
    let html = '';
    try {
      globalThis.window = {localStorage: storage};
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
      let currentPicker;
      globalThis.document = {
        /**
         * Derives the query selector result from the supplied values.
         *
         * @param {function(...*): *} selector Selector input for this
         * operation.
         * @return {*} Result computed from the supplied inputs.
         */
        querySelector: selector => selector === '.collection-table-columns' ? currentPicker : null,
        /**
         * Simulates an element query with no matches.
         * @return {Array<never>} Empty match list; the simulated root has no matching elements.
         */
        querySelectorAll: () => [],
      };
      const view = createHomeView({
        state, selectors,
        /**
         * Tests input text against the shell pattern.
         *
         * @param {*} markup HTML markup for the selected content.
         */
        shell: markup => {
          html = markup;
          // Simulate native details toggling when the user clicks the
          // dropdown summary, rather than changing its view state directly.
          currentPicker = {
            open: Boolean(markup.values.view?.values?.openAttributes?.open),
            isConnected: true,
            /**
             * Updates the add event listener state for its caller.
             *
             * @param {*} event Event that triggered this operation.
             * @param {*} fn Function called during this operation.
             */
            addEventListener: (event, fn) => {
              if (event === 'toggle') currentPicker.onToggle = fn;
            },
          };
        },
      });
      view();
      assert.ok((await domElements(html, 'thead [data-column="rating"]')).length > 0);
      assert.equal((await domElements(html, 'thead [data-column="editing"]')).length, 0);
      const rating = {dataset: {collectionColumn: 'rating'}, checked: false};
      view.handleChange(rating);
      assert.equal((await domElements(html, 'thead [data-column="rating"]')).length, 0);
      const editing = {dataset: {collectionColumn: 'editing'}, checked: true};
      view.handleChange(editing);
      assert.ok((await domElements(html, 'thead [data-column="editing"]')).length > 0);
      assert.ok((await domElements(html, '[class="collection-table-columns"][open]')).length > 0);
      assert.deepEqual(loadTableColumns(storage).bottlings.includes('editing'), true);
      // Closing the native <details> summary must persist across renders;
      // previously the next table update reopened it unexpectedly.
      currentPicker.open = false;
      currentPicker.onToggle();
      view();
      assert.equal((await domElements(html, '[class="collection-table-columns"][open]')).length, 0, 'the manually closed column picker remains closed on a subsequent render');
      view.handleClick({
        dataset: {
          act: 'collection-sort-column',
          column: 'age',
        },
      });
      assert.equal((await domElements(html, '[class="collection-table-columns"][open]')).length, 0, 'sorting a header closes the picker after editing columns');
      assert.equal(state.sort, 'age');
      assert.ok((await domElements(html, 'option[value="age"][selected]')).length > 0);
      assert.equal((await domElements(html, 'thead [aria-sort="descending"] > button[data-column="age"]')).length, 1);
      view.handleClick({
        dataset: {
          act: 'collection-sort-column',
          column: 'age',
        },
      });
      assert.equal(state.sort, 'ageAsc');
      assert.ok((await domElements(html, 'option[value="ageAsc"][selected]')).length > 0);
      state.overviewMode = 'bottles';
      view();
      assert.ok((await domElements(html, 'thead [data-column="inventory"]')).length > 0);
      assert.ok((await domElements(html, 'thead [data-column="rating"]')).length > 0);
      view.handleClick({
        dataset: {
          act: 'collection-sort-column',
          column: 'inventory',
        },
      });
      assert.equal(state.sort, 'inventoryAsc');
      assert.ok((await domElements(html, 'option[value="inventoryAsc"][selected]')).length > 0);
      view.handleClick({
        dataset: {
          act: 'collection-sort-column',
          column: 'inventory',
        },
      });
      assert.equal(state.sort, 'inventoryDesc');
      view.handleClick({dataset: {act: 'collection-columns-default'}});
      assert.deepEqual(loadTableColumns(storage).bottles, DEFAULT_TABLE_COLUMNS.bottles);
    } finally {
      for (const [name, value] of Object.entries(original)) if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
);
