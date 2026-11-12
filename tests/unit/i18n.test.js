import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTranslator, availableLanguages, chooseLanguage, t } from '../../public/js/i18n/index.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../../public/locales/de.json', import.meta.url), 'utf8'));
const registry = JSON.parse(fs.readFileSync(new URL('../../public/locales/index.json', import.meta.url), 'utf8'));

test('German catalog consists of stable named keys instead of German source sentences', () => {
    assert.equal(registry.de, 'Deutsch');
    assert.ok(Object.keys(catalog).length >= 650);
    assert.equal(catalog['warehouse.page.intro'], 'Räume, Möbel und Fächer – jede Flasche hat ihren eigenen Platz.');
    assert.equal(catalog['common.actions.save'], 'Speichern');
    assert.equal(catalog['warehouse.page.title'], 'Lagerverwaltung');
    assert.equal(catalog['common.actions.close'], 'Schließen');
    assert.equal(catalog['collection.actions.scanInventory'], 'Inventar scannen');
    assert.ok(Object.keys(catalog).every(key => /^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+$/u.test(key)));
    assert.ok(Object.values(catalog).every(value => typeof value === 'string'));
    assert.equal(catalog['analytics.quality.title'], 'Datenqualität');
    assert.equal(catalog['warehouse.furniture.types.cabinet'], 'Schrank');
    assert.equal(catalog['warehouse.front.glassDoor'], 'Glastür');
    assert.equal(catalog['backups.restore.confirmReplaceCollection']?.length > 0, true);
    assert.ok(!Object.values(catalog).some(value => value === 'pushState' || value === 'replaceState'),
        'technical history methods must never be translation values');
    assert.ok(!Object.keys(catalog).some(key => /[äöüß]|[a-z]\.[a-z]\.[a-z]\.|\.2564a$/iu.test(key)),
        'translation keys must be stable English names, not transliterations or generated hashes');
});

test('translator replaces named placeholders, ICU plurals and falls back to German by key', () => {
    const german = {
        'common.actions.save': 'Speichern',
        'warehouse.count': '{count} Flaschen',
        'warehouse.units': '{count, plural, one {# Flasche} other {# Flaschen}}',
        'warehouse.page.intro': 'Räume, Möbel und Fächer.'
    };
    const translate = createTranslator({
        'common.actions.save': 'Save',
        'warehouse.count': '{count} bottles',
        'warehouse.units': '{count, plural, one {# bottle} other {# bottles}}'
    }, german, 'en');
    assert.equal(translate('common.actions.save'), 'Save');
    assert.equal(translate('warehouse.count', {count: 2}), '2 bottles');
    assert.equal(translate('warehouse.units', {count: 1}), '1 bottle');
    assert.equal(translate('warehouse.units', {count: 3}), '3 bottles');
    assert.equal(translate('warehouse.page.intro'), 'Räume, Möbel und Fächer.');
    assert.equal(translate('My Scottish bottle'), 'My Scottish bottle');
    assert.equal(translate('<h2>Speichern</h2>'), '<h2>Speichern</h2>');
    assert.equal(t('common.actions.save'), 'Speichern');
});

test('invalid or unsupported language choices never redirect or change saved preference', () => {
    assert.equal(availableLanguages().de, 'Deutsch');
    assert.equal(chooseLanguage('../en'), false);
    assert.equal(chooseLanguage('zz'), false);
});
