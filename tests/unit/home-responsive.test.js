import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHomeView} from '../../public/js/views/home.js';

/**
 * Constructs bottlings from the supplied data.
 *
 * @param {*} count Number of requested or available entries.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const createBottlings = count => Array.from({length: count}, (_, index) => ({
  id: `b-${index + 1}`,
  name: `Whisky ${String(index + 1).padStart(4, '0')}`,
  createdAt: '2026-11-06T00:00:00.000Z',
  bottles: [],
  distilleryIds: [],
}));

test(
  'changing the viewport does not change page content or multiply the chosen page size',
  () => {
    const prior = {
      document: globalThis.document,
      location: globalThis.location,
      history: globalThis.history,
      innerWidth: globalThis.innerWidth,
    };
    let markup = '';
    const historyCalls = [];
    const dummy = {
      /**
       * Updates the add event listener state for its caller.
       */
      addEventListener: () => {},
      /**
       * Updates the focus state for its caller.
       */
      focus: () => {},
      /**
       * Updates selection range in the current state.
       */
      setSelectionRange: () => {},
    };
    try {
      globalThis.document = {
        /**
         * Derives the query selector result from the supplied values.
         * @return {!Object} Result computed from the supplied inputs.
         */
        querySelector() {return dummy;},
        /**
         * Derives the query selector all result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        querySelectorAll() {return [];},
      };
      globalThis.location = {pathname: '/', search: '?page=18'};
      globalThis.history = {
        /**
         * Updates the replace state state for its caller.
         *
         * @param {*} args Arguments forwarded to the operation.
         */
        replaceState(...args) {historyCalls.push(args[2]);},
      };
      const state = {
        collection: {bottlings: createBottlings(450)},
        page: 'home',
        pageNumber: 18,
        pageSize: 24,
        search: '',
        status: 'all',
        completion: 'all',
        sort: 'name',
        view: 'cards',
      };
      const selectors = {
        /**
         * Derives the all bottles result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        allBottles: () => [],
        /**
         * Derives the bottles result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        bottles: () => [],
        /**
         * Derives the cover photo result from the supplied values.
         * @return {string} Resulting text.
         */
        coverPhoto: () => '',
        /**
         * Derives the distillery names result from the supplied values.
         * @return {string} Resulting text.
         */
        distilleryNames: () => '',
      };
      const view = createHomeView({
        state, selectors,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} html HTML markup to render or inspect.
         */
        shell(html) {
          markup = html;
        },
      });
      globalThis.innerWidth = 390;
      view();
      assert.equal(renderedText(state.pageNumber), 18);
      assert.equal(renderedText(markup).match(/<article\b/g).length, 24);
      assert.match(renderedText(markup), /409–432 von 450 Abfüllungen/);
      const mobileHtml = markup;

      globalThis.innerWidth = 1366;
      view();
      assert.equal(renderedText(state.pageNumber), 18);
      assert.equal(renderedText(markup).match(/<article\b/g).length, 24);
      assert.equal(renderedText(markup), renderedText(mobileHtml));
      assert.deepEqual(historyCalls, []);
    } finally {
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  }
);

test(
  'home hero preserves the established descriptive copy without hard-coded line breaks',
  () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(
      renderedText(de['home.hero.description']),
      'Von der besonderen Abfüllung bis zum letzten Dram. Entdecke, erfasse und verwalte deine Whisky-Sammlung.'
    );
    assert.equal(
      renderedText(en['home.hero.description']),
      'From a special bottling to the last dram. Discover, document and manage your whisky collection.'
    );
    for (const catalog of [de, en]) {
      assert.doesNotMatch(renderedText(catalog['home.hero.description']), /\n|<br\s*\/?\s*>/i);
    }
  }
);
