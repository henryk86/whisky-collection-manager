import {renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWhiskybase}
  from '../../public/js/features/whiskybase/controller.js';

const payload = {
  version: 2, source: 'external',
  fields: {
    whiskybaseId: '54321',
    whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/54321/example',
    name: 'Import in vorhandenem Tab',
  },
};

/**
 * Serializes mock import data to JSON.
 *
 * @param {!Object} options Options controlling the operation.
 * @return {!Array<*>} Resulting entries in their output order.
 */
function mockImport({openEditor}) {
  const oldLocation = globalThis.location;
  const oldHistory = globalThis.history;
  const oldDocument = globalThis.document;
  const oldSetTimeout = globalThis.setTimeout;
  const calls = [];
  const location = {
    pathname: '/', search: '?bottling=local-bottling',
    hash: '#wcm-import=' + encodeURIComponent(JSON.stringify(payload)),
  };
  globalThis.location = location;
  globalThis.history = {
    /**
     * Updates the replace state state for its caller.
     *
     * @param {*} args Arguments forwarded to the operation.
     */
    replaceState(...args) {
      calls.push(['history', args[2]]);
      location.hash = '';
    },
  };
  globalThis.document = {
    /**
     * Simulates an element lookup that finds nothing.
     * @return {null} Null to represent a missing element.
     */
    querySelector: () => null,
    /**
     * Constructs element from the supplied data.
     * @return {!Object} Result computed from the supplied inputs.
     */
    createElement: () => ({
      /**
       * Ignores removal in the simulated DOM.
       */
      remove() {}, className: '', textContent: '',
    }),
    body: {
      /**
       * Updates the append state for its caller.
       *
       * @param {*} el Value used by this operation.
       */
      append(el) {calls.push(['toast', el.textContent]);},
    },
  };
  globalThis.setTimeout =
    () => {}; // prevent nonessential toast timers in this unit test
  const state = {
    collection: {bottlings: [], distilleries: []},
    modal: openEditor ? {title: 'Abfüllung bearbeiten'} : null,
  };
  const controller = createWhiskybase({
    state,
    /**
     * Derives the navigate result from the supplied values.
     *
     * @param {!Array<*>} args Arguments forwarded to the operation.
     * @return {number} Calculated numeric value.
     */
    navigate: (...args) => calls.push(['navigate', ...args]),
    /**
     * Renders modal in the current view.
     *
     * @param {!Array<*>} args Arguments forwarded to the operation.
     * @return {number} Calculated numeric value.
     */
    showModal: (...args) => calls.push(['showModal', ...args]),
    /**
     * Performs the close modal lifecycle action.
     *
     * @param {!Array<*>} args Arguments forwarded to the operation.
     */
    closeModal: (...args) => {
      calls.push(['closeModal', ...args]);
      state.modal = null;
    },
    /**
     * Constructs bottling from the supplied data.
     * @return {number} Calculated numeric value.
     */
    createBottling: () => calls.push(['createBottling']),
  });
  return {
    calls, controller,
    /**
     * Updates the restore state for its caller.
     */
    restore() {
      if (oldLocation === undefined) delete globalThis.location; else globalThis.location = oldLocation;
      if (oldHistory === undefined) delete globalThis.history; else globalThis.history = oldHistory;
      if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
      globalThis.setTimeout = oldSetTimeout;
    },
  };
}

test('incoming hash import is processed in an already open manager tab', () => {
  const {calls, controller, restore} = mockImport({openEditor: false});
  try {
    controller.importFromExtension();
    assert.deepEqual(calls[0], ['history', '/?bottling=local-bottling']);
    assert.ok(calls.some(call => call[0] === 'navigate' && call[1] === 'home'));
    assert.ok(calls.some(call => call[0] === 'createBottling'));
    assert.ok(!calls.some(call => call[0] === 'showModal'));
    assert.ok(!calls.some(call => call[0] === 'toast'), 'the import should not throw');
  } finally {restore();}
});

test(
  'incoming hash import does not discard an already open form without confirmation',
  () => {
    const {calls, controller, restore} = mockImport({openEditor: true});
    try {
      controller.importFromExtension();
      assert.deepEqual(calls[0], ['history', '/?bottling=local-bottling']);
      const confirmation = calls.find(call => call[0] === 'showModal');
      assert.ok(confirmation, 'requires the in-app confirmation modal');
      assert.equal(renderedText(confirmation[1]), 'Externe Importdaten bereit');
      assert.match(renderedText(confirmation[2]), /ungespeicherte Eingaben/);
      assert.ok(domElements(confirmation[2], '[data-act="import-continue"]').length > 0);
      assert.equal(renderedText(confirmation[4]), true, 'keep the existing dialog nested underneath');
      assert.ok(!calls.some(call => call[0] === 'navigate'));
      assert.ok(!calls.some(call => call[0] === 'createBottling'));

      controller.confirmPendingImport();
      assert.ok(calls.some(call => call[0] === 'closeModal' && call[1] === true));
      assert.ok(calls.some(call => call[0] === 'navigate' && call[1] === 'home'));
      assert.ok(calls.some(call => call[0] === 'createBottling'));
      assert.ok(!calls.some(call => call[0] === 'toast'), 'the confirmed import should not throw');
    } finally {restore();}
  }
);

test(
  'a valid no-image import remains valid when preview validates it again',
  async () => {
    const {validateExtensionPayload} = await import('../../public/js/features/whiskybase/payload.js');
    const once = validateExtensionPayload(payload);
    assert.equal(renderedText(once.imageToken), null);
    const twice = validateExtensionPayload(once);
    assert.equal(renderedText(twice.fields.whiskybaseId), '54321');
    assert.equal(renderedText(twice.imageToken), null);
    assert.throws(() => validateExtensionPayload({...payload, imageToken: '../bad-token'}), /Bild-Token/);
  }
);


test('old import fragment is ignored without changing the active form', () => {
  const {calls, controller, restore} = mockImport({openEditor: true});
  try {
    location.hash = '#whiskybase-import=' + encodeURIComponent(JSON.stringify(payload));
    controller.importFromExtension();
    assert.equal(calls.length, 0);
  } finally {restore();}
});
