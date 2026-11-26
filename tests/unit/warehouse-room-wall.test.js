import test from 'node:test';
import assert from 'node:assert/strict';
import {wallFurnitureGroups} from '../../public/js/domain/warehouse-wall-layout.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

/**
 * Creates warehouse for warehouse room wall.test.
 *
 * @return {!Object} Structured result for the caller.
 */
function createWarehouse() {
  const room = {
    id: 'room', name: 'Room & <one>', width: 6, height: 4, furniture: [
      {
        id: 'f4',
        name: 'Regal 4',
        type: 'regal',
        x: 4,
        y: 3,
        rotation: 180,
        width: 1.3,
        elevation: 0,
        shelves: [
          {id: 'target', name: 'Fach B', capacity: 2, front: 'glass'},
          {id: 'full', name: 'Fach Voll', capacity: 1}],
      },
      {
        id: 'f1',
        name: 'Regal 1',
        type: 'regal',
        x: 0,
        y: 0,
        rotation: 0,
        width: 1.1,
        elevation: 0,
        shelves: [{id: 'source', name: 'Fach A', capacity: 5}, {id: 'higher', name: 'Oberes Fach', capacity: 1},],
      },
      {
        id: 'other',
        name: 'Empty furniture',
        type: 'regal',
        x: 2,
        y: 1,
        shelves: [],
      },
    ],
  };
  const warehouse = {
    rooms: [
      room,
      {
        id: 'elsewhere',
        name: 'Other',
        furniture: [{id: 'otherRack', shelves: [{id: 'outside', capacity: 3}]}],
      },
    ],
    bottles: [{id: 'b1', name: 'Ardbeg & <One>', number: '1'}, {id: 'b2', name: 'Second'},],
    assignments: {b1: 'source', b2: 'full'},
  };
  return {room, warehouse};
}

test(
  'overlapping but same-height furniture and units on opposite walls never stack',
  () => {
    /**
     * Derives the item result from the supplied values.
     *
     * @param {*} id Identifier of the affected record.
     * @param {*} x Horizontal coordinate.
     * @param {*} y Vertical coordinate.
     * @param {*} elevation Value used by this operation.
     * @param {number=} rotation Value used by this operation.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    const item = (id, x, y, elevation, rotation = 0) => ({
      id,
      name: id,
      x,
      y,
      width: 1,
      depth: .5,
      elevation,
      itemHeight: 1.5,
      rotation,
      shelves: [{id: `s-${id}`}],
    });
    const room = {
      furniture: [
        item('floorA', .5, .2, 0),
        item('floorB', .6, .2, 0),
        item('wallOpposite', .5, .2, 1.6, 180),
      ],
    };
    const groups = wallFurnitureGroups(room);
    assert.equal(groups.length, 3);
    assert.ok(groups.every(group => group.items.length === 1));
  }
);

test(
  're-render preserves the horizontal wall offset for each room independently',
  () => {
    const {room, warehouse} = createWarehouse();
    const other = {
      id: 'second',
      name: 'Second room',
      furniture: [{
        id: 'second-rack',
        name: 'Long rack',
        width: 2,
        shelves: [{id: 'other-shelf', name: 'One'}],
      }],
    };
    warehouse.rooms.push(other);
    const state = {warehouse, selected: 'shelves', warehouseRoomId: room.id};
    let viewport = null;
    const oldDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: selector => selector === '.warehouse-wall-scroll' ? viewport : null,
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         */
        shell: () => {
          viewport = {
            dataset: {roomId: state.warehouseRoomId},
            scrollLeft: 0,
            isConnected: true,
          };
        },
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate: () => {},
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      viewport.scrollLeft = 830;
      view.render();
      assert.equal(viewport.scrollLeft, 830);
      state.warehouseRoomId = other.id;
      view.render();
      assert.equal(viewport.scrollLeft, 0, 'another room must start with its own offset');
      viewport.scrollLeft = 145;
      state.warehouseRoomId = room.id;
      view.render();
      assert.equal(viewport.scrollLeft, 830, 'returning to the first room restores its own position');
      state.warehouseRoomId = other.id;
      view.render();
      assert.equal(viewport.scrollLeft, 145);
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
  }
);
