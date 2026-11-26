import {renderedText, domElements} from '../helpers/rendering.js';
import {createBottleForm} from '../../public/js/features/forms/bottle.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingBottlings, bottlingChoiceDialog, bottlingChoiceOptions}
  from '../../public/js/features/forms/bottling-choice.js';
import {createEditors} from '../../public/js/features/editor-controller.js';

const collection = {
  distilleries: [{id: 'dist-a', name: 'Lagavulin'}],
  bottlings: [
    {
      id: 'whisky-a',
      name: 'Islay Malt 16',
      bottler: 'Bottler One',
      distilleryIds: ['dist-a'],
      bottles: [{id: 'bottle-1'}],
    },
    {
      id: 'whisky-b',
      name: 'Highland Malt',
      bottler: 'Other Bottler',
      bottles: [],
    },
  ],
};

test(
  'chooser searches existing bottlings by name, distillery and bottler without mutating them',
  () => {
    assert.deepEqual(matchingBottlings(collection, 'islay').map(entry => entry.id), ['whisky-a']);
    assert.deepEqual(matchingBottlings(collection, 'lagavulin').map(entry => entry.id), ['whisky-a']);
    assert.deepEqual(matchingBottlings(collection, 'OTHER bottler').map(entry => entry.id), ['whisky-b']);
    assert.equal(matchingBottlings(collection, 'absent').length, 0);
    const html = bottlingChoiceDialog(collection);
    assert.ok(domElements(html, '[id="new-bottle-choice-form"]').length > 0);
    assert.ok(domElements(html, '[data-act="new-bottling-direct"]').length > 0);
    assert.ok(domElements(html, '[name="bottlingId"][required]').length > 0);
    assert.match(renderedText(html), /option value=""/); // no implicit parent selection
    assert.ok(domElements(html, '[value="whisky-a"]').length > 0);
    assert.equal(domElements(bottlingChoiceOptions(collection, 'unmatched'), '[value="whisky-a"]').length, 0);
    assert.equal(collection.bottlings.length, 2);
    assert.equal(collection.bottlings[0].bottles.length, 1);
  }
);

test('chooser escapes untrusted whisky names and identifiers', () => {
  const malicious = {
    bottlings: [{
      id: 'x" onclick="oops',
      name: '<img src=x onerror=alert(1)>', bottles: [],
    }],
  };
  const html = bottlingChoiceDialog(malicious);
  assert.match(renderedText(html), /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(renderedText(html), /<img src=x/);
  assert.doesNotMatch(renderedText(html), /value="x" onclick=/);
});

test(
  'global action chooses reuse or new bottling; detail action still adds to selected bottling',
  () => {
    const state = {collection, selected: 'whisky-a'};
    const calls = [];
    const editors = createEditors({
      state,
      selectors: {
        /**
         * Selects bottle matching the input.
         * @return {*} Result computed from the supplied inputs.
         */
        findBottle: () => null,
      },
      /**
       * Derives the bottling form result from the supplied values.
       * @return {string} Minimal bottling-form fixture containing the expected ID.
       */
      bottlingForm: () => '<form id="bottling-form"></form>',
      /**
       * Supplies the real physical-bottle form builder for the selection scenario.
       *
       * @param {Object=} _ Existing bottle draft or empty defaults.
       * @param {string} id Parent bottling identifier.
       * @return {import('../../public/js/ui/render-plan.js').RenderPlan} Physical-bottle editor plan.
       */
      bottleForm: createBottleForm({
        state, selectors: {
          /**
           * Returns the test bottling's distillery label.
           * @return {string} Empty label for this fixture.
           */
          distilleryNames: () => '',
        },
      }),
      /**
       * Renders modal in the current view.
       *
       * @param {*} title Title displayed or stored by this operation.
       * @param {*} body Body content to validate or process.
       * @return {number} Calculated numeric value.
       */
      showModal: (title, body) => calls.push({title, body}),
      /**
       * Performs the close modal lifecycle action.
       */
      closeModal() {},
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Suppresses action execution in this rendering-only scenario.
       */
      action() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    editors.newBottling();
    assert.match(renderedText(calls.at(-1).body), /new-bottle-choice-form/);
    editors.chooseExistingBottling('whisky-a');
    assert.ok(domElements(calls.at(-1).body, '[data-from-overview="1"]').length > 0);
    assert.ok(domElements(calls.at(-1).body, '[data-bottling-id="whisky-a"]').length > 0);
    assert.throws(() => editors.chooseExistingBottling('missing'), /vorhandene Abfüllung/);
    editors.createBottling();
    assert.ok(domElements(calls.at(-1).body, '[id="bottling-form"]').length > 0);
    editors.newBottle();
    assert.ok(domElements(calls.at(-1).body, '[data-bottling-id="whisky-a"]').length > 0);
    assert.equal(domElements(calls.at(-1).body, '[data-from-overview]').length, 0);
    state.collection = {bottlings: [], distilleries: []};
    editors.newBottling();
    assert.ok(domElements(calls.at(-1).body, '[id="bottling-form"]').length > 0);
  }
);
