import {captureContent, captureAppend} from '../helpers/capture-rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';

test(
  'editing external facts is explicit; cancelling restores saved facts without touching tasting notes',
  () => {
    const saved = {
      id: 'external-1',
      bottling: {name: 'Old whisky', distillery: 'Original', ageYears: 8},
      tastedOn: '2026-11-01',
      rating: 77,
      tastingNotes: {nose: 'vanilla', palate: '', finish: ''},
    };
    const state = {
      page: 'external-tasting',
      selected: 'external-1',
      collection: {bottlings: [], externalTastings: [saved]},
    };
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state,
      /**
       * Discards page content in this scenario; no real DOM is mounted.
       */
      shell() {},
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.editor();
    const read = {hidden: false}, name =
    {
      value: 'Old whisky',
      /**
       * Updates the focus state for its caller.
       */
      focus() {this.focused = true;},
    }, distillery = {value: 'Original'}, age = {value: '8'};
    const form = {
      hidden: true,
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector(selector) {
        return selector === '[data-external-field="name"]' ? name : null;
      },
    };
    const inputs = {name, distillery, ageYears: age};
    const panel = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector(selector) {
        if (selector === '[data-external-read]') return read;
        if (selector === '[data-external-edit]') return form;
        return inputs[selector.match(/data-external-field="([^"]+)"/)?.[1]] || null;
      },
    };
    const original = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Structured result assembled from the input data.
       */
      querySelector(selector) {
        return selector === '[data-flavor-detail]' ? {
          /**
           * Derives the query selector result from the supplied values.
           *
           * @param {*} sel Value used by this operation.
           * @return {!Object} Result computed from the supplied inputs.
           */
          querySelector(sel) {
            return sel === '.tasting-bottling-info' ? panel : null;
          },
        } : null;
      },
    };
    try {
      view.startExternalEdit();
      assert.equal(read.hidden, true);
      assert.equal(form.hidden, false);
      assert.equal(name.focused, true);
      name.value = 'Uncommitted'; distillery.value = 'Other'; age.value = '9';
      view.cancelExternalEdit();
      assert.equal(read.hidden, false);
      assert.equal(form.hidden, true);
      assert.equal(name.value, 'Old whisky');
      assert.equal(distillery.value, 'Original');
      assert.equal(age.value, '8');
      assert.equal(saved.tastingNotes.nose, 'vanilla');
    } finally {globalThis.document = original;}
  }
);
