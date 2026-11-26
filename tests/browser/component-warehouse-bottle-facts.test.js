import {domElements, domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {bottleListFacts, bottleRow} from '../../public/js/views/warehouse-presentation.js';
import {renderUnassignedTray} from '../../public/js/views/warehouse-unassigned-tray.js';

const bottle = {
  id: 'b1',
  name: 'Whisky <Test>',
  number: '42',
  ageYears: 18,
  releaseYear: 2012,
  caskType: 'Oloroso & Bourbon',
};

test(
  'warehouse inventory rows show age, release year and cask type next to the correct bottle',
  async () => {
    const facts = bottleListFacts(bottle);
    assert.match(await domText(facts), /Alter:/);
    assert.match(await domText(facts), /18 Jahre/);
    assert.match(await domText(facts), /Erscheinungsjahr:.*2012/);
    assert.match(await domText(facts), new RegExp("Fasstyp:.*Oloroso & Bourbon"));
    const row = bottleRow({assignments: {}, rooms: []}, bottle);
    assert.ok((await domElements(row, '[class="warehouse-bottle-row-info"]')).length > 0);
    assert.match(await domText(row), new RegExp("Whisky <Test>"));
    await assertDom(row, ".warehouse-bottle-facts");
    await assertDom(row, "[data-bottle-search]", {"data-bottle-search": /2012.*oloroso/});
  }
);

test(
  'missing facts remain absent, and label text is escaped in the inventory and tray',
  async () => {
    assert.equal(bottleListFacts({name: 'unknown'}), '');
    await assertDom(bottleRow({assignments: {}, rooms: []}, {id: 'b2', name: 'No facts'}), ".warehouse-bottle-facts", {}, true);
    assert.match(await domText(bottleListFacts({...bottle, caskType: '<script>'})), new RegExp("<script>"));
    const warehouse = {bottles: [bottle], assignments: {}};
    const html = renderUnassignedTray(warehouse);
    await assertDom(html, "details.warehouse-unassigned-tray[aria-label]");
    assert.equal((await domElements(html, 'details[class="warehouse-unassigned-tray"][open]')).length, 0);
    assert.ok((await domElements(html, 'summary[class="warehouse-unassigned-summary"]')).length > 0);
    assert.match(await domText(html), /Erscheinungsjahr:.*2012/);
    assert.ok((await domElements(renderUnassignedTray(warehouse, [], {expanded: true}), 'details[class="warehouse-unassigned-tray"][open]')).length > 0);
    assert.ok((await domElements(html, '[data-unassigned-id="b1"]')).length > 0);
  }
);

test(
  'storage wall remembers an opened staging tray when the view re-renders',
  async () => {
    const {createWarehouseView} = await import('../../public/js/views/warehouse.js');
    const furniture = {
      id: 'f',
      name: 'Shelf',
      x: 0,
      y: 0,
      width: 1,
      depth: .5,
      itemHeight: 1,
      shelves: [{id: 's', name: 'Bay', capacity: 10}],
    };
    const warehouse = {
      rooms: [{
        id: 'r', name: 'Room', width: 3, height: 3,
        furniture: [furniture],
      }],
      bottles: [bottle],
      assignments: {},
    };
    const state = {
      warehouse,
      selected: 'shelves',
      warehouseRoomId: 'r',
      warehouseSelectedBottleIds: [],
    };
    let html = '', onClick;
    const tray = {hidden: true};
    const attributes = new Map();
    const original = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: selector => selector === '.warehouse-unassigned-toggle'
        ? {
          /**
           * Updates the add event listener state for its caller.
           *
           * @param {*} name Environment variable or setting name.
           * @param {function(...*): *} handler Handler input for this
           * operation.
           */
          addEventListener: (name, handler) => {
            assert.equal(name, 'click');
            onClick = handler;
          },
        }
        : selector === '.warehouse-unassigned-tray--embedded' ? tray : null,
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
      const view = createWarehouseView({
        state,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
         */
        shell: markup => {html = markup;},
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      assert.ok((await domElements(html, '[id="warehouse-wall-unassigned-content"][hidden]')).length > 0);
      assert.equal(typeof onClick, 'function');
      onClick({
        currentTarget: {
          /**
           * Updates attribute in the current state.
           *
           * @param {*} name Environment variable or setting name.
           * @param {*} value Value to process.
           * @return {!Map<*, *>} Result computed from the supplied inputs.
           */
          setAttribute: (name, value) =>
            attributes.set(name, value),
        },
      });
      assert.equal(attributes.get('aria-expanded'), 'true');
      assert.equal(tray.hidden, false);
      view.render();
      assert.ok((await domElements(html, '[class="warehouse-unassigned-toggle"][aria-expanded="true"]')).length > 0);
      assert.equal((await domElements(html, '[id="warehouse-wall-unassigned-content"][hidden]')).length, 0);
      onClick({
        currentTarget: {
          /**
           * Updates attribute in the current state.
           *
           * @param {*} name Environment variable or setting name.
           * @param {*} value Value to process.
           * @return {!Map<*, *>} Result computed from the supplied inputs.
           */
          setAttribute: (name, value) =>
            attributes.set(name, value),
        },
      });
      assert.equal(tray.hidden, true);
      view.render();
      assert.ok((await domElements(html, '[id="warehouse-wall-unassigned-content"][hidden]')).length > 0);
    } finally {
      if (original === undefined) delete globalThis.document;
      else globalThis.document = original;
    }
  }
);
