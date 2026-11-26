import {captureContent} from '../helpers/capture-rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createModal} from '../../public/js/ui/modal.js';

/**
 * Derives the fake modal host result from the supplied values.
 * @return {!Object} Structured result assembled from the input data.
 */
function fakeModalHost() {
  let overlay = null;
  return {
    /**
     * Reads the first element child property from the current state.
     * @return {*} Result computed from the supplied inputs.
     */
    get firstElementChild() {return overlay;},
    /**
     * Assigns the inner html property in the current state.
     *
     * @param {*} text Text to process.
     */
    set renderedContent(text) {
      overlay = text ? {
        html: text, form: {name: '', files: []},
        /**
         * Ignores listener registration in this DOM-free test double.
         */
        addEventListener() {},
      } : null;
    },
    /**
     * Derives the query selector result from the supplied values.
     * @return {*} Result computed from the supplied inputs.
     */
    querySelector() {return overlay;},
    /**
     * The fake host has no parsed DOM controls.
     * @return {!Array<!Object>} Matching nodes in this test host.
     */
    querySelectorAll() {return [];},
    /**
     * Updates the replace children state for its caller.
     *
     * @param {*} element DOM element involved in the operation.
     */
    replaceChildren(element) {overlay = element;},
  };
}

test(
  'background scroll lock preserves the scrollbar gutter until the last nested modal closes',
  () => {
    const host = fakeModalHost();
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const body = {
      style: {},
      /**
       * Retrieves attribute from the available state.
       *
       * @param {*} name Environment variable or setting name.
       * @return {*} Result computed from the supplied inputs.
       */
      getAttribute(name) {return name === 'style' ? null : null;},
      /**
       * Removes or resets attribute.
       *
       * @param {*} name Environment variable or setting name.
       */
      removeAttribute(name) {if (name === 'style') this.style = {};},
      /**
       * Updates attribute in the current state.
       */
      setAttribute() {},
    };
    const html = {
      style: {},
      /**
       * Retrieves attribute from the available state.
       *
       * @param {*} name Environment variable or setting name.
       * @return {*} Result computed from the supplied inputs.
       */
      getAttribute(name) {return name === 'style' ? null : null;},
      /**
       * Removes or resets attribute.
       *
       * @param {*} name Environment variable or setting name.
       */
      removeAttribute(name) {if (name === 'style') this.style = {};},
      /**
       * Updates attribute in the current state.
       */
      setAttribute() {},
    };
    const scrollCalls = [];
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: () =>
        host, body, documentElement: html,
    };
    globalThis.window = {
      scrollY: 420,
      /**
       * Derives the scroll to result from the supplied values.
       *
       * @param {*} args Arguments forwarded to the operation.
       * @return {number} Calculated numeric value.
       */
      scrollTo: args =>
        scrollCalls.push(args),
    };
    try {
      const state = {modal: null};
      const modal = createModal({
        mountContent: captureContent,
        state,
        /**
         * Handles the close interaction.
         */
        onClose() {},
      });
      modal.showModal('Parent', '<form></form>');
      assert.equal(body.style.position, 'fixed');
      assert.equal(body.style.top, '-420px');
      assert.equal(html.style.overflowY, 'scroll', 'keep the classic scrollbar track');
      assert.notEqual(html.style.overflow, 'hidden');
      modal.showModal('Help', '<p>Help</p>');
      modal.closeModal();
      assert.equal(state.modal.title, 'Parent');
      assert.equal(body.style.position, 'fixed', 'nested close must not unlock the page');
      assert.equal(html.style.overflowY, 'scroll');
      modal.closeModal();
      assert.equal(state.modal, null);
      assert.equal(body.style.position, undefined);
      assert.equal(html.style.overflowY, undefined);
      assert.deepEqual(scrollCalls, [{top: 420, left: 0, behavior: 'instant'}]);
    } finally {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    }
  }
);

test(
  'a nested form dialog restores the exact parent DOM node and unsaved file inputs',
  () => {
    const host = fakeModalHost();
    const previous = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: () => host,
    };
    try {
      const state = {modal: null};
      const modal = createModal({
        mountContent: captureContent,
        state,
        /**
         * Handles the close interaction.
         */
        onClose() {},
      });
      modal.showModal('Abfüllung', '<form id="bottling-form"></form>', true);
      const original = host.firstElementChild;
      original.form.name = 'Unsaved whisky';
      original.form.files = ['image.png'];
      modal.showModal('Neue Destillerie', '<form id="distillery-form"></form>', false, true);
      assert.notEqual(host.firstElementChild, original);
      assert.equal(state.modal.title, 'Neue Destillerie');
      modal.closeModal();
      assert.equal(host.firstElementChild, original);
      assert.equal(host.firstElementChild.form.name, 'Unsaved whisky');
      assert.deepEqual(host.firstElementChild.form.files, ['image.png']);
      assert.equal(state.modal.title, 'Abfüllung');
      modal.closeModal();
      assert.equal(state.modal, null);
    } finally {globalThis.document = previous;}
  }
);

test('closing all dialogs discards nested parents during navigation', () => {
  const host = fakeModalHost();
  const previous = globalThis.document;
  globalThis.document = {
    /**
     * Derives the query selector result from the supplied values.
     * @return {!Object} Result computed from the supplied inputs.
     */
    querySelector: () => host,
  };
  try {
    const state = {modal: null};
    const modal = createModal({
      mountContent: captureContent,
      state,
      /**
       * Handles the close interaction.
       */
      onClose() {},
    });
    modal.showModal('Parent', '<p>Parent</p>');
    modal.showModal('Child', '<p>Child</p>', false, true);
    modal.closeModal(true);
    assert.equal(state.modal, null);
    assert.equal(host.firstElementChild, null);
    modal.showModal('Other', '<p>Other</p>');
    modal.closeModal();
    assert.equal(state.modal, null);
  } finally {globalThis.document = previous;}
});

test(
  'closing a capacity confirmation via cancel or page navigation returns false',
  async () => {
    const host = fakeModalHost();
    const oldDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: () => host,
    };
    try {
      const state = {modal: null};
      const modal = createModal({
        mountContent: captureContent,
        state,
        /**
         * Handles the close interaction.
         */
        onClose() {},
      });
      modal.showModal('Assignment', '<form id="warehouse-form"></form>');
      const answer = modal.confirm('Full', 'More places?', 'Increase');
      modal.closeModal();
      assert.equal(await answer, false);
      assert.equal(state.modal.title, 'Assignment');
      const second = modal.confirm('Full', 'More places?', 'Increase');
      modal.closeModal(true);
      assert.equal(await second, false);
      assert.equal(state.modal, null);
    } finally {
      if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    }
  }
);

test(
  'every modal opened from another modal automatically returns one level at a time',
  () => {
    const host = fakeModalHost();
    const previous = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: () => host,
    };
    try {
      const state = {modal: null};
      const modal = createModal({
        mountContent: captureContent,
        state,
        /**
         * Handles the close interaction.
         */
        onClose() {},
      });
      modal.showModal('Furniture', '<div id="furniture-manager"></div>', true);
      const furniture = host.firstElementChild;
      furniture.form.name = 'Furniture not saved';
      modal.showModal('Shelf', '<div id="shelf-manager"></div>', true);
      const shelf = host.firstElementChild;
      shelf.form.name = 'Edited shelf';
      modal.showModal('Bottle', '<div id="bottle-preview"></div>');
      assert.equal(state.modal.title, 'Bottle');
      modal.closeModal();
      assert.equal(state.modal.title, 'Shelf');
      assert.equal(host.firstElementChild, shelf);
      assert.equal(shelf.form.name, 'Edited shelf');
      modal.closeModal();
      assert.equal(state.modal.title, 'Furniture');
      assert.equal(host.firstElementChild, furniture);
      assert.equal(furniture.form.name, 'Furniture not saved');
      modal.closeModal();
      assert.equal(state.modal, null);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
    }
  }
);

test('explicit replacement can discard older modal history', () => {
  const host = fakeModalHost();
  const previous = globalThis.document;
  globalThis.document = {
    /**
     * Derives the query selector result from the supplied values.
     * @return {!Object} Result computed from the supplied inputs.
     */
    querySelector: () => host,
  };
  try {
    const state = {modal: null};
    const modal = createModal({
      mountContent: captureContent,
      state,
      /**
       * Handles the close interaction.
       */
      onClose() {},
    });
    modal.showModal('Furniture', '<div></div>');
    modal.showModal('Shelf', '<div></div>');
    modal.showModal('Standalone', '<div></div>', false, false);
    modal.closeModal();
    assert.equal(state.modal, null);
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});
