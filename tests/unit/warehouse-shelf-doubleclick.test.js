import test from 'node:test';
import assert from 'node:assert/strict';
import { bindEvents } from '../../public/js/events.js';

function delegatedEvents() {
    const listeners = new Map();
    const calls = {opened:[],selected:[],bottlePreviews:[]};
    const root = {addEventListener:(name, fn) => listeners.set(name, fn), querySelectorAll:() => []};
    const previousDocument = globalThis.document;
    globalThis.document = {addEventListener:()=>{}};
    try {
        bindEvents(root, {
            state:{}, render:()=>{}, action:()=>{}, navigate:()=>{}, editors:{}, settings:{}, backup:{},
            scanner:{}, externalImport:{}, modal:{}, photoViewer:{}, photoEditor:{}, theme:{},
            resolveCode:()=>{}, warehouseView:{
                openShelfDetails:id => calls.opened.push(id),
                openBottlePreview:id => calls.bottlePreviews.push(id),
                toggleWallBottleSelection:id => calls.selected.push(id),
            },
        });
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }
    const bay = {
        dataset:{act:'warehouse-shelf-view', shelfId:'rack-2-shelf-3'},
        tagName:'DIV', disabled:false,
        classList:{contains:name => name === 'warehouse-wall-bay'},
        closest(selector) {
            if (selector === '[data-act]') return this;
            if (selector.includes('.warehouse-wall-bay')) return this;
            return null;
        },
    };
    const bottle = {
        dataset:{act:'warehouse-bottle-select', id:'bottle-1'},
        tagName:'BUTTON', disabled:false,
        closest(selector) {
            if (selector === '[data-act]' || selector === 'button, a, input, select, textarea' || selector.startsWith('.warehouse-room-wall .warehouse-bottle-symbol')) return this;
            if (selector.includes('.warehouse-wall-bay')) return bay;
            return null;
        },
    };
    const managerShelf = {
        dataset:{shelfId:'rack-1-shelf-7'}, tagName:'DIV',
        closest(selector) {
            if (selector.includes('.warehouse-furniture-manager')) return this;
            return null;
        },
    };
    const managerBottle = {
        dataset:{act:'warehouse-bottle-preview',id:'bottle-2'},
        tagName:'BUTTON', disabled:false,
        closest(selector) {
            if (selector === '[data-act]' || selector === 'button, a, input, select, textarea') return this;
            if (selector.includes('.warehouse-furniture-manager')) return managerShelf;
            return null;
        },
    };
    return {listeners,calls,bay,bottle,managerShelf,managerBottle};
}

test('clicking a compartment never opens the modal; double-click opens it exactly once', async () => {
    const {listeners,calls,bay} = delegatedEvents();
    await listeners.get('click')({target:bay});
    await listeners.get('click')({target:bay});
    assert.deepEqual(calls.opened,[]);
    listeners.get('dblclick')({target:bay});
    assert.deepEqual(calls.opened,['rack-2-shelf-3']);
});

test('double-click on a rack bottle opens its own preview, not the compartment', async () => {
    const {listeners,calls,bottle} = delegatedEvents();
    await listeners.get('click')({target:bottle});
    listeners.get('dblclick')({target:bottle});
    assert.deepEqual(calls.selected,['bottle-1']);
    assert.deepEqual(calls.bottlePreviews,['bottle-1']);
    assert.deepEqual(calls.opened,[]);
});

test('furniture modal opens a bottle preview on click and a shelf overview on compartment double-click', async () => {
    const {listeners,calls,managerShelf,managerBottle} = delegatedEvents();
    await listeners.get('click')({target:managerBottle});
    assert.deepEqual(calls.bottlePreviews,['bottle-2']);
    assert.deepEqual(calls.opened,[]);
    listeners.get('dblclick')({target:managerBottle});
    assert.deepEqual(calls.opened,[]);
    listeners.get('dblclick')({target:managerShelf});
    assert.deepEqual(calls.opened,['rack-1-shelf-7']);
});

test('keyboard Enter and Space still open a focused compartment', () => {
    const {listeners,calls,bay} = delegatedEvents();
    for (const key of ['Enter',' ']) {
        let prevented = false;
        listeners.get('keydown')({key,target:bay,preventDefault:()=>{prevented=true;}});
        assert.equal(prevented,true);
    }
    assert.deepEqual(calls.opened,['rack-2-shelf-3','rack-2-shelf-3']);
});

test('zero-capacity shelf ignores double-click and keyboard despite inherited shelf styling', () => {
    const {listeners,calls,bay,managerShelf}=delegatedEvents();
    bay.dataset.capacity='0';
    managerShelf.dataset.capacity='0';
    listeners.get('dblclick')({target:bay});
    listeners.get('dblclick')({target:managerShelf});
    assert.deepEqual(calls.opened,[]);
    // Non-assignable wall shelves lack the action attribute and are not focusable.
    const blocked={...bay,dataset:{shelfId:'blocked',capacity:'0'},classList:{contains:()=>false}};
    listeners.get('keydown')({key:'Enter',target:blocked,preventDefault:()=>{throw new Error('must not focus');}});
    assert.deepEqual(calls.opened,[]);
});
