import test from 'node:test';
import assert from 'node:assert/strict';
import { createExternalImport } from '../../public/js/features/import/controller.js';

/** A different source can feed the import UI without Whiskybase fields or selectors. */
test('generic import preview applies fields and matches distilleries without provider coupling', () => {
    const previous = { document: globalThis.document, setTimeout: globalThis.setTimeout };
    const state = { collection: { bottlings: [], distilleries: [{ id: 'local-d', name: 'Test Distillery' }] } };
    let panel = null;
    const choices = [
        { dataset: { importField: 'name' } },
        { dataset: { importField: 'abv' } },
    ];
    const form = {
        dataset: {},
        elements: { name: { value: '' }, abv: { value: '' } },
        querySelector(selector) { return selector === '.forms' ? { prepend(element) { panel = element; } } : selector === '#import-panel' ? panel : null; },
        querySelectorAll(selector) { return selector === 'input[name=distilleryIds]:checked' ? [] : selector === 'input[name=distilleryIds]' ? [{ value: 'local-d', checked: false }] : []; },
    };
    const calls = [];
    globalThis.document = {
        querySelector(selector) { return selector === '#bottling-form' ? form : selector === '#import-panel' ? panel : null; },
        createElement() { return { setAttribute() {}, remove() {}, querySelector() { return null; }, insertAdjacentHTML() {}, querySelectorAll(selector) {
            if (selector === '[data-import-field]:checked') return choices;
            if (selector === '[name=import-distillery]:checked') return [{ value: 'local-d' }];
            return [];
        } }; },
        body: { append(el) { calls.push(el.textContent); } },
    };
    globalThis.setTimeout = () => 0;
    try {
        const controller = createExternalImport({
            state, sourceName: 'Local Catalog',
            validatePayload: data => data,
            findExistingBottling: () => null,
        });
        controller.previewImport({
            referenceId: 'LC-12', distilleryName: 'Test Distillery', imageToken: null,
            fields: { name: 'Example', abv: 48 },
        });
        assert.equal(panel.id, 'import-panel');
        assert.match(panel.innerHTML, /data-import-field="name"/);
        assert.match(panel.innerHTML, /name="import-distillery" value="local-d"/);
        controller.applyImport();
        assert.equal(form.elements.name.value, 'Example');
        assert.equal(form.elements.abv.value, 48);
        assert.ok(calls.some(message => /Importdaten/.test(message)));
    } finally {
        if (previous.document === undefined) delete globalThis.document;
        else globalThis.document = previous.document;
        globalThis.setTimeout = previous.setTimeout;
    }
});

test('new physical bottle uses a source-independent photo opt-in only for pending imports', async () => {
    const { createEditors } = await import('../../public/js/features/editor-controller.js');
    const modals = [];
    const editor = createEditors({
        state: { selected: 'bottling-1', collection: { bottlings: [{ id: 'bottling-1', name: 'Test' }] } },
        selectors: { findBottle: () => null },
        bottleForm: () => '<form id="bottle-form"></form>',
        showModal: (title, html) => modals.push({ title, html }),
        getPendingImageToken: () => 'valid-pending-token',
    });
    editor.newBottle(true);
    assert.match(modals[0].html, /name="importReferencePhoto" checked/);
    assert.match(modals[0].html, /class="import-photo form-field full"/);
    editor.newBottle(false);
    assert.doesNotMatch(modals[1].html, /importReferencePhoto/);
});
