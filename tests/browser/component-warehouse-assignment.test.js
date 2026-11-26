import {domElements, domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentLocation, renderWarehouseAssignment, shelfCapacityIncrease} from '../../public/js/ui/warehouse-assignment.js';

/**
 * Derives the fixture result from the supplied values.
 * @return {!Array<*>} Resulting entries in their output order.
 */
function fixture() {
  const shelf = {id: 's1', name: 'Fach 1', capacity: 1};
  const full = {id: 's2', name: 'Voll', capacity: 0};
  const warehouse = {
    rooms: [{
      id: 'r1',
      name: 'Whiskyzimmer',
      furniture: [{id: 'f1', name: 'Regal <1>', shelves: [shelf, full]}],
    }],
    assignments: {b1: 's1'},
    bottles: [{id: 'b1', name: 'Whisky <test>', number: '100'}],
  };
  return {warehouse, shelf, full};
}

test(
  'assignment dialog separates room, furniture and shelf with current path and safe markup',
  async () => {
    const {warehouse, shelf} = fixture();
    const html = renderWarehouseAssignment(warehouse, warehouse.bottles[0]);
    assert.ok((await domElements(html, '[class="warehouse-assignment-bottle"]')).length > 0);
    assert.ok((await domElements(html, '[class="warehouse-assignment-current"]')).length > 0);
    assert.match(await domText(html), /Aktueller Lagerort/);
    await assertDom(html, "strong", {"text": new RegExp("^Whiskyzimmer \\/ Regal <1> \\/ Fach 1$")});
    assert.ok((await domElements(html, 'div[class="warehouse-assignment-editor"]')).length > 0);
    await assertDom(html, "details,summary", {}, true);
    assert.equal((await domElements(html, 'fieldset.warehouse-assignment-target > legend'))[0].text.trim(), 'Neuer Lagerort');
    assert.ok((await domElements(html, '[data-assignment-room]')).length > 0);
    assert.ok((await domElements(html, '[data-assignment-furniture]')).length > 0);
    assert.ok((await domElements(html, '[data-assignment-shelf]')).length > 0);
    assert.match(await domText(html), new RegExp("Whiskyzimmer \\/ Regal <1> \\/ Fach 1"));
    await assertDom(html, "\\31 ", {}, true);
    assert.equal((await domElements(html, 'test')).length, 0);
    assert.ok((await domElements(html, '[value="s1"][selected]')).length > 0);
    assert.ok((await domElements(html, '[value="s2"][disabled]')).length > 0);
    assert.match(await domText(html), /1 von 1 Plätzen belegt/);
    assert.deepEqual(assignmentLocation(warehouse, 's1')?.shelf, shelf);
  }
);

test(
  'bulk assignment form checks total capacity and preserves per-bottle selection',
  async () => {
    const {bulkAssignmentPayload} = await import('../../public/js/ui/warehouse-assignment.js');
    const w = {
      rooms: [{
        id: 'r',
        name: 'Room',
        furniture: [{
          id: 'f',
          name: 'Rack',
          shelves: [{id: 'target', name: 'Target', capacity: 2}],
        }],
      }],
      bottles: [{id: 'a', name: 'A'}, {id: 'b', name: 'B'}, {
        id: 'c',
        name: 'C',
      }],
      assignments: {a: 'target'},
    };
    assert.deepEqual(bulkAssignmentPayload(['b', 'c'], 'shelf', 'target', w), {ids: ['b', 'c'], shelfId: 'target'});
    assert.deepEqual(bulkAssignmentPayload(['a', 'b'], 'shelf', 'target', w), {ids: ['a', 'b'], shelfId: 'target'});
    assert.deepEqual(bulkAssignmentPayload(['b', 'c'], 'none', '', w), {ids: ['b', 'c'], shelfId: null});
    assert.throws(() => bulkAssignmentPayload(['a', 'a'], 'shelf', 'target', w), /zuerst Flaschen/);
    const {renderWarehouseAssignment} = await import('../../public/js/ui/warehouse-assignment.js');
    const html = renderWarehouseAssignment(w, [w.bottles[0], w.bottles[1]]);
    assert.match(await domText(html), /2 Flaschen ausgewählt/);
    assert.ok((await domElements(html, 'div[class="warehouse-assignment-editor"]')).length > 0);
    await assertDom(html, "details,summary", {}, true);
  }
);

test(
  'positive overcapacity has a confirmable required capacity; zero stays non-assignable',
  async () => {
    const {warehouse, full} = fixture();
    warehouse.bottles.push({id: 'b2', name: 'B'});
    assert.deepEqual(
      shelfCapacityIncrease(warehouse, warehouse.rooms[0].furniture[0].shelves[0], ['b2']),
      {current: 1, required: 2, blocked: false}
    );
    assert.deepEqual(shelfCapacityIncrease(warehouse, full, 'b2'), {current: 0, required: 1, blocked: true});
    assert.equal(shelfCapacityIncrease(warehouse, warehouse.rooms[0].furniture[0].shelves[0], ['b1']), null);
    warehouse.rooms[0].furniture[0].shelves.push({id: 'unlimited', capacity: null});
    assert.equal(shelfCapacityIncrease(warehouse, warehouse.rooms[0].furniture[0].shelves[2], ['b2']), null);
    assert.ok((await domElements(renderWarehouseAssignment(warehouse, [warehouse.bottles[0], warehouse.bottles[1]]), '[value="r1"]')).length > 0);
  }
);
