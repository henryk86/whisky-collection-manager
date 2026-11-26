import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWarehouseRoomWall}
  from '../../public/js/views/warehouse-room-wall.js';
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
  () => {
    const w = warehouse();
    const html = renderWarehouseRoomWall(w.rooms[0], w);
    assert.equal((renderedText(html).match(/data-act="warehouse-bottle-select"/g) || []).length < 6, true);
    assert.match(renderedText(html), /data-act="warehouse-shelf-view"/);
    assert.match(renderedText(html), /warehouse-shelf-overflow/);
    const contents = shelfContents(w, 's');
    assert.equal(renderedText(contents.count), 15);
    assert.equal((renderedText(contents.html).match(/class="warehouse-shelf-detail-bottle/g) || []).length, 15);
    assert.match(renderedText(contents.html), /I-0/);
    assert.match(renderedText(contents.html), /Sherry/);
    assert.equal(renderedText(shelfContents(w, 'missing')), null);
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
      assert.equal(renderedText(view.openFurnitureManager('f')), true);
      assert.doesNotMatch(renderedText(forms.at(-1).content), />Flaschen anzeigen<\/button>/);
      assert.match(renderedText(forms.at(-1).content), /data-act="warehouse-bottle-preview" data-id="b0"/);
      assert.equal(renderedText(view.openShelfDetails('s')), true);
      assert.match(renderedText(forms.at(-1).content), /I-14/);
      assert.doesNotMatch(renderedText(forms.at(-1).content), /data-act="warehouse-bottle-select"/);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
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
      assert.match(renderedText(html), /data-act="warehouse-rooms-transfer"/);
      assert.equal((renderedText(html).match(/data-act="warehouse-rooms-transfer"/g) || []).length, 1);
      state.selected = 'rooms'; view.render();
      assert.match(renderedText(html), /data-act="warehouse-rooms-transfer"/);
      assert.equal((renderedText(html).match(/data-act="warehouse-rooms-transfer"/g) || []).length, 1);
      state.selected = 'shelves'; view.render();
      assert.match(renderedText(html), /data-act="warehouse-shelf-view"/);
      view.openShelfDetails('s');
      assert.equal((renderedText(dialogs.at(-1)).match(/class="warehouse-shelf-detail-bottle/g) || []).length, 15);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
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
    assert.match(renderedText(html), /warehouse-wall-bay--unavailable/);
    assert.match(renderedText(html), /data-shelf-id="s" data-capacity="0" data-front=/);
    assert.doesNotMatch(renderedText(html), /data-act="warehouse-shelf-view"/);
    assert.doesNotMatch(renderedText(html), /role="button" aria-label="Cabinet/);
    assert.equal(renderedText(shelfContents(w, 's')?.unavailable), true);
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
    assert.equal(renderedText(contents.count), 2);
    assert.match(renderedText(contents.html), /A&amp;B &lt;Whisky&gt;/);
    assert.match(renderedText(contents.html), /Inventarnummer:<\/span> IV-12&lt;&amp;/);
    assert.match(renderedText(contents.html), /Alkoholgehalt:<\/span> 48,5 % Vol\./);
    assert.match(renderedText(contents.html), /Status:<\/span>/);
    assert.match(renderedText(contents.html), /Oak &lt;Wood&gt;/);
    assert.match(renderedText(contents.html), /data-act="warehouse-assign" data-id="physical-1"/);
    assert.match(
      renderedText(contents.html),
      new RegExp(
        'href="\\/\\?bottling=bottling-1" data-act=' + '"open" data-id="bottling-1" data-bottle-id' + '="physical-1"'
      )
    );
    assert.match(renderedText(contents.html), /data-act="warehouse-assign" data-id="physical-2"/);
    assert.equal(
      (renderedText(contents.html).match(/data-act="open"/g) || []).length,
      1,
      'no details link for a bottle without bottling ID'
    );
    assert.equal((renderedText(contents.html).match(/Alkoholgehalt:/g) || []).length, 1, 'no invented ABV');
    assert.equal((renderedText(contents.html).match(/Status:/g) || []).length, 1, 'no invented status');
    assert.match(renderedText(contents.html), /class="warehouse-bottle-symbol warehouse-bottle-static/);
    assert.doesNotMatch(renderedText(contents.html), /data-act="warehouse-bottle-select"|aria-pressed=|<Whisky>|<Wood>/);
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
           * @param {*} html HTML markup to render or inspect.
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
      assert.match(renderedText(dialogs.at(-1).html), /warehouse-bottle-preview/);
      assert.doesNotMatch(renderedText(dialogs.at(-1).html), /warehouse-shelf-detail-grid/);
      assert.match(renderedText(dialogs.at(-1).html), /55 % Vol\./);
      assert.match(renderedText(dialogs.at(-1).html), /data-act="warehouse-assign" data-id="selected"/);
      state.warehouseSelectedBottleIds = ['unassigned'];
      view.previewSelectedBottle();
      assert.match(renderedText(dialogs.at(-1).html), /warehouse-bottle-preview/);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
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
      renderedText(html),
      new RegExp(
        '<span class="warehouse-bottle-symbol wareh' + 'ouse-bottle-static has-photo" aria-hidden=' + '"true">'
      )
    );
    assert.match(renderedText(html), /src="\/assets\/photo-placeholder\.svg"/);
    assert.match(renderedText(html), /class="warehouse-bottle-photo" src="\/images\/test\.jpg"/);
    assert.equal((renderedText(html).match(/photo-placeholder\.svg/g) || []).length, 1);
    assert.doesNotMatch(
      renderedText(html),
      new RegExp(
        'data-act="warehouse-bottle-select"|data-ac' + 't="warehouse-bottle-preview"|aria-pressed=' +
        '|is-selected|data-select-label='
      )
    );
    assert.equal((renderedText(html).match(/class="warehouse-bottle-symbol warehouse-bottle-static/g) || []).length, 2);
    assert.doesNotMatch(renderedText(html), /<button[^>]*class="warehouse-bottle-symbol/);
    assert.match(renderedText(html), /data-act="warehouse-assign" data-id="without-photo"/);
    // The shelf wall still allows multi-selection and keeps its original SVG
    // symbol.
    const wall = renderWarehouseRoomWall(w.rooms[0], w, ['without-photo']);
    assert.doesNotMatch(renderedText(wall), /photo-placeholder\.svg/);
    assert.match(renderedText(wall), /class="warehouse-wall-bottle is-selected"/);
    assert.match(renderedText(wall), /data-act="warehouse-bottle-select"/);
  }
);
