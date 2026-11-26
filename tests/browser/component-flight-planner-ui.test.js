import {domElements, domText, domIndex, assertDom} from './component-dom.js';
import {captureContent, captureAppend} from '../helpers/capture-rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';
import {createHomeView} from '../../public/js/views/home.js';

const base = {
  distilleries: [], externalTastings: [], settings: {savedViews: []},
  bottlings: [{
    id: 'b1',
    name: 'Islay Malt',
    abv: 46,
    bottles: [{
      id: 'x1', inventoryNumber: '10', status: 'open', volumeType: 'standard',
    }],
    tastings: [],
    completionStatus: 'complete',
  }],
  tastingFlights: [],
};

const plan = {
  id: 'plan-a',
  name: 'Next tasting',
  date: '2026-11-22',
  notes: '',
  tastingIds: [],
  phase: 'planned',
  planItems: [{bottlingId: 'b1', bottleId: 'x1', reason: 'manual'}],
  createdAt: '2026-11-22T01:00:00Z',
  updatedAt: '2026-11-22T01:00:00Z',
};

test(
  'planned and historic flights render separately without creating fake tasting notes',
  async () => {
    const collection = structuredClone(base);
    collection.tastingFlights = [plan];
    let html = '';
    const state = {page: 'tastings-home', selected: null, collection};
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
       */
      shell: value => {html = value;},
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
      selectors: {
        /**
         * Simulates a missing cover photo.
         * @return {null} No photo path.
         */
        coverPhoto: () => null,
      },
    });
    view.home();
    assert.equal((await domElements(html, '[data-act="flight-plan-new"] > svg.ui-symbol')).length, 1);
    assert.match(await domText(html), /Next tasting/);
    state.page = 'tasting-flight'; state.selected = 'plan-a'; view.flight();
    assert.ok((await domElements(html, '[data-act="flight-plan-start"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="flight-plan-replace"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="flight-plan-move"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="flight-plan-remove"]')).length > 0);
    assert.equal((await domElements(html, '[data-act="tasting-flight-note-open"]')).length, 0);
    collection.tastingFlights[0].phase = 'inProgress';
    view.flight();
    assert.ok((await domElements(html, '[data-act="flight-plan-record"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="flight-plan-finish"]')).length > 0);
    assert.equal((await domElements(html, '[data-act="tasting-flight-toggle-add"]')).length, 0);
    assert.equal((await domElements(html, '[data-act="tasting-flight-attach"]')).length, 0);
    collection.tastingFlights[0].phase = 'completed';
    view.flight();
    assert.equal((await domElements(html, '[data-act="flight-plan-record"]')).length, 0);
    assert.ok((await domElements(html, '[data-act="tasting-flight-toggle-add"][disabled]')).length > 0);
  }
);

test(
  'collection view integrates flavor overlay, saved views header and contextual flight action',
  async () => {
    const collection = structuredClone(base);
    const state = {
      collection,
      page: 'home',
      pageNumber: 1,
      pageSize: 24,
      view: 'cards',
      overviewMode: 'bottlings',
      search: '',
      status: 'all',
      completion: 'all',
      sort: 'name',
      distillery: 'all',
      rating: 'all',
      volumeType: 'all',
      flavorCriteria: [{axis: 'smoky', min: 6, max: 10}],
      profileMissing: false,
    };
    let html = '';
    const selectors = {
      /**
       * Derives the all bottles result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      allBottles: () => collection.bottlings.flatMap(b => b.bottles),
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
       * Omits distillery labels for this test.
       * @return {string} Empty label; no distillery name is supplied by this fixture.
       */
      distilleryNames: () => '',
    };
    const home = createHomeView({
      state, selectors,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
       */
      shell: value => {
        html = value;
      },
    });
    home();
    assert.ok((await domElements(html, '[data-collection-flavor-picker]')).length > 0);
    assert.ok((await domElements(html, '[class="ui-symbol collection-flavor-chevron"]')).length > 0);
    assert.ok((await domElements(html, '[class="ui-symbol collection-menu-chevron"]')).length > 0);
    await assertDom(html, "[aria-hidden=\"true\"]", {text: "⌄"}, true);
    assert.ok((await domElements(html, '[data-flavor-profile-status]')).length > 0);
    assert.ok((await domElements(html, '[value="with"][data-flavor-profile-status]')).length > 0);
    assert.equal((await domElements(html, 'select[data-flavor-axis="smoky"][data-flavor-part="min"]'))[0].value, '6');
    assert.ok((await domElements(html, '[data-act="collection-flavor-add"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="collection-flavor-apply"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="collection-flavor-open"]')).length > 0);
    await assertDom(html, ".collection-flavor-filter", {}, true);
    assert.ok((await domElements(html, '[id="collection-saved-views"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="collection-view-save"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="collection-view-apply"]')).length > 0);
    await assertDom(html, ".collection-saved-controls", {}, true);
    assert.equal((await domElements(html, '[data-act="collection-flight-plan"] > svg.ui-symbol')).length, 1);
    assert.ok((await domElements(html, 'div[class="collection-results-heading"]')).length > 0);
    assert.ok(await domIndex(html, '[data-act="collection-flight-plan"]') > await domIndex(html, '.collection-results-heading'));
    assert.ok(await domIndex(html, '[data-act="collection-flight-plan"]') < await domIndex(html, '.empty-state'));
  }
);

test('planner distinguishes unavailable sherry casks from cask mismatches',
  async () => {
    const collection = structuredClone(base);
    const bottling = collection.bottlings[0];
    bottling.name = 'Numbered Oloroso';
    bottling.caskType = '21 Oloroso Sherry Butts';
    bottling.bottles[0].status = 'closed';
    const state = {collection, flightCandidateIds: null};
    const preview = {renderedContent: ''};
    const save = {disabled: true};
    const availability = {value: 'open'};
    const inputs = new Map([
      ['[data-flight-plan-availability]', availability],
      ['[data-flight-plan-cask-mode]', {value: 'specific'}],
      ['[name="flight-cask-group-sherry"]', {checked: true}],
      ['[data-flight-plan-cask-phase]', {value: 'maturation'}],
      ['[name="flight-plan-strict"]', {checked: true}],
      ['.flight-plan-preview', preview],
      ['[data-act="flight-plan-create"]', save],
    ]);
    const root = {
      /**
       * Retrieves an actual planner input by its selector.
       * @param {string} selector Selector used by the view.
       * @return {?Object} Simulated input or output node.
       */
      querySelector(selector) {return inputs.get(selector) || null;},
      /**
       * No refinement panels are mounted in this test.
       * @return {!Array} Empty list of panels.
       */
      querySelectorAll() {return [];},
    };
    const previousDocument = globalThis.document;
    globalThis.document = {
      /**
       * Returns the planner modal root.
       * @return {!Object} Simulated planner dialog.
       */
      querySelector() {return root;},
    };
    try {
      const view = createTastingsView({
        mountContent: captureContent, mountAppend: captureAppend,
        state,
        /** Displays the planner without requiring a browser. */
        showModal() {},
      });
      view.startPlannedFlight();
      view.generateFlightPlan();
      assert.match(await domText(preview.renderedContent), /Keine passenden Flaschen/);
      assert.match(await domText(preview.renderedContent), /0 von 0 verfügbaren/);
      assert.match(await domText(preview.renderedContent), /gewählten Verfügbarkeit: 1/);
      assert.equal(save.disabled, true);
      availability.value = 'all';
      view.generateFlightPlan();
      assert.match(await domText(preview.renderedContent), /Numbered Oloroso/);
      assert.match(await domText(preview.renderedContent), /1 von 1 verfügbaren/);
      assert.doesNotMatch(await domText(preview.renderedContent), /gewählten Verfügbarkeit/);
      assert.equal(save.disabled, false);
      state.flightCandidateIds = [];
      view.startPlannedFlight();
      view.generateFlightPlan();
      assert.match(await domText(preview.renderedContent), /gefilterten Sammlung: 1/);
      assert.doesNotMatch(await domText(preview.renderedContent), /Numbered Oloroso/);
      assert.equal(save.disabled, true);
      view.startPlannedFlight();
      availability.value = 'open';
      bottling.bottles[0].status = 'open';
      view.generateFlightPlan();
      assert.match(await domText(preview.renderedContent), /Numbered Oloroso/);
      assert.equal(save.disabled, false);
    } finally {
      globalThis.document = previousDocument;
    }
  }
);
