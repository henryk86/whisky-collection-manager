import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingBottlings, bottlingChoiceDialog, bottlingChoiceOptions } from '../../public/js/features/forms/bottling-choice.js';
import { createEditors } from '../../public/js/features/editor-controller.js';

const collection = {
    distilleries: [{ id: 'dist-a', name: 'Lagavulin' }],
    bottlings: [
        { id: 'whisky-a', name: 'Islay Malt 16', bottler: 'Bottler One', distilleryIds: ['dist-a'], bottles: [{id:'bottle-1'}] },
        { id: 'whisky-b', name: 'Highland Malt', bottler: 'Other Bottler', bottles: [] },
    ]
};

test('chooser searches existing bottlings by name, distillery and bottler without mutating them', () => {
    assert.deepEqual(matchingBottlings(collection, 'islay').map(entry => entry.id), ['whisky-a']);
    assert.deepEqual(matchingBottlings(collection, 'lagavulin').map(entry => entry.id), ['whisky-a']);
    assert.deepEqual(matchingBottlings(collection, 'OTHER bottler').map(entry => entry.id), ['whisky-b']);
    assert.equal(matchingBottlings(collection, 'absent').length, 0);
    const html = bottlingChoiceDialog(collection);
    assert.match(html, /id="new-bottle-choice-form"/);
    assert.match(html, /data-act="new-bottling-direct"/);
    assert.match(html, /name="bottlingId" required/);
    assert.match(html, /option value=""/); // no implicit parent selection
    assert.match(html, /value="whisky-a"/);
    assert.doesNotMatch(bottlingChoiceOptions(collection, 'unmatched'), /value="whisky-a"/);
    assert.equal(collection.bottlings.length, 2);
    assert.equal(collection.bottlings[0].bottles.length, 1);
});

test('chooser escapes untrusted whisky names and identifiers', () => {
    const malicious = { bottlings: [{id:'x" onclick="oops',name:'<img src=x onerror=alert(1)>',bottles:[]}] };
    const html = bottlingChoiceDialog(malicious);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<img src=x/);
    assert.doesNotMatch(html, /value="x" onclick=/);
});

test('global action chooses reuse or new bottling; detail action still adds to selected bottling', () => {
    const state = { collection, selected: 'whisky-a' };
    const calls = [];
    const editors = createEditors({
        state,
        selectors: { findBottle: () => null },
        bottlingForm: () => '<form id="bottling-form"></form>',
        bottleForm: (_, id) => `<form id="bottle-form" data-bottling-id="${id}"></form>`,
        showModal: (title, body) => calls.push({title, body}),
        closeModal() {}, navigate() {}, action() {}, refresh() {}
    });
    editors.newBottling();
    assert.match(calls.at(-1).body, /new-bottle-choice-form/);
    editors.chooseExistingBottling('whisky-a');
    assert.match(calls.at(-1).body, /data-from-overview="1"/);
    assert.match(calls.at(-1).body, /data-bottling-id="whisky-a"/);
    assert.throws(() => editors.chooseExistingBottling('missing'), /vorhandene Abfüllung/);
    editors.createBottling();
    assert.match(calls.at(-1).body, /id="bottling-form"/);
    editors.newBottle();
    assert.match(calls.at(-1).body, /data-bottling-id="whisky-a"/);
    assert.doesNotMatch(calls.at(-1).body, /data-from-overview/);
    state.collection = {bottlings: [],distilleries:[]};
    editors.newBottling();
    assert.match(calls.at(-1).body, /id="bottling-form"/);
});
