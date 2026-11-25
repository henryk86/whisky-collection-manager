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
    bottles: [{id: 'x1', inventoryNumber: '10', status: 'open', volumeType: 'standard'}],
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
  () => {
    const collection = structuredClone(base);
    collection.tastingFlights = [plan];
    let html = '';
    const state = {page: 'tastings-home', selected: null, collection};
    const view = createTastingsView({
      state,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} value Value to process.
       */
      shell: value => {html = value;},
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
      selectors: {
        /**
         * Derives the cover photo result from the supplied values.
         * @return {*} Result computed from the supplied inputs.
         */
        coverPhoto: () => null,
      },
    });
    view.home();
    assert.match(
      html,
      /data-act="flight-plan-new"[^>]*><svg class="ui-symbol"/
    );
    assert.match(html, /Next tasting/);
    state.page = 'tasting-flight'; state.selected = 'plan-a'; view.flight();
    assert.match(html, /data-act="flight-plan-start"/);
    assert.match(html, /data-act="flight-plan-replace"/);
    assert.match(html, /data-act="flight-plan-move"/);
    assert.match(html, /data-act="flight-plan-remove"/);
    assert.doesNotMatch(html, /data-act="tasting-flight-note-open"/);
    collection.tastingFlights[0].phase = 'inProgress';
    view.flight();
    assert.match(html, /data-act="flight-plan-record"/);
    assert.match(html, /data-act="flight-plan-finish"/);
    assert.doesNotMatch(html, /data-act="tasting-flight-toggle-add"/);
    assert.doesNotMatch(html, /data-act="tasting-flight-attach"/);
    collection.tastingFlights[0].phase = 'completed';
    view.flight();
    assert.doesNotMatch(html, /data-act="flight-plan-record"/);
    assert.match(html, /data-act="tasting-flight-toggle-add"[^>]+disabled/);
  }
);
test(
  'collection view integrates flavor overlay, saved views header and contextual flight action',
  () => {
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
       * Derives the cover photo result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      coverPhoto: () => null,
      /**
       * Derives the distillery names result from the supplied values.
       * @return {string} Resulting text.
       */
      distilleryNames: () => '',
    };
    const home = createHomeView({
      state, selectors,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} value Value to process.
       */
      shell: value => {
        html =
          value;
      },
    });
    home();
    assert.match(html, /data-collection-flavor-picker/);
    assert.match(html, /class="ui-symbol collection-flavor-chevron"/);
    assert.match(html, /class="ui-symbol collection-menu-chevron"/);
    assert.doesNotMatch(html, /aria-hidden="true">⌄/);
    assert.match(html, /data-flavor-profile-status/);
    assert.match(html, /value="with" data-flavor-profile-status/);
    assert.match(
      html,
      /data-flavor-axis="smoky" data-flavor-part="min"[^>]*>[\s\S]*?<option value="6" selected>/
    );
    assert.match(html, /data-act="collection-flavor-add"/);
    assert.match(html, /data-act="collection-flavor-apply"/);
    assert.match(html, /data-act="collection-flavor-open"/);
    assert.doesNotMatch(html, /collection-flavor-filter/);
    assert.match(html, /id="collection-saved-views"/);
    assert.match(html, /data-act="collection-view-save"/);
    assert.match(html, /data-act="collection-view-apply"/);
    assert.doesNotMatch(html, /collection-saved-controls/);
    assert.match(
      html,
      /data-act="collection-flight-plan"[^>]*><svg class="ui-symbol"/
    );
    assert.match(html, /<div class="collection-results-heading">/);
    assert.ok(html.indexOf('data-act="collection-flight-plan"') >
      html.indexOf('class="collection-results-heading"'));
    assert.ok(html.indexOf('data-act="collection-flight-plan"') <
      html.indexOf('class="empty-state"'));
  }
);


test('planner distinguishes unavailable sherry casks from cask mismatches',
  () => {
    const collection = structuredClone(base);
    const bottling = collection.bottlings[0];
    bottling.name = 'Numbered Oloroso';
    bottling.caskType = '21 Oloroso Sherry Butts';
    bottling.bottles[0].status = 'closed';
    const state = {collection, flightCandidateIds: null};
    const preview = {innerHTML: ''};
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
      const view = createTastingsView({state,
        /** Displays the planner without requiring a browser. */
        showModal() {},
      });
      view.startPlannedFlight();
      view.generateFlightPlan();
      assert.match(preview.innerHTML, /Keine passenden Flaschen/);
      assert.match(preview.innerHTML, /0 von 0 verfügbaren/);
      assert.match(preview.innerHTML, /gewählten Verfügbarkeit: 1/);
      assert.equal(save.disabled, true);
      availability.value = 'all';
      view.generateFlightPlan();
      assert.match(preview.innerHTML, /Numbered Oloroso/);
      assert.match(preview.innerHTML, /1 von 1 verfügbaren/);
      assert.doesNotMatch(preview.innerHTML, /gewählten Verfügbarkeit/);
      assert.equal(save.disabled, false);
      state.flightCandidateIds = [];
      view.startPlannedFlight();
      view.generateFlightPlan();
      assert.match(preview.innerHTML, /gefilterten Sammlung: 1/);
      assert.doesNotMatch(preview.innerHTML, /Numbered Oloroso/);
      assert.equal(save.disabled, true);
      view.startPlannedFlight();
      availability.value = 'open';
      bottling.bottles[0].status = 'open';
      view.generateFlightPlan();
      assert.match(preview.innerHTML, /Numbered Oloroso/);
      assert.equal(save.disabled, false);
    } finally {
      globalThis.document = previousDocument;
    }
  }
);
