import {domElements, domText, domEqual} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
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
  async () => {
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
       * Ignores listener registration in this DOM-free test double.
       */
      addEventListener: () => {},
      /**
       * Suppresses focus changes in the simulated DOM.
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
         * Simulates an element query with no matches.
         * @return {Array<never>} Empty match list; the simulated root has no matching elements.
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
         * Provides an empty collection inventory.
         * @return {Array<never>} Empty physical inventory in this fixture.
         */
        allBottles: () => [],
        /**
         * Provides an empty physical-bottle list.
         * @return {Array<never>} No physical bottles for the requested bottling.
         */
        bottles: () => [],
        /**
         * Simulates a bottling without a cover photo.
         * @return {string} Empty path to exercise the no-photo state.
         */
        coverPhoto: () => '',
        /**
         * Omits distillery labels for this test.
         * @return {string} Empty label; no distillery name is supplied by this fixture.
         */
        distilleryNames: () => '',
      };
      const view = createHomeView({
        state, selectors,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} html Page content passed by the view.
         */
        shell(html) {
          markup = html;
        },
      });
      globalThis.innerWidth = 390;
      view();
      assert.equal(state.pageNumber, 18);
      assert.equal((await domElements(markup, 'article')).length, 24);
      assert.match(await domText(markup), /409–432 von 450 Abfüllungen/);
      const mobileHtml = markup;

      globalThis.innerWidth = 1366;
      view();
      assert.equal(state.pageNumber, 18);
      assert.equal((await domElements(markup, 'article')).length, 24);
      assert.ok(await domEqual(markup, mobileHtml));
      assert.deepEqual(historyCalls, []);
    } finally {
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  }
);
