import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer, requestJson as api} from '../helpers/server.js';

test('bulk physical bottle relocation either saves all selected bottles or none', async () => {
  const ctx = await startTestServer();
  try {
    const room = (await api(ctx.base, '/api/warehouse/rooms', 'POST', {name: 'Stockroom', width: 5, height: 5})).data;
    const rack = (await api(ctx.base, `/api/warehouse/rooms/${room.id}/furniture`, 'POST',
      {name: 'Regal', type: 'regal', x: 0, y: 0, width: 1, depth: 0.5})).data;
    const src = (await api(ctx.base, `/api/warehouse/furniture/${rack.id}/shelves`, 'POST', {name: 'A', capacity: 3})).data;
    const target = (await api(ctx.base, `/api/warehouse/furniture/${rack.id}/shelves`, 'POST', {name: 'B', capacity: 2})).data;
    const group = (await api(ctx.base, '/api/bottlings', 'POST',
      {name: 'Group', firstBottle: {inventoryNumber: '8801', status: 'closed'}})).data;
    const first = group.bottle.id;
    const second = (await api(ctx.base, '/api/bottles', 'POST',
      {bottlingId: group.bottling.id, inventoryNumber: '8802'})).data.id;
    const third = (await api(ctx.base, '/api/bottles', 'POST',
      {bottlingId: group.bottling.id, inventoryNumber: '8803'})).data.id;
    for (const bottleId of [first, second]) assert.equal((await api(ctx.base, `/api/warehouse/bottles/${bottleId}`, 'PUT', {shelfId: src.id})).status, 200);
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${third}`, 'PUT', {shelfId: target.id})).status, 200);
    const payload = {ids: [first, second], shelfId: target.id};
    assert.equal((await api(ctx.base, '/api/warehouse/bottles/bulk', 'POST', payload)).status, 409);
    let state = (await api(ctx.base, '/api/warehouse')).data;
    assert.equal(state.assignments[first], src.id);
    assert.equal(state.assignments[second], src.id);
    assert.equal(state.assignments[third], target.id);
    assert.equal((await api(ctx.base, '/api/warehouse/bottles/bulk', 'POST', {ids: [first, first], shelfId: target.id})).status, 400);
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${third}`, 'PUT', {shelfId: src.id})).status, 200);
    assert.equal((await api(ctx.base, '/api/warehouse/bottles/bulk', 'POST', payload)).status, 200);
    state = (await api(ctx.base, '/api/warehouse')).data;
    assert.equal(state.assignments[first], target.id);
    assert.equal(state.assignments[second], target.id);
    assert.equal(state.assignments[third], src.id);
    assert.equal((await api(ctx.base, '/api/warehouse/bottles/bulk', 'POST', {ids: [first, second], shelfId: null})).status, 200);
    state = (await api(ctx.base, '/api/warehouse')).data;
    assert.equal(state.assignments[first], undefined);
    assert.equal(state.assignments[second], undefined);
  } finally {await ctx.stop();}
});

test('overcapacity relocation requires explicit approval and expands capacity atomically', async () => {
  const ctx = await startTestServer();
  try {
    const room = (await api(ctx.base, '/api/warehouse/rooms', 'POST', {name: 'Overflow', width: 5, height: 5})).data;
    const furniture = (await api(ctx.base, `/api/warehouse/rooms/${room.id}/furniture`, 'POST',
      {name: 'Rack', type: 'regal', x: 0, y: 0, width: 1, depth: .5})).data;
    const source = (await api(ctx.base, `/api/warehouse/furniture/${furniture.id}/shelves`, 'POST', {name: 'Source', capacity: 5})).data;
    const destination = (await api(ctx.base, `/api/warehouse/furniture/${furniture.id}/shelves`, 'POST', {name: 'Destination', capacity: 1})).data;
    const blocked = (await api(ctx.base, `/api/warehouse/furniture/${furniture.id}/shelves`, 'POST', {name: 'Blocked', capacity: 0})).data;
    const first = (await api(ctx.base, '/api/bottlings', 'POST', {name: 'One', firstBottle: {inventoryNumber: 'T-001'}})).data.bottle.id;
    const second = (await api(ctx.base, '/api/bottlings', 'POST', {name: 'Two', firstBottle: {inventoryNumber: 'T-002'}})).data.bottle.id;
    const third = (await api(ctx.base, '/api/bottlings', 'POST', {name: 'Three', firstBottle: {inventoryNumber: 'T-003'}})).data.bottle.id;
    for (const id of [first, second, third]) assert.equal((await api(ctx.base, `/api/warehouse/bottles/${id}`, 'PUT', {shelfId: source.id})).status, 200);
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${first}`, 'PUT', {shelfId: destination.id})).status, 200);
    const url = '/api/warehouse/bottles/bulk', request = {ids: [second, third], shelfId: destination.id};
    assert.equal((await api(ctx.base, url, 'POST', request)).status, 409);
    assert.equal((await api(ctx.base, url, 'POST', {...request, increaseCapacityTo: 2})).status, 409,
      'a user approval for 2 spaces cannot silently grow to 3');
    let state = (await api(ctx.base, '/api/warehouse')).data;
    assert.equal(state.assignments[second], source.id);
    assert.equal(state.rooms[0].furniture[0].shelves[1].capacity, 1);
    assert.equal((await api(ctx.base, url, 'POST', {...request, increaseCapacityTo: 3})).status, 200);
    state = (await api(ctx.base, '/api/warehouse')).data;
    assert.equal(state.rooms[0].furniture[0].shelves[1].capacity, 3);
    assert.equal(state.assignments[second], destination.id);
    assert.equal(state.assignments[third], destination.id);
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${second}`, 'PUT',
      {shelfId: blocked.id, increaseCapacityTo: 4})).status, 409);
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${second}`, 'PUT',
      {shelfId: source.id})).status, 200);
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${second}`, 'PUT',
      {shelfId: destination.id})).status, 200, 'returning to previous shelf does not require more capacity');
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${second}`, 'PUT',
      {shelfId: blocked.id, increaseCapacityTo: 1})).status, 409);
    state = (await api(ctx.base, '/api/warehouse')).data;
    assert.equal(state.rooms[0].furniture[0].shelves[2].capacity, 0);
    assert.equal(state.assignments[second], destination.id);
    const fourth = (await api(ctx.base, '/api/bottlings', 'POST', {name: 'Four', firstBottle: {inventoryNumber: 'T-004'}})).data.bottle.id;
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${fourth}`, 'PUT', {shelfId: destination.id})).status, 409);
    assert.equal((await api(ctx.base, `/api/warehouse/bottles/${fourth}`, 'PUT',
      {shelfId: destination.id, increaseCapacityTo: 4})).status, 200);
    state = (await api(ctx.base, '/api/warehouse')).data;
    assert.equal(state.rooms[0].furniture[0].shelves[1].capacity, 4);
    assert.equal(state.assignments[fourth], destination.id);
  } finally {await ctx.stop();}
});
