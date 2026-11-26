import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {findWarehouseBottles} from '../../public/js/domain/warehouse-finder.js';
import {renderWarehouseFinder, renderWarehouseFinderResults}
  from '../../public/js/views/warehouse-finder.js';
import {renderWarehouseRoomWall}
  from '../../public/js/views/warehouse-room-wall.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

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
  assignments: Object.fromEntries(renderedText(bottles).slice(0, 8).map(b => [b.id, 's'])),
};

test(
  'finder matches inventory numbers, accented names, locations and multiple terms without grouping physical bottles',
  () => {
    assert.equal(renderedText(findWarehouseBottles(warehouse, {query: 'glenfarclas'}).total), 8);
    assert.equal(renderedText(findWarehouseBottles(warehouse, {query: '#104'}).items[0].bottle.id), 'b5');
    assert.equal(renderedText(findWarehouseBottles(warehouse, {query: 'vitrine Fach 2'}).total), 8);
    assert.equal(renderedText(findWarehouseBottles(warehouse, {query: 'glenfarclas Fach 2'}).total), 8);
    assert.equal(renderedText(findWarehouseBottles(warehouse, {query: 'glenfarclas', placement: 'unassigned'}).total), 0);
    assert.equal(renderedText(findWarehouseBottles(warehouse, {placement: 'unassigned'}).items[0].bottle.id), 'b9');
    assert.equal(renderedText(findWarehouseBottles(warehouse, {placement: 'assigned'}).total), 8);
    assert.equal(renderedText(findWarehouseBottles(warehouse, {placement: 'invalid'}).total), 9);
  }
);

test('finder pagination returns bounded pages and stable counts', () => {
  const page = findWarehouseBottles(warehouse, {page: 3, pageSize: 3});
  assert.equal(renderedText(page.total), 9);
  assert.equal(renderedText(page.pages), 3);
  assert.equal(renderedText(page.page), 3);
  assert.equal(page.items.length, 3);
  assert.equal(renderedText(findWarehouseBottles(warehouse, {page: 99, pageSize: 3}).page), 3);
  assert.equal(renderedText(findWarehouseBottles(warehouse, {query: 'absent'}).total), 0);
});

test(
  'finder cards show location action only when assigned and safely escape display data',
  () => {
    const html = renderWarehouseFinder({
      query: '<script>',
      placement: 'all',
      results: findWarehouseBottles(warehouse),
    });
    assert.match(renderedText(html), /value="&lt;script&gt;"/);
    assert.equal((renderedText(html).match(/data-act="warehouse-find-location"/g) || []).length, 8);
    assert.equal((renderedText(html).match(/data-act="warehouse-assign"/g) || []).length, 9);
    assert.match(renderedText(html), /Islay &lt;strong&gt;/);
    assert.match(renderedText(html), /Lagerort zuweisen/);
    assert.match(renderedText(html), /Whiskyzimmer \/ Vitrine links \/ Fach 2/);
    const paged = renderWarehouseFinderResults(findWarehouseBottles(warehouse, {page: 1, pageSize: 3}));
    assert.match(renderedText(paged), /warehouse-find-next/);
    assert.match(renderedText(paged), /9 Flaschen gefunden/);
  }
);

test(
  'a bottle beyond the wall preview limit is visible and individually highlighted when found',
  () => {
    const ordinary = renderWarehouseRoomWall(warehouse.rooms[0], warehouse, []);
    assert.doesNotMatch(renderedText(ordinary), /data-id="b8"/);
    const focused = renderWarehouseRoomWall(warehouse.rooms[0], warehouse, [], {focusBottleId: 'b8'});
    assert.match(renderedText(focused), /class="warehouse-wall-bottle is-find-focus"/);
    assert.match(renderedText(focused), /class="warehouse-wall-bottle is-find-dimmed"/);
    assert.match(renderedText(focused), /data-id="b8"/);
    assert.match(renderedText(focused), /warehouse-wall-bay is-find-focus/);
    assert.equal((renderedText(focused).match(/class="warehouse-wall-bottle/g) || []).length,
      (renderedText(ordinary).match(/class="warehouse-wall-bottle/g) || []).length);
  }
);

test(
  'finder navigation preserves query, filter and pagination when returning from focused shelf',
  () => {
    const extended = {
      ...warehouse, bottles: [...warehouse.bottles,
      ...Array.from(
        {length: 28},
        (_, i) => ({
          id: `extra-${i}`,
          name: `Glenfarclas Extra ${i}`,
          number: String(300 + i),
        })
      )],
      assignments: {
        ...warehouse.assignments,
        ...Object.fromEntries(Array.from({length: 28}, (_, i) => [`extra-${i}`, 's'])),
      },
    };
    const state = {
      warehouse: extended,
      page: 'warehouse',
      selected: 'find',
      warehouseSearch: 'glenfarclas',
      warehouseFinderPlacement: 'assigned',
      warehouseFinderPage: 2,
      warehouseRoomId: null,
      warehouseFurnitureId: null,
      warehouseSelectedBottleIds: [],
    };
    let html = '';
    let view;
    const originalDocument = globalThis.document;
    globalThis.document = {
      /**
       * Simulates an element lookup that finds nothing.
       * @return {null} Null to represent a missing element.
       */
      querySelector: () => null,
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
      /**
       * Retrieves element by id from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getElementById: () => null,
    };
    try {
      view = createWarehouseView({
        state,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Page content passed by the view.
         */
        shell: content => {html = content;},
        /**
         * Updates the navigate state for its caller.
         *
         * @param {*} page Page or view being rendered or selected.
         * @param {*} selected Currently selected item or identifier.
         */
        navigate: (page, selected) => {
          state.page = page; state.selected = selected; view.render();
        },
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.showBottleLocation('b8');
      assert.equal(renderedText(state.selected), 'shelves');
      assert.equal(renderedText(state.warehouseRoomId), 'r');
      assert.equal(renderedText(state.warehouseFurnitureId), 'f');
      assert.match(renderedText(html), /class="warehouse-wall-bottle is-find-focus"/);
      assert.match(renderedText(html), /class="warehouse-wall-bottle is-find-dimmed"/);
      assert.match(renderedText(html), /data-act="warehouse-return-find"/);
      assert.match(renderedText(html), /data-act="warehouse-find-clear"/);
      view.returnToFinder();
      assert.equal(renderedText(state.selected), 'find');
      assert.equal(renderedText(state.warehouseSearch), 'glenfarclas');
      assert.equal(renderedText(state.warehouseFinderPlacement), 'assigned');
      assert.equal(renderedText(state.warehouseFinderPage), 2);
      assert.doesNotMatch(renderedText(html), /warehouse-bottle-check/);
      assert.doesNotMatch(renderedText(html), /data-act="warehouse-return-find"/);
    } finally {
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    }
  }
);

test(
  'detail-page storage link highlights the same shelf and bottle and returns to its bottling',
  () => {
    const state = {
      warehouse,
      page: 'detail',
      selected: 'release-8',
      warehouseSelectedBottleIds: [],
      warehouseFindReturn: false,
      warehouseFindFocusBottleId: null,
      warehouseFindReturnBottlingId: null,
    };
    let html = '';
    const navigation = [];
    let view;
    const previousDocument = globalThis.document;
    globalThis.document = {
      /**
       * Simulates an element lookup that finds nothing.
       * @return {null} Null to represent a missing element.
       */
      querySelector: () => null,
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
      /**
       * Retrieves element by id from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getElementById: () => null,
    };
    try {
      view = createWarehouseView({
        state,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Page content passed by the view.
         */
        shell: content => {html = content;},
        /**
         * Updates the navigate state for its caller.
         *
         * @param {*} page Page or view being rendered or selected.
         * @param {*} selected Currently selected item or identifier.
         * @param {*} options Options controlling the operation.
         */
        navigate: (page, selected, options) => {
          navigation.push({page, selected, options});
          state.page = page; state.selected = selected;
          if (page === 'warehouse') view.render();
        },
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.showBottleLocation('b8', {returnToBottlingId: 'release-8'});
      assert.deepEqual(navigation.at(-1), {page: 'warehouse', selected: 'shelves', options: undefined});
      assert.equal(renderedText(state.warehouseRoomId), 'r');
      assert.equal(renderedText(state.warehouseFurnitureId), 'f');
      assert.equal(renderedText(state.warehouseFindFocusBottleId), 'b8');
      assert.match(renderedText(html), /warehouse-wall-bay is-find-focus/);
      assert.match(renderedText(html), /class="warehouse-wall-bottle is-find-focus"/);
      assert.match(renderedText(html), /class="warehouse-wall-bottle is-find-dimmed"/);
      assert.match(renderedText(html), /Zurück zur Abfüllung/);
      assert.match(renderedText(html), /data-act="warehouse-find-clear"/);
      view.returnToFinder();
      assert.deepEqual(
        navigation.at(-1),
        {
          page: 'detail',
          selected: 'release-8',
          options: {highlightBottleId: 'b8'},
        }
      );
      assert.equal(renderedText(state.warehouseFindReturn), false);
      assert.equal(renderedText(state.warehouseFindFocusBottleId), null);
      assert.equal(renderedText(state.warehouseFindReturnBottlingId), null);
    } finally {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    }
  }
);

test(
  'closing the finder banner removes both shelf and bottle highlights without navigation',
  () => {
    const state = {
      warehouse,
      page: 'warehouse',
      selected: 'find',
      warehouseSearch: 'glenfarclas',
      warehouseFinderPlacement: 'assigned',
      warehouseFinderPage: 1,
      warehouseSelectedBottleIds: [],
    };
    let html = '';
    let view;
    const removedClasses = [];
    const banner = {
      /**
       * Updates the remove state for its caller.
       */
      remove() {this.removed = true;},
    };
    const wall = {
      classList: {
        /**
         * Updates the remove state for its caller.
         *
         * @param {!Array<*>} names Value used by this operation.
         */
        remove(...names) {removedClasses.push(['wall', ...names]);},
      },
    };
    const bay = {
      classList: {
        /**
         * Updates the remove state for its caller.
         *
         * @param {!Array<*>} names Value used by this operation.
         */
        remove(...names) {removedClasses.push(['bay', ...names]);},
      },
    };
    const focused = {
      classList: {
        /**
         * Updates the remove state for its caller.
         *
         * @param {!Array<*>} names Value used by this operation.
         */
        remove(...names) {removedClasses.push(['bottle', ...names]);},
      },
    };
    const dimmed = {
      classList: {
        /**
         * Updates the remove state for its caller.
         *
         * @param {!Array<*>} names Value used by this operation.
         */
        remove(...names) {removedClasses.push(['dimmed', ...names]);},
      },
    };
    const originalDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelector(selector) {
        if (selector === '.warehouse-find-return') return banner;
        if (selector === '.warehouse-room-wall.has-find-focus') return wall;
        return null;
      },
      /**
       * Derives the query selector all result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll(selector) {
        if (renderedText(selector).includes('.warehouse-wall-bay.is-find-focus')) return [
          bay, focused, dimmed];
        return [];
      },
    };
    try {
      view = createWarehouseView({
        state,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Page content passed by the view.
         */
        shell: content => {html = content;},
        /**
         * Updates the navigate state for its caller.
         *
         * @param {*} page Page or view being rendered or selected.
         * @param {*} selected Currently selected item or identifier.
         */
        navigate: (page, selected) => {
          state.page = page; state.selected = selected; view.render();
        },
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.showBottleLocation('b1');
      assert.equal(renderedText(state.selected), 'shelves');
      assert.match(renderedText(html), /data-act="warehouse-find-clear"/);
      view.clearFindFocus();
      assert.equal(renderedText(state.selected), 'shelves', 'the shelf view stays open');
      assert.equal(renderedText(state.warehouseFindReturn), false);
      assert.equal(renderedText(state.warehouseFindFocusBottleId), null);
      assert.equal(renderedText(banner.removed), true);
      assert.ok(removedClasses.some(([which, name]) => which === 'wall' && name === 'has-find-focus'));
      assert.ok(removedClasses.some(([which, name]) => which === 'bay' && name === 'is-find-focus'));
      assert.ok(removedClasses.some(([which, , name]) => which === 'dimmed' && name === 'is-find-dimmed'));
      assert.equal(renderedText(state.warehouseSearch), 'glenfarclas');
      assert.equal(renderedText(state.warehouseFinderPlacement), 'assigned');
    } finally {
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    }
  }
);

test(
  'narrow shelves reserve a separate overflow slot and keep the focused bottle visible',
  () => {
    const narrow = structuredClone(warehouse);
    narrow.rooms[0].furniture[0].width = 0.7;
    narrow.rooms[0].furniture[0].itemHeight = 0.48;
    const html = renderWarehouseRoomWall(narrow.rooms[0], narrow, [], {focusBottleId: 'b8'});
    // Every bottle slot plus the +N badge must fit within the physical bay.
    const preview = renderedText(html).match(
      new RegExp('data-shelf-id="s"[\\s\\S]*?<div class="war' + 'ehouse-bottle-silhouettes">([\\s\\S]*?)<\\' + '/div>'))?.[1] || '';
    const visibleIds = [...renderedText(preview).matchAll(/data-act="warehouse-bottle-select" data-id="(b\d+)"/g)].map(match => match[1]);
    const slotWidth = Number(renderedText(html).match(/--wall-bottle-width:([\d.]+)px/)?.[1]);
    assert.ok(visibleIds.length > 0 && visibleIds.length < 5);
    assert.ok(visibleIds.length * (slotWidth + 2) + 27 <= 0.7 * 230 - 22);
    assert.ok(renderedText(visibleIds).includes('b8'), 'a bottle beyond the preview limit remains the focus');
    assert.match(renderedText(html), new RegExp(`warehouse-shelf-overflow[^>]*>\\+${8 - visibleIds.length}<\\/span>`));
    assert.doesNotMatch(renderedText(html), /warehouse-find-bottle-badge/);
    assert.match(renderedText(html), /class="warehouse-room-wall has-find-focus"/);
    // 0.48m shelf -> 110.4px. The preview height must not consume its title +
    // rail.
    const height = Number(renderedText(html).match(/--wall-bottle-height:([\d.]+)px/)?.[1]);
    assert.ok(height > 0 && height < 74, 'photo height fits the label and shelf frame');
  }
);
