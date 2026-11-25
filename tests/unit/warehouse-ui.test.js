import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {routeUrl, parseRoute} from '../../public/js/navigation/routes.js';
import {storagePath, createWarehouseView}
  from '../../public/js/views/warehouse.js';

test(
  'warehouse routes survive reloads and links from bottle details resolve \
individual shelves',
  () => {
    const target = routeUrl(
      'warehouse',
      'rooms',
      {roomId: 'room-123', furnitureId: 'furniture-123'}
    );
    assert.deepEqual(
      parseRoute(new URL(target, 'http://example.test').search),
      {
        page: 'warehouse',
        selected: 'rooms',
        roomId: 'room-123',
        furnitureId: 'furniture-123',
      }
    );
    assert.equal(
      parseRoute('?view=warehouse&section=bad').selected,
      'overview'
    );
    const w = {
      rooms: [{
        id: 'r',
        name: 'Room',
        furniture: [{
          id: 'f', name: 'Regal', shelves: [{
            id: 's',
            name: 'Fach',
          }],
        }],
      }],
    };
    assert.equal(storagePath(w, 's').label, 'Room / Regal / Fach');
    assert.equal(storagePath(w, 'missing'), null);
  }
);
test(
  'warehouse view renders room plan, separate bottle assignment and \
responsive shelf elevation without HTML injection',
  () => {
    const state = {
      warehouse: {
        schemaVersion: 1,
        rooms: [{
          id: 'r',
          name: 'Test <Room>',
          width: 4,
          height: 4,
          furniture: [{
            id: 'f',
            name: 'Regal A',
            type: 'regal',
            x: 0,
            y: 0,
            width: 1,
            depth: .5,
            rotation: 0,
            shelves: [{id: 's', name: 'Fach 1', capacity: 10}],
          }],
        }],
        assignments: {b: 's'},
        bottles: [{
          id: 'b',
          name: 'Ardbeg & Co',
          number: '00001',
          volumeType: 'standard',
        }],
      },
      selected: 'shelves',
      warehouseRoomId: 'r',
      warehouseFurnitureId: 'f',
      warehouseSearch: '',
      warehouseUnassigned: false,
      warehousePlanMode: '2d',
    };
    let html = '';
    const view = createWarehouseView({
      state,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} output Output resource or accumulated result.
       */
      shell: output => {html = output;},
      /**
       * Updates the navigate state for its caller.
       */
      navigate: () => {},
      modal: {},
      /**
       * Performs the refresh lifecycle action.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      refresh: async () => {},
    });
    const originalDocument = globalThis.document;
    try {
      globalThis.document = {
        /**
         * Derives the query selector result from the supplied values.
         * @return {*} Result computed from the supplied inputs.
         */
        querySelector: () => null,
      }; view.render();
      assert.match(html, /Regale &amp; Fächer/);
      assert.match(html, /warehouse-shelf/);
      state.selected = 'rooms'; view.render();
    }
    finally {
      if (originalDocument ===
        undefined) delete globalThis.document; else globalThis.document =
          originalDocument;
    }
    assert.match(html, /class="warehouse-floor"/);
    assert.match(html, /Regal A/);
    assert.match(html, /Test &lt;Room&gt;/);
    assert.doesNotMatch(html, /<Room>/);
  }
);


test(
  'warehouse uses the same page header and section sidebar as analytics on \
every subsection',
  () => {
    const state = {
      warehouse: {schemaVersion: 1, rooms: [], bottles: [], assignments: {}},
      selected: 'overview', warehouseSearch: '', warehouseUnassigned: false,
    };
    let html = '';
    const view = createWarehouseView({
      state,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} output Output resource or accumulated result.
       */
      shell: output => {html = output;},
      /**
       * Updates the navigate state for its caller.
       */
      navigate: () => {},
      modal: {},
      /**
       * Performs the refresh lifecycle action.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      refresh: async () => {},
    });
    const expectedTabs = {
      overview: 'Übersicht',
      rooms: 'Raumpläne',
      shelves: 'Regale & Fächer',
      find: 'Flaschen finden',
    };
    const previousDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () => null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
      /**
       * Retrieves element by id from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getElementById: () => null,
    };
    try {
      for (const [id, title] of Object.entries(expectedTabs)) {
        state.selected = id;
        view.render();
        assert.match(html, /class="analytics-page warehouse-page"/);
        assert.match(
          html,
          new RegExp(
            '<header class="section-head ds-page-header' +
            ' warehouse-heading"><div class="page-headi' +
            'ng-copy"><span class="eyebrow dark">DEINE ' +
            'FLASCHEN IM BLICK<\\/span><h2>Lagerverwalt' +
            'ung<span class="heading-period" aria-hidde' +
            'n="true">\\.<\\/span><\\/h2>'
          )
        );
        assert.match(html, /class="section-nav-desktop warehouse-tabs"/);
        assert.match(html, /data-section-switch="warehouse"/);
        const active = html.match(
          /<button[^>]*class="section-nav-item active"[^>]*>/g) || [];
        assert.equal(
          active.length,
          1,
          `exactly one active warehouse section for ${id}`
        );
        assert.match(
          active[0],
          new RegExp(`data-section="${id}" aria-current="page"`)
        );
        assert.match(
          html,
          new RegExp(`data-section="${id}" aria-current="page">${title
            .replaceAll('&', '&amp;').replace(/[.*+?^${}()|[\]\\]/g,
              '\\$&'
            )}`)
        );
      }
    } finally {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    }
  }
);

test(
  'warehouse shelf rendering includes copy controls and thumbnails only \
where a physical bottle photo exists',
  () => {
    const state = {
      warehouse: {
        schemaVersion: 1,
        rooms: [{
          id: 'r',
          name: 'Whiskyzimmer',
          width: 4,
          height: 4,
          furniture: [{
            id: 'f',
            name: 'Regal A',
            type: 'regal',
            x: 0,
            y: 0,
            width: 1,
            depth: 0.5,
            rotation: 0,
            shelves: [{id: 's', name: 'Fach 1', capacity: null}],
          }],
        }],
        assignments: {b1: 's', b2: 's'},
        bottles: [
          {
            id: 'b1',
            name: 'Whisky mit Foto',
            number: '1',
            photoPath: 'images/b1/sample.jpg',
          },
          {id: 'b2', name: 'Whisky ohne Foto', number: '2', photoPath: null},
        ],
      }, selected: 'shelves', warehouseRoomId: 'r', warehouseFurnitureId: 'f',
    };
    let html = '';
    const forms = [];
    const view = createWarehouseView({
      state,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} output Output resource or accumulated result.
       */
      shell: output => {html = output;},
      /**
       * Updates the navigate state for its caller.
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
    const savedDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () =>
        null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    try {
      view.render();
      assert.doesNotMatch(
        html,
        /data-act="warehouse-furniture-copy" data-id="f"/
      );
      view.openFurnitureManager('f');
      assert.match(
        forms.at(-1).content,
        /data-act="warehouse-furniture-copy" data-id="f"/
      );
      assert.match(
        forms.at(-1).content,
        /data-act="warehouse-shelf-copy" data-id="s"/
      );
      assert.match(
        html,
        /class="warehouse-bottle-photo" src="\/images\/b1\/sample.jpg"/
      );
      assert.equal(
        (html.match(/class="warehouse-bottle-photo"/g) || []).length,
        1,
        'the permanently visible wall displays the photo only once'
      );
      assert.doesNotMatch(
        html,
        /\|\| '<span class=\"hint\">Fach ist leer/,
        'no unrendered template suffixes'
      );
      assert.equal(
        (html.match(/class="warehouse-bottle-symbol"/g) || []).length,
        2,
        'the page renders each bottle silhouette once'
      );
      assert.doesNotMatch(
        html,
        /warehouse-management-drawer|warehouse-furniture-panel/
      );
      assert.equal(
        (forms.at(0).content.match(/class="warehouse-bottle-symbol/g) ||
          []).length,
        2,
        'single furniture modal shows its assigned bottles'
      );
      assert.match(
        forms.at(0).content,
        new RegExp(
          'class="warehouse-bottle-symbol" data-act="' +
          'warehouse-bottle-preview" data-id="b1"'
        )
      );
      assert.match(
        forms.at(0).content,
        /class="warehouse-bottle-photo" src="\/images\/b1\/sample.jpg"/
      );
      assert.match(
        forms.at(0).content,
        /data-act="warehouse-bottle-preview" data-id="b2"/
      );
      assert.doesNotMatch(forms.at(0).content, />Flaschen anzeigen<\/button>/);
      view.openBottlePreview('b1');
      assert.match(forms.at(-1).content, /warehouse-bottle-preview/);
      assert.match(
        forms.at(-1).content,
        /data-act="warehouse-assign" data-id="b1"/
      );
      view.openShelfDetails('s');
      assert.match(forms.at(-1).content, /Whisky mit Foto/);
      assert.match(
        forms.at(-1).content,
        /data-act="warehouse-assign" data-id="b1"/
      );
      assert.match(html, /data-act="warehouse-bottles-preview-selected"/);
      assert.match(html, /data-act="warehouse-bottle-select" data-id="b1"/);
      assert.doesNotMatch(html, /data-act="warehouse-assign" data-id="b1"/);
      view.openForm('furniture-copy', 'f');
      assert.match(forms.at(-1).content, /name="withShelves" checked/);
      assert.match(
        forms.at(-1).content,
        /data-endpoint="\/api\/warehouse\/furniture\/f\/copy"/
      );
      view.openForm('shelf-copy', 's');
      assert.match(forms.at(-1).content, /name="furnitureId"/);
      assert.match(
        forms.at(-1).content,
        /data-endpoint="\/api\/warehouse\/shelves\/s\/copy"/
      );
    } finally {
      if (savedDocument === undefined) delete globalThis.document;
      else globalThis.document = savedDocument;
    }
  }
);

test(
  'shelf bottle opens a read-only details modal with the exact bottle link \
and separate relocation action',
  () => {
    const bottleId = 'bottle-123';
    const bottlingId = 'bottling-456';
    const state = {
      warehouse: {
        rooms: [{
          id: 'room',
          name: 'Raum',
          furniture: [{
            id: 'shelf',
            name: 'Regal',
            shelves: [{id: 'slot', name: 'Fach 1'}],
          }],
        }],
        assignments: {[bottleId]: 'slot'}, bottles: [{
          id: bottleId,
          bottlingId,
          name: 'A&B <Whisky>',
          number: '123<&',
          volumeType: 'sample',
          volumeMl: 50,
          status: 'open',
          photoPath: 'images/bottle-123/photo.jpg',
        }],
      },
      collection: {
        bottlings: [{
          id: bottlingId, ageYears: 12, abv: 46, bottles: [{
            id: bottleId,
            purchaseDate: '2026-01-02',
            purchasePrice: 45,
            currency: 'EUR',
            merchant: 'Shop <City>',
            comment: 'My <comment>',
          }],
        }],
      },
    };
    let dialog;
    const view = createWarehouseView({
      state,
      /**
       * Updates the shell state for its caller.
       */
      shell: () => {},
      /**
       * Updates the navigate state for its caller.
       */
      navigate: () => {},
      modal: {
        /**
         * Renders modal in the current view.
         *
         * @param {*} title Title displayed or stored by this operation.
         * @param {*} html HTML markup to render or inspect.
         */
        showModal: (title, html) => {dialog = {title, html};},
      },
      /**
       * Performs the refresh lifecycle action.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      refresh: async () => {},
    });
    view.openBottlePreview(bottleId);
    assert.equal(dialog.title, 'Flaschendetails');
    assert.match(dialog.html, /A&amp;B &lt;Whisky&gt;/);
    assert.match(dialog.html, /123&lt;&amp;/);
    assert.match(dialog.html, /Raum \/ Regal \/ Fach 1/);
    assert.match(dialog.html, /50 ml/);
    assert.match(dialog.html, /46 % Vol\./);
    assert.match(dialog.html, /Shop &lt;City&gt;/);
    assert.match(dialog.html, /My &lt;comment&gt;/);
    assert.doesNotMatch(dialog.html, /<Whisky>|<City>|<comment>/);
    assert.match(dialog.html, /class="warehouse-bottle-preview-photo"/);
    assert.match(dialog.html, />Zu den Flaschendetails<\/a>/);
    assert.match(
      dialog.html,
      /data-act="warehouse-assign" data-id="bottle-123"/
    );
    assert.match(
      dialog.html,
      new RegExp(
        'href="\\/\\?bottling=bottling-456" data-ac' +
        't="open" data-id="bottling-456" data-bottl' +
        'e-id="bottle-123"'
      )
    );
  }
);

test(
  'warehouse overview and room views show room capacity and distinguish \
elevated wall shelves',
  () => {
    const state = {
      warehouse: {
        schemaVersion: 1, rooms: [{
          id: 'r', name: 'Whiskyzimmer', width: 4, height: 3, furniture: [
            {
              id: 'cab',
              name: 'Schrank',
              type: 'schrank',
              x: 0.1,
              y: 0.2,
              width: 1.2,
              depth: 0.5,
              rotation: 0,
              elevation: 0,
              itemHeight: 1.8,
              shelves: [{id: 's1', name: 'Fach 1', capacity: 8}],
            },
            {
              id: 'wall',
              name: 'Hängeregal',
              type: 'haengeregal',
              x: 0.1,
              y: 0.2,
              width: 1.2,
              depth: 0.5,
              rotation: 0,
              elevation: 1.9,
              itemHeight: 0.35,
              shelves: [{id: 's2', name: 'Fach 1', capacity: null}],
            },
          ],
        }], assignments: {b: 's2'}, bottles: [{id: 'b', name: 'Ardbeg'}],
      },
      selected: 'overview',
      warehouseRoomId: 'r',
      warehouseSearch: '',
      warehouseUnassigned: false,
      warehousePlanMode: '2d',
    };
    let html = ''; let dialog = '';
    const view = createWarehouseView({
      state,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} output Output resource or accumulated result.
       */
      shell: output => {html = output;},
      /**
       * Updates the navigate state for its caller.
       */
      navigate: () => {},
      modal: {
        /**
         * Renders modal in the current view.
         *
         * @param {*} _title Value used by this operation.
         * @param {*} content Content to render, store or examine.
         */
        showModal: (_title, content) => {dialog = content;},
      },
      /**
       * Performs the refresh lifecycle action.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      refresh: async () => {},
    });
    const oldDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () =>
        null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    try {
      view.render();
      assert.match(
        html,
        /Gesamtkapazität: mind\. 8 Plätze · 1 Fach ohne Limit/
      );
      assert.match(html, /Belegt: 1 Flasche/);
      state.selected = 'rooms';
      view.render();
      assert.match(html, /id="warehouse-plan-layer"/);
      assert.match(html, /class="warehouse-drag warehouse-elevated/);
      assert.match(html, /ab 1,9 m/);
      state.warehousePlanLevel = 'floor';
      view.render();
      assert.match(html, /data-id="cab"/);
      assert.doesNotMatch(html, /<g[^>]*data-id="wall"/);
      state.warehousePlanLevel = 'elevated';
      view.render();
      assert.match(html, /data-id="wall"/);
      assert.doesNotMatch(html, /<g[^>]*data-id="cab"/);
      view.openForm('furniture', 'wall');
      assert.match(dialog, /Unterkante über Boden/);
      assert.match(dialog, /Möbelhöhe/);
      assert.match(dialog, /value="1.9"/);
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
  }
);


test(
  '2D room plan grid uses 0.1 m subdivisions, 0.5 m guides and 1 m major \
lines beneath furniture',
  () => {
    const state = {
      warehouse: {
        schemaVersion: 1, rooms: [{
          id: 'r', name: 'Raum', width: 2, height: 1.5,
          furniture: [{
            id: 'f',
            name: 'Regal',
            type: 'regal',
            x: 0,
            y: 0,
            width: 1,
            depth: .5,
            rotation: 0,
            shelves: [],
          }],
        }],
        bottles: [], assignments: {},
      }, selected: 'rooms', warehouseRoomId: 'r', warehousePlanMode: '2d',
    };
    let html = '';
    const savedDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () => null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
      /**
       * Retrieves element by id from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getElementById: () => null,
    };
    try {
      createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} content Content to render, store or examine.
         */
        shell: content => {html = content;},
        /**
         * Updates the navigate state for its caller.
         */
        navigate: () => {},
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      }).render();
    }
    finally {
      if (savedDocument ===
        undefined) delete globalThis.document; else globalThis.document =
          savedDocument;
    }
    assert.match(html, /class="warehouse-plan-grid" aria-hidden="true"/);
    assert.match(
      html,
      /class="warehouse-grid-fine" x1="30" y1="0" x2="30" y2="450"/
    );
    assert.match(
      html,
      /class="warehouse-grid-fine" x1="60" y1="0" x2="60" y2="450"/
    );
    assert.match(
      html,
      /class="warehouse-grid-minor" x1="150" y1="0" x2="150" y2="450"/
    );
    assert.match(
      html,
      /class="warehouse-grid-major" x1="300" y1="0" x2="300" y2="450"/
    );
    assert.match(
      html,
      /class="warehouse-grid-major" x1="0" y1="300" x2="600" y2="300"/
    );
    assert.match(
      html,
      /class="warehouse-grid-fine" x1="0" y1="30" x2="600" y2="30"/
    );
    assert.ok(
      html.indexOf('warehouse-plan-grid') <
      html.indexOf('class="warehouse-drag'),
      'grid must be under furniture'
    );
  }
);

test(
  'room creation/edit/delete controls appear only in Raumpläne, not Regale \
& Fächer',
  () => {
    const state = {
      warehouse: {
        schemaVersion: 1, rooms: [{
          id: 'raum', name: 'Raum', width: 3, height: 3,
          furniture: [],
        }], bottles: [], assignments: {},
      }, selected: 'shelves', warehouseRoomId: 'raum',
    };
    let html = '';
    const savedDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () =>
        null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} output Output resource or accumulated result.
         */
        shell: output => {html = output;},
        /**
         * Updates the navigate state for its caller.
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
      assert.match(
        html,
        /id="warehouse-room-select"/,
        'room selection remains available while editing shelves'
      );
      for (const action of ['warehouse-room-new', 'warehouse-room-edit',
        'warehouse-room-delete']) {
        assert.doesNotMatch(
          html,
          new RegExp(`data-act="${action}"`),
          `${action} must be absent from Regale & Fächer`
        );
      }
      state.selected = 'rooms';
      view.render();
      for (const action of ['warehouse-room-new', 'warehouse-room-edit',
        'warehouse-room-delete']) {
        assert.match(
          html,
          new RegExp(`data-act="${action}"`),
          `${action} must remain in Raumpläne`
        );
      }
    } finally {
      if (savedDocument === undefined) delete globalThis.document;
      else globalThis.document = savedDocument;
    }
  }
);

test(
  'bulk furniture edit uses the same small button size as the other \
warehouse bulk actions',
  () => {
    const state = {
      warehouse: {
        schemaVersion: 1, rooms: [{
          id: 'r', name: 'Raum', width: 3, height: 3,
          furniture: [{
            id: 'f',
            name: 'Regal',
            type: 'regal',
            x: 0,
            y: 0,
            width: 1,
            depth: .5,
            rotation: 0,
            shelves: [],
          }],
        }], bottles: [], assignments: {},
      },
      selected: 'shelves',
      warehouseRoomId: 'r',
      warehousePlanMode: '3d',
      warehouseSelectedFurnitureIds: ['f'],
    };
    let html = '', manager = '';
    const savedDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () => null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
      /**
       * Retrieves element by id from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getElementById: () => null,
    };
    try {
      const view = createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} output Output resource or accumulated result.
         */
        shell: output => {html = output;},
        /**
         * Updates the navigate state for its caller.
         */
        navigate: () => {},
        modal: {
          /**
           * Renders modal in the current view.
           *
           * @param {*} _title Value used by this operation.
           * @param {*} content Content to render, store or examine.
           */
          showModal: (_title, content) => {manager = content;},
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      assert.doesNotMatch(html, /warehouse-bulk-edit/);
      view.openFurnitureBulkManager();
    } finally {
      if (savedDocument === undefined) delete globalThis.document;
      else globalThis.document = savedDocument;
    }
    const actionButtons =
      [...manager.matchAll(
        new RegExp(
          '<button[^>]*data-act="warehouse-bulk-(?:se' +
          'lect-all|clear|delete|edit)"[^>]*>',
          'g'
        ))].map(match => match[0]);
    assert.equal(actionButtons.length, 4);
    for (const button of actionButtons) assert.match(button,
      /class="btn small(?: |")/);
  }
);


test(
  'room plan shows dominant room name, metrics and a single compact tools bar',
  () => {
    const state = {
      warehouse: {
        schemaVersion: 1,
        rooms: [{
          id: 'r',
          name: 'Whiskyzimmer',
          width: 3,
          height: 4,
          furniture: [{
            id: 'f',
            name: 'Regal',
            type: 'regal',
            x: 0,
            y: 0,
            width: 1,
            depth: .5,
            rotation: 0,
            shelves: [],
          }],
        }],
        bottles: [],
        assignments: {},
      },
      selected: 'rooms',
      warehouseRoomId: 'r',
      warehousePlanMode: '3d',
    };
    let html = ''; const previous = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () =>
        null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    try {
      createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} value Value to process.
         */
        shell: value => {html = value;},
        /**
         * Updates the navigate state for its caller.
         */
        navigate: () => {},
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      }).render();
    }
    finally {
      if (previous ===
        undefined) delete globalThis.document; else globalThis.document =
          previous;
    }
    assert.match(
      html,
      new RegExp(
        '<header class="warehouse-room-summary"><di' +
        'v class="warehouse-room-identity"><h3(?: d' +
        'ata-i18n-ignore)?>Whiskyzimmer<\\/h3><span' +
        '>3 × 4 m<\\/span>'
      )
    );
    assert.equal((html.match(/Gesamtkapazität:/g) || []).length, 1);
    const toolbar = html.match(
      /<div class="warehouse-plan-tools"[^>]*>(.*?)<\/div><\/div>/s)?.[0] || '';
    assert.match(toolbar, /data-mode="2d"/);
    assert.match(toolbar, /data-mode="3d"/);
    assert.match(toolbar, /warehouse-camera-toolbar/);
    assert.match(toolbar, /id="warehouse-plan-zoom"/);
    assert.ok(html.indexOf('warehouse-plan-tools') <
      html.indexOf('warehouse-three-viewport'));
    assert.doesNotMatch(html, /class="warehouse-subtitle">Whiskyzimmer/);
  }
);

test(
  'furniture wall switches render independently with accessible labels and \
preserved states',
  () => {
    const state = {
      warehouse: {
        schemaVersion: 1,
        rooms: [{
          id: 'r',
          name: 'Raum',
          width: 4,
          height: 4,
          furniture: [{
            id: 'f',
            name: 'Schrank',
            type: 'schrank',
            x: 0,
            y: 0,
            width: 1,
            depth: .5,
            rotation: 0,
            leftSidePanel: true,
            rightSidePanel: false,
            backPanel: true,
            shelves: [],
          }],
        }],
        bottles: [],
        assignments: {},
      },
      selected: 'rooms',
      warehouseRoomId: 'r',
    };
    let html = ''; const previous = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () =>
        null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    try {
      createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         */
        shell: () => {},
        /**
         * Updates the navigate state for its caller.
         */
        navigate: () => {},
        modal: {
          /**
           * Renders modal in the current view.
           *
           * @param {*} _title Value used by this operation.
           * @param {*} value Value to process.
           */
          showModal: (_title, value) => {html = value;},
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      }).openForm('furniture',
        'f'
      );
    }
    finally {
      if (previous ===
        undefined) delete globalThis.document; else globalThis.document =
          previous;
    }
    assert.match(html, /fieldset class="warehouse-wall-options"/);
    assert.equal(
      (html.match(/class="warehouse-wall-toggle"/g) || []).length,
      3
    );
    assert.match(html, /name="leftSidePanel" checked/);
    assert.match(html, /name="rightSidePanel" (?!checked)/);
    assert.match(html, /name="backPanel" checked/);
  }
);


test(
  'Raumpläne are limited to spatial layout, while Regale & Fächer owns wall,\
 editing and bottle actions',
  () => {
    const room = {
      id: 'r', name: 'Lager', width: 4, height: 3, furniture: [{
        id: 'f',
        name: 'Regal 1',
        type: 'regal',
        x: 0,
        y: 0,
        width: 1,
        depth: .5,
        elevation: 0,
        itemHeight: 1.5,
        rotation: 0,
        shelves: [{id: 's', name: 'Fach', capacity: 3}],
      }],
    };
    const state = {
      warehouse: {
        rooms: [room],
        bottles: [{id: 'b', name: 'Bottle'}],
        assignments: {b: 's'},
      },
      selected: 'rooms',
      warehouseRoomId: 'r',
      warehouseFurnitureId: 'f',
      warehousePlanMode: '2d',
    };
    let html = '';
    const original = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () => null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
      /**
       * Retrieves element by id from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getElementById: () => null,
    };
    try {
      const view = createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} value Value to process.
         */
        shell: value => {html = value;},
        /**
         * Updates the navigate state for its caller.
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
      assert.match(html, /class="warehouse-floor"/);
      assert.match(html, /data-act="warehouse-open-shelves"/);
      assert.match(
        html,
        /data-act="warehouse-furniture-new"/,
        'place furniture without leaving the room plan'
      );
      assert.match(
        html,
        /data-act="warehouse-furniture-manage"/,
        'selected furniture can manage compartments in a modal'
      );
      assert.doesNotMatch(
        html,
        new RegExp(
          'warehouse-room-wall|warehouse-furniture-pa' +
          'nel|warehouse-shelf-new|warehouse-bulk-edi' +
          't|warehouse-bottle-symbol|data-mode="wall"'
        )
      );
      state.selected = 'shelves';
      state.warehouseFurnitureId = 'f';
      view.render();
      assert.match(html, /class="warehouse-room-wall"/);
      assert.match(html, /data-act="warehouse-furniture-new"/);
      assert.match(html, /data-act="warehouse-furniture-bulk"/);
      assert.match(html, /data-act="warehouse-furniture-manage"/);
      assert.doesNotMatch(
        html,
        /warehouse-bulk-edit|warehouse-furniture-panel/
      );
      assert.match(html, /warehouse-bottle-select/);
      assert.doesNotMatch(
        html,
        new RegExp(
          'warehouse-floor|warehouse-three-viewport|w' +
          'arehouse-plan-tools|data-act="warehouse-ro' +
          'om-new"'
        )
      );
    } finally {
      if (original === undefined) delete globalThis.document;
      else globalThis.document = original;
    }
  }
);


test(
  'a selected furniture in Raumpläne presents an actionable position \
summary, not a shelf editor',
  () => {
    const room = {
      id: 'r',
      name: 'Plan room',
      width: 4,
      height: 3,
      furniture: [{
        id: 'f',
        name: 'Top unit',
        type: 'haengeregal',
        x: 1.2,
        y: .4,
        elevation: 1.9,
        width: 1,
        depth: .4,
        rotation: 0,
        shelves: [{id: 's', name: 'Fach'}],
      }],
    };
    const state = {
      warehouse: {rooms: [room], bottles: [], assignments: {}},
      selected: 'rooms',
      warehousePlanMode: '2d',
      warehouseRoomId: room.id,
      warehouseFurnitureId: 'f',
    };
    let html = ''; const previous = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () =>
        null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    try {
      createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} markup HTML markup for the selected content.
         */
        shell: markup => {html = markup;},
        /**
         * Updates the navigate state for its caller.
         */
        navigate: () => {},
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      }).render();
    }
    finally {
      if (previous ===
        undefined) delete globalThis.document; else globalThis.document =
          previous;
    }
    assert.match(
      html,
      /class="warehouse-section-boundary warehouse-plan-focus"/
    );
    assert.match(html, /Top unit/);
    assert.match(html, /X: 1,2 m/);
    assert.match(html, /data-act="warehouse-open-shelves"/);
    assert.doesNotMatch(
      html,
      /class="warehouse-management-drawer"|warehouse-furniture-panel/
    );
  }
);

test(
  'shelf management shows bottles in its modal without duplicating the wall \
on the page',
  () => {
    const room = {
      id: 'r',
      name: 'Storage',
      width: 5,
      height: 4,
      furniture: [{
        id: 'f',
        name: 'Shelf',
        type: 'regal',
        width: 1,
        depth: .5,
        itemHeight: 1.5,
        shelves: [{id: 's', name: 'One', capacity: 2}],
      }],
    };
    const state = {
      warehouse: {
        rooms: [room],
        bottles: [{id: 'b', name: 'Bottle'}],
        assignments: {b: 's'},
      },
      selected: 'shelves',
      warehouseRoomId: 'r',
      warehouseFurnitureId: 'f',
    };
    let html = '', manager = '', wide = false; const previous =
      globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () =>
        null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} markup HTML markup for the selected content.
         */
        shell: markup => {html = markup;},
        /**
         * Updates the navigate state for its caller.
         */
        navigate: () => {},
        modal: {
          /**
           * Renders modal in the current view.
           *
           * @param {*} _title Value used by this operation.
           * @param {*} content Content to render, store or examine.
           * @param {*} isWide Value used by this operation.
           */
          showModal: (_title, content, isWide) => {
            manager =
              content; wide = isWide;
          },
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      assert.match(html, /data-act="warehouse-furniture-manage"/);
      assert.doesNotMatch(
        html,
        new RegExp(
          'warehouse-management-drawer|warehouse-furn' +
          'iture-panel|warehouse-shelf-edit'
        )
      );
      assert.equal(
        (html.match(/class="warehouse-bottle-symbol"/g) || []).length,
        1
      );
      view.openFurnitureManager('f');
      assert.equal(wide, true);
      assert.match(
        manager,
        /class="warehouse-furniture-manager warehouse-shelves-management"/
      );
      assert.match(manager, /data-act="warehouse-shelf-edit"/);
      assert.match(manager, /data-act="warehouse-furniture-edit"/);
      assert.match(manager, /data-act="warehouse-bottle-preview" data-id="b"/);
      const actionIndex =
        manager.indexOf('class="actions warehouse-furniture-actions"');
      const photosIndex =
        manager.indexOf(
          'class="warehouse-furniture-photos bottle-entry-gallery"');
      assert.ok(
        actionIndex >= 0 && photosIndex > actionIndex,
        'shelf and assignment controls precede furniture photos'
      );
      assert.match(
        manager,
        new RegExp(
          'class="warehouse-furniture-photo-actions b' +
          'ottle-photo-add-actions"><label class="pho' +
          'to-add"'
        )
      );
      assert.equal(
        (manager.match(/data-furniture-photos="f"/g) || []).length,
        2,
        'upload and camera inputs remain available'
      );
      assert.doesNotMatch(
        manager,
        /class="photo-edit-trigger"/,
        'furniture photos have no photo editor icon'
      );
      assert.equal(
        (manager.match(/class="warehouse-bottle-symbol/g) || []).length,
        1,
        'only bottles from the selected furniture are shown'
      );
    } finally {
      if (previous ===
        undefined) delete globalThis.document; else globalThis.document =
          previous;
    }
  }
);

test(
  'single furniture modal stays scoped to the clicked cabinet; batch edit \
has a separate dialog',
  () => {
    const room = {
      id: 'room', name: 'Room', width: 5, height: 4, furniture: [
        {
          id: 'a',
          name: 'Left cabinet',
          type: 'schrank',
          x: 0,
          y: 0,
          width: 1,
          depth: .5,
          itemHeight: 1.5,
          shelves: [{id: 'sa', name: 'Left shelf'}],
        },
        {
          id: 'b',
          name: 'Right cabinet',
          type: 'schrank',
          x: 1,
          y: 0,
          width: 1,
          depth: .5,
          itemHeight: 1.5,
          shelves: [{id: 'sb', name: 'Right shelf'}],
        },
      ],
    };
    const state = {
      warehouse: {
        rooms: [room],
        bottles: [
          {id: 'left-bottle', name: 'Left whisky'},
          {id: 'right-bottle', name: 'Right whisky'},
        ],
        assignments: {'left-bottle': 'sa', 'right-bottle': 'sb'},
      },
      selected: 'shelves',
      warehouseRoomId: 'room',
      warehouseFurnitureId: 'a',
    };
    const oldDocument = globalThis.document;
    let page = '', dialog = '', title = '';
    const viewport = {
      dataset: {roomId: 'room'}, scrollLeft: 0, isConnected:
        true,
    };
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector(selector) {
        return selector === '.warehouse-wall-scroll' ?
          viewport : null;
      },
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} html HTML markup to render or inspect.
         */
        shell: html => {page = html;},
        modal: {
          /**
           * Renders modal in the current view.
           *
           * @param {*} label Label shown to the user.
           * @param {*} content Content to render, store or examine.
           */
          showModal: (label, content) => {
            title = label; dialog =
              content;
          },
        },
        /**
         * Updates the navigate state for its caller.
         */
        navigate: () => {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      view.openFurnitureManager('a');
      assert.equal(title, 'Left cabinet');
      assert.match(dialog, /Left shelf/);
      assert.match(
        dialog,
        /data-act="warehouse-bottle-preview" data-id="left-bottle"/
      );
      assert.doesNotMatch(
        dialog,
        new RegExp(
          'right-bottle|Right shelf|warehouse-bulk-li' +
          'st|warehouse-bulk-check|warehouse-bulk-pic' +
          'k'
        )
      );
      viewport.scrollLeft = 275;
      view.openFurnitureManager('b');
      assert.equal(title, 'Right cabinet');
      assert.match(dialog, /Right shelf/);
      assert.match(
        dialog,
        /data-act="warehouse-bottle-preview" data-id="right-bottle"/
      );
      assert.doesNotMatch(dialog, /left-bottle|Left shelf|warehouse-bulk-list/);
      assert.equal(viewport.scrollLeft, 275);
      view.openFurnitureBulkManager();
      assert.match(dialog, /warehouse-furniture-bulk-manager/);
      assert.match(dialog, /data-act="warehouse-toggle-furniture"/);
      assert.doesNotMatch(
        dialog,
        /warehouse-furniture-panel|warehouse-shelf-edit|type="checkbox"/
      );
      view.toggleFurnitureBulkSelection('a');
      view.openFurnitureBulkManager();
      assert.match(dialog, /aria-pressed="true"/);
      assert.doesNotMatch(
        page,
        /warehouse-furniture-panel|warehouse-management-drawer/
      );
    } finally {
      if (oldDocument ===
        undefined) delete globalThis.document; else globalThis.document =
          oldDocument;
    }
  }
);

test(
  'deleting an occupied room asks to unassign bottles before deletion; \
empty room offers normal removal',
  () => {
    const room = {
      id: 'r',
      name: 'My <Room>',
      width: 4,
      height: 3,
      furniture: [{id: 'f', name: 'Shelf', shelves: [{id: 's1'}, {id: 's2'}]}],
    };
    const state = {
      warehouse: {
        rooms: [
          room,
          {
            id: 'other',
            name: 'Other',
            furniture: [{shelves: [{id: 'other-shelf'}]}],
          },
        ],
        assignments: {b1: 's1', b2: 's2', b3: 'other-shelf'}, bottles: [],
      },
    };
    const dialogs = [];
    const view = createWarehouseView({
      state,
      /**
       * Updates the shell state for its caller.
       */
      shell: () => {},
      /**
       * Updates the navigate state for its caller.
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
    view.askDelete('room', 'r');
    assert.match(dialogs.at(-1).title, /Raum/);
    assert.match(dialogs.at(-1).html, /2 Flaschen/);
    assert.match(dialogs.at(-1).html, /My &lt;Room&gt;/);
    assert.doesNotMatch(dialogs.at(-1).html, /<Room>/);
    assert.match(dialogs.at(-1).html, /data-act="close-modal"/);
    assert.match(
      dialogs.at(-1).html,
      /data-act="warehouse-confirm-delete-unassign"/
    );
    assert.doesNotMatch(
      dialogs.at(-1).html,
      /data-act="warehouse-confirm-delete"/
    );
    state.warehouse.assignments = {b3: 'other-shelf'};
    view.askDelete('room', 'r');
    assert.match(dialogs.at(-1).html, /data-act="warehouse-confirm-delete"/);
    assert.doesNotMatch(
      dialogs.at(-1).html,
      /warehouse-confirm-delete-unassign/
    );
  }
);

test(
  'unassigned bottles tray shows only search and bottles without the long \
help paragraph',
  async () => {
    const {renderUnassignedTray} =
      await import('../../public/js/views/warehouse-unassigned-tray.js');
    const warehouse = {rooms: [], bottles: [], assignments: {}};
    const html = renderUnassignedTray(warehouse, [], {
      embedded: true,
      expanded: true,
    });
    assert.match(html, /id="warehouse-unassigned-wall-search"/);
    assert.match(html, /class="warehouse-unassigned-page-search"/);
    assert.match(html, /placeholder="Flaschenname oder Inventarnummer suchen"/);
    const footer = html.match(
      new RegExp(
        '<div class="warehouse-unassigned-paginatio' +
        'n">([\\s\\S]*?)<\\/div>\\s*<\\/div>'
      ))?.[1] || '';
    assert.ok(
      footer.includes('warehouse-unassigned-page-summary'),
      'item counter must appear in footer'
    );
    assert.ok(
      footer.indexOf('warehouse-unassigned-page-summary') <
      footer.indexOf('warehouse-unassigned-wall-search'),
      'search must follow item counter'
    );
    assert.ok(
      footer.indexOf('warehouse-unassigned-wall-search') <
      footer.indexOf('warehouse-unassigned-page-controls'),
      'search must precede pagination buttons'
    );
    assert.doesNotMatch(html, /warehouse-unassigned-search-label/);
    assert.match(html, /aria-label="Flaschen suchen"/);
    assert.doesNotMatch(
      html,
      /Virtuelles Ablageregal|höchstens 24 Flaschen|unassignedHint/
    );
    const locale = JSON.parse(fs.readFileSync('public/locales/de.json',
      'utf8'));
    assert.equal(Object.hasOwn(locale, 'warehouse.wall.unassignedHint'), false);
  }
);


test(
  'furniture without compartments remains reachable to add its first shelf',
  () => {
    const room = {
      id: 'room-empty-shelves',
      name: 'Whiskyzimmer',
      width: 4,
      height: 3,
      furniture: [{
        id: 'unconfigured',
        name: 'Neue Vitrine',
        type: 'vitrine',
        x: 0,
        y: 0,
        width: 1,
        depth: .5,
        itemHeight: 1.8,
        rotation: 0,
        shelves: [],
      }],
    };
    const state = {
      warehouse: {rooms: [room], bottles: [], assignments: {}},
      page: 'warehouse',
      selected: 'shelves',
      warehouseRoomId: room.id,
    };
    let html = '';
    const original = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () => null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
      /**
       * Retrieves element by id from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getElementById: () => null,
    };
    try {
      const view = createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} value Value to process.
         */
        shell: value => {html = value;},
        /**
         * Updates the navigate state for its caller.
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
      assert.match(html, /warehouse-unconfigured-furniture/);
      assert.match(html, /Neue Vitrine/);
      assert.match(
        html,
        /data-act="warehouse-shelf-new" data-id="unconfigured"/
      );
      let form = '';
      const formView = createWarehouseView({
        state,
        /**
         * Updates the shell state for its caller.
         */
        shell: () => {},
        /**
         * Updates the navigate state for its caller.
         */
        navigate: () => {},
        modal: {
          /**
           * Renders modal in the current view.
           *
           * @param {*} _title Value used by this operation.
           * @param {*} value Value to process.
           */
          showModal: (_title, value) => {form = value;},
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      formView.openForm('shelf', 'unconfigured');
      assert.match(
        form,
        /data-endpoint="\/api\/warehouse\/furniture\/unconfigured\/shelves"/
      );
    } finally {
      if (original === undefined) delete globalThis.document;
      else globalThis.document = original;
    }
  }
);


test(
  'furniture photos reuse bottle-photo tiles without edit icon or move arrows',
  async () => {
    const {shelfPanel} =
      await import('../../public/js/views/warehouse-presentation.js');
    const furniture = {
      id: 'f',
      name: 'Photo shelf',
      type: 'regal',
      width: 1,
      depth: .5,
      itemHeight: 1.5,
      shelves: [{id: 's', name: 'Fach 1'}],
      photos: [
        {id: 'photo1', path: 'images/test/furniture-one.jpg'},
        {id: 'photo2', path: 'images/test/furniture-two.jpg'}],
    };
    const room = {
      id: 'r', name: 'Storage', width: 5, height: 4,
      furniture: [furniture],
    };
    const warehouse = {rooms: [room], bottles: [], assignments: {}};
    const html = shelfPanel(warehouse, room, furniture, {managementOnly: true});
    assert.match(
      html,
      /class="warehouse-furniture-photos bottle-entry-gallery"/
    );
    assert.match(html, /class="warehouse-furniture-photo-list bottle-photos"/);
    assert.equal(
      (html.match(/class="warehouse-furniture-photo photo-tile"/g) ||
        []).length,
      2
    );
    assert.equal(
      (html.match(/class="warehouse-photo-open photo-open"/g) || []).length,
      2
    );
    assert.equal(
      (html.match(/class="photo-remove" data-act="warehouse-photo-delete"/g) ||
        []).length,
      2
    );
    assert.doesNotMatch(
      html,
      new RegExp(
        'data-act="warehouse-photo-move"|class="pho' +
        'to-controls"|class="photo-move"'
      )
    );
    assert.doesNotMatch(html, /photo-edit-trigger|data-photo-drag/);
    assert.match(
      html,
      /class="warehouse-furniture-photo-actions bottle-photo-add-actions"/
    );
    assert.equal((html.match(/data-furniture-photos="f"/g) || []).length, 2);
  }
);
