import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

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
      assert.equal(attributes.get('aria-pressed'), 'true');
      assert.equal(attributes.get('aria-label'), 'Remove bottle');
      assert.equal(marked.has('is-selected'), true);
      assert.equal(clear.disabled, false);
      assert.equal(assign.disabled, false);
      assert.equal(preview.disabled, false);
      view.toggleWallBottleSelection('b2');
      assert.deepEqual(state.warehouseSelectedBottleIds, ['b1', 'b2']);
      assert.equal(preview.disabled, true);
      view.toggleWallBottleSelection('b1');
      assert.deepEqual(state.warehouseSelectedBottleIds, ['b2']);
      assert.equal(attributes.get('aria-pressed'), 'false');
      assert.equal(marked.has('is-selected'), false);
      view.clearBottleSelection();
      assert.deepEqual(state.warehouseSelectedBottleIds, []);
      assert.equal(clear.disabled, true);
      assert.equal(assign.disabled, true);
    } finally {
      if (original === undefined) delete globalThis.document;
      else globalThis.document = original;
    }
  }
);
