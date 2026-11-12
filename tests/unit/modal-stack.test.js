import test from 'node:test';
import assert from 'node:assert/strict';
import { createModal } from '../../public/js/ui/modal.js';

function fakeModalHost() {
    let overlay = null;
    return {
        get firstElementChild() { return overlay; },
        set innerHTML(text) {
            overlay = text ? { html: text, form: { name: '', files: [] }, addEventListener() {} } : null;
        },
        querySelector() { return overlay; },
        replaceChildren(element) { overlay = element; },
    };
}

test('a nested form dialog restores the exact parent DOM node and unsaved file inputs', () => {
    const host = fakeModalHost();
    const previous = globalThis.document;
    globalThis.document = { querySelector: () => host };
    try {
        const state = { modal: null };
        const modal = createModal({ state, onClose() {} });
        modal.showModal('Abfüllung', '<form id="bottling-form"></form>', true);
        const original = host.firstElementChild;
        original.form.name = 'Unsaved whisky';
        original.form.files = ['image.png'];
        modal.showModal('Neue Destillerie', '<form id="distillery-form"></form>', false, true);
        assert.notEqual(host.firstElementChild, original);
        assert.equal(state.modal.title, 'Neue Destillerie');
        modal.closeModal();
        assert.equal(host.firstElementChild, original);
        assert.equal(host.firstElementChild.form.name, 'Unsaved whisky');
        assert.deepEqual(host.firstElementChild.form.files, ['image.png']);
        assert.equal(state.modal.title, 'Abfüllung');
        modal.closeModal();
        assert.equal(state.modal, null);
    } finally { globalThis.document = previous; }
});

test('closing all dialogs discards nested parents during navigation', () => {
    const host = fakeModalHost();
    const previous = globalThis.document;
    globalThis.document = { querySelector: () => host };
    try {
        const state = { modal: null };
        const modal = createModal({ state, onClose() {} });
        modal.showModal('Parent', '<p>Parent</p>');
        modal.showModal('Child', '<p>Child</p>', false, true);
        modal.closeModal(true);
        assert.equal(state.modal, null);
        assert.equal(host.firstElementChild, null);
        modal.showModal('Other', '<p>Other</p>');
        modal.closeModal();
        assert.equal(state.modal, null);
    } finally { globalThis.document = previous; }
});
