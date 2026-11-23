import test from 'node:test';
import assert from 'node:assert/strict';
import {bottleListFacts, bottleRow} from '../../public/js/views/warehouse-presentation.js';
import {renderUnassignedTray} from '../../public/js/views/warehouse-unassigned-tray.js';

const bottle = {id: 'b1', name: 'Whisky <Test>', number: '42', ageYears: 18, releaseYear: 2012, caskType: 'Oloroso & Bourbon'};

test('warehouse inventory rows show age, release year and cask type next to the correct bottle', () => {
  const facts = bottleListFacts(bottle);
  assert.match(facts, /Alter:/);
  assert.match(facts, /18 Jahre/);
  assert.match(facts, /Erscheinungsjahr:.*2012/);
  assert.match(facts, /Fasstyp:.*Oloroso &amp; Bourbon/);
  const row = bottleRow({assignments: {}, rooms: []}, bottle);
  assert.match(row, /class="warehouse-bottle-row-info"/);
  assert.match(row, /Whisky &lt;Test&gt;/);
  assert.match(row, /warehouse-bottle-facts/);
  assert.match(row, /data-bottle-search="[^"]*2012[^"]*oloroso/);
});

test('missing facts remain absent, and label text is escaped in the inventory and tray', () => {
  assert.equal(bottleListFacts({name: 'unknown'}), '');
  assert.doesNotMatch(bottleRow({assignments: {}, rooms: []}, {id: 'b2', name: 'No facts'}), /warehouse-bottle-facts/);
  assert.match(bottleListFacts({...bottle, caskType: '<script>'}), /&lt;script&gt;/);
  const warehouse = {bottles: [bottle], assignments: {}};
  const html = renderUnassignedTray(warehouse);
  assert.match(html, /<details class="warehouse-unassigned-tray"\s+aria-label=/);
  assert.doesNotMatch(html, /<details class="warehouse-unassigned-tray" open/);
  assert.match(html, /<summary class="warehouse-unassigned-summary"/);
  assert.match(html, /Erscheinungsjahr:.*2012/);
  assert.match(renderUnassignedTray(warehouse, [], {expanded: true}), /<details class="warehouse-unassigned-tray" open/);
  assert.match(html, /data-unassigned-id="b1"/);
});

test('storage wall remembers an opened staging tray when the view re-renders', async () => {
  const {createWarehouseView} = await import('../../public/js/views/warehouse.js');
  const furniture = {id: 'f', name: 'Shelf', x: 0, y: 0, width: 1, depth: .5, itemHeight: 1, shelves: [{id: 's', name: 'Bay', capacity: 10}]};
  const warehouse = {rooms: [{id: 'r', name: 'Room', width: 3, height: 3, furniture: [furniture]}], bottles: [bottle], assignments: {}};
  const state = {warehouse, selected: 'shelves', warehouseRoomId: 'r', warehouseSelectedBottleIds: []};
  let html = '', onClick;
  const tray = {hidden: true};
  const attributes = new Map();
  const original = globalThis.document;
  globalThis.document = {
    querySelector: selector => selector === '.warehouse-unassigned-toggle'
      ? {addEventListener: (name, handler) => {assert.equal(name, 'click'); onClick = handler;}}
      : selector === '.warehouse-unassigned-tray--embedded' ? tray : null,
    querySelectorAll: () => [],
    getElementById: () => null
  };
  try {
    const view = createWarehouseView({state, shell: markup => {html = markup;}, modal: {}, refresh: async () => {}});
    view.render();
    assert.match(html, /id="warehouse-wall-unassigned-content"[^>]*hidden/);
    assert.equal(typeof onClick, 'function');
    onClick({currentTarget: {setAttribute: (name, value) => attributes.set(name, value)}});
    assert.equal(attributes.get('aria-expanded'), 'true');
    assert.equal(tray.hidden, false);
    view.render();
    assert.match(html, /class="warehouse-unassigned-toggle"[^>]*aria-expanded="true"/);
    assert.doesNotMatch(html, /id="warehouse-wall-unassigned-content"[^>]*hidden/);
    onClick({currentTarget: {setAttribute: (name, value) => attributes.set(name, value)}});
    assert.equal(tray.hidden, true);
    view.render();
    assert.match(html, /id="warehouse-wall-unassigned-content"[^>]*hidden/);
  } finally {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  }
});
