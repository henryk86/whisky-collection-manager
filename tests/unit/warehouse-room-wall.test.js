import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWarehouseRoomWall, wallFurniture, WALL_PIXELS_PER_METRE} from '../../public/js/views/warehouse-room-wall.js';
import {wallFurnitureGroups} from '../../public/js/domain/warehouse-wall-layout.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';
import {shelfDropStatus} from '../../public/js/ui/warehouse-bottle-drag.js';

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
        shelves: [
          {id: 'source', name: 'Fach A', capacity: 5},
          {id: 'higher', name: 'Oberes Fach', capacity: 1},
        ],
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
    bottles: [
      {id: 'b1', name: 'Ardbeg & <One>', number: '1'},
      {id: 'b2', name: 'Second'},
    ],
    assignments: {b1: 'source', b2: 'full'},
  };
  return {room, warehouse};
}

test(
  'room-wide virtual wall shows opposing shelves side by side and all compartments top to bottom',
  () => {
    const {room, warehouse} = createWarehouse();
    assert.deepEqual(wallFurniture(room).map(f => f.id), ['f1', 'f4']);
    const html = renderWarehouseRoomWall(room, warehouse);
    assert.equal(
      (html.match(/class="warehouse-wall-furniture"/g) || []).length,
      2
    );
    assert.match(html, /data-furniture-id="f1"/);
    assert.match(html, /data-furniture-id="f4"/);
    assert.ok(html.indexOf('data-furniture-id="f1"') <
      html.indexOf('data-furniture-id="f4"'));
    assert.ok(html.indexOf('data-shelf-id="higher"') <
      html.indexOf('data-shelf-id="source"'));
    assert.match(
      html,
      /data-shelf-id="target" data-capacity="2" data-act="warehouse-shelf-view"[^>]*data-front="glass"/
    );
    assert.match(
      html,
      /data-act="warehouse-bottle-select" data-id="b1" aria-pressed="false"/
    );
    assert.match(html, /Ardbeg &amp; &lt;One&gt;/);
    assert.doesNotMatch(
      html,
      /Room & <one>|Ardbeg & <One>|data-shelf-id="outside"/
    );
    assert.equal(shelfDropStatus(warehouse, 'b1', 'target'), 'valid');
    assert.equal(shelfDropStatus(warehouse, 'b1', 'full'), 'expand');
  }
);

test(
  'room wall ignores empty furniture and does not confuse other rooms or show a 3D scene',
  () => {
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
      querySelector: () =>
        null, querySelectorAll: () => [],
    };
    try {
      createWarehouseView({
        state,
        shell: output => {html = output;},
        navigate: () => {},
        modal: {},
        refresh: async () => {},
      }).render();
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
    assert.doesNotMatch(html, /data-mode="wall"/);
    assert.match(html, /class="warehouse-room-wall"/);
    assert.match(html, /data-shelf-id="target"/);
    assert.doesNotMatch(
      html,
      /class="warehouse-three-viewport"|class="warehouse-floor"|data-shelf-id="outside"/
    );
  }
);

test('an empty room receives a translated wall-state message', () => {
  assert.match(
    renderWarehouseRoomWall(
      {name: 'Empty', furniture: []},
      {bottles: [], assignments: {}}
    ),
    /noch keine Möbel mit Fächern/
  );
});


test(
  'room wall follows physical projection by direction instead of furniture names',
  () => {
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
    assert.ok(html.indexOf('data-furniture-id="ten"') <
      html.indexOf('data-furniture-id="two"'));
    assert.ok(html.indexOf('data-furniture-id="two"') <
      html.indexOf('data-furniture-id="one"'));
    assert.match(
      html,
      /class="warehouse-wall-stack warehouse-wall-stack--new-direction" data-facing="180"/
    );
  }
);

test(
  'a wall shelf directly over a cabinet is rendered above it in one shared footprint',
  () => {
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
    assert.deepEqual(
      groups[0].items.map(item => item.furniture.id),
      ['base', 'top']
    );
    assert.equal(groups[0].height, 2.3);
    assert.equal(groups[0].width, 1.2);
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    assert.match(
      html,
      /class="warehouse-wall-stack warehouse-wall-stack--layered"[^>]*--wall-stack-height:529px/
    );
    assert.ok(html.indexOf('data-furniture-id="base"') <
      html.indexOf('data-furniture-id="top"'));
    assert.match(html, /data-furniture-id="top"[^>]*--wall-elevation:437px/);
    assert.match(html, /data-furniture-id="base"[^>]*--wall-elevation:0px/);
    assert.match(html, /data-shelf-id="topShelf"/);
    assert.match(html, /data-shelf-id="baseShelf"/);
  }
);

test(
  'stacked furniture has an in-place edit icon without altering the bay layout',
  () => {
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
    const stacked = html.match(/data-furniture-id="upper"[\s\S]*?<\/section>/)?.[0];
    assert.ok(stacked);
    assert.match(
      stacked,
      /class="warehouse-wall-furniture-body"[\s\S]*?data-shelf-id="top"[\s\S]*?warehouse-wall-bay-title[\s\S]*?Fach 2/
    );
    assert.match(
      stacked,
      /class="warehouse-wall-furniture-edit" data-act="warehouse-furniture-manage" data-id="upper" title="Kamin"/
    );
    assert.doesNotMatch(
      stacked,
      /warehouse-wall-furniture-header|warehouse-wall-furniture-name|>Kamin<|0 \/ 0/
    );
    assert.match(stacked, /Glas|Offen/);
  }
);

test(
  'overlapping but same-height furniture and units on opposite walls never stack',
  () => {
    const item = (id, x, y, elevation, rotation = 0) => ({
      id,
      name: id,
      x,
      y,
      width: 1,
      depth: .5,
      elevation,
      itemHeight: 1.5,
      rotation,
      shelves: [{id: `s-${id}`}],
    });
    const room = {
      furniture: [
        item('floorA', .5, .2, 0),
        item('floorB', .6, .2, 0),
        item('wallOpposite', .5, .2, 1.6, 180),
      ],
    };
    const groups = wallFurnitureGroups(room);
    assert.equal(groups.length, 3);
    assert.ok(groups.every(group => group.items.length === 1));
  }
);

test(
  'an offset wall shelf preserves its lateral offset within the stack',
  () => {
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
    assert.match(html, /data-furniture-id="upper"[^>]+--wall-offset-x:92px/);
  }
);

test(
  'room wall renders real cabinet, shelf and mounting heights at ONE consistent scale',
  () => {
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
          shelves: [
            {id: 'large', name: 'Fach 1', heightCm: 100, capacity: 2},
            {id: 'auto', name: 'Fach 2', capacity: 2}],
        },
        {
          id: 'raised',
          name: 'Schrank 3',
          type: 'haengeregal',
          width: .8,
          itemHeight: .6,
          elevation: 1.8,
          shelves: [
            {id: 'mounted', name: 'Montiert', heightCm: 60, capacity: 1}],
        },
      ],
    };
    const html = renderWarehouseRoomWall(
      room,
      {bottles: [{id: 'b', name: 'Bottle'}], assignments: {b: 'low'}}
    );
    const scale = WALL_PIXELS_PER_METRE;
    assert.match(
      html,
      new RegExp(`data-furniture-id="short"[^>]+--wall-furniture-width:${1.2 * scale}px;--wall-furniture-height:${1.2 * scale}px;--wall-elevation:0px`)
    );
    assert.match(
      html,
      new RegExp(`data-furniture-id="tall"[^>]+--wall-furniture-height:${2.4 * scale}px`)
    );
    assert.match(
      html,
      new RegExp(`data-furniture-id="raised"[^>]+--wall-furniture-height:${.6 * scale}px;--wall-elevation:${1.8 * scale}px`)
    );
    assert.match(html, new RegExp(`--wall-clearance-height:${.5 * scale}px`));
    assert.match(
      html,
      new RegExp(`data-shelf-id="low"[^>]+--wall-bay-height:${.4 * scale}px`)
    );
    assert.match(
      html,
      new RegExp(`data-shelf-id="upper"[^>]+--wall-bay-height:${.3 * scale}px`)
    );
    assert.match(
      html,
      new RegExp(`data-shelf-id="large"[^>]+--wall-bay-height:${1 * scale}px`)
    );
    assert.match(
      html,
      new RegExp(`data-shelf-id="auto"[^>]+--wall-bay-height:${1.4 * scale}px`)
    );
    // Remaining clearance is not a phantom shelf: bottles can only be dropped
    // on real shelf IDs.
    assert.equal(
      (html.match(/class="warehouse-wall-clearance"/g) || []).length,
      1
    );
    assert.equal((html.match(/data-shelf-id=/g) || []).length, 5);
    assert.match(
      html,
      /data-shelf-id="low"[\s\S]*data-act="warehouse-bottle-select" data-id="b"/
    );
  }
);

test(
  'room wall does not stretch numerous shallow compartments beyond the cabinet height',
  () => {
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
    assert.match(html, /--wall-furniture-height:184px/);
    assert.equal((html.match(/--wall-bay-height:23px/g) || []).length, 8);
    assert.doesNotMatch(html, /--wall-clearance-height:/);
  }
);

test(
  'wall fills its complete physical height and only scrolls horizontally',
  () => {
    const {room, warehouse} = createWarehouse();
    const html = renderWarehouseRoomWall(room, warehouse, ['b1']);
    assert.match(html, /class="warehouse-wall-bottle is-selected"/);
    assert.match(
      html,
      /data-act="warehouse-bottle-select" data-id="b1" aria-pressed="true"/
    );
    assert.doesNotMatch(html, /class="warehouse-bottle-check"/);
    assert.match(html, /data-act="warehouse-bottles-preview-selected"/);
    assert.match(html, /data-act="warehouse-bottles-assign-selected"/);
  }
);


test(
  'a single wide upper unit spans two adjacent lower cabinets in ONE physical elevation',
  () => {
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
    assert.equal(
      groups.length,
      1,
      'both lower cabinets connect through the wide upper cabinet'
    );
    assert.equal(groups[0].width, 2);
    assert.equal(groups[0].height, 2.2);
    assert.deepEqual(
      groups[0].items.map(item => item.furniture.id),
      ['left', 'right', 'top']
    );
    assert.deepEqual(groups[0].items.map(item => item.offset), [0, 1, 0]);
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    assert.equal(
      (html.match(/class="warehouse-wall-stack warehouse-wall-stack--layered"/g) || []).length,
      1
    );
    assert.match(
      html,
      /data-furniture-id="top"[^>]*--wall-furniture-width:460px/
    );
    assert.match(html, /data-furniture-id="right"[^>]*--wall-offset-x:230px/);
  }
);

test(
  'in-furniture edit icons open the management modal without visible furniture names',
  () => {
    const {room, warehouse} = createWarehouse();
    const html = renderWarehouseRoomWall(room, warehouse);
    assert.match(
      html,
      /class="warehouse-wall-furniture-edit" data-act="warehouse-furniture-manage"/
    );
    assert.match(html, /title="Regal 1" aria-label=/);
    assert.doesNotMatch(
      html,
      /warehouse-wall-furniture-header|warehouse-wall-furniture-name/
    );
    assert.equal(
      (html.match(/class="warehouse-wall-furniture-edit"/g) || []).length,
      2
    );
  }
);

test(
  're-render preserves the horizontal wall offset for each room independently',
  () => {
    const {room, warehouse} = createWarehouse();
    const other = {
      id: 'second',
      name: 'Second room',
      furniture: [{
        id: 'second-rack',
        name: 'Long rack',
        width: 2,
        shelves: [{id: 'other-shelf', name: 'One'}],
      }],
    };
    warehouse.rooms.push(other);
    const state = {warehouse, selected: 'shelves', warehouseRoomId: room.id};
    let viewport = null;
    const oldDocument = globalThis.document;
    globalThis.document = {
      querySelector: selector => selector === '.warehouse-wall-scroll' ?
        viewport : null,
      querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state,
        shell: () => {
          viewport = {
            dataset: {roomId: state.warehouseRoomId},
            scrollLeft: 0,
            isConnected: true,
          };
        },
        navigate: () => {},
        modal: {},
        refresh: async () => {},
      });
      view.render();
      viewport.scrollLeft = 830;
      view.render();
      assert.equal(viewport.scrollLeft, 830);
      state.warehouseRoomId = other.id;
      view.render();
      assert.equal(
        viewport.scrollLeft,
        0,
        'another room must start with its own offset'
      );
      viewport.scrollLeft = 145;
      state.warehouseRoomId = room.id;
      view.render();
      assert.equal(
        viewport.scrollLeft,
        830,
        'returning to the first room restores its own position'
      );
      state.warehouseRoomId = other.id;
      view.render();
      assert.equal(viewport.scrollLeft, 145);
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
  }
);


test(
  'an empty bay has the same label font size as a non-assignable bay',
  () => {
    const room = {
      id: 'r', name: 'Room', furniture: [{
        id: 'f', name: 'Shelf', x: 0, y: 0, width: 1, depth: .5, itemHeight: 1,
        shelves: [
          {id: 'free', name: 'Free', capacity: 5},
          {id: 'blocked', name: 'Blocked', capacity: 0},
        ],
      }],
    };
    const html = renderWarehouseRoomWall(room, {bottles: [], assignments: {}});
    assert.match(html, /class="hint">Fach ist leer<\/span>/);
    assert.match(
      html,
      /class="warehouse-wall-no-space">Nicht belegbar<\/span>/
    );
  }
);


test(
  'first room-wall bay clears the inset top frame without shifting shelf geometry',
  () => {
    const {room, warehouse} = createWarehouse();
    const html = renderWarehouseRoomWall(room, warehouse);
    assert.match(
      html,
      /warehouse-wall-bay--top[^\"]*\"[^>]*--wall-bay-height:/
    );
  }
);
