import {domText, domMatches, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initializeLanguage, currentLanguage} from '../../public/js/i18n/index.js';
import {createAnalyticsView} from '../../public/js/views/analytics.js';
import {createHomeView} from '../../public/js/views/home.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

/**
 * Reads locale data from the local filesystem.
 *
 * @param {*} name Environment variable or setting name.
 * @return {*} Parsed JSON value.
 */
const locale = name => JSON.parse(fs.readFileSync(new URL(`../../public/locales/${name}`, import.meta.url), 'utf8'));

/**
 * Retrieves locale from the available state.
 *
 * @param {*} url URL of the resource being processed.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const fetchLocale = async url => ({
  ok: true,
  /**
   * Derives the json result from the supplied values.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  json: async () =>
    locale(url.split('/').at(-1)),
});

const room = {
  id: 'room-1',
  name: 'Whiskyzimmer',
  width: 4,
  height: 3,
  furniture: [{
    id: 'f1',
    name: 'Mein Regal',
    type: 'regal',
    x: 0,
    y: 0,
    width: 1,
    depth: .5,
    rotation: 0,
    shelves: [{id: 's1', name: 'Fach 1', capacity: 10}],
  }],
};

const collection = {
  schemaVersion: 9,
  settings: {},
  distilleries: [{id: 'd1', name: 'Ardbeg', country: 'Schottland'}],
  bottlings: [{
    id: 'b1',
    name: 'Custom Islay',
    distilleryIds: ['d1'],
    completionStatus: 'complete',
    bottles: [{
      id: 'p1',
      status: 'closed',
      volumeType: 'standard',
      volumeMl: 700,
      inventoryNumber: '000001',
    }],
  }],
};

const selectors = {
  /**
   * Derives the all bottles result from the supplied values.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  allBottles: () => collection.bottlings[0].bottles,
  /**
   * Derives the bottles result from the supplied values.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  bottles: () => collection.bottlings[0].bottles,
  /**
   * Simulates a missing cover photo.
   * @return {null} No photo path.
   */
  coverPhoto: () => null,
  /**
   * Supplies the fixed distillery label used by this fixture.
   * @return {string} Fixture label 'Ardbeg'.
   */
  distilleryNames: () => 'Ardbeg',
};

test(
  'English renders actual collection, analytics and warehouse controls, not German literals',
  async () => {
    const previous = {
      location: globalThis.location,
      document: globalThis.document,
      history: globalThis.history,
    };
    const field = {
      /**
       * Ignores listener registration in this DOM-free test double.
       */
      addEventListener() {},
    };
    try {
      globalThis.location = {search: '?lang=en', pathname: '/'};
      globalThis.document = {
        documentElement: {lang: 'de'},
        title: '',
        /**
         * Derives the query selector result from the supplied values.
         * @return {!Object} Result computed from the supplied inputs.
         */
        querySelector: () => field,
        /**
         * Simulates an element query with no matches.
         * @return {Array<never>} Empty match list; the simulated root has no matching elements.
         */
        querySelectorAll: () => [],
        /**
         * Retrieves element by id from the available state.
         * @return {*} Result computed from the supplied inputs.
         */
        getElementById: () => null,
      };
      globalThis.history = {
        /**
         * Suppresses history replacement in the simulated browser.
         */
        replaceState() {},
      };
      assert.equal(await initializeLanguage(fetchLocale), 'en');
      assert.equal(currentLanguage(), 'en');
      const state = {
        collection,
        overviewMode: 'bottlings',
        view: 'cards',
        search: '',
        status: 'all',
        completion: 'all',
        distillery: 'all',
        volumeType: 'all',
        sort: 'name',
        pageNumber: 1,
        pageSize: 24,
      };
      let home = '';
      createHomeView({
        state, selectors,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} html Page content passed by the view.
         */
        shell: html => {home = html;},
      })();
      await assertDom(home, "[data-act=\"toggle-view\"] .collection-filter-view-text", {text: "Table"});
      state.view = 'table';
      createHomeView({
        state, selectors,
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} html Page content passed by the view.
         */
        shell: html => {home = html;},
      })();
      await assertDom(home, "[data-act=\"toggle-view\"] .collection-filter-view-text", {text: "Cards"});
      assert.match(await domText(home), /All distilleries/);
      assert.match(await domText(home), /All statuses/);
      assert.equal((await domMatches(home, "*", {"text": new RegExp("^Tabelle$")})) || (await domMatches(home, "*", {"text": new RegExp("^Kacheln$")})) || (await domMatches(home, "*", {"text": new RegExp("^Alle Destillerien$")})) || (await domMatches(home, "*", {"text": new RegExp("^Alle Status$")})), false);
      assert.match(await domText(home), /Custom Islay/);
      let analytics = '';
      createAnalyticsView({
        state: {collection, selected: 'overview', analyticsFilters: {}},
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} html Captured render content to inspect.
         */
        shell: html => {analytics = html;},
      })();
      for (const label of [
        'All distilleries',
        'All countries',
        'All bottle types',
        'All statuses',
      ]) assert.match(await domText(analytics), new RegExp(label));
      assert.equal((new RegExp("Alle Destillerien|Alle L\\u00e4nder|Alle Flaschentypen|Alle Status").test(await domText(analytics))), false);
      let warehouse = '';
      const warehouseState = {
        warehouse: {rooms: [room], bottles: [], assignments: {}},
        selected: 'rooms',
        warehouseRoomId: 'room-1',
        warehousePlanMode: '2d',
      };
      createWarehouseView({
        state: warehouseState,
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} html Captured render content to inspect.
         */
        shell: html => {warehouse = html;},
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate: () => {},
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      }).render();
      assert.match(await domText(warehouse), /Storage management/);
      assert.match(await domText(warehouse), /Whiskyzimmer/);
      assert.match(await domText(warehouse), /Mein Regal/);
      await assertDom(warehouse, "*", {"text": new RegExp("^Lagerverwaltung$")}, true);
      let furnitureForm = '';
      createWarehouseView({
        state: warehouseState,
        /**
         * Discards page content in this scenario; no real DOM is mounted.
         */
        shell: () => {},
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate: () => {},
        modal: {
          /**
           * Renders modal in the current view.
           *
           * @param {*} _title Value used by this operation.
           * @param {*} body Body content to validate or process.
           */
          showModal: (_title, body) => {furnitureForm = body;},
        },
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      }).openForm('furniture',
        'f1'
      );
      for (const label of ['Left side panel', 'Right side panel', 'Back panel',
        'Door leaves']) assert.match(await domText(furnitureForm), new RegExp(label));
      assert.equal((new RegExp("Linke Seitenwand|Rechte Seitenwand|R\\u00fcckwand|T\\u00fcrfl\\u00fcgel").test(await domText(furnitureForm))), false);
    } finally {
      for (const [name, value] of Object.entries(previous)) if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
      await initializeLanguage(async url => url.endsWith('index.json') ?
        {
          ok: true,
          /**
           * Derives the json result from the supplied values.
           * @return {!Promise<*>} Promise for the asynchronous operation.
           */
          json: async () => locale('index.json'),
        } : {ok: false});
    }
  }
);
