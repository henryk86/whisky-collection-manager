import test from 'node:test';
import assert from 'node:assert/strict';
import {getBrowserStorage} from '../../public/js/browser-storage.js';
import {getThemePreference} from '../../public/js/theme/preference.js';
import {getPageSizePreference, savePageSizePreference} from '../../public/js/domain/page-size-preference.js';
import {getCollectionViewPreference, saveCollectionViewPreference} from '../../public/js/domain/collection-view-preference.js';
import {DEFAULT_TABLE_COLUMNS, loadTableColumns, saveTableColumns} from '../../public/js/domain/collection-table-columns.js';
import {chooseLanguage, initializeLanguage} from '../../public/js/i18n/index.js';

// Preserve property descriptors rather than evaluating Node's Web Storage getter.
function replaceGlobal(t, name, descriptor) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {...descriptor, configurable: true});
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else delete globalThis[name];
  });
}

test('browser preferences never access Node Web Storage, even if it is exposed', async t => {
  let accesses = 0;
  replaceGlobal(t, 'window', {value: undefined});
  replaceGlobal(t, 'localStorage', {get() {accesses++; throw Error('Node storage must not be used');}});
  assert.equal(getBrowserStorage(), undefined);
  assert.equal(getThemePreference(), 'system');
  assert.equal(getPageSizePreference(), 24);
  assert.equal(savePageSizePreference(48), false);
  assert.equal(getCollectionViewPreference(), 'cards');
  assert.equal(saveCollectionViewPreference('table'), false);
  assert.deepEqual(loadTableColumns(), DEFAULT_TABLE_COLUMNS);
  assert.equal(saveTableColumns(DEFAULT_TABLE_COLUMNS), false);
  assert.equal(await initializeLanguage(async () => ({ok: false})), 'de');
  assert.equal(chooseLanguage('de'), true);
  assert.equal(accesses, 0);
});

test('browser storage denial is handled without accessing the Node storage getter', t => {
  let accesses = 0;
  replaceGlobal(t, 'localStorage', {get() {accesses++; throw Error('Node storage must not be used');}});
  replaceGlobal(t, 'window', {value: {get localStorage() {throw Error('Browser storage denied');}}});
  assert.equal(getBrowserStorage(), undefined);
  assert.equal(getThemePreference(), 'system');
  assert.equal(getCollectionViewPreference(), 'cards');
  assert.equal(savePageSizePreference(48), false);
  assert.equal(accesses, 0);
});

test('browser preferences use the current window storage and preserve explicit storage adapters', t => {
  const items = new Map([['whisky-theme', 'dark']]);
  const storage = {getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value)};
  replaceGlobal(t, 'window', {value: {localStorage: storage}});
  assert.equal(getBrowserStorage(), storage);
  assert.equal(getThemePreference(), 'dark');
  assert.equal(savePageSizePreference(48), true);
  assert.equal(getPageSizePreference(), 48);
  assert.equal(saveCollectionViewPreference('table'), true);
  assert.equal(getCollectionViewPreference(), 'table');
  assert.equal(saveTableColumns({bottlings: ['rating'], bottles: ['inventory']}), true);
  assert.deepEqual(loadTableColumns(), {bottlings: ['rating'], bottles: ['inventory']});
  assert.equal(getPageSizePreference(null), 24);
  assert.equal(getCollectionViewPreference(null), 'cards');
});
