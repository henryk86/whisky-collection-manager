import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentShelfInfo, assignmentPayload, approveShelfCapacityIncrease} from '../../public/js/ui/warehouse-assignment.js';

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
  'a bottle can remain on a filled shelf but cannot choose a different full shelf',
  () => {
    const {warehouse, shelf, full} = fixture();
    assert.deepEqual(assignmentShelfInfo(warehouse, shelf, 'b1'), {occupied: 1, full: false, capacity: 1});
    assert.deepEqual(assignmentShelfInfo(warehouse, shelf, 'b2'), {occupied: 1, full: true, capacity: 1});
    assert.equal(assignmentShelfInfo(warehouse, full, 'b1').full, true);
    assert.deepEqual(assignmentPayload('none', 's1', warehouse), {shelfId: null});
    assert.deepEqual(assignmentPayload('shelf', 's1', warehouse), {shelfId: 's1'});
    assert.throws(() => assignmentPayload('shelf', 'missing', warehouse), /gültiges Fach/);
  }
);

test(
  'user confirms the exact new capacity before any assignment can request its increase',
  async () => {
    const {warehouse} = fixture();
    warehouse.bottles.push({id: 'b2', name: 'B'});
    let question = '';
    /**
     * Derives the accept result from the supplied values.
     *
     * @param {*} message Message to display or use for diagnostics.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    const accept = message => {question = message; return true;};
    assert.deepEqual(
      await approveShelfCapacityIncrease(warehouse, 's1', ['b2'], async message => accept(message)),
      {increaseCapacityTo: 2}
    );
    assert.match(question, /1.*2.*2/);
    assert.equal(await approveShelfCapacityIncrease(warehouse, 's1', ['b2'], async () => false), null);
    assert.deepEqual(
      await approveShelfCapacityIncrease(
        warehouse,
        's1',
        ['b1'],
        () => {throw new Error('not needed');}
      ),
      {}
    );
    await assert.rejects(approveShelfCapacityIncrease(warehouse, 's2', ['b2'], () => true), /erlaubt keine Flaschen/);
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
      assert.equal(await approveShelfCapacityIncrease(warehouse, 's1', ['b2']), null);
      assert.deepEqual(
        await approveShelfCapacityIncrease(warehouse, 's1', ['b2'], async () => true),
        {increaseCapacityTo: 2}
      );
    } finally {
      if (oldConfirm === undefined) delete globalThis.confirm; else globalThis.confirm = oldConfirm;
    }
  }
);
