import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestFlight, flightCandidates, orderFlightItems, FLIGHT_FOCUSES} from '../../public/js/domain/flight-planner.js';

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

const base = {bottlings: items};

/**
 * Transforms the entries used by ids.
 *
 * @param {*} style Visual style or rendering properties.
 * @param {!Object=} opts Value used by this operation.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const ids = (style, opts = {}) => suggestFlight(base, {style, count: 3, today: Date.parse('2026-11-23'), ...opts}).map(item => item.bottlingId);

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
    const family = id => id.startsWith('smoke') ? 'smoke' : id.startsWith('fruit') ? 'fruit' : id;
    assert.equal(selected.length, 5);
    assert.equal(new Set(selected.map(family)).size, 5);
  }
);

test(
  'similar selects tight profiles; focus prefers matching radar axes; contrast spans families',
  () => {
    assert.deepEqual(new Set(ids('similar')), new Set(['smoke1', 'smoke2', 'smoke3']));
    const fruity = ids('similar', {focus: 'fruity'});
    assert.ok(fruity.includes('fruit1') && fruity.includes('fruit2'), fruity.join(','));
    assert.equal(new Set(ids('contrast').map(id => id.replace(/[0-9]/g, ''))).size, 3);
    assert.deepEqual(FLIGHT_FOCUSES, ['any', 'smoky', 'peaty', 'fruity', 'winey', 'woody']);
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
    assert.ok(chosen.some(item => item.bottlingId === 'untasted' && item.reason === 'noProfile'));
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
    assert.equal(suggestFlight(collection, {...request, preferUnfamiliar: false})[0].bottlingId, 'a');
    assert.equal(suggestFlight(collection, {...request, preferUnfamiliar: true})[0].bottlingId, 'b');
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
    assert.equal(families.filter((value, i) => i > 0 && value !== families[i - 1]).length, 1);
  }
);

test(
  'no profile data is fabricated; invalid planner settings are rejected',
  () => {
    const chosen = suggestFlight({bottlings: [entry('unknown', {}, '')]}, {style: 'balanced', count: 3});
    assert.deepEqual(chosen, [{bottlingId: 'unknown', bottleId: 'p-unknown', reason: 'noProfile'}]);
    assert.throws(() => suggestFlight(base, {focus: 'invented'}));
    assert.throws(() => suggestFlight(base, {count: 7}));
  }
);
