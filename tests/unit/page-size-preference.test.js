import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../../public/js/state.js';
import {
    PAGE_SIZE_STORAGE_KEY, getPageSizePreference, savePageSizePreference,
} from '../../public/js/domain/page-size-preference.js';

function fakeStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: key => data.has(key) ? data.get(key) : null,
        setItem: (key, value) => data.set(key, value),
    };
}

test('all selectable page sizes are persisted and restored', () => {
    const storage = fakeStorage();
    for (const size of [12, 24, 48, 96]) {
        assert.equal(savePageSizePreference(size, storage), true);
        assert.equal(storage.getItem(PAGE_SIZE_STORAGE_KEY), String(size));
        assert.equal(getPageSizePreference(storage), size);
    }
});

test('missing, unsupported and malformed stored values revert to 24', () => {
    for (const value of [null, '', '0', '13', '240', '-1', '1e2', '024', 'Infinity', 'invalid']) {
        const storage = fakeStorage(value === null ? {} : { [PAGE_SIZE_STORAGE_KEY]: value });
        assert.equal(getPageSizePreference(storage), 24);
    }
    const storage = fakeStorage({ [PAGE_SIZE_STORAGE_KEY]: '48' });
    assert.equal(savePageSizePreference(13, storage), false);
    assert.equal(storage.getItem(PAGE_SIZE_STORAGE_KEY), '48');
});

test('browser storage failures leave the UI usable with its default size', () => {
    const storage = {
        getItem() { throw new Error('Storage denied'); },
        setItem() { throw new Error('Storage denied'); },
    };
    assert.equal(getPageSizePreference(storage), 24);
    assert.equal(savePageSizePreference(48, storage), false);
});

test('initial UI state restores the browser preference across new app instances', () => {
    const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const storage = fakeStorage({ [PAGE_SIZE_STORAGE_KEY]: '96' });
    try {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
        const route = { page: 'home', selected: null };
        assert.equal(createState(route).pageSize, 96);
        savePageSizePreference(12);
        assert.equal(createState(route).pageSize, 12);
    } finally {
        if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
        else delete globalThis.localStorage;
    }
});
