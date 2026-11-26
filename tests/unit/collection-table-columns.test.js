import test from 'node:test';
import assert from 'node:assert/strict';
import {TABLE_COLUMNS, DEFAULT_TABLE_COLUMNS, TABLE_COLUMNS_STORAGE_KEY, loadTableColumns, saveTableColumns, normalizeTableColumns, sortForColumn} from '../../public/js/domain/collection-table-columns.js';
import {collectionOverviewEntries} from '../../public/js/domain/collection-overview.js';

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
      saveTableColumns({bottlings: ['rating', 'editing', 'nonsense'], bottles: ['inventory']}, storage),
      true
    );
    assert.deepEqual(loadTableColumns(storage), {bottlings: ['editing', 'rating'], bottles: ['inventory']});
    storage.setItem(TABLE_COLUMNS_STORAGE_KEY, '{broken');
    assert.deepEqual(loadTableColumns(storage).bottlings, DEFAULT_TABLE_COLUMNS.bottlings);
    assert.deepEqual(normalizeTableColumns('bottlings', []), DEFAULT_TABLE_COLUMNS.bottlings);
  }
);

test(
  'every available column has two sort directions and toggles deterministically',
  () => {
    for (const mode of ['bottles', 'bottlings']) for (
      const column of TABLE_COLUMNS[mode]) {
      assert.ok(column.asc && column.desc && column.asc !== column.desc, `${mode}/${column.id}`);
      const first = sortForColumn(column, 'name');
      assert.ok([column.asc, column.desc].includes(first));
      assert.equal(sortForColumn(column, first), first === column.asc ? column.desc : column.asc);
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
    const entries = (mode, sort) => collectionOverviewEntries(collection, {mode, sort});
    assert.deepEqual(entries('bottles', 'inventoryAsc').map(e => e.bottle.id), ['a2', 'b1', 'a1']);
    assert.deepEqual(entries('bottles', 'inventoryDesc').map(e => e.bottle.id), ['a1', 'b1', 'a2']);
    assert.deepEqual(entries('bottles', 'volumeMlAsc').map(e => e.bottle.id), ['a2', 'b1', 'a1']);
    assert.deepEqual(entries('bottles', 'statusAsc').map(e => e.bottle.id), ['a1', 'a2', 'b1']);
    assert.deepEqual(entries('bottlings', 'abvDesc').map(e => e.bottling.id), ['b', 'a']);
    assert.deepEqual(entries('bottlings', 'ageAsc').map(e => e.bottling.id), ['a', 'b']);
    assert.deepEqual(entries('bottlings', 'yearAsc').map(e => e.bottling.id), ['b', 'a']);
    assert.deepEqual(entries('bottlings', 'stockAsc').map(e => e.bottling.id), ['b', 'a']);
    assert.deepEqual(entries('bottlings', 'completionAsc').map(e => e.bottling.id), ['a', 'b']);
    assert.deepEqual(entries('bottlings', 'scoreDesc').map(e => e.bottling.id), ['b', 'a']);
  }
);
