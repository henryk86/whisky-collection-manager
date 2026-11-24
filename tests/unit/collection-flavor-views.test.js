import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionOverviewEntries, matchesFlavorCriteria} from '../../public/js/domain/collection-overview.js';
import {normalizeFlavorCriteria, normalizeSavedViews} from '../../shared/collection-saved-views.js';
import {suggestFlight, flightCandidates} from '../../public/js/domain/flight-planner.js';

/**
 * Derives the profile result from the supplied values.
 *
 * @param {*} smoky Value used by this operation.
 * @param {*} fruity Value used by this operation.
 * @return {!Object} Result computed from the supplied inputs.
 */
const profile = (smoky, fruity) => ({
  woody: 2,
  smoky,
  cereal: 1,
  peaty: smoky,
  fruity,
  floral: 1,
  medicinal: 0,
  winey: 0,
  feinty: 0,
  sulphury: 0,
});
const coll = {
  distilleries: [], bottlings: [
    {
      id: 'a',
      name: 'Smoky',
      abv: 50,
      bottles: [{id: 'a1', status: 'open', volumeType: 'standard'}],
      tastings: [{id: 'ta', tastedOn: '2026-11-01', flavorProfile: profile(8, 6)}],
    },
    {
      id: 'b',
      name: 'Gentle',
      abv: 40,
      bottles: [{id: 'b1', status: 'closed', volumeType: 'sample'}],
      tastings: [{id: 'tb', tastedOn: '2026-10-01', flavorProfile: profile(1, 3)}],
    },
    {
      id: 'c',
      name: 'Unknown',
      abv: 46,
      bottles: [{id: 'c1', status: 'open', volumeType: 'standard'}],
      tastings: [],
    },
  ],
};
test(
  'flavor criteria are ANDed, old profiles have genuinely unassessed axes, zero is a score',
  () => {
    const c = [{axis: 'smoky', min: 7, max: 10}, {axis: 'fruity', min: 5, max: 10}];
    assert.deepEqual(
      collectionOverviewEntries(coll, {flavorCriteria: c}).map(x =>
        x.bottling.id),
      ['a']
    );
    assert.equal(matchesFlavorCriteria(coll.bottlings[2], c), false);
    assert.deepEqual(
      collectionOverviewEntries(coll, {profileMissing: true}).map(x =>
        x.bottling.id),
      ['c']
    );
    assert.deepEqual(
      collectionOverviewEntries(coll, {profilePresent: true}).map(x =>
        x.bottling.id),
      ['b', 'a']
    );
    assert.equal(
      matchesFlavorCriteria(
        coll.bottlings[1],
        [{axis: 'medicinal', min: 0, max: 0}]
      ),
      true
    );
    const legacy = {
      ...coll.bottlings[0],
      tastings: [{
        id: 'old',
        tastedOn: '2020-01-01',
        flavorProfile: {
          woody: 2,
          cereal: 1,
          peaty: 4,
          fruity: 6,
          floral: 1,
          winey: 0,
          feinty: 0,
          sulphury: 0,
        },
      }],
    };
    assert.equal(
      matchesFlavorCriteria(legacy, [{axis: 'smoky', min: 0, max: 10}]),
      false
    );
    assert.equal(
      matchesFlavorCriteria(legacy, [{axis: 'fruity', min: 6, max: 6}]),
      true
    );
  }
);
test(
  'old tasting with a profile remains filterable even if newer tasting omitted profile',
  () => {
    const b = {
      ...coll.bottlings[0],
      tastings: [
        ...coll.bottlings[0].tastings,
        {id: 'new', tastedOn: '2026-11-02', flavorProfile: null},
      ],
    };
    assert.equal(
      matchesFlavorCriteria(b, [{axis: 'smoky', min: 8, max: 8}]),
      true
    );
  }
);
test(
  'saved views reject duplicate IDs, malformed criteria and preserve both column preferences',
  () => {
    const view = {
      id: 'v1',
      name: ' Open ',
      filters: {
        search: '',
        status: 'open',
        completion: 'all',
        distillery: 'all',
        rating: 'all',
        volumeType: 'all',
        flavorCriteria: [{axis: 'smoky', min: 5, max: 10}],
        profileMissing: false,
      },
      display: {
        sort: 'name',
        view: 'table',
        mode: 'bottles',
        columns: {bottlings: ['name'], bottles: ['inventory']},
      },
    };
    assert.equal(normalizeSavedViews([view])[0].name, 'Open');
    assert.equal(
      normalizeSavedViews([view])[0].filters.profilePresent,
      undefined,
      'old saved views retain their format'
    );
    assert.equal(
      normalizeSavedViews([{...view, filters: {...view.filters, profilePresent: true}}])[0].filters.profilePresent,
      true
    );
    assert.throws(() => normalizeSavedViews([{
      ...view,
      filters: {...view.filters, profileMissing: true, profilePresent: true},
    }]));
    assert.throws(() => normalizeSavedViews([view, view]));
    assert.throws(() => normalizeFlavorCriteria([{axis: 'smoky', min: 9, max: 4}]));
    assert.throws(() => normalizeFlavorCriteria([{axis: 'smoky', min: 0, max: 10}, {axis: 'smoky', min: 3, max: 7}]));
  }
);
test(
  'offline flight suggestion keeps physical bottle identities, excludes empty, and never invents flavors',
  () => {
    const open = flightCandidates(coll, {availability: 'open'});
    assert.deepEqual(open.map(x => x.bottling.id), ['a', 'c']);
    assert.deepEqual(
      flightCandidates(coll, {availability: 'samples'}).map(x => x.bottle.id),
      ['b1']
    );
    for (const style of ['balanced', 'similar', 'contrast', 'discover']) {
      const result = suggestFlight(coll, {style, count: 3, availability: 'all'});
      assert.equal(result.length, 3);
      assert.equal(new Set(result.map(x => x.bottlingId)).size, 3);
      assert.equal(new Set(result.map(x => x.bottleId)).size, 3);
      assert.deepEqual(
        suggestFlight(coll, {style, count: 3, availability: 'all'}),
        result
      );
      assert.ok(result.some(x => x.reason === 'noProfile'));
    }
    assert.deepEqual(
      suggestFlight(
        coll,
        {style: 'discover', count: 5, bottlingIds: ['a'], availability: 'all'}
      ).map(x => x.bottleId),
      ['a1']
    );
  }
);
