import {domElements, domText, domMatches, domIndex, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

const room = {
  id: 'room', name: 'Zimmer', width: 5, height: 4, furniture: [
    {
      id: 'cabinet',
      name: 'Schrank',
      type: 'schrank',
      x: 0.5,
      y: 0.3,
      width: 1.8,
      depth: 0.7,
      rotation: 0,
      elevation: 0,
      itemHeight: 1.8,
      shelves: [],
    },
    {
      id: 'wall',
      name: 'Hängeregal',
      type: 'haengeregal',
      x: 0.5,
      y: 0.3,
      width: 1.8,
      depth: 0.7,
      rotation: 0,
      elevation: 1.9,
      itemHeight: 0.4,
      shelves: [{id: 's1', name: 'Oben'}],
    },
    {
      id: 'rack',
      name: 'Regal',
      type: 'regal',
      x: 3,
      y: 1.5,
      width: 1.5,
      depth: 0.5,
      rotation: 90,
      elevation: 0,
      itemHeight: 1.9,
      shelves: [{id: 's2', name: 'Fach 1'}, {id: 's3', name: 'Fach 2'}],
    },
  ],
};

const warehouse = {
  rooms: [room], bottles: [{id: 'b1'}], assignments: {b1: 's2', },
};

test(
  '3D is mounted lazily in the warehouse page, with no SVG/2D regression',
  async () => {
    let html = ''; const state = {
      warehouse,
      selected: 'rooms',
      warehouseRoomId: room.id,
      warehousePlanMode: '2d',
    };
    const old = globalThis.document;
    globalThis.document = {
      /**
       * Simulates an element lookup that finds nothing.
       * @return {null} Null to represent a missing element.
       */
      querySelector: () => null,
    };
    try {
      const view = createWarehouseView({
        state,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
         */
        shell: value => {html = value;},
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
      view.render(); assert.ok((await domElements(html, '[class="warehouse-floor"]')).length > 0);
      state.warehousePlanMode = '3d'; view.render(); assert.ok((await domElements(html, '[class="warehouse-three-viewport"]')).length > 0);
      assert.equal((await domElements(html, '[class="warehouse-isometric"]')).length, 0);
      assert.equal((await domElements(html, '[data-act="warehouse-camera"]')).length, 4);
      assert.equal((await domElements(html, '[data-act="warehouse-visibility-toggle"]')).length, 3);
      assert.equal((await domElements(html, '.warehouse-bulk-item')).length, 3, 'only one furniture list');
      assert.equal((await domMatches(html, ".warehouse-iso-number, .warehouse-iso-legend-items")), false);
      assert.equal(view.update3DZoom(150), false);
    } finally {
      if (old === undefined) delete globalThis.document; else globalThis.document = old;
    }
  }
);

test(
  'warehouse multi-edit selection panel and optional properties are wired for the current room',
  async () => {
    let html = ''; let form = ''; const state = {
      warehouse,
      selected: 'shelves',
      warehouseRoomId: room.id,
      warehousePlanMode: '2d',
      warehouseSelectedFurnitureIds: [],
    };
    const before = JSON.stringify(warehouse);
    const previous = globalThis.document;
    globalThis.document = {
      /**
       * Simulates an element lookup that finds nothing.
       * @return {null} Null to represent a missing element.
       */
      querySelector: () =>
        null,
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
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} output Page content passed by the view.
         * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
         */
        shell: output => html = output,
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate: () => {},
        modal: {
          /**
           * Captures the dialog body without mounting the modal overlay.
           *
           * @param {string} _title Dialog title ignored by this fixture.
           * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Dialog content captured for assertions.
           * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured dialog content.
           */
          showModal: (_title, content) => form = content,
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      await assertDom(html, ".warehouse-bulk-check", {}, true, 'no furniture editor duplicates the shelf wall');
      view.openFurnitureBulkManager();
      assert.equal((await domElements(form, '[class="warehouse-bulk-pick"]')).length, 3);
      await assertDom(form, ".warehouse-furniture-panel", {}, true);
      assert.ok((await domElements(form, '[data-act="warehouse-bulk-edit"][disabled]')).length > 0);
      assert.ok((await domElements(form, '[data-act="warehouse-bulk-delete"][disabled]')).length > 0);
      view.toggleFurnitureSelection('cabinet', true);
      view.toggleFurnitureSelection('rack', true);
      view.openFurnitureBulkManager();
      assert.match(await domText(form), /2 von 3 ausgewählt/);
      assert.equal((await domElements(form, '[aria-pressed="true"]')).length, 2);
      assert.ok((await domElements(form, '[data-act="warehouse-bulk-delete"]')).length > 0);
      view.askBulkDelete();
      assert.match(await domText(form), /2 Lagermöbel wirklich löschen/);
      view.openForm('furniture-bulk');
      assert.ok((await domElements(form, '[data-endpoint="/api/warehouse/furniture/bulk"]')).length > 0);
      for (const name of [
        'rotation',
        'elevation',
        'itemHeight',
        'width',
        'depth',
        'leftSidePanel',
        'rightSidePanel',
        'backPanel',
      ]) await assertDom(form, `[name="${name}"]`);
      await assertDom(form, "[name^=\"apply-\"]", {}, true);
      assert.match(await domText(form), /Leere Felder bleiben unverändert/);
      view.clearFurnitureSelection();
      assert.deepEqual(state.warehouseSelectedFurnitureIds, []);
      view.selectAllFurniture();
      assert.equal(state.warehouseSelectedFurnitureIds.length, 3);
      state.selected = 'shelves'; view.render();
      view.openFurnitureBulkManager();
      assert.equal((await domElements(form, '[class="warehouse-bulk-pick"]')).length, 3);
      await assertDom(form, ".warehouse-furniture-panel", {}, true);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
    }
    assert.equal(JSON.stringify(warehouse), before, 'selection must not edit the warehouse until a save action');
  }
);

test(
  'room plan furniture selection highlights layout without opening shelf details or scrolling',
  async () => {
    const originalDocument = globalThis.document, originalWindow = globalThis.window;
    let html = '', scrolls = 0, navigations = 0, replaced = '';
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: selector => selector === '.warehouse-furniture-panel' ?
        {
          /**
           * Updates the scroll into view state for its caller.
           *
           * @param {*} options Options controlling the operation.
           */
          scrollIntoView: options => {
            assert.equal(options.block, 'start');
            assert.equal(options.behavior, 'instant');
            scrolls++;
          },
        } : null,
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
    };
    globalThis.window = {
      history: {
        /**
         * Updates the replace state state for its caller.
         *
         * @param {*} _state Value used by this operation.
         * @param {string} _title Value used by this operation.
         * @param {*} url URL of the resource being processed.
         */
        replaceState: (_state, _title, url) => {replaced = url;},
      },
    };
    const state = {
      warehouse,
      selected: 'rooms',
      warehouseRoomId: room.id,
      warehousePlanMode: '2d',
    };
    try {
      const view = createWarehouseView({
        state,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
         */
        shell: value => {html = value;},
        /**
         * Updates the navigate state for its caller.
         */
        navigate: () => {navigations++;},
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.selectFurniture('rack');
      assert.equal(state.warehouseFurnitureId, 'rack');
      assert.equal(state.selected, 'rooms');
      assert.equal(navigations, 0);
      assert.equal(scrolls, 0);
      assert.match(replaced, /section=rooms.*furniture=rack/);
      assert.equal((await domMatches(html, ".warehouse-furniture-panel, .warehouse-room-wall")), false);
      assert.equal((await domElements(html, '.warehouse-bulk-item')).length, 3);
      await assertDom(html, ".warehouse-room-card", {}, true);
    } finally {
      if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
      if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    }
  }
);

test(
  'room plans default to 3D while a deliberate 2D selection keeps the floor plan',
  async () => {
    let html = '';
    const original = globalThis.document;
    globalThis.document = {
      /**
       * Simulates an element lookup that finds nothing.
       * @return {null} Null to represent a missing element.
       */
      querySelector: () =>
        null,
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
    };
    try {
      const state = {warehouse, selected: 'rooms', warehouseRoomId: room.id};
      const view = createWarehouseView({
        state,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
         */
        shell: markup => {html = markup;},
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
      assert.ok((await domElements(html, '[class="warehouse-three-viewport"]')).length > 0);
      assert.ok((await domElements(html, '[data-mode="3d"][class="btn small primary"][aria-pressed="true"]')).length > 0);
      assert.equal((await domElements(html, '[class="warehouse-eye-icon"]')).length, room.furniture.length);
      assert.equal((await domElements(html, '[data-act="warehouse-visibility-toggle"]')).length, room.furniture.length);
      assert.equal((await domMatches(html, "[data-act=\"warehouse-iso-clear\"]")) || (await domMatches(html, "*", {"text": new RegExp("^Freistellen$")})) || (await domMatches(html, "*", {"text": new RegExp("^Alle zeigen$")})), false);
      await assertDom(html, "[aria-pressed=\"true\"][title=\"Schrank ausblenden\"][aria-label=\"Schrank ausblenden\"]");
      const selectedId = state.warehouseFurnitureId;
      assert.equal(view.toggleFurnitureVisibility('cabinet'), false);
      assert.deepEqual(state.warehouseHiddenFurnitureIds, ['cabinet']);
      assert.equal(state.warehouseFurnitureId, selectedId, 'toggle must not select furniture');
      view.render();
      await assertDom(html, "[aria-pressed=\"false\"][title=\"Schrank einblenden\"][aria-label=\"Schrank einblenden\"]");
      assert.ok((await domElements(html, '[aria-pressed="true"][title="Regal ausblenden"]')).length > 0);
      assert.equal(view.toggleFurnitureVisibility('wall'), false);
      assert.deepEqual(
        state.warehouseHiddenFurnitureIds,
        ['cabinet', 'wall'],
        'multiple pieces can be hidden independently'
      );
      assert.equal(view.toggleFurnitureVisibility('cabinet'), true);
      assert.deepEqual(state.warehouseHiddenFurnitureIds, ['wall']);
      state.warehousePlanMode = '2d'; view.render();
      assert.ok((await domElements(html, '[class="warehouse-floor"]')).length > 0);
      assert.equal((await domElements(html, '[data-act="warehouse-visibility-toggle"]')).length, 0);
    } finally {
      if (original === undefined) delete globalThis.document; else globalThis.document = original;
    }
  }
);

test(
  '3D furniture controls share a compact workspace with the room and provide one show-all action',
  async () => {
    let html = '';
    const original = globalThis.document;
    globalThis.document = {
      /**
       * Simulates an element lookup that finds nothing.
       * @return {null} Null to represent a missing element.
       */
      querySelector: () =>
        null,
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
    };
    try {
      const state = {
        warehouse,
        selected: 'rooms',
        warehouseRoomId: room.id,
        warehouseHiddenFurnitureIds: ['cabinet', 'rack'],
      };
      const view = createWarehouseView({
        state,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
         */
        shell: markup => {html = markup;},
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
      assert.ok((await domElements(html, '[class="warehouse-plan-workspace"]')).length > 0);
      assert.ok((await domElements(html, '[class="warehouse-plan-stage"]')).length > 0);
      assert.ok((await domElements(html, '[class="warehouse-bulk-panel warehouse-bulk-panel--sidebar"]')).length > 0);
      assert.ok((await domElements(html, '[data-act="warehouse-show-all"]')).length > 0);
      assert.equal((await domElements(html, '[data-act="warehouse-show-all"]')).length, 1);
      assert.equal((await domElements(html, 'button.btn.small.warehouse-show-all[data-act="warehouse-show-all"]'))[0].text.trim(), 'Alle einblenden');
      assert.ok(await domIndex(html, '.warehouse-plan-stage') < await domIndex(html, '.warehouse-bulk-panel--sidebar'));
      assert.equal((await domElements(html, '.warehouse-bulk-item')).length, 3);
      const previousSelection = state.warehouseFurnitureId;
      const selectedIds = state.warehouseSelectedFurnitureIds = ['wall'];
      assert.equal(view.showAllFurniture(), 2);
      assert.deepEqual(state.warehouseHiddenFurnitureIds, []);
      assert.equal(state.warehouseFurnitureId, previousSelection);
      assert.deepEqual(state.warehouseSelectedFurnitureIds, selectedIds);
      assert.equal(view.showAllFurniture(), 0, 'show all is idempotent');
      view.render();
      assert.equal((await domElements(html, 'button.btn.small.warehouse-show-all[data-act="warehouse-show-all"][disabled]'))[0].text.trim(), 'Alle einblenden');
      state.warehousePlanMode = '2d'; view.render();
      assert.equal((await domMatches(html, ".warehouse-plan-workspace, .warehouse-show-all, [data-act=\"warehouse-show-all\"]")), false);
    } finally {
      if (original === undefined) delete globalThis.document; else globalThis.document = original;
    }
  }
);

test(
  '3D room-plan double-click opens only occupied shelf contents in place, never furniture editing',
  async () => {
    const room = {
      id: 'room', name: 'Raum', furniture: [{
        id: 'rack', name: 'Regal', shelves: [
          {id: 'occupied', name: 'Unten', capacity: 4},
          {id: 'empty', name: 'Oben', capacity: 4},
          {id: 'blocked', name: 'Gesperrt', capacity: 0},
        ],
      }],
    };
    const warehouse = {
      rooms: [room],
      assignments: {b: 'occupied'},
      bottles: [{id: 'b', name: 'Flasche', number: '27'}],
    };
    const state = {
      warehouse,
      selected: 'rooms',
      warehouseRoomId: 'room',
      warehouseFurnitureId: null,
    };
    const modals = []; const navigation = [];
    const view = createWarehouseView({
      state,
      /**
       * Discards page content in this scenario; no real DOM is mounted.
       */
      shell: () => {},
      /**
       * Derives the navigate result from the supplied values.
       *
       * @param {!Array<*>} args Arguments forwarded to the operation.
       * @return {number} Calculated numeric value.
       */
      navigate: (...args) => navigation.push(args),
      modal: {
        /**
         * Renders modal in the current view.
         *
         * @param {!Array<*>} args Arguments forwarded to the operation.
         * @return {number} Calculated numeric value.
         */
        showModal: (...args) => modals.push(args),
      },
      /**
       * Performs the refresh lifecycle action.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      refresh: async () => {},
    });
    assert.equal(view.openOccupiedShelfDetails('empty'), false);
    assert.equal(view.openOccupiedShelfDetails('blocked'), false);
    assert.equal(view.openOccupiedShelfDetails('missing'), false);
    assert.deepEqual(modals, []);
    assert.equal(view.openOccupiedShelfDetails('occupied'), true);
    assert.equal(modals.length, 1);
    assert.equal(modals[0][0], 'Raum / Regal / Unten');
    assert.match(await domText(modals[0][1]), /Flasche/);
    await assertDom(modals[0][1], ".warehouse-shelf-detail-grid");
    assert.equal(state.selected, 'rooms');
    assert.equal(state.warehouseFurnitureId, null);
    assert.deepEqual(navigation, []);
  }
);
