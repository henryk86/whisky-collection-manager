import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createEditors} from '../../public/js/features/editor-controller.js';
import {runAction} from '../../public/js/ui/action-result.js';

function fakeForm(id) {
  const button = {disabled: false};
  return {
    id, dataset: id === 'bottle-form' ? {bottlingId: 'parent'} : {},
    elements: {},
    button,
    attributes: new Map(),
    setAttribute(name, value) {this.attributes.set(name, value);},
    getAttribute(name) {return this.attributes.get(name);},
    removeAttribute(name) {this.attributes.delete(name);},
    querySelectorAll(selector) {
      return selector.includes('submit') ?
        [button] : [];
    },
    querySelector() {return null;},
  };
}

function editors() {
  return createEditors({
    state: {collection: {bottlings: []}},
    selectors: {findBottle: () => null},
    bottlingForm: () => '',
    bottleForm: () => '',
    showModal: () => {},
    closeModal: () => {},
    navigate: () => {},
    action: task => runAction(task, async () => {}, () => {}),
  });
}

for (const id of ['bottling-form', 'bottle-form']) {
  test(
    `editor: ${id} accepts one concurrent POST and unlocks after HTTP failure`,
    async () => {
      const documentBefore = globalThis.document;
      globalThis.document = {
        querySelector: () => null,
        createElement: () => ({remove() {} }),
        body: {append() {} },
      };
      const fetchBefore = globalThis.fetch;
      const formDataBefore = globalThis.FormData;
      globalThis.FormData =
        class {constructor() {} entries() {return [['name', 'Saved once'], ['inventoryNumber', '000004']][Symbol.iterator]();} };
      let posts = 0, failNext = false;
      globalThis.fetch = async url => {
        posts++;
        await delay(35);
        if (failNext) {
          failNext =
            false; return Response.json({error: 'private'}, {status: 500});
        }
        return Response.json(id === 'bottling-form' ?
          {bottling: {id: 'created'}, bottle: {id: 'first'}} : {id: 'created'});
      };
      try {
        const editor = editors();
        const form = fakeForm(id);
        const event = {target: form, preventDefault() {} };
        const save = editor.handleForm(event);
        const doubleSubmit = editor.handleForm(event);
        assert.equal(form.dataset.saving, '1');
        assert.equal(form.getAttribute('aria-busy'), 'true');
        assert.equal(form.button.disabled, true);
        await Promise.all([save, doubleSubmit]);
        assert.equal(posts, 1);
        assert.equal(form.dataset.saving, undefined);
        assert.equal(form.button.disabled, false);
        failNext = true;
        await editor.handleForm(event);
        assert.equal(posts, 2);
        assert.equal(form.button.disabled, false);
        await editor.handleForm(event);
        assert.equal(posts, 3, 'a failed POST must allow another submission');
      } finally {
        globalThis.fetch = fetchBefore;
        globalThis.FormData = formDataBefore;
        if (documentBefore === undefined) delete globalThis.document;
        else globalThis.document = documentBefore;
      }
    }
  );
}
