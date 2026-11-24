import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWarehouseRoomWall} from '../../public/js/views/warehouse-room-wall.js';
import {shelfContents} from '../../public/js/views/warehouse-shelf-details.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

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
  () => {
    const w = warehouse();
    const html = renderWarehouseRoomWall(w.rooms[0], w);
    assert.equal(
      (html.match(/data-act="warehouse-bottle-select"/g) || []).length < 6,
      true
    );
    assert.match(html, /data-act="warehouse-shelf-view"/);
    assert.match(html, /warehouse-shelf-overflow/);
    const contents = shelfContents(w, 's');
    assert.equal(contents.count, 15);
    assert.equal(
      (contents.html.match(/class="warehouse-shelf-detail-bottle/g) ||
        []).length,
      15
    );
    assert.match(contents.html, /I-0/);
    assert.match(contents.html, /Sherry/);
    assert.equal(shelfContents(w, 'missing'), null);
  }
);

test(
  'furniture dialog uses bottle previews and opens the shelf modal by compartment double-click',
  () => {
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
      querySelector: () =>
        null, querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state,
        shell: () => {},
        navigate: () => {},
        modal: {showModal: (title, content) => forms.push({title, content})},
        refresh: async () => {},
      });
      assert.equal(view.openFurnitureManager('f'), true);
      assert.doesNotMatch(forms.at(-1).content, />Flaschen anzeigen<\/button>/);
      assert.match(
        forms.at(-1).content,
        /data-act="warehouse-bottle-preview" data-id="b0"/
      );
      assert.equal(view.openShelfDetails('s'), true);
      assert.match(forms.at(-1).content, /I-14/);
      assert.doesNotMatch(
        forms.at(-1).content,
        /data-act="warehouse-bottle-select"/
      );
    } finally {
      if (previous ===
        undefined) delete globalThis.document; else globalThis.document =
          previous;
    }
  }
);

test(
  'warehouse room actions expose one transfer entry on overview and floor plan; shelf opens all bottles',
  () => {
    const w = warehouse(), state = {
      warehouse: w,
      selected: 'overview',
      warehouseRoomId: 'r',
      warehouseFurnitureId: 'f',
    };
    let html = ''; const dialogs = [];
    const previous = globalThis.document;
    globalThis.document = {
      querySelector: () =>
        null, querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state,
        shell: output => html = output,
        navigate: () => {},
        modal: {showModal: (title, content) => dialogs.push(content)},
        refresh: async () => {},
      });
      view.render();
      assert.match(html, /data-act="warehouse-rooms-transfer"/);
      assert.equal(
        (html.match(/data-act="warehouse-rooms-transfer"/g) || []).length,
        1
      );
      state.selected = 'rooms'; view.render();
      assert.match(html, /data-act="warehouse-rooms-transfer"/);
      assert.equal(
        (html.match(/data-act="warehouse-rooms-transfer"/g) || []).length,
        1
      );
      state.selected = 'shelves'; view.render();
      assert.match(html, /data-act="warehouse-shelf-view"/);
      view.openShelfDetails('s');
      assert.equal(
        (dialogs.at(-1).match(/class="warehouse-shelf-detail-bottle/g) ||
          []).length,
        15
      );
    } finally {
      if (previous ===
        undefined) delete globalThis.document; else globalThis.document =
          previous;
    }
  }
);

test(
  'unassignable zero-capacity bays have no modal affordance or pointer cursor',
  () => {
    const w = warehouse();
    w.rooms[0].furniture[0].shelves[0].capacity = 0;
    w.bottles = []; w.assignments = {};
    const html = renderWarehouseRoomWall(w.rooms[0], w);
    assert.match(html, /warehouse-wall-bay--unavailable/);
    assert.match(html, /data-shelf-id="s" data-capacity="0" data-front=/);
    assert.doesNotMatch(html, /data-act="warehouse-shelf-view"/);
    assert.doesNotMatch(html, /role="button" aria-label="Cabinet/);
    assert.equal(shelfContents(w, 's')?.unavailable, true);
  }
);

test(
  'compartment cards directly expose relocation, the physical bottle detail route, inventory number, ABV and status',
  () => {
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
    assert.match(contents.html, /A&amp;B &lt;Whisky&gt;/);
    assert.match(contents.html, /Inventarnummer:<\/span> IV-12&lt;&amp;/);
    assert.match(contents.html, /Alkoholgehalt:<\/span> 48,5 % Vol\./);
    assert.match(contents.html, /Status:<\/span>/);
    assert.match(contents.html, /Oak &lt;Wood&gt;/);
    assert.match(
      contents.html,
      /data-act="warehouse-assign" data-id="physical-1"/
    );
    assert.match(
      contents.html,
      /href="\/\?bottling=bottling-1" data-act="open" data-id="bottling-1" data-bottle-id="physical-1"/
    );
    assert.match(
      contents.html,
      /data-act="warehouse-assign" data-id="physical-2"/
    );
    assert.equal(
      (contents.html.match(/data-act="open"/g) || []).length,
      1,
      'no details link for a bottle without bottling ID'
    );
    assert.equal(
      (contents.html.match(/Alkoholgehalt:/g) || []).length,
      1,
      'no invented ABV'
    );
    assert.equal(
      (contents.html.match(/Status:/g) || []).length,
      1,
      'no invented status'
    );
    assert.match(
      contents.html,
      /class="warehouse-bottle-symbol warehouse-bottle-static/
    );
    assert.doesNotMatch(
      contents.html,
      /data-act="warehouse-bottle-select"|aria-pressed=|<Whisky>|<Wood>/
    );
  }
);

test(
  'the rack selection preview opens individual details for assigned and unassigned bottles',
  () => {
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
      querySelector: () =>
        null, querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state,
        shell: () => {},
        navigate: () => {},
        modal: {showModal: (title, html) => dialogs.push({title, html})},
        refresh: async () => {},
      });
      view.previewSelectedBottle();
      assert.match(dialogs.at(-1).html, /warehouse-bottle-preview/);
      assert.doesNotMatch(dialogs.at(-1).html, /warehouse-shelf-detail-grid/);
      assert.match(dialogs.at(-1).html, /55 % Vol\./);
      assert.match(
        dialogs.at(-1).html,
        /data-act="warehouse-assign" data-id="selected"/
      );
      state.warehouseSelectedBottleIds = ['unassigned'];
      view.previewSelectedBottle();
      assert.match(dialogs.at(-1).html, /warehouse-bottle-preview/);
    } finally {
      if (previous ===
        undefined) delete globalThis.document; else globalThis.document =
          previous;
    }
  }
);

test(
  'shelf overview uses decorative bottle images while offering direct relocation and details actions',
  () => {
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
    assert.match(
      html,
      /<span class="warehouse-bottle-symbol warehouse-bottle-static has-photo" aria-hidden="true">/
    );
    assert.match(html, /src="\/assets\/photo-placeholder\.svg"/);
    assert.match(
      html,
      /class="warehouse-bottle-photo" src="\/images\/test\.jpg"/
    );
    assert.equal((html.match(/photo-placeholder\.svg/g) || []).length, 1);
    assert.doesNotMatch(
      html,
      /data-act="warehouse-bottle-select"|data-act="warehouse-bottle-preview"|aria-pressed=|is-selected|data-select-label=/
    );
    assert.equal(
      (html.match(/class="warehouse-bottle-symbol warehouse-bottle-static/g) || []).length,
      2
    );
    assert.doesNotMatch(html, /<button[^>]*class="warehouse-bottle-symbol/);
    assert.match(html, /data-act="warehouse-assign" data-id="without-photo"/);
    // The shelf wall still allows multi-selection and keeps its original SVG
    // symbol.
    const wall = renderWarehouseRoomWall(w.rooms[0], w, ['without-photo']);
    assert.doesNotMatch(wall, /photo-placeholder\.svg/);
    assert.match(wall, /class="warehouse-wall-bottle is-selected"/);
    assert.match(wall, /data-act="warehouse-bottle-select"/);
  }
);
