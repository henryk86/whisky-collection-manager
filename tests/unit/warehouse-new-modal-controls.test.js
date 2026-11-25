import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createModal} from '../../public/js/ui/modal.js';
import {helpView} from '../../public/js/views/help.js';
test(
  'modal supports choice and replaces current sibling while preserving the \
original stack',
  async () => {
    const prior = globalThis.document;
    let overlay;
    const host = {
      /**
       * Reads the first element child property from the current state.
       * @return {*} Result computed from the supplied inputs.
       */
      get firstElementChild() {return overlay;},
      /**
       * Assigns the inner html property in the current state.
       *
       * @param {*} html HTML markup to render or inspect.
       */
      set innerHTML(html) {
        overlay = html ?
          {
            html,
            /**
             * Updates the add event listener state for its caller.
             */
            addEventListener() {},
          } : null;
      },
      /**
       * Updates the replace children state for its caller.
       *
       * @param {*} element DOM element involved in the operation.
       */
      replaceChildren(element) {overlay = element;},
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector() {return overlay;},
    };
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector() {return host;},
    };
    try {
      const state = {modal: null}; const modal =
        createModal({
          state,
          /**
           * Handles the close interaction.
           */
          onClose() {},
        });
      modal.showModal('Parent', '<p>Parent</p>');
      const parent = host.firstElementChild;
      modal.showModal('First', '<p>First</p>');
      modal.showModal('Second', '<p>Second</p>', false, 'replace');
      modal.closeModal();
      assert.equal(host.firstElementChild, parent);
      const prompt = modal.choose(
        'Unsaved',
        'Choose',
        [
          {id: 'cancel', label: 'Cancel'},
          {id: 'discard', label: 'Discard'},
          {id: 'save', label: 'Save'},
        ]
      );
      assert.equal(modal.acceptChoice('discard'), true);
      assert.equal(await prompt, 'discard');
      modal.closeModal();
      assert.equal(state.modal, null);
    } finally {globalThis.document = prior;}
  }
);
test(
  'help retains existing short guidance and includes technical accordion \
guides in the same content panel',
  () => {
    const html = helpView('backups');
    assert.match(html, /help-content-panel/);
    assert.match(html, /help-technical-guides/);
    assert.match(html, /class="help-guide"/);
    assert.match(html, /backup-admin-token/);
    assert.match(html, /rclone config/);
    assert.match(html, /OneDrive/);
  }
);
