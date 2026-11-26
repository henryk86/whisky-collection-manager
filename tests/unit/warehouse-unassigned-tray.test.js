import test from 'node:test';
import assert from 'node:assert/strict';
import {unassignedWallPage} from '../../public/js/domain/warehouse-unassigned-tray.js';

/**
 * Derives the inventory result from the supplied values.
 *
 * @param {*} count Number of requested or available entries.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const inventory = count => ({
  bottles: Array.from({length: count}, (_, i) => ({
    id: `b${i}`,
    name: `Whisky ${String(i).padStart(4, '0')}`,
    number: `INV-${i}`,
  })), assignments: {b0: 's0', b10: 's0'},
});

test(
  'unassigned search is case insensitive and pagination clamps when results shrink',
  () => {
    const warehouse = inventory(500);
    const matches = unassignedWallPage(warehouse, {
      query: 'whisky 004',
      page: 9,
    });
    assert.equal(matches.page, 1);
    assert.ok(matches.items.length > 0);
    assert.ok(matches.items.every(bottle => bottle.name.toLowerCase().includes('whisky 004')));
    const byNumber = unassignedWallPage(warehouse, {query: 'inv-111'});
    assert.deepEqual(byNumber.items.map(item => item.id), ['b111']);
    assert.equal(unassignedWallPage(warehouse, {query: 'nonexistent'}).items.length, 0);
    assert.equal(unassignedWallPage(warehouse, {query: 'nonexistent'}).pages, 1);
  }
);
