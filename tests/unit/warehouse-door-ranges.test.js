import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {warehouse3DGeometry}
  from '../../public/js/domain/warehouse-3d-model.js';
import {visibleShelfFront} from '../../shared/warehouse-compartments.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

const item = {
  id: 'f',
  name: 'Vitrinenschrank',
  type: 'regal',
  x: 0,
  y: 0,
  width: 1.2,
  depth: 0.5,
  rotation: 0,
  elevation: 0,
  itemHeight: 2,
  doorLeaves: 2,
  glassFrame: true,
  doorRanges: [
    {from: 1, to: 2, front: 'door', doorLeaves: 1, glassFrame: null},
    {from: 3, to: 5, front: 'glass', doorLeaves: 2, glassFrame: true},
  ],
  shelves: Array.from(
    {length: 5},
    (_, i) => ({
      id: 's' + i,
      name: 'Fach ' + (i + 1),
      capacity: i === 0 ? 0 : 5,
      heightCm: 40,
      front: 'open',
    })
  ),
};
const room = {id: 'r', name: 'Raum', width: 5, height: 4, furniture: [item]};
const warehouse = {rooms: [room], assignments: {}, bottles: []};

test(
  'door ranges draw continuous doors across compartments in all rotations',
  () => {
    assert.deepEqual(
      item.shelves.map((_, i) => visibleShelfFront(item, i)),
      ['door', 'door', 'glass', 'glass', 'glass']
    );
    for (const rotation of [0, 90, 180, 270]) {
      const furniture = {...item, rotation};
      const parts = warehouse3DGeometry({...room, furniture: [furniture]}, warehouse).objects[0].parts;
      const doors = parts.filter(p => p.role === 'door');
      const glass = parts.filter(p => p.role === 'glass-front');
      assert.equal(doors.length, 1);
      assert.equal(glass.length, 2);
      assert.equal(parts.filter(p => p.role === 'glass-frame').length, 8);
      assert.ok(Math.abs(doors[0].size[1] - (.8 - 0.0156)) < .06);
      assert.ok(Math.abs(glass[0].size[1] - (1.2 - 0.0156)) < .06);
      assert.ok(parts.every(p => p.size.every(v => v > 0)));
    }
  }
);

test(
  'furniture form exposes range configuration and zero-capacity shelves hide empty text',
  () => {
    let html = '', form = ''; const previous = globalThis.document;
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
        state: {
          warehouse,
          selected: 'shelves',
          warehouseRoomId: 'r',
          warehouseFurnitureId: 'f',
        },
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
         * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
         */
        shell: value => html = value,
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate: () => {},
        modal: {
          /**
           * Captures the dialog body without mounting the modal overlay.
           *
           * @param {string} _title Dialog title ignored by this fixture.
           * @param {import('../../public/js/ui/render-plan.js').RenderContent} body Dialog content captured for assertions.
           * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured dialog content.
           */
          showModal: (_title, body) => form = body,
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      assert.ok(!renderedText(html).includes('0 / 0 Flaschen'));
      assert.equal(
        (renderedText(html).match(/Fach ist leer/g) || []).length,
        4,
        'the room wall renders four compartments once; edit controls live in a modal'
      );
      view.openForm('furniture', 'f');
      assert.match(renderedText(form), /warehouse-door-range-list/);
      assert.match(renderedText(form), /door-range-from/);
      assert.match(renderedText(form), /door-range-frame/);
      assert.match(renderedText(form), /Türbereich/);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
    }
  }
);
