import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer, requestJson as api} from '../helpers/server.js';

/**
 * Coordinates asynchronous work for create.
 *
 * @param {*} base Base value or reference for the calculation.
 * @param {*} name Environment variable or setting name.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const create = async (base, name) =>
  (await api(base, '/api/warehouse/rooms', 'POST', {
    name, width: 5,
    height: 4,
  })).data;

/**
 * Coordinates asynchronous work for furniture.
 *
 * @param {*} base Base value or reference for the calculation.
 * @param {*} room Warehouse room being inspected or modified.
 * @param {*} name Environment variable or setting name.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const furniture = async (base, room, name) => (await api(
  base,
  `/api/warehouse/rooms/${room.id}/furniture`,
  'POST',
  {name, type: 'regal', x: 0, y: 0, width: 1, depth: .5, rotation: 0}
)).data;

/**
 * Coordinates asynchronous work for shelf.
 *
 * @param {*} base Base value or reference for the calculation.
 * @param {*} model Value used by this operation.
 * @param {*} name Environment variable or setting name.
 * @param {number=} capacity Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const shelf = async (base, model, name, capacity = 3) => (await api(
  base,
  `/api/warehouse/furniture/${model.id}/shelves`,
  'POST',
  {name, capacity}
)).data;

/**
 * Coordinates asynchronous work for bottle.
 *
 * @param {*} base Base value or reference for the calculation.
 * @param {*} number Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const bottle = async (base, number) => (await api(
  base,
  '/api/bottlings',
  'POST',
  {
    name: `Whisky ${number}`,
    firstBottle: {inventoryNumber: number, status: 'closed'},
  }
)).data.bottle;

/**
 * Derives the export rooms result from the supplied values.
 *
 * @param {*} base Base value or reference for the calculation.
 * @param {*} roomIds Value used by this operation.
 * @param {*} includeAssignments Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const exportRooms = (base, roomIds, includeAssignments) => api(
  base,
  '/api/warehouse/rooms/export',
  'POST',
  {roomIds, includeAssignments}
);

/**
 * Derives the preview result from the supplied values.
 *
 * @param {*} base Base value or reference for the calculation.
 * @param {*} document Value used by this operation.
 * @param {!Object=} opts Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const preview = (base, document, opts = {}) => api(
  base,
  '/api/warehouse/rooms/import/preview',
  'POST',
  {document, ...opts}
);

/**
 * Derives the apply result from the supplied values.
 *
 * @param {*} base Base value or reference for the calculation.
 * @param {*} document Value used by this operation.
 * @param {!Object=} opts Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const apply = (base, document, opts = {}) =>
  api(base, '/api/warehouse/rooms/import', 'POST', {document, ...opts});

test(
  'export of selected/multiple/all rooms can be imported with or without \
matching bottle allocations across instances',
  async () => {
    const source = await startTestServer(), destination =
      await startTestServer();
    try {
      const room1 = await create(source.base, 'Original room');
      const room2 = await create(source.base, 'Spare room');
      const room3 = await create(source.base, 'Hidden room');
      const cabinet = await furniture(source.base, room1, 'Regal mit Fächern');
      const bay = await shelf(source.base, cabinet, 'Fach 1', 2);
      const originalBottle = await bottle(source.base, 'TRANSFER-4711');
      await api(
        source.base,
        `/api/warehouse/bottles/${originalBottle.id}`,
        'PUT',
        {shelfId: bay.id}
      );
      const receiverBottle = await bottle(destination.base, 'TRANSFER-4711');
      assert.notEqual(originalBottle.id, receiverBottle.id);
      const single = (await exportRooms(source.base, [room1.id], false)).data;
      assert.equal(single.format, 'wcm-room-transfer');
      assert.equal(single.rooms.length, 1);
      assert.equal(single.assignments.length, 0);
      assert.equal(single.includesAssignments, false);
      const several = (await exportRooms(source.base, [room1.id, room2.id],
        true)).data;
      assert.deepEqual(
        several.rooms.map(r => r.name),
        ['Original room', 'Spare room']
      );
      assert.equal(several.assignments.length, 1);
      assert.equal(several.assignments[0].inventoryNumber, 'TRANSFER-4711');
      assert.equal(several.assignments[0].bottleId, originalBottle.id);
      const all = (await exportRooms(source.base, 'all', true)).data;
      assert.equal(all.rooms.length, 3);
      const dry = (await preview(destination.base, several)).data;
      assert.equal(dry.createdRooms, 2);
      assert.equal(dry.assigned, 1);
      assert.equal(
        (await api(destination.base, '/api/warehouse')).data.rooms.length,
        0,
        'preview never commits'
      );
      const result = await apply(destination.base, several);
      assert.equal(result.status, 200);
      assert.equal(result.data.createdRooms, 2);
      assert.equal(result.data.assigned, 1);
      const target = (await api(destination.base, '/api/warehouse')).data;
      assert.equal(target.rooms.length, 2);
      assert.notEqual(target.rooms[0].id, room1.id);
      assert.notEqual(target.rooms[0].furniture[0].id, cabinet.id);
      assert.notEqual(target.rooms[0].furniture[0].shelves[0].id, bay.id);
      assert.equal(
        target.assignments[receiverBottle.id],
        target.rooms[0].furniture[0].shelves[0].id
      );
      const repeat = (await apply(destination.base, several)).data;
      assert.equal(repeat.createdRooms, 0);
      assert.equal(repeat.skippedRooms, 2);
      assert.equal(
        (await api(destination.base, '/api/warehouse')).data.rooms.length,
        2
      );
      const extra = (await apply(destination.base, all, {
        includeAssignments:
          false,
      })).data;
      assert.equal(extra.createdRooms, 1);
      assert.equal(extra.assigned, 0);
      assert.equal(
        (await api(destination.base, '/api/warehouse')).data.rooms.length,
        3
      );
      // An existing occupied room cannot be replaced even when explicitly
      // requested.
      assert.equal(
        (await preview(destination.base, several, {conflictPolicy: 'replace'}))
          .data.blockedRooms,
        1
      );
      assert.equal(
        (await apply(destination.base, several, {conflictPolicy: 'replace'}))
          .status,
        409
      );
      assert.equal(
        (await api(destination.base, '/api/warehouse')).data.rooms.length,
        3
      );
    } finally {await source.stop(); await destination.stop();}
  }
);

test(
  'room import rejects corrupt or missing references without writing any rooms',
  async () => {
    const ctx = await startTestServer();
    try {
      const room = await create(ctx.base, 'Portable room');
      const valid = (await exportRooms(ctx.base, [room.id], false)).data;
      const corrupt = structuredClone(valid);
      corrupt.rooms[0].width = -2;
      assert.equal((await preview(ctx.base, corrupt)).status, 400);
      assert.equal((await apply(ctx.base, corrupt)).status, 400);
      const unknown = structuredClone(valid);
      unknown.assignments =
        [{bottleId: 'b', shelfId: 'invalid', inventoryNumber: 'foo'}];
      assert.equal((await apply(ctx.base, unknown)).status, 400);
      assert.equal(
        (await api(ctx.base, '/api/warehouse')).data.rooms.length,
        1
      );
      assert.equal(
        (await exportRooms(ctx.base, ['unknown'], false)).status,
        400
      );
    } finally {await ctx.stop();}
  }
);
