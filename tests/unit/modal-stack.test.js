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


test('flight planner help opens as a child dialog and closing restores its live form, preview and heading action', () => {
    const host = fakeModalHost();
    // The real modal renderer uses the overlay as a DOM element. For this test
    // only the overlay lookup is needed; planner option lookup can return null.
    host.querySelector = selector => selector === '.overlay' ? host.firstElementChild : null;
    const previous = globalThis.document;
    globalThis.document = { querySelector: () => host };
    try {
        const state = { modal: null };
        const modal = createModal({ state, onClose() {} });
        const plannerHelpButton = '<button type="button" data-act="flight-plan-help">?</button>';
        modal.showModal('Flight planen', '<form id="flight-plan"></form>', true, false, plannerHelpButton);
        const planner = host.firstElementChild;
        planner.form.name = 'Not yet saved flight';
        planner.form.files = ['draft-proposal'];
        assert.match(planner.html, /dialog-title-with-action/);
        assert.match(planner.html, /data-act="flight-plan-help"/);
        modal.showModal('So wird ein Flight geplant', '<section>Formeln</section>', true, true);
        assert.equal(state.modal.title, 'So wird ein Flight geplant');
        assert.notEqual(host.firstElementChild, planner);
        modal.closeModal();
        assert.equal(state.modal.title, 'Flight planen');
        assert.equal(state.modal.headingAction, plannerHelpButton);
        assert.equal(host.firstElementChild, planner, 'the exact original DOM must return');
        assert.equal(planner.form.name, 'Not yet saved flight');
        assert.deepEqual(planner.form.files, ['draft-proposal']);
    } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});

test('tasting view returns from flight planning help to the original unsaved planner dialog', async () => {
    const { createTastingsView } = await import('../../public/js/views/tastings.js');
    const host = fakeModalHost();
    host.querySelector = selector => selector === '.overlay' ? host.firstElementChild : null;
    const previous = globalThis.document;
    globalThis.document = { querySelector: () => host };
    try {
        const state = { modal: null, collection: { bottlings: [], tastingFlights: [] }, flightCandidateIds: null };
        const modal = createModal({ state, onClose() {} });
        const view = createTastingsView({
            state, selectors: {}, shell() {}, navigate() {}, refresh() {},
            showModal: modal.showModal, closeModal: modal.closeModal
        });
        view.startPlannedFlight();
        const planner = host.firstElementChild;
        assert.equal(state.modal.title, 'Flight planen');
        assert.match(planner.html, /data-act="flight-plan-help"/);
        planner.form.name = 'Kept draft';
        planner.form.files = ['kept-proposal'];
        view.showFlightPlanningHelp();
        assert.equal(state.modal.title, 'So wird ein Flight geplant');
        modal.closeModal();
        assert.equal(state.modal.title, 'Flight planen');
        assert.equal(host.firstElementChild, planner);
        assert.equal(planner.form.name, 'Kept draft');
        assert.deepEqual(planner.form.files, ['kept-proposal']);
    } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
