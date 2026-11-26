import {domElements, domText, domIndex, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {unassignedWallPage, UNASSIGNED_WALL_PAGE_SIZE} from '../../public/js/domain/warehouse-unassigned-tray.js';
import {renderUnassignedTray, renderUnassignedTrayPage} from '../../public/js/views/warehouse-unassigned-tray.js';
import {renderWarehouseRoomWall} from '../../public/js/views/warehouse-room-wall.js';

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
  'virtual unassigned shelf pages thousands of bottles without rendering the entire inventory',
  async () => {
    const warehouse = inventory(2502);
    const first = unassignedWallPage(warehouse);
    assert.equal(first.total, 2500);
    assert.equal(first.items.length, UNASSIGNED_WALL_PAGE_SIZE);
    assert.equal(first.pages, Math.ceil(2500 / UNASSIGNED_WALL_PAGE_SIZE));
    assert.equal(first.items[0].id, 'b1');
    const last = unassignedWallPage(warehouse, {page: 100000});
    assert.equal(last.page, last.pages);
    assert.ok(last.items.length > 0 && last.items.length <= UNASSIGNED_WALL_PAGE_SIZE);
    assert.ok(last.items.every(item => item.id !== 'b0' && item.id !== 'b10'));
    const pageHtml = renderUnassignedTrayPage(warehouse);
    assert.equal((await domElements(pageHtml, '[data-unassigned-id]')).length, UNASSIGNED_WALL_PAGE_SIZE);
    assert.equal((await domElements(pageHtml, '[data-unassigned-id="b0"]')).length, 0);
    await assertDom(pageHtml, "[data-shelf-id]", {}, true, 'staging must not pretend to be a real target shelf');
  }
);

test(
  'unassigned staging uses existing bottle selection and safely escapes labels',
  async () => {
    const warehouse = {
      bottles: [{id: 'unsafe', name: '<script>alert(1)</script>', number: '123'}, {id: 'placed', name: 'Placed'},], assignments: {placed: 'shelf'},
    };
    const html = renderUnassignedTray(warehouse, ['unsafe']);
    await assertDom(html, ".warehouse-unassigned-bottle.warehouse-wall-bottle.is-selected");
    assert.ok((await domElements(html, '[data-act="warehouse-bottle-select"][data-id="unsafe"][aria-pressed="true"]')).length > 0);
    assert.match(await domText(html), new RegExp("<script>"));
    assert.equal((await domElements(html, 'script')).length, 0);
    assert.equal((await domElements(html, '[data-id="placed"]')).length, 0);
    assert.ok((await domElements(html, '[data-act="warehouse-unassigned-next"][disabled]')).length > 0);
  }
);

test(
  'room wall offers the unassigned shelf without adding furniture or duplicating bottle locations',
  async () => {
    const warehouse = inventory(40);
    const room = {
      id: 'r', name: 'Room', furniture: [{
        id: 'f', name: 'Shelf', x: 0, y: 0, width: 1, depth: .5, itemHeight: 1,
        shelves: [{id: 's0', name: 'Compartment', capacity: 50}],
      }],
    };
    const html = renderWarehouseRoomWall(room, warehouse, [], {page: 2});
    assert.equal(
      (await domElements(html, '.warehouse-unassigned-tray.warehouse-unassigned-tray--embedded')).length,
      1
    );
    assert.equal((await domElements(html, '[class="warehouse-bottle-bulk-tools"]')).length, 1);
    assert.equal((await domElements(html, '[class="warehouse-wall-controls"]')).length, 1);
    await assertDom(html, ".warehouse-unassigned-toggle[aria-controls=\"warehouse-wall-unassigned-content\"][aria-expanded=\"false\"]");
    assert.ok((await domElements(html, '[id="warehouse-wall-unassigned-content"][hidden]')).length > 0);
    assert.equal((await domElements(html, '.warehouse-unassigned-summary')).length, 0, 'no redundant collapsed header');
    assert.ok((await domElements(html, '[data-unassigned-id="b26"]')).length > 0);
    assert.equal((await domElements(html, '[data-unassigned-id="b0"]')).length, 0);
    assert.equal((await domElements(html, '[data-shelf-id]')).length, 1);
    assert.ok((await domElements(html, '[data-shelf-id="s0"]')).length > 0);
    assert.equal((await domElements(html, '[class="warehouse-wall-scroll"]')).length, 1);
    const emptyRoom = renderWarehouseRoomWall({id: 'r2', name: 'Empty room', furniture: []}, warehouse);
    assert.ok((await domElements(emptyRoom, '[class="warehouse-unassigned-tray warehouse-unassigned-tray--embedded"]')).length > 0);
    assert.match(await domText(emptyRoom), /noch keine Möbel mit Fächern/);
  }
);

test(
  'wall combines unassigned disclosure and selected-bottle actions into one compact header',
  async () => {
    const warehouse = {
      bottles: [{id: 'b1', name: 'One'}, {id: 'b2', name: 'Two'}],
      assignments: {},
    };
    const room = {id: 'room', name: 'Room', furniture: []};
    const html = renderWarehouseRoomWall(room, warehouse, ['b1'], {expanded: true});
    assert.ok((await domElements(html, '[class="warehouse-wall-controls"]')).length > 0);
    assert.match(await domText(html), /1 Flaschen ausgewählt/);
    assert.match(await domText(html), /Nicht zugeordnet \(2\)/);
    assert.ok((await domElements(html, '[class="warehouse-unassigned-toggle"][aria-expanded="true"]')).length > 0);
    assert.equal((await domElements(html, '[id="warehouse-wall-unassigned-content"][hidden]')).length, 0);
    assert.equal((await domElements(html, '.warehouse-bottle-bulk-tools')).length, 1);
    assert.equal((await domElements(html, '[data-act="warehouse-bottles-assign-selected"]')).length, 1);
    assert.ok((await domElements(html, '[data-unassigned-id="b1"]')).length > 0);
  }
);

test(
  'search is inline between bottle count and pager, and the input value survives pagination',
  async () => {
    const warehouse = inventory(50);
    const html = renderUnassignedTrayPage(warehouse, [], {
      query: 'Whisky 00',
      page: 2,
    });
    const count = await domIndex(html, '.warehouse-unassigned-page-summary');
    const search = await domIndex(html, '[id="warehouse-unassigned-wall-search"]');
    const controls = await domIndex(html, '.warehouse-unassigned-page-controls');
    assert.ok(count !== -1 && count < search && search < controls);
    assert.ok((await domElements(html, '[value="Whisky 00"]')).length > 0);
    await assertDom(html, ".warehouse-unassigned-search-footer", {}, true);
  }
);
