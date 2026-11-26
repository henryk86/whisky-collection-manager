import test from 'node:test';
import assert from 'node:assert/strict';
import {findWarehouseBottles} from '../../public/js/domain/warehouse-finder.js';

const bottles = Array.from({length: 9}, (_, i) => ({
  id: `b${i + 1}`,
  name: i === 8 ? 'Islay <strong>' : `Glenfarclas ${i + 1}`,
  number: String(100 + i),
  volumeMl: 700,
  status: 'closed',
  bottlingId: `release-${i + 1}`,
}));

const warehouse = {
  rooms: [{
    id: 'r', name: 'Whiskyzimmer', width: 5, height: 3, furniture: [{
      id: 'f',
      name: 'Vitrine links',
      type: 'vitrine',
      x: 0,
      y: 0,
      width: 1,
      depth: .4,
      itemHeight: 2,
      rotation: 0,
      elevation: 0,
      shelves: [{id: 's', name: 'Fach 2', capacity: 15}],
    }],
  }],
  bottles,
  assignments: Object.fromEntries(bottles.slice(0, 8).map(b => [b.id, 's'])),
};

test(
  'finder matches inventory numbers, accented names, locations and multiple terms without grouping physical bottles',
  () => {
    assert.equal(findWarehouseBottles(warehouse, {query: 'glenfarclas'}).total, 8);
    assert.equal(findWarehouseBottles(warehouse, {query: '#104'}).items[0].bottle.id, 'b5');
    assert.equal(findWarehouseBottles(warehouse, {query: 'vitrine Fach 2'}).total, 8);
    assert.equal(findWarehouseBottles(warehouse, {query: 'glenfarclas Fach 2'}).total, 8);
    assert.equal(findWarehouseBottles(warehouse, {query: 'glenfarclas', placement: 'unassigned'}).total, 0);
    assert.equal(findWarehouseBottles(warehouse, {placement: 'unassigned'}).items[0].bottle.id, 'b9');
    assert.equal(findWarehouseBottles(warehouse, {placement: 'assigned'}).total, 8);
    assert.equal(findWarehouseBottles(warehouse, {placement: 'invalid'}).total, 9);
  }
);

test('finder pagination returns bounded pages and stable counts', () => {
  const page = findWarehouseBottles(warehouse, {page: 3, pageSize: 3});
  assert.equal(page.total, 9);
  assert.equal(page.pages, 3);
  assert.equal(page.page, 3);
  assert.equal(page.items.length, 3);
  assert.equal(findWarehouseBottles(warehouse, {page: 99, pageSize: 3}).page, 3);
  assert.equal(findWarehouseBottles(warehouse, {query: 'absent'}).total, 0);
});
