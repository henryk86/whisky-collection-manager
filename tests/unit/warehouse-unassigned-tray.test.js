import {renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {unassignedWallPage, UNASSIGNED_WALL_PAGE_SIZE}
  from '../../public/js/domain/warehouse-unassigned-tray.js';
import {renderUnassignedTray, renderUnassignedTrayPage}
  from '../../public/js/views/warehouse-unassigned-tray.js';
import {renderWarehouseRoomWall}
  from '../../public/js/views/warehouse-room-wall.js';

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
  () => {
    const warehouse = inventory(2502);
    const first = unassignedWallPage(warehouse);
    assert.equal(renderedText(first.total), 2500);
    assert.equal(first.items.length, renderedText(UNASSIGNED_WALL_PAGE_SIZE));
    assert.equal(renderedText(first.pages), Math.ceil(2500 / UNASSIGNED_WALL_PAGE_SIZE));
    assert.equal(renderedText(first.items[0].id), 'b1');
    const last = unassignedWallPage(warehouse, {page: 100000});
    assert.equal(renderedText(last.page), renderedText(last.pages));
    assert.ok(last.items.length > 0 && last.items.length <= UNASSIGNED_WALL_PAGE_SIZE);
    assert.ok(last.items.every(item => item.id !== 'b0' && item.id !== 'b10'));
    const pageHtml = renderUnassignedTrayPage(warehouse);
    assert.equal((renderedText(pageHtml).match(/data-unassigned-id=/g) || []).length, renderedText(UNASSIGNED_WALL_PAGE_SIZE));
    assert.equal(domElements(pageHtml, '[data-unassigned-id="b0"]').length, 0);
    assert.doesNotMatch(renderedText(pageHtml), /data-shelf-id=/, 'staging must not pretend to be a real target shelf');
  }
);

test(
  'unassigned search is case insensitive and pagination clamps when results shrink',
  () => {
    const warehouse = inventory(500);
    const matches = unassignedWallPage(warehouse, {
      query: 'whisky 004',
      page: 9,
    });
    assert.equal(renderedText(matches.page), 1);
    assert.ok(matches.items.length > 0);
    assert.ok(matches.items.every(bottle => bottle.name.toLowerCase().includes('whisky 004')));
    const byNumber = unassignedWallPage(warehouse, {query: 'inv-111'});
    assert.deepEqual(byNumber.items.map(item => item.id), ['b111']);
    assert.equal(unassignedWallPage(warehouse, {query: 'nonexistent'}).items.length, 0);
    assert.equal(renderedText(unassignedWallPage(warehouse, {query: 'nonexistent'}).pages), 1);
  }
);

test(
  'unassigned staging uses existing bottle selection and safely escapes labels',
  () => {
    const warehouse = {
      bottles: [{id: 'unsafe', name: '<script>alert(1)</script>', number: '123'}, {id: 'placed', name: 'Placed'},], assignments: {placed: 'shelf'},
    };
    const html = renderUnassignedTray(warehouse, ['unsafe']);
    assert.match(renderedText(html), /warehouse-unassigned-bottle warehouse-wall-bottle is-selected/);
    assert.ok(domElements(html, '[data-act="warehouse-bottle-select"][data-id="unsafe"][aria-pressed="true"]').length > 0);
    assert.match(renderedText(html), /&lt;script&gt;/);
    assert.equal(domElements(html, 'script').length, 0);
    assert.equal(domElements(html, '[data-id="placed"]').length, 0);
    assert.ok(domElements(html, '[data-act="warehouse-unassigned-next"][disabled]').length > 0);
  }
);

test(
  'room wall offers the unassigned shelf without adding furniture or duplicating bottle locations',
  () => {
    const warehouse = inventory(40);
    const room = {
      id: 'r', name: 'Room', furniture: [{
        id: 'f', name: 'Shelf', x: 0, y: 0, width: 1, depth: .5, itemHeight: 1,
        shelves: [{id: 's0', name: 'Compartment', capacity: 50}],
      }],
    };
    const html = renderWarehouseRoomWall(room, warehouse, [], {page: 2});
    assert.equal(
      (renderedText(html).match(new RegExp('class="warehouse-unassigned-tray warehouse' + '-unassigned-tray--embedded"', 'g')) || []).length,
      1
    );
    assert.equal(domElements(html, '[class="warehouse-bottle-bulk-tools"]').length, 1);
    assert.equal(domElements(html, '[class="warehouse-wall-controls"]').length, 1);
    assert.match(
      renderedText(html),
      new RegExp(
        'class="warehouse-unassigned-toggle"[^>]*ar' + 'ia-controls="warehouse-wall-unassigned-con' +
        'tent"[^>]*aria-expanded="false"'
      )
    );
    assert.ok(domElements(html, '[id="warehouse-wall-unassigned-content"][hidden]').length > 0);
    assert.equal((renderedText(html).match(/warehouse-unassigned-summary/g) || []).length, 0, 'no redundant collapsed header');
    assert.ok(domElements(html, '[data-unassigned-id="b26"]').length > 0);
    assert.equal(domElements(html, '[data-unassigned-id="b0"]').length, 0);
    assert.equal((renderedText(html).match(/data-shelf-id=/g) || []).length, 1);
    assert.ok(domElements(html, '[data-shelf-id="s0"]').length > 0);
    assert.equal(domElements(html, '[class="warehouse-wall-scroll"]').length, 1);
    const emptyRoom = renderWarehouseRoomWall({id: 'r2', name: 'Empty room', furniture: []}, warehouse);
    assert.ok(domElements(emptyRoom, '[class="warehouse-unassigned-tray warehouse-unassigned-tray--embedded"]').length > 0);
    assert.match(renderedText(emptyRoom), /noch keine Möbel mit Fächern/);
  }
);

test(
  'wall combines unassigned disclosure and selected-bottle actions into one compact header',
  () => {
    const warehouse = {
      bottles: [{id: 'b1', name: 'One'}, {id: 'b2', name: 'Two'}],
      assignments: {},
    };
    const room = {id: 'room', name: 'Room', furniture: []};
    const html = renderWarehouseRoomWall(room, warehouse, ['b1'], {expanded: true});
    assert.ok(domElements(html, '[class="warehouse-wall-controls"]').length > 0);
    assert.match(renderedText(html), /1 Flaschen ausgewählt/);
    assert.match(renderedText(html), /Nicht zugeordnet \(2\)/);
    assert.ok(domElements(html, '[class="warehouse-unassigned-toggle"][aria-expanded="true"]').length > 0);
    assert.equal(domElements(html, '[id="warehouse-wall-unassigned-content"][hidden]').length, 0);
    assert.equal((renderedText(html).match(/warehouse-bottle-bulk-tools/g) || []).length, 1);
    assert.equal(domElements(html, '[data-act="warehouse-bottles-assign-selected"]').length, 1);
    assert.ok(domElements(html, '[data-unassigned-id="b1"]').length > 0);
  }
);


test(
  'search is inline between bottle count and pager, and the input value survives pagination',
  () => {
    const warehouse = inventory(50);
    const html = renderUnassignedTrayPage(warehouse, [], {
      query: 'Whisky 00',
      page: 2,
    });
    const count = renderedText(html).indexOf('class="warehouse-unassigned-page-summary"');
    const search = renderedText(html).indexOf('id="warehouse-unassigned-wall-search"');
    const controls = renderedText(html).indexOf('class="warehouse-unassigned-page-controls"');
    assert.ok(count !== -1 && count < search && search < controls);
    assert.ok(domElements(html, '[value="Whisky 00"]').length > 0);
    assert.doesNotMatch(renderedText(html), /warehouse-unassigned-search-footer/);
  }
);
