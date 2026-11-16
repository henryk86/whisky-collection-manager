import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileChildren } from '../../public/js/ui/dom-reconcile.js';

// An isolated DOM subset exercises the actual reconciliation algorithm without
// a browser dependency. Buttons sharing data-photo-id must remain distinct.
class Element {
    nodeType = 1;
    parentElement = null;
    style = {};
    constructor(tagName, attrs = {}, children = []) {
        this.tagName = tagName.toUpperCase();
        this.map = new Map(Object.entries(attrs));
        this.nodes = [];
        for (const child of children) this.insertBefore(child, null);
    }
    get id() { return this.getAttribute('id') || ''; }
    get attributes() { return [...this.map].map(([name, value]) => ({name, value})); }
    hasAttribute(name) { return this.map.has(name); }
    getAttribute(name) { return this.map.get(name) ?? null; }
    setAttribute(name, value) { this.map.set(name, String(value)); }
    removeAttribute(name) { this.map.delete(name); }
    get childNodes() { return this.nodes; }
    get firstChild() { return this.nodes[0] ?? null; }
    get nextSibling() {
        if (!this.parentElement) return null;
        return this.parentElement.nodes[this.parentElement.nodes.indexOf(this) + 1] ?? null;
    }
    insertBefore(child, reference) {
        if (child.parentElement) child.parentElement.removeChild(child);
        const index = reference === null ? this.nodes.length : this.nodes.indexOf(reference);
        assert.ok(index >= 0, 'reference is a child');
        this.nodes.splice(index, 0, child);
        child.parentElement = this;
        return child;
    }
    removeChild(child) {
        const index = this.nodes.indexOf(child);
        assert.ok(index >= 0);
        this.nodes.splice(index, 1);
        child.parentElement = null;
        return child;
    }
    cloneNode(deep) {
        return new Element(this.tagName, Object.fromEntries(this.map),
            deep ? this.nodes.map(child => child.cloneNode(true)) : []);
    }
    isEqualNode(other) {
        return this.tagName === other.tagName &&
            this.map.size === other.map.size &&
            [...this.map].every(([key, value]) => other.getAttribute(key) === value) &&
            this.nodes.length === other.nodes.length &&
            this.nodes.every((child, index) => child.isEqualNode(other.nodes[index]));
    }
}
const el = (tag, attrs, children) => new Element(tag, attrs, children);
const actions = id => [
    el('button', {'data-act':'photo-editor-open', 'data-photo-id':id}),
    el('button', {'data-act':'delete-photo', 'data-photo-id':id}),
];
const tile = (id, cutout = false) => el('div', {
    'data-photo-tile':'', 'data-photo-id': id,
}, [el('button', {'data-act':'open-photo'}), ...actions(id),
    ...(cutout ? [el('span', {'class':'photo-cutout-badge'})] : [])]);

test('photo reconciliation retains distinct editor and delete controls after cutout update', () => {
    const current = el('div', {}, [tile('picture-1')]);
    const originalTile = current.firstChild;
    const originalEdit = originalTile.childNodes[1];
    globalThis.document = {activeElement:null};
    try {
        reconcileChildren(current, el('div', {}, [tile('picture-1', true)]));
    } finally {
        delete globalThis.document;
    }
    assert.equal(current.childNodes.length, 1);
    assert.equal(current.firstChild, originalTile, 'unchanged photo tile remains mounted');
    assert.deepEqual(current.firstChild.childNodes.map(child => child.getAttribute('data-act')),
        ['open-photo', 'photo-editor-open', 'delete-photo', null]);
    assert.equal(current.firstChild.childNodes[1], originalEdit, 'photo editor button survives refresh');
});
