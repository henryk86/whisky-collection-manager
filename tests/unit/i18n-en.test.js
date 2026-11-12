import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTranslator, initializeLanguage, currentLanguage, t } from '../../public/js/i18n/index.js';

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../../public/locales/${file}`, import.meta.url), 'utf8'));
const german = read('de.json');
const english = read('en.json');
const registry = read('index.json');

const parameters = (message) => [
    ...[...message.matchAll(/\{([a-zA-Z]\w*)\}/gu)].map(([, name]) => name),
    ...[...message.matchAll(/\{([a-zA-Z]\w*),\s*plural,/gu)].map(([, name]) => name)
].sort();

test('English locale is selectable and contains precisely the same keys and parameters as German', () => {
    assert.equal(registry.en, 'English');
    assert.deepEqual(Object.keys(english).sort(), Object.keys(german).sort());
    assert.ok(Object.keys(english).length >= 790, 'full locale catalog must not shrink');
    for (const [key, original] of Object.entries(german)) {
        assert.equal(typeof english[key], 'string', `missing English text: ${key}`);
        assert.ok(english[key].trim().length > 0, `empty English text: ${key}`);
        assert.deepEqual(parameters(english[key]), parameters(original), `parameter mismatch: ${key}`);
    }
});

test('English translates storage labels, dynamic placeholders, plurals and leaves user names intact', () => {
    const t = createTranslator(english, german, 'en');
    assert.equal(t('warehouse.page.title'), 'Storage management');
    assert.equal(t('common.actions.save'), 'Save');
    assert.equal(t('warehouse.occupancy.count', { count: 1 }), 'Occupied: 1 bottle');
    assert.equal(t('warehouse.occupancy.count', { count: 8 }), 'Occupied: 8 bottles');
    assert.equal(t('warehouse.furniture.placedCount', { count: 1 }), '1 furniture item');
    assert.equal(t('warehouse.furniture.placedCount', { count: 3 }), '3 furniture items');
    assert.equal(t('warehouse.shelves.showForFurniture', { name: 'Whiskyzimmer' }), 'Show compartments of Whiskyzimmer');
    assert.equal(t('warehouse.selection.count', {selected: 2, total: 5}), '2 of 5 selected');
});


test('English language selection loads the registered English JSON catalog', async () => {
    const previousLocation = globalThis.location;
    globalThis.location = { search: '?lang=en' };
    try {
        const load = async (url) => {
            const file = url === '/locales/index.json' ? 'index.json' : url === '/locales/en.json' ? 'en.json' : null;
            if (!file) return { ok: false };
            return { ok: true, json: async () => read(file) };
        };
        assert.equal(await initializeLanguage(load), 'en');
        assert.equal(currentLanguage(), 'en');
        assert.equal(t('warehouse.page.title'), 'Storage management');
    } finally {
        if (previousLocation === undefined) delete globalThis.location;
        else globalThis.location = previousLocation;
    }
});
