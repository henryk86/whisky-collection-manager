import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileChildren} from '../../public/js/ui/dom-reconcile.js';

// An isolated DOM subset exercises the actual reconciliation algorithm without
// a browser dependency. Buttons sharing data-photo-id must remain distinct.
class Element {
  nodeType = 1;
  parentElement = null;
  style = {};
  /**
   * Initializes the instance and its state.
   *
   * @param {*} tagName Value used by this operation.
   * @param {!Object=} attrs Value used by this operation.
   * @param {!Array<*>=} children Value used by this operation.
   */
  constructor(tagName, attrs = {}, children = []) {
    this.tagName = tagName.toUpperCase();
    this.map = new Map(Object.entries(attrs));
    this.nodes = [];
    for (const child of children) this.insertBefore(child, null);
  }

  /**
   * Reads the id property from the current state.
   * @return {*} Result computed from the supplied inputs.
   */
  get id() {return this.getAttribute('id') || '';}

  /**
   * Reads the attributes property from the current state.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  get attributes() {
    return [...this.map].map(([name, value]) =>
      ({name, value}));
  }

  /**
   * Checks whether attribute applies.
   *
   * @param {*} name Environment variable or setting name.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  hasAttribute(name) {return this.map.has(name);}

  /**
   * Retrieves attribute from the available state.
   *
   * @param {*} name Environment variable or setting name.
   * @return {*} Result computed from the supplied inputs.
   */
  getAttribute(name) {return this.map.get(name) ?? null;}

  /**
   * Updates attribute in the current state.
   *
   * @param {*} name Environment variable or setting name.
   * @param {*} value Value to process.
   */
  setAttribute(name, value) {this.map.set(name, String(value));}

  /**
   * Removes or resets attribute.
   *
   * @param {*} name Environment variable or setting name.
   */
  removeAttribute(name) {this.map.delete(name);}

  /**
   * Reads the child nodes property from the current state.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  get childNodes() {return this.nodes;}

  /**
   * Reads the first child property from the current state.
   * @return {*} Result computed from the supplied inputs.
   */
  get firstChild() {return this.nodes[0] ?? null;}

  /**
   * Reads the next sibling property from the current state.
   * @return {*} Computed value, or null when the input has no match.
   */
  get nextSibling() {
    if (!this.parentElement) return null;
    return this.parentElement.nodes[this.parentElement.nodes.indexOf(this) +
      1] ?? null;
  }

  /**
   * Derives the insert before result from the supplied values.
   *
   * @param {*} child Value used by this operation.
   * @param {*} reference Reference value to compare against.
   * @return {*} Result computed from the supplied inputs.
   */
  insertBefore(child, reference) {
    if (child.parentElement) child.parentElement.removeChild(child);
    const index = reference === null ? this.nodes.length : this.nodes
      .indexOf(reference);
    assert.ok(index >= 0, 'reference is a child');
    this.nodes.splice(index, 0, child);
    child.parentElement = this;
    return child;
  }

  /**
   * Removes or resets child.
   *
   * @param {*} child Value used by this operation.
   * @return {*} Result computed from the supplied inputs.
   */
  removeChild(child) {
    const index = this.nodes.indexOf(child);
    assert.ok(index >= 0);
    this.nodes.splice(index, 1);
    child.parentElement = null;
    return child;
  }

  /**
   * Transforms the entries used by clone node.
   *
   * @param {*} deep Value used by this operation.
   * @return {*} New instance constructed from the inputs.
   */
  cloneNode(deep) {
    return new Element(this.tagName, Object.fromEntries(this.map),
      deep ? this.nodes.map(child => child.cloneNode(true)) : []);
  }

  /**
   * Checks whether equal node applies.
   *
   * @param {*} other Value used by this operation.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  isEqualNode(other) {
    return this.tagName === other.tagName &&
      this.map.size === other.map.size &&
      [...this.map].every(([key, value]) => other.getAttribute(key) ===
        value) &&
      this.nodes.length === other.nodes.length &&
      this.nodes.every((child, index) => child.isEqualNode(other.nodes[index]));
  }
}
/**
 * Derives the el result from the supplied values.
 *
 * @param {*} tag Value used by this operation.
 * @param {*} attrs Value used by this operation.
 * @param {*} children Value used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
const el = (tag, attrs, children) => new Element(tag, attrs, children);

/**
 * Derives the actions result from the supplied values.
 *
 * @param {*} id Identifier of the affected record.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const actions = id => [
  el('button', {'data-act': 'photo-editor-open', 'data-photo-id': id}),
  el('button', {'data-act': 'delete-photo', 'data-photo-id': id}),
];

/**
 * Derives the tile result from the supplied values.
 *
 * @param {*} id Identifier of the affected record.
 * @param {boolean=} cutout Value used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
const tile = (id, cutout = false) => el('div', {
  'data-photo-tile': '', 'data-photo-id': id,
}, [el('button', {'data-act': 'open-photo'}), ...actions(id),
...(cutout ? [el('span', {'class': 'photo-cutout-badge'})] : [])]);

test(
  'photo reconciliation retains distinct editor and delete controls after cutout update',
  () => {
    const current = el('div', {}, [tile('picture-1')]);
    const originalTile = current.firstChild;
    const originalEdit = originalTile.childNodes[1];
    globalThis.document = {activeElement: null};
    try {
      reconcileChildren(current, el('div', {}, [tile('picture-1', true)]));
    } finally {
      delete globalThis.document;
    }
    assert.equal(current.childNodes.length, 1);
    assert.equal(
      current.firstChild,
      originalTile,
      'unchanged photo tile remains mounted'
    );
    assert.deepEqual(
      current.firstChild.childNodes.map(child =>
        child.getAttribute('data-act')),
      ['open-photo', 'photo-editor-open', 'delete-photo', null]
    );
    assert.equal(
      current.firstChild.childNodes[1],
      originalEdit,
      'photo editor button survives refresh'
    );
  }
);
