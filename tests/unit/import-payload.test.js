import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImportPayload } from '../../public/js/features/import/payload.js';
import { validateExtensionPayload } from '../../public/js/features/whiskybase/payload.js';

test('a provider-neutral payload retains allowed fields and strips unknown data', () => {
    const normalized = normalizeImportPayload({
        source: 'external', version: 2,
        fields: { name: 'Example release', abv: 46, caskNumber: 'A12', injected: '<script>' },
        distilleryName: 'A, B', imageToken: null,
    }, { referenceId: 'CAT-17' });
    assert.equal(normalized.referenceId, 'CAT-17');
    assert.equal(normalized.fields.name, 'Example release');
    assert.equal(normalized.fields.abv, 46);
    assert.equal(Object.hasOwn(normalized.fields, 'injected'), false);
    assert.equal(normalized.imageToken, null);
});

test('source-specific metadata is accepted only when its adapter allows it', () => {
    const raw = { source: 'external', version: 2,
        fields: { name: 'Example', whiskybaseId: '15', whiskybaseUrl: 'https://whiskybase.com/whiskies/whisky/15/example' },
    };
    assert.equal(Object.hasOwn(normalizeImportPayload(raw, { referenceId: 'EX-15' }).fields, 'whiskybaseId'), false);
    assert.equal(validateExtensionPayload(raw).fields.whiskybaseId, '15');
    assert.equal(validateExtensionPayload(raw).fields.whiskybaseUrl, raw.fields.whiskybaseUrl);
    assert.throws(() => validateExtensionPayload({ ...raw, fields: { ...raw.fields, whiskybaseUrl: 'https://evil.invalid/' } }));
});

test('generic payload rejects missing names, unsafe image tokens and malformed schemas', () => {
    const raw = { version: 2, source: 'external', fields: { name: 'Example' } };
    assert.throws(() => normalizeImportPayload({ ...raw, imageToken: '../../../bad' }, { referenceId: 'EXT-1' }), /Bild-Token/);
    assert.throws(() => normalizeImportPayload({ ...raw, fields: { name: '  ' } }, { referenceId: 'EXT-1' }), /Whiskyname/);
    assert.throws(() => normalizeImportPayload({ ...raw, fields: [] }, { referenceId: 'EXT-1' }), /Importdaten/);
    assert.throws(() => normalizeImportPayload(raw, { referenceId: '' }), /Importdaten/);
});
