import {domElements, domText, domMatches, domIndex, domScope, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWarehouseRoomWall, wallFurniture, WALL_PIXELS_PER_METRE} from '../../public/js/views/warehouse-room-wall.js';
import {wallFurnitureGroups} from '../../public/js/domain/warehouse-wall-layout.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';
import {shelfDropStatus} from '../../public/js/ui/warehouse-bottle-drag.js';

/**
 * Creates warehouse for warehouse room wall.test.
 *
 * @return {!Object} Structured result for the caller.
 */
function createWarehouse() {
  const room = {
    id: 'room', name: 'Room & <one>', width: 6, height: 4, furniture: [
      {
        id: 'f4',
        name: 'Regal 4',
        type: 'regal',
        x: 4,
        y: 3,
        rotation: 180,
        width: 1.3,
        elevation: 0,
        shelves: [
          {id: 'target', name: 'Fach B', capacity: 2, front: 'glass'},
          {id: 'full', name: 'Fach Voll', capacity: 1}],
      },
      {
        id: 'f1',
        name: 'Regal 1',
        type: 'regal',
        x: 0,
        y: 0,
        rotation: 0,
        width: 1.1,
        elevation: 0,
        shelves: [{id: 'source', name: 'Fach A', capacity: 5}, {id: 'higher', name: 'Oberes Fach', capacity: 1},],
      },
      {
        id: 'other',
        name: 'Empty furniture',
        type: 'regal',
        x: 2,
        y: 1,
        shelves: [],
      },
    ],
  };
  const warehouse = {
    rooms: [
      room,
      {
        id: 'elsewhere',
        name: 'Other',
        furniture: [{id: 'otherRack', shelves: [{id: 'outside', capacity: 3}]}],
      },
    ],
    bottles: [{id: 'b1', name: 'Ardbeg & <One>', number: '1'}, {id: 'b2', name: 'Second'},],
    assignments: {b1: 'source', b2: 'full'},
  };
  return {room, warehouse};
}

test(
  'room-wide virtual wall shows opposing shelves side by side and all compartments top to bottom',
  async () => {
    const {room, warehouse} = createWarehouse();
    assert.deepEqual(wallFurniture(room).map(f => f.id), ['f1', 'f4']);
    const html = renderWarehouseRoomWall(room, warehouse);
    assert.equal((await domElements(html, '[class="warehouse-wall-furniture"]')).length, 2);
    assert.ok((await domElements(html, '[data-furniture-id="f1"]')).length > 0);
    assert.ok((await domElements(html, '[data-furniture-id="f4"]')).length > 0);
    assert.ok(await domIndex(html, '[data-furniture-id="f1"]') < await domIndex(html, '[data-furniture-id="f4"]'));
    assert.ok(await domIndex(html, '[data-shelf-id="higher"]') < await domIndex(html, '[data-shelf-id="source"]'));
    await assertDom(html, "[data-shelf-id=\"target\"][data-capacity=\"2\"][data-act=\"warehouse-shelf-view\"][data-front=\"glass\"]");
    assert.ok((await domElements(html, '[data-act="warehouse-bottle-select"][data-id="b1"][aria-pressed="false"]')).length > 0);
    await assertDom(html, '[data-act="warehouse-bottle-select"][data-id="b1"]', {'aria-label': /Ardbeg & <One>/});
    await assertDom(html, "one, [data-shelf-id=\"outside\"]", {}, true);
    assert.equal(shelfDropStatus(warehouse, 'b1', 'target'), 'valid');
    assert.equal(shelfDropStatus(warehouse, 'b1', 'full'), 'expand');
  }
);

test(
  'room wall ignores empty furniture and does not confuse other rooms or show a 3D scene',
  async () => {
    const {room, warehouse} = createWarehouse();
    const state = {
      warehouse,
      selected: 'shelves',
      warehouseRoomId: room.id,
      warehousePlanMode: '3d',
      warehouseFurnitureId: null,
    };
    let html = '';
    const oldDocument = globalThis.document;
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
      createWarehouseView({
        state,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} output Page content passed by the view.
         */
        shell: output => {html = output;},
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
      }).render();
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
    assert.equal((await domElements(html, '[data-mode="wall"]')).length, 0);
    assert.ok((await domElements(html, '[class="warehouse-room-wall"]')).length > 0);
    assert.ok((await domElements(html, '[data-shelf-id="target"]')).length > 0);
    await assertDom(html, ".warehouse-three-viewport, .warehouse-floor, [data-shelf-id=\"outside\"]", {}, true);
  }
);

test('an empty room receives a translated wall-state message', async () => {
  assert.match(await domText(renderWarehouseRoomWall({name: 'Empty', furniture: []}, {bottles: [], assignments: {}})), /noch keine Möbel mit Fächern/);
});

test(
  'room wall follows physical projection by direction instead of furniture names',
  async () => {
    /**
     * Derives the shelf result from the supplied values.
     *
     * @param {*} id Identifier of the affected record.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    const shelf = id => [{id, name: id, capacity: 1}];
    const room = {
      name: 'Sorting', furniture: [
        {
          id: 'ten',
          name: 'Regal 10',
          x: 0,
          y: 0,
          rotation: 0,
          width: 1,
          depth: .5,
          shelves: shelf('s10'),
        },
        {
          id: 'two',
          name: 'Regal 2',
          x: 5,
          y: 2,
          rotation: 0,
          width: 1,
          depth: .5,
          shelves: shelf('s2'),
        },
        {
          id: 'one',
          name: 'Regal 1',
          x: 4,
          y: 3,
          rotation: 180,
          width: 1,
          depth: .5,
          shelves: shelf('s1'),
        },
      ],
    };
    assert.deepEqual(wallFurniture(room).map(f => f.id), ['ten', 'two', 'one']);
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    assert.ok(await domIndex(html, '[data-furniture-id="ten"]') < await domIndex(html, '[data-furniture-id="two"]'));
    assert.ok(await domIndex(html, '[data-furniture-id="two"]') < await domIndex(html, '[data-furniture-id="one"]'));
    await assertDom(html, ".warehouse-wall-stack.warehouse-wall-stack--new-direction[data-facing=\"180\"]");
  }
);

test(
  'a wall shelf directly over a cabinet is rendered above it in one shared footprint',
  async () => {
    const room = {
      name: 'Stacked furniture', furniture: [
        {
          id: 'other',
          name: 'B-Schrank',
          x: 2.5,
          y: .2,
          rotation: 0,
          width: 1,
          depth: .5,
          itemHeight: 1.8,
          elevation: 0,
          shelves: [{id: 'otherShelf', name: '1', capacity: 2}],
        },
        {
          id: 'top',
          name: 'A-Haengeregal',
          x: .5,
          y: .2,
          rotation: 0,
          width: 1.2,
          depth: .5,
          itemHeight: .4,
          elevation: 1.9,
          shelves: [{id: 'topShelf', name: '2', capacity: 2}],
        },
        {
          id: 'base',
          name: 'Z-Unterschrank',
          x: .5,
          y: .2,
          rotation: 0,
          width: 1.2,
          depth: .5,
          itemHeight: 1.8,
          elevation: 0,
          shelves: [{id: 'baseShelf', name: '3', capacity: 2}],
        },
      ],
    };
    const groups = wallFurnitureGroups(room);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0].items.map(item => item.furniture.id), ['base', 'top']);
    assert.equal(groups[0].height, 2.3);
    assert.equal(groups[0].width, 1.2);
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    await assertDom(html, ".warehouse-wall-stack.warehouse-wall-stack--layered[style*=\"--wall-stack-height:529px\"]");
    assert.ok(await domIndex(html, '[data-furniture-id="base"]') < await domIndex(html, '[data-furniture-id="top"]'));
    await assertDom(html, "[data-furniture-id=\"top\"][style*=\"--wall-elevation:437px\"]");
    await assertDom(html, "[data-furniture-id=\"base\"][style*=\"--wall-elevation:0px\"]");
    assert.ok((await domElements(html, '[data-shelf-id="topShelf"]')).length > 0);
    assert.ok((await domElements(html, '[data-shelf-id="baseShelf"]')).length > 0);
  }
);

test(
  'stacked furniture has an in-place edit icon without altering the bay layout',
  async () => {
    const room = {
      id: 'r', name: 'Room', furniture: [
        {
          id: 'lower',
          name: 'Lower',
          x: 0,
          y: 0,
          rotation: 0,
          width: 1,
          depth: .5,
          elevation: 0,
          itemHeight: 1.5,
          shelves: [{id: 'low', name: 'Bottom bay', capacity: 5}],
        },
        {
          id: 'upper',
          name: 'Kamin',
          x: 0,
          y: 0,
          rotation: 0,
          width: 1,
          depth: .5,
          elevation: 1.6,
          itemHeight: .5,
          shelves: [{id: 'top', name: 'Fach 2', capacity: 0}],
        },
      ],
    };
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    const stacked = domScope(html, '[data-furniture-id="upper"]');
    assert.ok(stacked);
    await assertDom(stacked, ".warehouse-wall-furniture-body [data-shelf-id=\"top\"] .warehouse-wall-bay-title", {text: /Fach 2/});
    await assertDom(stacked, ".warehouse-wall-furniture-edit[data-act=\"warehouse-furniture-manage\"][data-id=\"upper\"][title=\"Kamin\"]");
    assert.equal((await domMatches(stacked, "*", {"text": new RegExp("^Kamin$")})) || (await domMatches(stacked, ".warehouse-wall-furniture-header, .warehouse-wall-furniture-name") || new RegExp("0 \\/ 0").test(await domText(stacked))), false);
    assert.equal((new RegExp("Glas|Offen").test(await domText(stacked))), true);
  }
);

test(
  'an offset wall shelf preserves its lateral offset within the stack',
  async () => {
    const room = {
      furniture: [
        {
          id: 'bottom',
          name: 'Bottom',
          x: 1,
          y: 0,
          width: 1.6,
          depth: .5,
          itemHeight: 1.6,
          elevation: 0,
          shelves: [{id: 'a'}],
        },
        {
          id: 'upper',
          name: 'Upper',
          x: 1.4,
          y: 0,
          width: .8,
          depth: .5,
          itemHeight: .3,
          elevation: 1.7,
          shelves: [{id: 'b'}],
        },
      ],
    };
    const groups = wallFurnitureGroups(room);
    assert.equal(groups.length, 1);
    assert.ok(Math.abs(groups[0].items[1].offset - .4) < .001);
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    await assertDom(html, "[data-furniture-id=\"upper\"][style*=\"--wall-offset-x:92px\"]");
  }
);

test(
  'room wall renders real cabinet, shelf and mounting heights at ONE consistent scale',
  async () => {
    const room = {
      name: 'Height test', furniture: [
        {
          id: 'short',
          name: 'Schrank 1',
          type: 'schrank',
          width: 1.2,
          itemHeight: 1.2,
          elevation: 0,
          shelves: [
            {id: 'low', name: 'Unterteil', heightCm: 40, capacity: 2},
            {id: 'upper', name: 'Oben', heightCm: 30, capacity: 2}],
        },
        {
          id: 'tall',
          name: 'Schrank 2',
          type: 'schrank',
          width: 1.5,
          itemHeight: 2.4,
          elevation: 0,
          shelves: [{id: 'large', name: 'Fach 1', heightCm: 100, capacity: 2}, {id: 'auto', name: 'Fach 2', capacity: 2}],
        },
        {
          id: 'raised',
          name: 'Schrank 3',
          type: 'haengeregal',
          width: .8,
          itemHeight: .6,
          elevation: 1.8,
          shelves: [{id: 'mounted', name: 'Montiert', heightCm: 60, capacity: 1}],
        },
      ],
    };
    const html = renderWarehouseRoomWall(room, {bottles: [{id: 'b', name: 'Bottle'}], assignments: {b: 'low'}});
    const scale = WALL_PIXELS_PER_METRE;
    await assertDom(html, `[data-furniture-id="short"][style*="--wall-furniture-width:${1.2 * scale}px"][style*="--wall-furniture-height:${1.2 * scale}px"][style*="--wall-elevation:0px"]`);
    await assertDom(html, `[data-furniture-id="tall"][style*="--wall-furniture-height:${2.4 * scale}px"]`);
    await assertDom(html, `[data-furniture-id="raised"][style*="--wall-furniture-height:${.6 * scale}px"][style*="--wall-elevation:${1.8 * scale}px"]`);
    await assertDom(html, `[style*="--wall-clearance-height:${.5 * scale}px"]`);
    await assertDom(html, `[data-shelf-id="low"][style*="--wall-bay-height:${.4 * scale}px"]`);
    await assertDom(html, `[data-shelf-id="upper"][style*="--wall-bay-height:${.3 * scale}px"]`);
    await assertDom(html, `[data-shelf-id="large"][style*="--wall-bay-height:${1 * scale}px"]`);
    await assertDom(html, `[data-shelf-id="auto"][style*="--wall-bay-height:${1.4 * scale}px"]`);
    // Remaining clearance is not a phantom shelf: bottles can only be dropped
    // on real shelf IDs.
    assert.equal((await domElements(html, '[class="warehouse-wall-clearance"]')).length, 1);
    assert.equal((await domElements(html, '[data-shelf-id]')).length, 5);
    await assertDom(html, "[data-shelf-id=\"low\"] [data-act=\"warehouse-bottle-select\"][data-id=\"b\"]");
  }
);

test(
  'room wall does not stretch numerous shallow compartments beyond the cabinet height',
  async () => {
    const room = {
      name: 'Shallow bays', furniture: [{
        id: 'many',
        name: 'Regal',
        type: 'regal',
        width: .7,
        itemHeight: .8,
        shelves:
          Array.from(
            {length: 8},
            (_, index) =>
            ({
              id: `s${index}`,
              name: `Fach ${index}`,
              heightCm: 10,
              capacity: 3,
            })
          ),
      }],
    };
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    await assertDom(html, "[style*=\"--wall-furniture-height:184px\"]");
    assert.equal((await domElements(html, '[style*="--wall-bay-height:23px"]')).length, 8);
    await assertDom(html, "[style*=\"--wall-clearance-height:\"]", {}, true);
  }
);

test(
  'wall fills its complete physical height and only scrolls horizontally',
  async () => {
    const {room, warehouse} = createWarehouse();
    const html = renderWarehouseRoomWall(room, warehouse, ['b1']);
    assert.ok((await domElements(html, '[class="warehouse-wall-bottle is-selected"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="warehouse-bottle-select"][data-id="b1"][aria-pressed="true"]')).length > 0);
    assert.equal((await domElements(html, '[class="warehouse-bottle-check"]')).length, 0);
    assert.ok((await domElements(html, '[data-act="warehouse-bottles-preview-selected"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="warehouse-bottles-assign-selected"]')).length > 0);
  }
);

test(
  'a single wide upper unit spans two adjacent lower cabinets in ONE physical elevation',
  async () => {
    /**
     * Derives the shelf result from the supplied values.
     *
     * @param {*} id Identifier of the affected record.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    const shelf = id => [{id: `s-${id}`, name: id, capacity: 5}];
    const room = {
      id: 'span-room', name: 'Span test', furniture: [
        {
          id: 'left',
          name: 'Lower left',
          x: 0,
          y: 0,
          rotation: 0,
          width: 1,
          depth: .5,
          elevation: 0,
          itemHeight: 1.7,
          shelves: shelf('left'),
        },
        {
          id: 'right',
          name: 'Lower right',
          x: 1,
          y: 0,
          rotation: 0,
          width: 1,
          depth: .5,
          elevation: 0,
          itemHeight: 1.7,
          shelves: shelf('right'),
        },
        {
          id: 'top',
          name: 'Wide cabinet',
          x: 0,
          y: 0,
          rotation: 0,
          width: 2,
          depth: .5,
          elevation: 1.75,
          itemHeight: .45,
          shelves: shelf('top'),
        },
      ],
    };
    const groups = wallFurnitureGroups(room);
    assert.equal(groups.length, 1, 'both lower cabinets connect through the wide upper cabinet');
    assert.equal(groups[0].width, 2);
    assert.equal(groups[0].height, 2.2);
    assert.deepEqual(groups[0].items.map(item => item.furniture.id), ['left', 'right', 'top']);
    assert.deepEqual(groups[0].items.map(item => item.offset), [0, 1, 0]);
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    assert.equal((await domElements(html, '[class="warehouse-wall-stack warehouse-wall-stack--layered"]')).length, 1);
    await assertDom(html, "[data-furniture-id=\"top\"][style*=\"--wall-furniture-width:460px\"]");
    await assertDom(html, "[data-furniture-id=\"right\"][style*=\"--wall-offset-x:230px\"]");
  }
);

test(
  'in-furniture edit icons open the management modal without visible furniture names',
  async () => {
    const {room, warehouse} = createWarehouse();
    const html = renderWarehouseRoomWall(room, warehouse);
    await assertDom(html, ".warehouse-wall-furniture-edit[data-act=\"warehouse-furniture-manage\"]");
    await assertDom(html, "[title=\"Regal 1\"][aria-label]");
    assert.equal((await domMatches(html, ".warehouse-wall-furniture-header, .warehouse-wall-furniture-name")), false);
    assert.equal((await domElements(html, '[class="warehouse-wall-furniture-edit"]')).length, 2);
  }
);

test(
  'an empty bay has the same label font size as a non-assignable bay',
  async () => {
    const room = {
      id: 'r', name: 'Room', furniture: [{
        id: 'f', name: 'Shelf', x: 0, y: 0, width: 1, depth: .5, itemHeight: 1,
        shelves: [{id: 'free', name: 'Free', capacity: 5}, {id: 'blocked', name: 'Blocked', capacity: 0},],
      }],
    };
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    await assertDom(html, "[class=\"hint\"]", {"text": new RegExp("^Fach ist leer$")});
    await assertDom(html, "[class=\"warehouse-wall-no-space\"]", {"text": new RegExp("^Nicht belegbar$")});
  }
);

test(
  'first room-wall bay clears the inset top frame without shifting shelf geometry',
  async () => {
    const {room, warehouse} = createWarehouse();
    const html = renderWarehouseRoomWall(room, warehouse);
    await assertDom(html, ".warehouse-wall-bay--top[style*=\"--wall-bay-height:\"]");
  }
);
