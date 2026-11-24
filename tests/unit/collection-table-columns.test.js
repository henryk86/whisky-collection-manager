import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TABLE_COLUMNS, DEFAULT_TABLE_COLUMNS, TABLE_COLUMNS_STORAGE_KEY,
  loadTableColumns, saveTableColumns, normalizeTableColumns, sortForColumn,
} from '../../public/js/domain/collection-table-columns.js';
import {collectionOverviewEntries} from '../../public/js/domain/collection-overview.js';
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
   * Derives the cover photo result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  coverPhoto: () => null,
  /**
   * Derives the distillery names result from the supplied values.
   * @return {string} Resulting text.
   */
  distilleryNames: () => '',
};

/**
 * Derives the extract header result from the supplied values.
 *
 * @param {*} html HTML markup to render or inspect.
 * @return {*} Result computed from the supplied inputs.
 */
const extractHeader = html =>
  html.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/)?.[1] || '';

// These preferences must not modify collection.json or leak across overview
// modes.
test(
  'table column defaults, validation and per-mode browser persistence',
  () => {
    const storage = makeStore();
    const defaults = loadTableColumns(storage);
    assert.deepEqual(defaults.bottlings, DEFAULT_TABLE_COLUMNS.bottlings);
    assert.deepEqual(defaults.bottles, DEFAULT_TABLE_COLUMNS.bottles);
    assert.ok(defaults.bottlings.includes('rating'));
    assert.ok(!defaults.bottlings.includes('editing'));
    assert.ok(defaults.bottles.includes('rating'));
    assert.equal(
      saveTableColumns(
        {bottlings: ['rating', 'editing', 'nonsense'], bottles: ['inventory']},
        storage
      ),
      true
    );
    assert.deepEqual(
      loadTableColumns(storage),
      {bottlings: ['editing', 'rating'], bottles: ['inventory']}
    );
    storage.setItem(TABLE_COLUMNS_STORAGE_KEY, '{broken');
    assert.deepEqual(
      loadTableColumns(storage).bottlings,
      DEFAULT_TABLE_COLUMNS.bottlings
    );
    assert.deepEqual(
      normalizeTableColumns('bottlings', []),
      DEFAULT_TABLE_COLUMNS.bottlings
    );
  }
);

test(
  'every available column has two sort directions and toggles deterministically',
  () => {
    for (const mode of ['bottles', 'bottlings']) for (const column of TABLE_COLUMNS[mode]) {
      assert.ok(
        column.asc && column.desc && column.asc !== column.desc,
        `${mode}/${column.id}`
      );
      const first = sortForColumn(column, 'name');
      assert.ok([column.asc, column.desc].includes(first));
      assert.equal(
        sortForColumn(column, first),
        first === column.asc ? column.desc : column.asc
      );
    }
  }
);

test('switching from last tasted to name starts A-Z, then flips to Z-A', () => {
  const name = TABLE_COLUMNS.bottlings.find(column => column.id === 'name');
  assert.equal(sortForColumn(name, 'tastedDesc'), 'name');
  assert.equal(sortForColumn(name, 'name'), 'nameDesc');
  assert.equal(sortForColumn(name, 'nameDesc'), 'name');
});

test(
  'header sorts cover inventory, status, amount, stock, ABV, age, year and completion',
  () => {
    /**
     * Derives the entries result from the supplied values.
     *
     * @param {*} mode Selected mode controlling the operation.
     * @param {*} sort Sort direction or ordering rule.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    const entries = (mode, sort) =>
      collectionOverviewEntries(collection, {mode, sort});
    assert.deepEqual(
      entries('bottles', 'inventoryAsc').map(e => e.bottle.id),
      ['a2', 'b1', 'a1']
    );
    assert.deepEqual(
      entries('bottles', 'inventoryDesc').map(e => e.bottle.id),
      ['a1', 'b1', 'a2']
    );
    assert.deepEqual(
      entries('bottles', 'volumeMlAsc').map(e => e.bottle.id),
      ['a2', 'b1', 'a1']
    );
    assert.deepEqual(
      entries('bottles', 'statusAsc').map(e => e.bottle.id),
      ['a1', 'a2', 'b1']
    );
    assert.deepEqual(
      entries('bottlings', 'abvDesc').map(e => e.bottling.id),
      ['b', 'a']
    );
    assert.deepEqual(
      entries('bottlings', 'ageAsc').map(e => e.bottling.id),
      ['a', 'b']
    );
    assert.deepEqual(
      entries('bottlings', 'yearAsc').map(e => e.bottling.id),
      ['b', 'a']
    );
    assert.deepEqual(
      entries('bottlings', 'stockAsc').map(e => e.bottling.id),
      ['b', 'a']
    );
    assert.deepEqual(
      entries('bottlings', 'completionAsc').map(e => e.bottling.id),
      ['a', 'b']
    );
    assert.deepEqual(
      entries('bottlings', 'scoreDesc').map(e => e.bottling.id),
      ['b', 'a']
    );
  }
);

test(
  'table columns can be enabled and removed and header sorting synchronizes the dropdown',
  () => {
    const original = {
      document: globalThis.document,
      location: globalThis.location,
      history: globalThis.history,
      localStorage: globalThis.localStorage,
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
      globalThis.localStorage = storage;
      globalThis.location = {pathname: '/', search: ''};
      globalThis.history = {
        /**
         * Updates the replace state state for its caller.
         */
        replaceState() {},
        /**
         * Updates the push state state for its caller.
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
        querySelector: selector => selector === '.collection-table-columns' ?
          currentPicker : null,
        /**
         * Derives the query selector all result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
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
            open: /class="collection-table-columns" open/.test(markup),
            isConnected: true,
            /**
             * Updates the add event listener state for its caller.
             *
             * @param {*} event Event that triggered this operation.
             * @param {*} fn Function called during this operation.
             */
            addEventListener: (event, fn) => {
              if (event ===
                'toggle') currentPicker.onToggle = fn;
            },
          };
        },
      });
      view();
      assert.match(extractHeader(html), /data-column="rating"/);
      assert.doesNotMatch(extractHeader(html), /data-column="editing"/);
      const rating = {dataset: {collectionColumn: 'rating'}, checked: false};
      view.handleChange(rating);
      assert.doesNotMatch(extractHeader(html), /data-column="rating"/);
      const editing = {dataset: {collectionColumn: 'editing'}, checked: true};
      view.handleChange(editing);
      assert.match(extractHeader(html), /data-column="editing"/);
      assert.match(html, /class="collection-table-columns" open/);
      assert.deepEqual(
        loadTableColumns(storage).bottlings.includes('editing'),
        true
      );
      // Closing the native <details> summary must persist across renders;
      // previously the next table update reopened it unexpectedly.
      currentPicker.open = false;
      currentPicker.onToggle();
      view();
      assert.doesNotMatch(html, /class="collection-table-columns" open/,
        'the manually closed column picker remains closed on a subsequent render');
      view.handleClick({dataset: {act: 'collection-sort-column', column: 'age'}});
      assert.doesNotMatch(html, /class="collection-table-columns" open/,
        'sorting a header closes the picker after editing columns');
      assert.equal(state.sort, 'age');
      assert.match(html, /<option value="age" selected>/);
      assert.match(
        extractHeader(html),
        /aria-sort="descending"[^>]*>\s*<button[^>]*data-column="age"/
      );
      view.handleClick({dataset: {act: 'collection-sort-column', column: 'age'}});
      assert.equal(state.sort, 'ageAsc');
      assert.match(html, /<option value="ageAsc" selected>/);
      state.overviewMode = 'bottles';
      view();
      assert.match(extractHeader(html), /data-column="inventory"/);
      assert.match(extractHeader(html), /data-column="rating"/);
      view.handleClick({dataset: {act: 'collection-sort-column', column: 'inventory'}});
      assert.equal(state.sort, 'inventoryAsc');
      assert.match(html, /<option value="inventoryAsc" selected>/);
      view.handleClick({dataset: {act: 'collection-sort-column', column: 'inventory'}});
      assert.equal(state.sort, 'inventoryDesc');
      view.handleClick({dataset: {act: 'collection-columns-default'}});
      assert.deepEqual(
        loadTableColumns(storage).bottles,
        DEFAULT_TABLE_COLUMNS.bottles
      );
    } finally {
      for (const [name, value] of Object.entries(original)) if (value ===
        undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
);
