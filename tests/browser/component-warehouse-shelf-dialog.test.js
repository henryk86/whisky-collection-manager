import {domElements, domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWarehouseRoomWall} from '../../public/js/views/warehouse-room-wall.js';
import {shelfContents} from '../../public/js/views/warehouse-shelf-details.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

/**
 * Transforms the entries used by warehouse.
 * @return {!Array<*>} Resulting entries in their output order.
 */
function warehouse() {
  const room = {
    id: 'r', name: 'Room', width: 4, height: 4, furniture: [{
      id: 'f',
      name: 'Cabinet',
      type: 'regal',
      x: 0,
      y: 0,
      width: .5,
      depth: .4,
      rotation: 0,
      itemHeight: 1.5,
      shelves: [{id: 's', name: 'Shelf', capacity: 20}],
    }],
  };
  const bottles = Array.from(
    {length: 15},
    (_, i) => ({
      id: `b${i}`,
      name: `Whisky ${i}`,
      number: `I-${i}`,
      ageYears: 12,
      releaseYear: 2020,
      caskType: 'Sherry',
    })
  );
  return {
    schemaVersion: 1,
    rooms: [room],
    bottles,
    assignments: Object.fromEntries(bottles.map(b => [b.id, 's'])),
  };
}

test(
  'a narrow shelf only shows one front row and no internal horizontal scrollbar, modal shows all 15 bottles',
  async () => {
    const w = warehouse();
    const html = renderWarehouseRoomWall(w.rooms[0], w);
    assert.equal((await domElements(html, '[data-act="warehouse-bottle-select"]')).length < 6, true);
    assert.ok((await domElements(html, '[data-act="warehouse-shelf-view"]')).length > 0);
    await assertDom(html, ".warehouse-shelf-overflow");
    const contents = shelfContents(w, 's');
    assert.equal(contents.count, 15);
    assert.equal((await domElements(contents.html, '.warehouse-shelf-detail-bottle')).length, 15);
    assert.match(await domText(contents.html), /I-0/);
    assert.match(await domText(contents.html), /Sherry/);
    assert.equal(shelfContents(w, 'missing'), null);
  }
);

test(
  'furniture dialog uses bottle previews and opens the shelf modal by compartment double-click',
  async () => {
    const w = warehouse();
    const forms = [];
    const state = {
      warehouse: w,
      selected: 'shelves',
      warehouseRoomId: 'r',
      warehouseFurnitureId: 'f',
    };
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
         * Discards page content in this scenario; no real DOM is mounted.
         */
        shell: () => {},
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate: () => {},
        modal: {
          /**
           * Renders modal in the current view.
           *
           * @param {*} title Title displayed or stored by this operation.
           * @param {*} content Content to render, store or examine.
           * @return {number} Calculated numeric value.
           */
          showModal: (title, content) => forms.push({title, content}),
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      assert.equal(view.openFurnitureManager('f'), true);
      await assertDom(forms.at(-1).content, "button", {"text": new RegExp("^Flaschen anzeigen$")}, true);
      assert.ok((await domElements(forms.at(-1).content, '[data-act="warehouse-bottle-preview"][data-id="b0"]')).length > 0);
      assert.equal(view.openShelfDetails('s'), true);
      assert.match(await domText(forms.at(-1).content), /I-14/);
      assert.equal((await domElements(forms.at(-1).content, '[data-act="warehouse-bottle-select"]')).length, 0);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
    }
  }
);

test(
  'warehouse room actions expose one transfer entry on overview and floor plan; shelf opens all bottles',
  async () => {
    const w = warehouse(), state = {
      warehouse: w,
      selected: 'overview',
      warehouseRoomId: 'r',
      warehouseFurnitureId: 'f',
    };
    let html = ''; const dialogs = [];
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
           * Renders modal in the current view.
           *
           * @param {*} title Title displayed or stored by this operation.
           * @param {*} content Content to render, store or examine.
           * @return {number} Calculated numeric value.
           */
          showModal: (title, content) => dialogs.push(content),
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      assert.ok((await domElements(html, '[data-act="warehouse-rooms-transfer"]')).length > 0);
      assert.equal((await domElements(html, '[data-act="warehouse-rooms-transfer"]')).length, 1);
      state.selected = 'rooms'; view.render();
      assert.ok((await domElements(html, '[data-act="warehouse-rooms-transfer"]')).length > 0);
      assert.equal((await domElements(html, '[data-act="warehouse-rooms-transfer"]')).length, 1);
      state.selected = 'shelves'; view.render();
      assert.ok((await domElements(html, '[data-act="warehouse-shelf-view"]')).length > 0);
      view.openShelfDetails('s');
      assert.equal((await domElements(dialogs.at(-1), '.warehouse-shelf-detail-bottle')).length, 15);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
    }
  }
);

test(
  'unassignable zero-capacity bays have no modal affordance or pointer cursor',
  async () => {
    const w = warehouse();
    w.rooms[0].furniture[0].shelves[0].capacity = 0;
    w.bottles = []; w.assignments = {};
    const html = renderWarehouseRoomWall(w.rooms[0], w);
    await assertDom(html, '.warehouse-wall-bay--unavailable');
    await assertDom(html, "[data-shelf-id=\"s\"][data-capacity=\"0\"][data-front]");
    assert.equal((await domElements(html, '[data-act="warehouse-shelf-view"]')).length, 0);
    await assertDom(html, "[role=\"button\"][aria-label^=\"Cabinet\"]", {}, true);
    assert.equal(shelfContents(w, 's')?.unavailable, true);
  }
);

test(
  'compartment cards directly expose relocation, the physical bottle detail route, inventory number, ABV and status',
  async () => {
    const w = warehouse();
    w.bottles = [{
      id: 'physical-1',
      bottlingId: 'bottling-1',
      name: 'A&B <Whisky>',
      number: 'IV-12<&',
      status: 'open',
      ageYears: 11,
      releaseYear: 2022,
      caskType: 'Oak <Wood>',
    },
    {id: 'physical-2', name: 'Without metadata', status: null}];
    w.assignments = {'physical-1': 's', 'physical-2': 's'};
    const contents = shelfContents(w, 's', [{id: 'bottling-1', abv: 48.5}]);
    assert.equal(contents.count, 2);
    assert.match(await domText(contents.html), new RegExp("A&B <Whisky>"));
    await assertDom(contents.html, "span", {text: "Inventarnummer:", followingText: " IV-12<&"});
    await assertDom(contents.html, "span", {text: "Alkoholgehalt:", followingText: " 48,5 % Vol."});
    await assertDom(contents.html, "span", {text: "Status:"});
    assert.match(await domText(contents.html), new RegExp("Oak <Wood>"));
    assert.ok((await domElements(contents.html, '[data-act="warehouse-assign"][data-id="physical-1"]')).length > 0);
    assert.equal((await domElements(contents.html, 'a[href="/?bottling=bottling-1"][data-act="open"][data-id="bottling-1"][data-bottle-id="physical-1"]')).length, 1);
    assert.ok((await domElements(contents.html, '[data-act="warehouse-assign"][data-id="physical-2"]')).length > 0);
    assert.equal(
      (await domElements(contents.html, '[data-act="open"]')).length,
      1,
      'no details link for a bottle without bottling ID'
    );
    assert.equal(((await domText(contents.html)).match(/Alkoholgehalt:/g) || []).length, 1, 'no invented ABV');
    assert.equal(((await domText(contents.html)).match(/Status:/g) || []).length, 1, 'no invented status');
    await assertDom(contents.html, ".warehouse-bottle-symbol.warehouse-bottle-static");
    await assertDom(contents.html, "[data-act=\"warehouse-bottle-select\"], [aria-pressed], Whisky, Wood", {}, true);
  }
);

test(
  'the rack selection preview opens individual details for assigned and unassigned bottles',
  async () => {
    const w = warehouse();
    w.bottles = [
      {
        id: 'selected',
        bottlingId: 'edition',
        name: 'Selected',
        number: '9',
        status: 'closed',
      },
      {id: 'unassigned', bottlingId: 'edition', name: 'Unassigned'},
    ];
    w.assignments = {'selected': 's'};
    const state = {
      warehouse: w,
      collection: {bottlings: [{id: 'edition', abv: 55, bottles: []}]},
      selected: 'shelves',
      warehouseRoomId: 'r',
      warehouseSelectedBottleIds: ['selected'],
    };
    const dialogs = [];
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
         * Discards page content in this scenario; no real DOM is mounted.
         */
        shell: () => {},
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate: () => {},
        modal: {
          /**
           * Renders modal in the current view.
           *
           * @param {*} title Title displayed or stored by this operation.
           * @param {*} html Captured render content to inspect.
           * @return {number} Calculated numeric value.
           */
          showModal: (title, html) => dialogs.push({title, html}),
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.previewSelectedBottle();
      await assertDom(dialogs.at(-1).html, ".warehouse-bottle-preview");
      await assertDom(dialogs.at(-1).html, ".warehouse-shelf-detail-grid", {}, true);
      assert.match(await domText(dialogs.at(-1).html), /55 % Vol\./);
      assert.ok((await domElements(dialogs.at(-1).html, '[data-act="warehouse-assign"][data-id="selected"]')).length > 0);
      state.warehouseSelectedBottleIds = ['unassigned'];
      view.previewSelectedBottle();
      await assertDom(dialogs.at(-1).html, ".warehouse-bottle-preview");
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
    }
  }
);

test(
  'shelf overview uses decorative bottle images while offering direct relocation and details actions',
  async () => {
    const w = warehouse();
    w.bottles = [
      {id: 'without-photo', name: 'Without photo', number: '1'},
      {
        id: 'with-photo',
        name: 'With photo',
        number: '2',
        photoPath: 'images/test.jpg',
      },
    ];
    w.assignments = {'without-photo': 's', 'with-photo': 's'};
    const html = shelfContents(w, 's').html;
    assert.equal((await domElements(html, 'span.warehouse-bottle-symbol.warehouse-bottle-static.has-photo[aria-hidden="true"]')).length, 1);
    assert.ok((await domElements(html, '[src="/assets/photo-placeholder.svg"]')).length > 0);
    assert.ok((await domElements(html, '[class="warehouse-bottle-photo"][src="/images/test.jpg"]')).length > 0);
    assert.equal((await domElements(html, '[src*="photo-placeholder.svg"]')).length, 1);
    await assertDom(html, "[data-act=\"warehouse-bottle-select\"], [data-act=\"warehouse-bottle-preview\"], [aria-pressed], .is-selected, [data-select-label]", {}, true);
    assert.equal((await domElements(html, '.warehouse-bottle-symbol.warehouse-bottle-static')).length, 2);
    await assertDom(html, "button.warehouse-bottle-symbol", {}, true);
    assert.ok((await domElements(html, '[data-act="warehouse-assign"][data-id="without-photo"]')).length > 0);
    // The shelf wall still allows multi-selection and keeps its original SVG
    // symbol.
    const wall = renderWarehouseRoomWall(w.rooms[0], w, ['without-photo']);
    await assertDom(wall, "[src*=\"photo-placeholder.svg\"]", {}, true);
    assert.ok((await domElements(wall, '[class="warehouse-wall-bottle is-selected"]')).length > 0);
    assert.ok((await domElements(wall, '[data-act="warehouse-bottle-select"]')).length > 0);
  }
);
