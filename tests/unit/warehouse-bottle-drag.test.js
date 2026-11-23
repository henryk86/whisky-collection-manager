import test from 'node:test';
import assert from 'node:assert/strict';
import {mountWarehouseBottleDrag, shelfDropStatus} from '../../public/js/ui/warehouse-bottle-drag.js';

function fixture() {
  const warehouse = {
    rooms: [{
      id: 'room', furniture: [{
        id: 'rack', shelves: [
          {id: 'source', capacity: 1}, {id: 'destination', capacity: 2},
          {id: 'full', capacity: 1}, {id: 'disabled', capacity: 0}
        ]
      }]
    }],
    bottles: [{id: 'b1'}, {id: 'b2'}, {id: 'b3'}],
    assignments: {b1: 'source', b2: 'full', removed: 'destination'}
  };
  return warehouse;
}

test('bottle drop checks current assignment and live occupancy without inventing available space', () => {
  const w = fixture();
  assert.equal(shelfDropStatus(w, 'b1', 'destination'), 'valid', 'stale assignments do not consume capacity');
  assert.equal(shelfDropStatus(w, 'b1', 'source'), 'same');
  assert.equal(shelfDropStatus(w, 'b1', 'full'), 'expand');
  assert.equal(shelfDropStatus(w, 'b1', 'disabled'), 'full');
  assert.equal(shelfDropStatus(w, 'b1', 'missing'), 'invalid');
  assert.equal(shelfDropStatus(w, 'unknown', 'destination'), 'invalid');
  w.assignments.b3 = 'destination';
  assert.equal(shelfDropStatus(w, 'b1', 'destination'), 'valid');
  w.assignments.b2 = 'destination';
  assert.equal(shelfDropStatus(w, 'b1', 'destination'), 'expand');
});

function fakeDom() {
  const listeners = new Map();
  const classList = () => {
    const entries = new Set();
    return {add: key => entries.add(key), remove: key => entries.delete(key), contains: key => entries.has(key)};
  };
  const button = {dataset: {id: 'b1'}, classList: classList(), setPointerCapture: () => {}, releasePointerCapture: () => {}, closest: selector => selector === '.warehouse-bottle-symbol' ? button : null};
  const shelves = Object.fromEntries(['source', 'destination', 'full', 'disabled'].map(id =>
    [id, {dataset: {shelfId: id}, classList: classList(), closest(selector) {return selector === '.warehouse-shelf' ? this : null;} }]));
  const panel = {
    classList: classList(),
    ownerDocument: {elementFromPoint(x) {return x < 75 ? shelves.source : x < 175 ? shelves.destination : x < 275 ? shelves.full : shelves.disabled;} },
    querySelectorAll: selector => selector === '.warehouse-shelf' ? Object.values(shelves) : [],
    contains: node => node === button || Object.values(shelves).includes(node),
    addEventListener(name, listener) {if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener);},
    removeEventListener(name, listener) {listeners.set(name, (listeners.get(name) || []).filter(item => item !== listener));},
  };
  const fire = (type, x, {target = button, pointerId = 1} = {}) => {
    const event = {
      target, pointerId, isPrimary: true, button: 0, clientX: x, clientY: 10,
      prevented: false, stopped: false, preventDefault() {this.prevented = true;},
      stopPropagation() {this.stopped = true;}, stopImmediatePropagation() {this.stopped = true;}
    };
    for (const fn of listeners.get(type) || []) fn(event);
    return event;
  };
  return {button, shelves, panel, fire};
}

test('pointer relocation keeps a tap as a detail click; drag highlights, saves once and suppresses modal click', async () => {
  const warehouse = fixture();
  const dom = fakeDom();
  const calls = [];
  const cleanup = mountWarehouseBottleDrag(dom.panel, {getWarehouse: () => warehouse, onDrop: (...args) => calls.push(args)});
  dom.fire('pointerdown', 20);
  dom.fire('pointerup', 20);
  assert.equal(dom.fire('click', 20).prevented, false, 'tap still opens the bottle detail');
  dom.fire('pointerdown', 20);
  dom.fire('pointermove', 25);
  assert.equal(dom.panel.classList.contains('warehouse-is-dragging'), false, 'small movement is a click');
  dom.fire('pointermove', 120);
  assert.equal(dom.shelves.destination.classList.contains('warehouse-drop-target'), true);
  dom.fire('pointerup', 120);
  assert.equal(dom.shelves.destination.classList.contains('warehouse-drop-target'), false);
  assert.equal(dom.panel.classList.contains('warehouse-is-dragging'), false);
  assert.equal(dom.fire('click', 120).prevented, true, 'release must not open the detail modal');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['b1', 'destination']]);
  cleanup();
});

test('overcapacity shelf requests confirmation flow, while cancelled gestures clean up', async () => {
  const w = fixture();
  const dom = fakeDom();
  const calls = [], rejected = [];
  const cleanup = mountWarehouseBottleDrag(dom.panel, {
    getWarehouse: () => w, onDrop: (...args) => calls.push(args), onInvalidDrop: reason => rejected.push(reason)
  });
  dom.fire('pointerdown', 20);
  dom.fire('pointermove', 220);
  assert.equal(dom.shelves.full.classList.contains('warehouse-drop-capacity'), true);
  dom.fire('pointerup', 220);
  dom.fire('pointerdown', 20);
  dom.fire('pointermove', 120);
  dom.fire('pointercancel', 120);
  assert.equal(dom.shelves.destination.classList.contains('warehouse-drop-target'), false);
  dom.fire('pointerdown', 20);
  dom.fire('pointermove', 120);
  dom.fire('pointerup', 20); // finish where it began
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['b1', 'full']]);
  assert.deepEqual(rejected, []);
  cleanup();
});

test('drag across two racks on a long virtual wall auto-scrolls and saves only at the destination', async () => {
  const warehouse = fixture();
  const original = warehouse.rooms[0].furniture[0];
  const destination = original.shelves.splice(1, 1)[0];
  warehouse.rooms[0].furniture.push({id: 'otherRack', shelves: [destination]});
  const dom = fakeDom();
  const scroll = {scrollLeft: 0, scrollTop: 0, getBoundingClientRect() {return {left: 0, right: 140, top: 0, bottom: 100};} };
  dom.panel.querySelector = selector => selector === '.warehouse-wall-scroll' ? scroll : null;
  const calls = [];
  const cleanup = mountWarehouseBottleDrag(dom.panel, {getWarehouse: () => warehouse, onDrop: (...args) => calls.push(args)});
  dom.fire('pointerdown', 20);
  dom.fire('pointermove', 120);
  assert.ok(scroll.scrollLeft > 0, 'the destination area automatically scrolls while dragging at the edge');
  dom.fire('pointerup', 120);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['b1', 'destination']], 'cross-furniture relocation reuses the same assignment endpoint');
  const stopped = scroll.scrollLeft;
  await new Promise(resolve => setTimeout(resolve, 65));
  assert.equal(scroll.scrollLeft, stopped, 'edge scrolling stops after dropping');
  cleanup();
});

test('a selected group is dropped atomically and group occupancy is validated', async () => {
  const w = fixture();
  assert.equal(shelfDropStatus(w, ['b1', 'b3'], 'destination'), 'valid');
  assert.equal(shelfDropStatus(w, ['b1', 'b2'], 'destination'), 'valid');
  assert.equal(shelfDropStatus(w, ['b1', 'b2'], 'full'), 'expand');
  assert.equal(shelfDropStatus(w, ['b1', 'b1'], 'destination'), 'invalid');
  w.assignments.b3 = 'destination';
  assert.equal(shelfDropStatus(w, ['b1', 'b2'], 'destination'), 'expand');
  delete w.assignments.b3;
  const dom = fakeDom(), calls = [];
  const cleanup = mountWarehouseBottleDrag(dom.panel, {
    getWarehouse: () => w,
    getDraggedIds: id => id === 'b1' ? ['b1', 'b2'] : [id], onDrop: (...args) => calls.push(args)
  });
  dom.fire('pointerdown', 20);
  dom.fire('pointermove', 120);
  dom.fire('pointerup', 120);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [[['b1', 'b2'], 'destination']]);
  cleanup();
});
