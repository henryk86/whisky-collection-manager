import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentLocation, assignmentShelfInfo, assignmentPayload, renderWarehouseAssignment, shelfCapacityIncrease, approveShelfCapacityIncrease} from '../../public/js/ui/warehouse-assignment.js';

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
  () => {
    const {warehouse, shelf} = fixture();
    const html = renderWarehouseAssignment(warehouse, warehouse.bottles[0]);
    assert.match(html, /class="warehouse-assignment-bottle"/);
    assert.match(html, /class="warehouse-assignment-current"/);
    assert.match(html, /Aktueller Lagerort/);
    assert.match(
      html,
      /<strong>Whiskyzimmer \/ Regal &lt;1&gt; \/ Fach 1<\/strong>/
    );
    assert.match(html, /<div class="warehouse-assignment-editor">/);
    assert.doesNotMatch(html, /<details|<summary>/);
    assert.match(
      html,
      /<fieldset class="warehouse-assignment-target"><legend>Neuer Lagerort<\/legend>/
    );
    assert.match(html, /data-assignment-room/);
    assert.match(html, /data-assignment-furniture/);
    assert.match(html, /data-assignment-shelf/);
    assert.match(html, /Whiskyzimmer \/ Regal &lt;1&gt; \/ Fach 1/);
    assert.doesNotMatch(html, /<1>/);
    assert.doesNotMatch(html, /<test>/);
    assert.match(html, /value="s1" selected/);
    assert.match(html, /value="s2" disabled/);
    assert.match(html, /1 von 1 Plätzen belegt/);
    assert.deepEqual(assignmentLocation(warehouse, 's1')?.shelf, shelf);
  }
);

test(
  'a bottle can remain on a filled shelf but cannot choose a different full shelf',
  () => {
    const {warehouse, shelf, full} = fixture();
    assert.deepEqual(
      assignmentShelfInfo(warehouse, shelf, 'b1'),
      {occupied: 1, full: false, capacity: 1}
    );
    assert.deepEqual(
      assignmentShelfInfo(warehouse, shelf, 'b2'),
      {occupied: 1, full: true, capacity: 1}
    );
    assert.equal(assignmentShelfInfo(warehouse, full, 'b1').full, true);
    assert.deepEqual(
      assignmentPayload('none', 's1', warehouse),
      {shelfId: null}
    );
    assert.deepEqual(
      assignmentPayload('shelf', 's1', warehouse),
      {shelfId: 's1'}
    );
    assert.throws(
      () => assignmentPayload('shelf', 'missing', warehouse),
      /gültiges Fach/
    );
  }
);

test(
  'bulk assignment form checks total capacity and preserves per-bottle selection',
  async () => {
    const {bulkAssignmentPayload} =
      await import('../../public/js/ui/warehouse-assignment.js');
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
      bottles: [{id: 'a', name: 'A'}, {id: 'b', name: 'B'}, {id: 'c', name: 'C'}],
      assignments: {a: 'target'},
    };
    assert.deepEqual(
      bulkAssignmentPayload(['b', 'c'], 'shelf', 'target', w),
      {ids: ['b', 'c'], shelfId: 'target'}
    );
    assert.deepEqual(
      bulkAssignmentPayload(['a', 'b'], 'shelf', 'target', w),
      {ids: ['a', 'b'], shelfId: 'target'}
    );
    assert.deepEqual(
      bulkAssignmentPayload(['b', 'c'], 'none', '', w),
      {ids: ['b', 'c'], shelfId: null}
    );
    assert.throws(
      () => bulkAssignmentPayload(['a', 'a'], 'shelf', 'target', w),
      /zuerst Flaschen/
    );
    const {renderWarehouseAssignment} =
      await import('../../public/js/ui/warehouse-assignment.js');
    const html = renderWarehouseAssignment(w, [w.bottles[0], w.bottles[1]]);
    assert.match(html, /2 Flaschen ausgewählt/);
    assert.match(html, /<div class="warehouse-assignment-editor">/);
    assert.doesNotMatch(html, /<details|<summary>/);
  }
);

test(
  'positive overcapacity has a confirmable required capacity; zero stays non-assignable',
  () => {
    const {warehouse, full} = fixture();
    warehouse.bottles.push({id: 'b2', name: 'B'});
    assert.deepEqual(
      shelfCapacityIncrease(
        warehouse,
        warehouse.rooms[0].furniture[0].shelves[0],
        ['b2']
      ),
      {current: 1, required: 2, blocked: false}
    );
    assert.deepEqual(
      shelfCapacityIncrease(warehouse, full, 'b2'),
      {current: 0, required: 1, blocked: true}
    );
    assert.equal(
      shelfCapacityIncrease(
        warehouse,
        warehouse.rooms[0].furniture[0].shelves[0],
        ['b1']
      ),
      null
    );
    warehouse.rooms[0].furniture[0].shelves
      .push({id: 'unlimited', capacity: null});
    assert.equal(
      shelfCapacityIncrease(
        warehouse,
        warehouse.rooms[0].furniture[0].shelves[2],
        ['b2']
      ),
      null
    );
    assert.match(
      renderWarehouseAssignment(
        warehouse,
        [warehouse.bottles[0], warehouse.bottles[1]]
      ),
      /value="r1"/
    );
  }
);

test(
  'user confirms the exact new capacity before any assignment can request its increase',
  async () => {
    const {warehouse} = fixture();
    warehouse.bottles.push({id: 'b2', name: 'B'});
    let question = '';
    const accept = message => {question = message; return true;};
    assert.deepEqual(
      await approveShelfCapacityIncrease(
        warehouse,
        's1',
        ['b2'],
        async message => accept(message)
      ),
      {increaseCapacityTo: 2}
    );
    assert.match(question, /1.*2.*2/);
    assert.equal(
      await approveShelfCapacityIncrease(
        warehouse,
        's1',
        ['b2'],
        async () => false
      ),
      null
    );
    assert.deepEqual(
      await approveShelfCapacityIncrease(
        warehouse,
        's1',
        ['b1'],
        () => {throw new Error('not needed');}
      ),
      {}
    );
    await assert.rejects(
      approveShelfCapacityIncrease(warehouse, 's2', ['b2'], () => true),
      /erlaubt keine Flaschen/
    );
  }
);

test(
  'capacity increase requires an explicit callback and never opens a native browser dialog',
  async () => {
    const {warehouse} = fixture();
    warehouse.bottles.push({id: 'b2'});
    const oldConfirm = globalThis.confirm;
    globalThis.confirm =
      () => {throw new Error('native confirm must never run');};
    try {
      assert.equal(
        await approveShelfCapacityIncrease(warehouse, 's1', ['b2']),
        null
      );
      assert.deepEqual(
        await approveShelfCapacityIncrease(
          warehouse,
          's1',
          ['b2'],
          async () => true
        ),
        {increaseCapacityTo: 2}
      );
    } finally {
      if (oldConfirm ===
        undefined) delete globalThis.confirm; else globalThis.confirm =
          oldConfirm;
    }
  }
);
