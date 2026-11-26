import {domElements, domText, domTextIndex, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

const base = {
  id: 'c',
  name: 'Gemischter Schrank',
  type: 'schrank',
  x: 1,
  y: 0.5,
  width: 1.6,
  depth: 0.6,
  rotation: 0,
  elevation: 0.2,
  itemHeight: 2,
  shelves: [
    {id: 'low', name: 'Untertür', front: 'door', heightCm: 60, capacity: 5},
    {id: 'mid', name: 'Offenes Fach', front: 'open', heightCm: 80, capacity: 7},
    {id: 'top', name: 'Glas oben', front: 'glass', heightCm: 60, capacity: 5},
  ],
};

const room = {id: 'r', name: 'Zimmer', width: 5, height: 4, furniture: [base]};

const warehouse = {rooms: [room], assignments: {}, bottles: []};

test(
  'shelf edit form offers front and centimeter height and panel lists fronts top to bottom',
  async () => {
    let html = ''; let form = '';
    const state = {
      warehouse,
      selected: 'shelves',
      warehouseRoomId: 'r',
      warehouseFurnitureId: 'c',
      warehousePlanMode: '2d',
    };
    const doc = globalThis.document;
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
           * @param {*} _name Value used by this operation.
           * @param {*} content Content to render, store or examine.
           * @return {*} Result computed from the supplied inputs.
           */
          showModal: (_name, content) => form = content,
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      assert.ok(await domTextIndex(html, 'Glas oben') < await domTextIndex(html, 'Offenes Fach'));
      assert.ok(await domTextIndex(html, 'Offenes Fach') < await domTextIndex(html, 'Untertür'));
      view.openFurnitureManager('c');
      assert.match(await domText(form), /Glastür · 1-flügelig · ohne Rahmen · 60 cm/);
      await assertDom(form, 'button', {'aria-label': 'Fach nach oben verschieben'});
      await assertDom(html, ".warehouse-furniture-panel", {}, true, 'furniture editing is modal only');
      view.openForm('shelf', 'mid');
      assert.ok((await domElements(form, '[name="heightCm"]')).length > 0);
      assert.ok((await domElements(form, '[name="front"]')).length > 0);
      assert.ok((await domElements(form, '[name="doorLeaves"]')).length > 0);
      assert.ok((await domElements(form, '[name="glassFrame"]')).length > 0);
      await assertDom(form, "*", {"text": new RegExp("^Holztür$")});
      await assertDom(form, "*", {"text": new RegExp("^Glastür$")});
    } finally {
      if (doc === undefined) delete globalThis.document; else globalThis.document = doc;
    }
  }
);

test(
  'furniture edit and bulk edit both offer door leaf and glass frame defaults',
  async () => {
    const state = {
      warehouse,
      selected: 'shelves',
      warehouseRoomId: 'r',
      warehouseFurnitureId: 'c',
    };
    let form = ''; const doc = globalThis.document;
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
      view.openForm('furniture', 'c');
      assert.ok((await domElements(form, '[name="doorLeaves"]')).length > 0);
      assert.ok((await domElements(form, '[name="glassFrame"]')).length > 0);
      state.warehouseSelectedFurnitureIds = ['c'];
      view.openForm('furniture-bulk');
      assert.ok((await domElements(form, '[name="doorLeaves"]')).length > 0);
      assert.ok((await domElements(form, '[name="glassFrame"]')).length > 0);
    } finally {
      if (doc === undefined) delete globalThis.document; else globalThis.document = doc;
    }
  }
);
