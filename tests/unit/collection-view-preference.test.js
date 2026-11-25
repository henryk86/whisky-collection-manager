import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../../public/js/state.js';
import {
  COLLECTION_VIEW_STORAGE_KEY, getCollectionViewPreference,
  saveCollectionViewPreference,
} from '../../public/js/domain/collection-view-preference.js';

/**
 * Builds a lookup map for the fake storage data.
 *
 * @param {!Object=} initial Value used by this operation.
 * @return {!Object} Structured result assembled from the input data.
 */
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    /**
     * Retrieves item from the available state.
     *
     * @param {*} key Key used to select or group values.
     * @return {*} Result computed from the supplied inputs.
     */
    getItem: key => data.has(key) ? data.get(key) : null,
    /**
     * Updates item in the current state.
     *
     * @param {*} key Key used to select or group values.
     * @param {*} value Value to process.
     * @return {!Map<*, *>} Result computed from the supplied inputs.
     */
    setItem: (key, value) => data.set(key, value),
  };
}

test(
  'collection display preference saves cards and table independently of collection data',
  () => {
    const storage = fakeStorage();
    assert.equal(getCollectionViewPreference(storage), 'cards');
    assert.equal(saveCollectionViewPreference('table', storage), true);
    assert.equal(storage.getItem(COLLECTION_VIEW_STORAGE_KEY), 'table');
    assert.equal(getCollectionViewPreference(storage), 'table');
    assert.equal(saveCollectionViewPreference('cards', storage), true);
    assert.equal(getCollectionViewPreference(storage), 'cards');
  }
);

test(
  'invalid display preferences fall back to cards and cannot overwrite stored values',
  () => {
    const storage = fakeStorage({[COLLECTION_VIEW_STORAGE_KEY]: 'table'});
    assert.equal(saveCollectionViewPreference('grid', storage), false);
    assert.equal(storage.getItem(COLLECTION_VIEW_STORAGE_KEY), 'table');
    for (const value of ['', 'tables', 'TABLE', 'grid', 'undefined']) {
      assert.equal(getCollectionViewPreference(fakeStorage({[COLLECTION_VIEW_STORAGE_KEY]: value, })), 'cards');
    }
  }
);

test('unavailable browser storage leaves collection display usable', () => {
  const storage = {
    /**
     * Retrieves item from the available state.
     */
    getItem() {throw new Error('Storage disabled');},
    /**
     * Updates item in the current state.
     */
    setItem() {throw new Error('Storage disabled');},
  };
  assert.equal(getCollectionViewPreference(storage), 'cards');
  assert.equal(saveCollectionViewPreference('table', storage), false);
});

test(
  'a new application state restores the last selected collection display',
  () => {
    const existing = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const storage = fakeStorage();
    const route = {page: 'home', selected: null};
    try {
      Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: storage});
      assert.equal(createState(route).view, 'cards');
      assert.equal(saveCollectionViewPreference('table'), true);
      assert.equal(createState(route).view, 'table');
      assert.equal(saveCollectionViewPreference('cards'), true);
      assert.equal(createState(route).view, 'cards');
    } finally {
      if (existing) Object.defineProperty(globalThis, 'localStorage', existing);
      else delete globalThis.localStorage;
    }
  }
);
