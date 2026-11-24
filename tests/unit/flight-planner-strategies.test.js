import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestFlight, flightCandidates, orderFlightItems, FLIGHT_FOCUSES} from '../../public/js/domain/flight-planner.js';
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
  tastings: tastedOn ? [{id: `t-${id}`, tastedOn, flavorProfile: {...axes, ...values}}] : [],
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
const base = {bottlings: items};
/**
 * Transforms the entries used by ids.
 *
 * @param {*} style Visual style or rendering properties.
 * @param {!Object=} opts Value used by this operation.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const ids = (style, opts = {}) => suggestFlight(
  base,
  {style, count: 3, today: Date.parse('2026-11-23'), ...opts}
).map(item => item.bottlingId);

test(
  'balanced suggests distinct aroma families rather than only the best documented bottles',
  () => {
    const selected = ids('balanced', {count: 5});
    /**
     * Derives the family result from the supplied values.
     *
     * @param {*} id Identifier of the affected record.
     * @return {*} Result computed from the supplied inputs.
     */
    const family = id => id.startsWith('smoke') ? 'smoke' :
      id.startsWith('fruit') ? 'fruit' : id;
    assert.equal(selected.length, 5);
    assert.equal(new Set(selected.map(family)).size, 5);
  }
);
test(
  'similar selects tight profiles; focus prefers matching radar axes; contrast spans families',
  () => {
    assert.deepEqual(
      new Set(ids('similar')),
      new Set(['smoke1', 'smoke2', 'smoke3'])
    );
    const fruity = ids('similar', {focus: 'fruity'});
    assert.ok(
      fruity.includes('fruit1') && fruity.includes('fruit2'),
      fruity.join(',')
    );
    assert.equal(
      new Set(ids('contrast').map(id => id.replace(/[0-9]/g, ''))).size,
      3
    );
    assert.deepEqual(
      FLIGHT_FOCUSES,
      ['any', 'smoky', 'peaty', 'fruity', 'winey', 'woody']
    );
  }
);
test(
  'discover favors untried bottles, and remains stable on the same data and date',
  () => {
    const collection = {bottlings: [entry('untasted', {}, ''), ...items]};
    const options = {
      style: 'discover',
      count: 3,
      today: Date.parse('2026-11-23'),
      preferUnfamiliar: true,
    };
    const chosen = suggestFlight(collection, options);
    assert.ok(chosen.some(item => item.bottlingId === 'untasted' &&
      item.reason === 'noProfile'));
    assert.deepEqual(suggestFlight(collection, options), chosen);
  }
);
test(
  'unfamiliarity compares against previous tastings outside the availability filter',
  () => {
    const familiar = entry('a', {fruity: 5}, '2026-10-01');
    const novel = entry('b', {woody: 9}, '2026-10-01');
    const past = entry('history', {fruity: 5}, '2026-10-01');
    past.bottles[0].status = 'closed';
    const collection = {bottlings: [familiar, novel, past]};
    const request = {
      style: 'discover',
      count: 1,
      availability: 'open',
      today: Date.parse('2026-11-23'),
    };
    assert.equal(
      suggestFlight(collection, {...request, preferUnfamiliar: false})[0]
        .bottlingId,
      'a'
    );
    assert.equal(
      suggestFlight(collection, {...request, preferUnfamiliar: true})[0]
        .bottlingId,
      'b'
    );
  }
);
test(
  'order search groups related aroma profiles when intensity is tied',
  () => {
    const bottles = [
      entry('fruity1', {fruity: 9}),
      entry('woody1', {woody: 9}),
      entry('fruity2', {fruity: 8}),
      entry('woody2', {woody: 8}),
    ];
    const ordered = orderFlightItems(flightCandidates({bottlings: bottles}));
    const families = ordered.map(item => item.bottling.id.slice(0, -1));
    assert.equal(
      families.filter((value, i) => i > 0 && value !== families[i - 1]).length,
      1
    );
  }
);
test(
  'no profile data is fabricated; invalid planner settings are rejected',
  () => {
    const chosen = suggestFlight(
      {bottlings: [entry('unknown', {}, '')]},
      {style: 'balanced', count: 3}
    );
    assert.deepEqual(
      chosen,
      [{bottlingId: 'unknown', bottleId: 'p-unknown', reason: 'noProfile'}]
    );
    assert.throws(() => suggestFlight(base, {focus: 'invented'}));
    assert.throws(() => suggestFlight(base, {count: 7}));
  }
);
test(
  'tasting overview provides an accessible help button and translated planning modal',
  () => {
    const collection = {
      bottlings: items,
      tastingFlights: [],
      externalTastings: [],
      distilleries: [],
    };
    let html = '', modal = ''; let title = '', wide =
      false, nested, headingAction;
    const view = createTastingsView({
      state: {collection, page: 'tastings-home', selected: null},
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} rendered Value used by this operation.
       */
      shell: rendered => {html = rendered;},
      /**
       * Updates the navigate state for its caller.
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
        title =
          heading; modal = body; wide = isWide; nested =
            keepParent; headingAction = action;
      },
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
      /class="ds-help-icon-button flight-plan-help-button" data-act="flight-plan-help" aria-label="So wird ein Flight geplant"/
    );
    assert.doesNotMatch(html, /class="btn small flight-plan-help-button"/);
    view.showFlightPlanningHelp();
    assert.equal(title, 'So wird ein Flight geplant');
    assert.equal(wide, true);
    assert.equal(
      nested,
      true,
      'help must preserve an already open planning modal'
    );
    for (const word of [
      'Ausgewogen',
      'Thematisch ähnlich',
      'Kontrastreich',
      'Entdecken',
      'Reihenfolge optimieren',
    ]) assert.ok(modal.includes(word), word);
    for (const formula of [
      '13*G + 4*R + 0.08*sum(N)',
      '8*R + 3.2*sum(Dsigned) - 14*M + F + Pref',
      '2.5*sum(Dsigned) + 3*G - 14*M',
      'sum(N + (prefer unfamiliar ? 2*U : 0))',
      '0.35*abs(delta) + 1.8*max(0, delta-3)',
      'C(total) = C(start) + sum(C(previous, next))',
    ]) assert.ok(modal.includes(formula), formula);
    assert.match(modal, /flight-plan-help-formula/);
    for (const formula of [
      'wG=0.65, wF=0.25, wA=0.10',
      'dA = min(abs(ageA-ageB)/15, 1)',
      '9*matchingCaskGroup + 4*matchingSherrySubtype',
      '0.65*(dF(A,B) or 0)',
    ])
      assert.ok(modal.includes(formula), formula);
    assert.match(modal, /Mindestens zwei gemeinsame Achsen/);
    assert.match(modal, /sechs bestplatzierten Flaschen/);
    assert.match(modal, /720/);
    assert.ok(
      modal.length > 6000,
      'Detailed explanations should remain available'
    );
    assert.match(modal, /data-act="close-modal"/);
    view.startPlannedFlight();
    assert.equal(nested, false, 'new planner starts as a top-level modal');
    assert.match(
      headingAction,
      /class="ds-help-icon-button flight-plan-help-button" data-act="flight-plan-help"/
    );
    assert.match(headingAction, /aria-label="So wird ein Flight geplant"/);
    assert.match(modal, /data-flight-plan-focus-wrap hidden/);
    assert.match(modal, /data-flight-plan-unfamiliar-wrap hidden/);
    assert.match(modal, /data-flight-plan-unfamiliar checked/);
    assert.match(modal, /<details class="flight-plan-advanced">/);
    for (const field of [
      'data-flight-plan-cask-mode',
      'data-flight-plan-cask-group',
      'data-flight-plan-cask-subtype',
      'data-flight-plan-age-mode',
      'data-flight-plan-age-min',
      'data-flight-plan-age-max',
      'data-flight-plan-strict',
    ])
      assert.match(modal, new RegExp(field));
  }
);
