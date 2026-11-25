import {captureContent} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {toast} from '../../public/js/ui/notifications.js';

/**
 * Locates the DOM elements used by fake document.
 * @return {!Array<*>} Resulting entries in their output order.
 */
function fakeDocument() {
  const body = {
    children: [],
    /**
     * Updates the append state for its caller.
     *
     * @param {*} node Node to inspect or update.
     */
    append(node) {this.children.push(node); node.parent = this;},
    /**
     * Derives the query selector result from the supplied values.
     *
     * @param {function(...*): *} selector Selector used to obtain matching
     *     values.
     * @return {*} Whether the requested condition is met.
     */
    querySelector(selector) {
      return selector === '.toast' ? this.children.find(node => node.className?.split(' ').includes('toast')) || null : null;
    },
  };
  /**
   * Constructs element from the supplied data.
   *
   * @param {*} tagName Value used by this operation.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  function createElement(tagName) {
    return {
      tagName: tagName.toUpperCase(),
      attributes: {},
      children: [],
      listeners: {},
      /**
       * Updates attribute in the current state.
       *
       * @param {*} name Environment variable or setting name.
       * @param {*} value Value to process.
       */
      setAttribute(name, value) {this.attributes[name] = String(value);},
      /**
       * Updates the append state for its caller.
       *
       * @param {*} node Node to inspect or update.
       */
      append(node) {this.children.push(node); node.parent = this;},
      /**
       * Updates the add event listener state for its caller.
       *
       * @param {*} name Environment variable or setting name.
       * @param {function(...*): *} callback Callback invoked by the operation.
       */
      addEventListener(name, callback) {this.listeners[name] = callback;},
      /**
       * Updates the remove state for its caller.
       */
      remove() {
        if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
        this.parent = null;
      },
    };
  }
  return {
    body,
    createElement,
    /**
     * Locates the DOM elements used by query selector.
     *
     * @param {function(...*): *} selector Selector used to obtain matching
     *     values.
     * @return {*} Matching DOM element, if present.
     */
    querySelector: selector => body.querySelector(selector),
  };
}

test(
  'error toast is dismissible by an accessible close button and still auto-expires',
  () => {
    const oldDocument = globalThis.document;
    const oldSetTimeout = globalThis.setTimeout;
    const doc = fakeDocument();
    const scheduled = [];
    globalThis.document = doc;
    globalThis.setTimeout =
      (callback, delay) => {
        scheduled.push({callback, delay});
        return scheduled.length;
      };
    try {
      toast('Ungültiges Leerdatum', true, captureContent);
      assert.equal(doc.body.children.length, 1);
      const note = doc.body.children[0];
      assert.equal(note.className, 'toast error');
      assert.equal(note.attributes.role, 'alert');
      assert.equal(note.children[0].textContent, 'Ungültiges Leerdatum');
      const close = note.children[1];
      assert.equal(close.tagName, 'BUTTON');
      assert.equal(close.type, 'button');
      assert.equal(close.attributes['aria-label'], 'Schließen');
      assert.match(close.innerHTML, /<svg/);
      assert.equal(scheduled[0].delay, 4600);
      close.listeners.click();
      assert.equal(doc.body.children.length, 0, 'close removes the notification immediately');
      scheduled[0].callback();
      assert.equal(doc.body.children.length, 0, 'automatic cleanup is harmless after manual close');
    } finally {
      if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
      globalThis.setTimeout = oldSetTimeout;
    }
  }
);

test(
  'success toast remains unchanged and a second toast replaces the previous notification',
  () => {
    const oldDocument = globalThis.document;
    const oldSetTimeout = globalThis.setTimeout;
    const doc = fakeDocument();
    globalThis.document = doc;
    globalThis.setTimeout = () => 1;
    try {
      toast('Fehlermeldung', true, captureContent);
      toast('Gespeichert', false, captureContent);
      assert.equal(doc.body.children.length, 1);
      const note = doc.body.children[0];
      assert.equal(note.className, 'toast');
      assert.equal(note.children.length, 0, 'no extra close control on success toasts');
      assert.equal(note.textContent, 'Gespeichert');
    } finally {
      if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
      globalThis.setTimeout = oldSetTimeout;
    }
  }
);
