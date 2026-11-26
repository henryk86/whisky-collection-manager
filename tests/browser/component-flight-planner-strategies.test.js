import {domElements, domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';

const axes = {
  woody: 0,
  smoky: 0,
  cereal: 0,
  peaty: 0,
  fruity: 0,
  floral: 0,
  medicinal: 0,
  winey: 0,
  feinty: 0,
  sulphury: 0,
};

/**
 * Derives the entry result from the supplied values.
 *
 * @param {*} id Identifier of the affected record.
 * @param {!Object=} values Values to process.
 * @param {string=} tastedOn Value used by this operation.
 * @param {number=} abv Value used by this operation.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const entry = (id, values = {}, tastedOn = '2026-08-01', abv = 46) => ({
  id,
  name: id,
  abv,
  distilleryIds: [`dist-${id}`],
  bottles: [{id: `p-${id}`, status: 'open', volumeType: 'standard'}],
  tastings: tastedOn ? [{
    id: `t-${id}`, tastedOn, flavorProfile: {
      ...axes,
      ...values,
    },
  }] : [],
});

const items = [
  entry('smoke1', {smoky: 9, peaty: 8}),
  entry('smoke2', {smoky: 8, peaty: 8}),
  entry('smoke3', {smoky: 9, peaty: 9}),
  entry('fruit1', {fruity: 9, floral: 7}),
  entry('fruit2', {fruity: 8, floral: 8}),
  entry('malt', {woody: 8, cereal: 7}),
  entry('wine', {winey: 9}),
  entry('other', {sulphury: 8}),
];

test(
  'tasting overview provides an accessible help button and translated planning modal',
  async () => {
    const collection = {
      bottlings: items,
      tastingFlights: [],
      externalTastings: [],
      distilleries: [],
    };
    let html = '', modal = ''; let title = '', wide = false, nested, headingAction;
    const view = createTastingsView({
      state: {collection, page: 'tastings-home', selected: null},
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} rendered Page content passed by the view.
       */
      shell: rendered => {html = rendered;},
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
      /**
       * Renders modal in the current view.
       *
       * @param {*} heading Value used by this operation.
       * @param {*} body Body content to validate or process.
       * @param {*} isWide Value used by this operation.
       * @param {*} keepParent Value used by this operation.
       * @param {*} action Operation or action callback to invoke.
       */
      showModal: (heading, body, isWide, keepParent, action) => {
        title = heading; modal = body; wide = isWide; nested = keepParent; headingAction = action;
      },
      selectors: {
        /**
         * Simulates a missing cover photo.
         * @return {null} No photo path.
         */
        coverPhoto: () => null,
      },
    });
    view.home();
    await assertDom(html, "[class=\"ds-help-icon-button flight-plan-help-button\"][data-act=\"flight-plan-help\"][aria-label=\"So wird ein Flight geplant\"]");
    assert.equal((await domElements(html, '[class="btn small flight-plan-help-button"]')).length, 0);
    view.showFlightPlanningHelp();
    assert.equal(title, 'So wird ein Flight geplant');
    assert.equal(wide, true);
    assert.equal(nested, true, 'help must preserve an already open planning modal');
    for (const word of [
      'Ausgewogen',
      'Thematisch ähnlich',
      'Kontrastreich',
      'Entdecken',
      'Reihenfolge optimieren',
    ]) assert.ok((await domText(modal)).includes(word), word);
    for (const formula of [
      '13*G + 4*R + 0.08*sum(N)',
      '8*R + 3.2*sum(Dsigned) - 14*M + F + Pref',
      '2.5*sum(Dsigned) + 3*G - 14*M',
      'sum(N + (prefer unfamiliar ? 2*U : 0))',
      '0.35*abs(delta) + 1.8*max(0, delta-3)',
      'C(total) = C(start) + sum(C(previous, next))',
    ]) assert.ok((await domText(modal)).includes(formula), formula);
    await assertDom(modal, ".flight-plan-help-formula");
    for (const formula of [
      'wG=0.65, wF=0.25, wA=0.10',
      'dA = min(abs(ageA-ageB)/15, 1)',
      '9*matchingCaskGroup + 4*matchingCaskDetails',
      '0.65*(dF(A,B) or 0)',
    ])
      assert.ok((await domText(modal)).includes(formula), formula);
    assert.match(await domText(modal), /Mindestens zwei gemeinsame Achsen/);
    assert.match(await domText(modal), /sechs bestplatzierten Flaschen/);
    assert.match(await domText(modal), /720/);
    assert.ok((await domElements(modal, 'p')).filter(node => node.text.trim().length > 80).length >= 10, 'Detailed explanations should remain available');
    assert.ok((await domElements(modal, '[data-act="close-modal"]')).length > 0);
    view.startPlannedFlight();
    assert.equal(nested, false, 'new planner starts as a top-level modal');
    await assertDom(headingAction, "[class=\"ds-help-icon-button flight-plan-help-button\"][data-act=\"flight-plan-help\"]");
    assert.ok((await domElements(headingAction, '[aria-label="So wird ein Flight geplant"]')).length > 0);
    assert.ok((await domElements(modal, '[data-flight-plan-focus-wrap][hidden]')).length > 0);
    assert.ok((await domElements(modal, '[data-flight-plan-unfamiliar-wrap][hidden]')).length > 0);
    assert.ok((await domElements(modal, '[name="flight-plan-unfamiliar"][checked]')).length > 0);
    assert.ok((await domElements(modal, 'details[class="flight-plan-advanced"]')).length > 0);
    for (const field of [
      'data-flight-plan-cask-mode',
      'name="flight-cask-group-sherry"',
      'name="flight-cask-feature-sherry-style-px"',
      'data-flight-plan-cask-phase',
      'data-flight-plan-age-mode',
      'data-flight-plan-age-min',
      'data-flight-plan-age-max',
      'name="flight-plan-strict"',
    ])
      await assertDom(modal, `[${field}]`);
  }
);
