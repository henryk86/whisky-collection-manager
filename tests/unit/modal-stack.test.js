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

test('in-app confirmation restores the original edit form after acceptance, never using browser confirm', async () => {
    const host = fakeModalHost();
    const oldDocument = globalThis.document;
    globalThis.document = {querySelector: () => host};
    try {
        const state = {modal:null};
        const modal = createModal({state,onClose(){}});
        modal.showModal('Assign bottles', '<form id="warehouse-form"></form>');
        const original = host.firstElementChild;
        original.form.name = 'Selected destination';
        const answer = modal.confirm('Increase capacity', 'Increase from 3 to 5?', 'Increase and assign');
        assert.equal(state.modal.title,'Increase capacity');
        assert.match(host.firstElementChild.html,/data-act="modal-confirm-accept"/);
        assert.match(host.firstElementChild.html,/data-act="close-modal"/);
        assert.equal(modal.acceptConfirmation(),true);
        assert.equal(await answer,true);
        assert.equal(host.firstElementChild,original);
        assert.equal(original.form.name,'Selected destination');
        modal.closeModal();
    } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document=oldDocument; }
});

test('closing a capacity confirmation via cancel or page navigation returns false', async () => {
    const host = fakeModalHost();
    const oldDocument = globalThis.document;
    globalThis.document = {querySelector:()=>host};
    try {
        const state={modal:null};
        const modal=createModal({state,onClose(){}});
        modal.showModal('Assignment','<form id="warehouse-form"></form>');
        const answer=modal.confirm('Full','More places?','Increase');
        modal.closeModal();
        assert.equal(await answer,false);
        assert.equal(state.modal.title,'Assignment');
        const second=modal.confirm('Full','More places?','Increase');
        modal.closeModal(true);
        assert.equal(await second,false);
        assert.equal(state.modal,null);
    } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document=oldDocument; }
});

test('every modal opened from another modal automatically returns one level at a time', () => {
    const host = fakeModalHost();
    const previous = globalThis.document;
    globalThis.document = {querySelector:() => host};
    try {
        const state={modal:null};
        const modal=createModal({state,onClose(){}});
        modal.showModal('Furniture','<div id="furniture-manager"></div>',true);
        const furniture=host.firstElementChild;
        furniture.form.name='Furniture not saved';
        modal.showModal('Shelf','<div id="shelf-manager"></div>',true);
        const shelf=host.firstElementChild;
        shelf.form.name='Edited shelf';
        modal.showModal('Bottle','<div id="bottle-preview"></div>');
        assert.equal(state.modal.title,'Bottle');
        modal.closeModal();
        assert.equal(state.modal.title,'Shelf');
        assert.equal(host.firstElementChild,shelf);
        assert.equal(shelf.form.name,'Edited shelf');
        modal.closeModal();
        assert.equal(state.modal.title,'Furniture');
        assert.equal(host.firstElementChild,furniture);
        assert.equal(furniture.form.name,'Furniture not saved');
        modal.closeModal();
        assert.equal(state.modal,null);
    } finally {if(previous===undefined) delete globalThis.document; else globalThis.document=previous;}
});

test('explicit replacement can discard older modal history', () => {
    const host=fakeModalHost();
    const previous=globalThis.document;
    globalThis.document={querySelector:()=>host};
    try {
        const state={modal:null};
        const modal=createModal({state,onClose(){}});
        modal.showModal('Furniture','<div></div>');
        modal.showModal('Shelf','<div></div>');
        modal.showModal('Standalone','<div></div>',false,false);
        modal.closeModal();
        assert.equal(state.modal,null);
    } finally {if(previous===undefined) delete globalThis.document; else globalThis.document=previous;}
});
