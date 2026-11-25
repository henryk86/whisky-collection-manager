import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

test(
  'physical bottle multi-selection remains in the storage wall, not in the finder',
  () => {
    const warehouse = {
      rooms: [{
        id: 'room', name: 'Raum', width: 5, height: 4, furniture: [
          {
            id: 'f',
            name: 'Regal 1',
            type: 'regal',
            width: 1,
            itemHeight: 2,
            elevation: 0,
            shelves: [{id: 's', name: 'Fach 1', capacity: 3}],
          }],
      }],
      bottles: [{id: 'b1', name: 'Whisky 1'}, {id: 'b2', name: 'Whisky 2'}],
      assignments: {b1: 's', b2: 's'},
    };
    const state = {
      warehouse,
      selected: 'find',
      warehouseUnassigned: false,
      warehouseSearch: '',
      warehouseRoomId: 'room',
      warehousePlanMode: 'wall',
      warehouseSelectedBottleIds: ['b1', 'b2'],
    };
    let html = '', dialog = '';
    const view = createWarehouseView({
      state,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} source Input source to inspect.
       */
      shell: source => {html = source;},
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
      view.render();
      assert.doesNotMatch(renderedText(html), /class="warehouse-bottle-check"/);
      assert.doesNotMatch(renderedText(html), /data-act="warehouse-bottles-assign-selected"/);
      assert.match(renderedText(html), /warehouse-finder-card/);
      assert.match(renderedText(html), /data-act="warehouse-find-location"/);
      state.selected = 'shelves';
      view.render();
      view.assignSelectedBottles();
      assert.match(renderedText(dialog), /data-endpoint="\/api\/warehouse\/bottles\/bulk"/);
      assert.match(renderedText(dialog), /data-bottle-bulk="true"/);
      assert.match(renderedText(html), /class="warehouse-room-wall"/);
      assert.equal((renderedText(html).match(/class="warehouse-wall-bottle is-selected"/g) || []).length, 2);
      assert.match(renderedText(html), /warehouse-bottle-bulk-tools/);
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
  }
);

test(
  'wall bottle selection toggles a pressed, highlighted bottle without checkboxes',
  () => {
    const warehouse = {
      rooms: [],
      bottles: [{id: 'b1', name: 'Bottle 1'}, {id: 'b2', name: 'Bottle 2'}],
      assignments: {},
    };
    const state = {warehouse, warehouseSelectedBottleIds: []};
    const marked = new Set();
    const attributes = new Map();
    const button = {
      dataset: {
        id: 'b1',
        selectLabel: 'Select bottle',
        deselectLabel: 'Remove bottle',
      },
      /**
       * Updates attribute in the current state.
       *
       * @param {*} key Key used to select or group values.
       * @param {*} value Value to process.
       * @return {!Map<*, *>} Result computed from the supplied inputs.
       */
      setAttribute: (key, value) => attributes.set(key, value),
      /**
       * Performs the closest lifecycle action.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Structured result assembled from the input data.
       */
      closest: selector => selector === '.warehouse-wall-bottle' ? {
        classList: {
          /**
           * Derives the toggle result from the supplied values.
           *
           * @param {*} name Environment variable or setting name.
           * @param {*} enabled Value used by this operation.
           * @return {*} Result computed from the supplied inputs.
           */
          toggle: (name, enabled) => enabled ? marked.add(name) : marked.delete(name),
        },
      } : null,
    };
    const clear = {disabled: true};
    const assign = {disabled: true};
    const preview = {disabled: true};
    const label = {textContent: ''};
    const original = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector all result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelectorAll: selector => ({
        '.warehouse-bottle-check': [],
        '.warehouse-wall-bottle .warehouse-bottle-symbol': [button],
        '.warehouse-bottles-preview-selected': [preview],
        '.warehouse-bottle-selection-count': [label],
        '.warehouse-bottles-select-clear,.warehouse-bottles-assign-selected': [clear, assign],
      }[selector] || []),
    };
    try {
      const view = createWarehouseView({state});
      view.toggleWallBottleSelection('b1');
      assert.deepEqual(state.warehouseSelectedBottleIds, ['b1']);
      assert.equal(renderedText(attributes.get('aria-pressed')), 'true');
      assert.equal(renderedText(attributes.get('aria-label')), 'Remove bottle');
      assert.equal(renderedText(marked.has('is-selected')), true);
      assert.equal(renderedText(clear.disabled), false);
      assert.equal(renderedText(assign.disabled), false);
      assert.equal(renderedText(preview.disabled), false);
      view.toggleWallBottleSelection('b2');
      assert.deepEqual(state.warehouseSelectedBottleIds, ['b1', 'b2']);
      assert.equal(renderedText(preview.disabled), true);
      view.toggleWallBottleSelection('b1');
      assert.deepEqual(state.warehouseSelectedBottleIds, ['b2']);
      assert.equal(renderedText(attributes.get('aria-pressed')), 'false');
      assert.equal(renderedText(marked.has('is-selected')), false);
      view.clearBottleSelection();
      assert.deepEqual(state.warehouseSelectedBottleIds, []);
      assert.equal(renderedText(clear.disabled), true);
      assert.equal(renderedText(assign.disabled), true);
    } finally {
      if (original === undefined) delete globalThis.document;
      else globalThis.document = original;
    }
  }
);
