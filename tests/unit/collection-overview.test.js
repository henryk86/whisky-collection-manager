import test from 'node:test';
import assert from 'node:assert/strict';
import {availableOverviewDistilleries, collectionOverviewEntries} from '../../public/js/domain/collection-overview.js';
import {homePageUrl, overviewModeFromSearch, paginate} from '../../public/js/domain/pagination.js';

/**
 * Derives the sample result from the supplied values.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const sample = () => ({
  bottlings: [
    {
      id: 'a', name: 'Islay Malt', bottler: 'Independent Bottler',
      distilleryIds: [], completionStatus: 'complete', ageYears: 12,
      createdAt: '2026-11-01T00:00:00Z', bottles: [
        {
          id: 'a-1',
          inventoryNumber: '000101',
          status: 'closed',
          volumeType: 'standard',
          volumeMl: 700,
          photos: [{path: 'one.jpg'}],
          createdAt: '2026-11-01',
        },
        {
          id: 'a-2',
          inventoryNumber: '000102',
          status: 'open',
          volumeType: 'sample',
          volumeMl: 50,
          photos: [{path: 'two.jpg'}],
          createdAt: '2026-11-03',
        },
        {
          id: 'a-3',
          inventoryNumber: '000103',
          status: 'empty',
          volumeType: 'standard',
          photos: [],
          createdAt: '2026-11-02',
        },
      ],
    },
    {
      id: 'z',
      name: 'Empty Bottling',
      distilleryIds: [],
      completionStatus: 'incomplete',
      bottles: [],
      createdAt: '2026-11-01',
    },
  ],
});

const selectors = {
  /**
   * Supplies the fixed distillery label used by this fixture.
   * @return {string} Fixture label 'Keine Destillerie angegeben'.
   */
  distilleryNames: () => 'Keine Destillerie angegeben',
};

test(
  'bottling mode remains one entry per bottling, bottle mode uses individual physical bottles',
  () => {
    const collection = sample();
    const bottlings = collectionOverviewEntries(collection, {mode: 'bottlings', ...selectors});
    const bottles = collectionOverviewEntries(collection, {
      mode: 'bottles',
      ...selectors,
    });
    assert.deepEqual(bottlings.map(item => item.bottling.id), ['z', 'a']);
    assert.deepEqual(bottlings.map(item => item.bottle), [null, null]);
    assert.equal(bottles.length, 3);
    assert.deepEqual(bottles.map(item => item.bottle.id), ['a-1', 'a-2', 'a-3']);
    assert.equal(bottles.every(item => item.bottling.id === 'a'), true);
    assert.equal(paginate(bottles, 2, 2).items[0].bottle.id, 'a-3');
  }
);

test(
  'bottle filters operate on each bottle, not on its entire bottling',
  () => {
    const collection = sample();
    const open = collectionOverviewEntries(collection, {mode: 'bottles', status: 'open', ...selectors});
    assert.deepEqual(open.map(item => item.bottle.id), ['a-2']);
    const closed = collectionOverviewEntries(collection, {mode: 'bottles', status: 'closed', ...selectors});
    assert.deepEqual(closed.map(item => item.bottle.id), ['a-1']);
    const search = collectionOverviewEntries(collection, {mode: 'bottles', search: '000102', ...selectors});
    assert.deepEqual(search.map(item => item.bottle.id), ['a-2']);
    assert.deepEqual(
      collectionOverviewEntries(collection, {mode: 'bottles', search: 'Sample', ...selectors}).map(item => item.bottle.id),
      ['a-2']
    );
    assert.equal(
      collectionOverviewEntries(collection, {mode: 'bottles', completion: 'incomplete', ...selectors}).length,
      0
    );
    assert.equal(
      collectionOverviewEntries(collection, {mode: 'bottlings', search: '000102', ...selectors}).length,
      1
    );
    assert.equal(
      collectionOverviewEntries(collection, {mode: 'bottlings', status: 'open', ...selectors}).length,
      1
    );
    assert.deepEqual(
      collectionOverviewEntries(collection, {mode: 'bottles', sort: 'newest', ...selectors}).map(item => item.bottle.id),
      ['a-2', 'a-3', 'a-1']
    );
  }
);

test(
  'quick distillery options contain only distilleries used by a bottling, including blends',
  () => {
    const collection = {
      distilleries: [
        {id: 'unrelated', name: 'Unused'}, {id: 'second', name: 'Zweite'},
        {id: 'first', name: 'Erste'}, {id: 'legacy', name: 'Legacy'},
      ],
      bottlings: [
        {
          id: 'blend',
          name: 'Blend',
          distilleryIds: ['second', 'first'],
          bottles: [],
        },
        {id: 'old', name: 'Old', distilleryId: 'legacy', bottles: []},
      ],
    };
    assert.deepEqual(availableOverviewDistilleries(collection).map(d => d.id), ['first', 'legacy', 'second']);
    assert.deepEqual(collectionOverviewEntries(collection, {distillery: 'first'}).map(e => e.bottling.id), ['blend']);
    assert.deepEqual(collectionOverviewEntries(collection, {distillery: 'legacy'}).map(e => e.bottling.id), ['old']);
    assert.equal(collectionOverviewEntries(collection, {distillery: 'unrelated'}).length, 0);
  }
);

test(
  'standard/sample quick filter is applied before pagination in both overview modes',
  () => {
    const collection = sample();
    collection.distilleries = [{id: 'islay', name: 'Islay'}, {id: 'other', name: 'Other'}];
    collection.bottlings[0].distilleryIds = ['islay'];
    collection.bottlings.push({
      id: 'other',
      name: 'Other',
      distilleryIds: ['other'],
      completionStatus: 'complete',
      bottles: [{id: 'other-1', status: 'closed', volumeType: 'standard'}],
    });
    const options = {distillery: 'islay', ...selectors};
    assert.deepEqual(
      collectionOverviewEntries(collection, {mode: 'bottles', volumeType: 'sample', ...options}).map(e => e.bottle.id),
      ['a-2']
    );
    assert.deepEqual(
      collectionOverviewEntries(collection, {mode: 'bottles', volumeType: 'standard', ...options}).map(e => e.bottle.id),
      ['a-1', 'a-3']
    );
    assert.deepEqual(
      collectionOverviewEntries(collection, {mode: 'bottlings', volumeType: 'sample', ...options}).map(e => e.bottling.id),
      ['a']
    );
    assert.deepEqual(
      collectionOverviewEntries(collection, {mode: 'bottlings', volumeType: 'standard', ...options}).map(e => e.bottling.id),
      ['a']
    );
    assert.equal(
      collectionOverviewEntries(collection, {mode: 'bottlings', volumeType: 'sample', distillery: 'other'}).length,
      0
    );
    assert.equal(
      collectionOverviewEntries(collection, {mode: 'bottlings', volumeType: 'standard', distillery: 'other'}).length,
      1
    );
    assert.equal(
      collectionOverviewEntries(
        collection,
        {
          mode: 'bottlings',
          volumeType: 'sample',
          completion: 'incomplete',
          ...options,
        }
      ).length,
      0
    );
    assert.equal(
      collectionOverviewEntries(collection, {mode: 'bottles', volumeType: 'sample', status: 'closed', ...options}).length,
      0
    );
    assert.equal(
      collectionOverviewEntries(collection, {mode: 'bottlings', volumeType: 'sample', status: 'closed', ...options}).length,
      0,
      'a closed standard bottle and open sample must not satisfy both filters'
    );
    assert.equal(
      collectionOverviewEntries(collection, {mode: 'bottlings', volumeType: 'sample', status: 'open', ...options}).length,
      1
    );
    assert.equal(
      paginate(collectionOverviewEntries(collection, {mode: 'bottles', volumeType: 'standard', ...options}), 1, 1).total,
      2
    );
  }
);

test(
  'bottle mode is bookmarkable and the default bottling URL is backward compatible',
  () => {
    assert.equal(homePageUrl(1), '/');
    assert.equal(homePageUrl(4), '/?page=4');
    assert.equal(homePageUrl(1, 'bottles'), '/?mode=bottles');
    assert.equal(homePageUrl(4, 'bottles'), '/?mode=bottles&page=4');
    assert.equal(overviewModeFromSearch('?mode=bottles&page=2'), 'bottles');
    assert.equal(overviewModeFromSearch('?mode=unknown'), 'bottlings');
  }
);

test(
  'pagination in bottle mode counts physical bottles rather than their shared bottling',
  () => {
    const collection = {
      bottlings: [{
        id: 'one', name: 'One Whisky', createdAt: '2026-11-08',
        bottles: Array.from({length: 28}, (_, i) => ({
          id: `b-${i}`,
          status: 'closed',
          volumeType: 'standard',
          inventoryNumber: String(i + 1).padStart(5, '0'),
        })),
      }],
    };
    const bottlingEntries = collectionOverviewEntries(collection, {mode: 'bottlings', ...selectors});
    const bottleEntries = collectionOverviewEntries(collection, {mode: 'bottles', ...selectors});
    assert.equal(paginate(bottlingEntries).total, 1);
    assert.equal(paginate(bottleEntries).total, 28);
    assert.equal(paginate(bottleEntries).pageCount, 2);
    assert.equal(paginate(bottleEntries, 2).items.length, 4);
  }
);

test(
  'latest tasting rating filters are applied before pagination in both overview modes',
  async () => {
    const {matchesOverviewRating} = await import('../../public/js/domain/collection-overview.js');
    const collection = sample();
    const date = '2026-11-15';
    collection.bottlings[0].tastings = [
      {id: 'old', tastedOn: '2026-01-01', rating: 99},
      {id: 'new', tastedOn: date, rating: 87.5},
    ];
    collection.bottlings[1].tastings = [];
    assert.equal(matchesOverviewRating(collection.bottlings[0], '5'), true);
    assert.equal(matchesOverviewRating(collection.bottlings[0], '4'), false);
    assert.equal(matchesOverviewRating(collection.bottlings[1], 'unrated'), true);
    assert.deepEqual(
      collectionOverviewEntries(collection, {mode: 'bottlings', rating: '5'}).map(e => e.bottling.id),
      ['a']
    );
    assert.equal(
      collectionOverviewEntries(collection, {
        mode: 'bottles',
        rating: '5',
      }).length,
      3
    );
    assert.deepEqual(
      collectionOverviewEntries(collection, {mode: 'bottlings', rating: 'unrated'}).map(e => e.bottling.id),
      ['z']
    );
    collection.bottlings[0].tastings.push({id: 'scoreless', tastedOn: '2026-12-01', rating: null});
    assert.equal(collectionOverviewEntries(collection, {rating: '5'}).length, 0);
    assert.deepEqual(collectionOverviewEntries(collection, {rating: 'unrated'}).map(e => e.bottling.id), ['z', 'a']);
    collection.bottlings[0].tastings = [{id: 'zero', tastedOn: date, rating: 0}];
    assert.equal(matchesOverviewRating(collection.bottlings[0], '1'), true, 'zero belongs to the first glass');
    assert.equal(matchesOverviewRating({tastings: [{id: 'edge', tastedOn: date, rating: 20.1}]}, '2'), true);
  }
);

test(
  'sorting by name and distillery is locale-aware and keeps equal entries stable',
  () => {
    const collection = {
      bottlings: [
        {id: 'one', name: 'Ähren', distilleryIds: ['a'], bottles: []},
        {id: 'two', name: 'Burg', distilleryIds: ['b'], bottles: []},
        {id: 'three', name: 'Cask', distilleryIds: ['a'], bottles: []},
      ],
    };
    /**
     * Derives the distillery names result from the supplied values.
     *
     * @param {*} bottling Bottling record being inspected or updated.
     * @return {*} Result computed from the supplied inputs.
     */
    const distilleryNames = bottling => ({a: 'Zweite', b: 'Aberfeldy'})[bottling.distilleryIds[0]];

    /**
     * Transforms the entries used by ids.
     *
     * @param {*} sort Sort direction or ordering rule.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    const ids = sort => collectionOverviewEntries(collection, {
      sort,
      distilleryNames,
    }).map(e => e.bottling.id);
    assert.deepEqual(ids('name'), ['one', 'two', 'three']);
    assert.deepEqual(ids('nameDesc'), ['three', 'two', 'one']);
    assert.deepEqual(ids('distillery'), ['two', 'one', 'three']);
    assert.deepEqual(ids('distilleryDesc'), ['one', 'three', 'two']);
  }
);

test(
  'price sorting uses individual bottle prices or same-currency bottling averages; missing data sorts last',
  () => {
    const collection = {
      bottlings: [
        {
          id: 'a', name: 'Alpha', bottles: [{id: 'a1', purchasePrice: 10, currency: 'EUR'}, {id: 'a2', purchasePrice: 40, currency: 'EUR'},],
        },
        {
          id: 'b',
          name: 'Beta',
          bottles: [{id: 'b1', purchasePrice: 20, currency: 'EUR'}],
        },
        {
          id: 'c',
          name: 'Gamma',
          bottles: [{id: 'c1', purchasePrice: null, currency: 'EUR'}],
        },
        {
          id: 'd',
          name: 'Delta',
          bottles: [{id: 'd1', purchasePrice: 100, currency: 'USD'}],
        },
        {
          id: 'e',
          name: 'Epsilon',
          bottles: [{id: 'e1', purchasePrice: 3, currency: 'EUR'}, {id: 'e2', purchasePrice: 4, currency: 'USD'},],
        },
      ],
    };
    /**
     * Transforms the entries used by sorted.
     *
     * @param {*} sort Sort direction or ordering rule.
     * @param {string=} mode Selected mode controlling the operation.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    const sorted = (sort, mode = 'bottlings') =>
      collectionOverviewEntries(collection, {sort, mode}).map(e => mode === 'bottles' ? e.bottle.id : e.bottling.id);
    assert.deepEqual(sorted('priceAsc'), ['b', 'a', 'd', 'e', 'c']);
    assert.deepEqual(sorted('priceDesc'), ['a', 'b', 'd', 'e', 'c']);
    assert.deepEqual(sorted('priceAsc', 'bottles'), ['e1', 'a1', 'b1', 'a2', 'e2', 'd1', 'c1']);
  }
);

test(
  'score and last-tasted sorting use the latest dated tasting, with null values at the end',
  () => {
    const collection = {
      bottlings: [
        {
          id: 'a',
          name: 'Alpha',
          tastings: [{id: 'a1', tastedOn: '2024-02-01', rating: 95}, {id: 'a2', tastedOn: '2026-08-10', rating: 50},],
          bottles: [],
        },
        {
          id: 'b',
          name: 'Beta',
          tastings: [{id: 'b1', tastedOn: '2025-10-10', rating: 0}],
          bottles: [],
        },
        {
          id: 'c',
          name: 'Gamma',
          tastings: [{id: 'c1', tastedOn: '2026-11-01', rating: null}],
          bottles: [],
        },
        {id: 'd', name: 'Delta', tastings: [], bottles: []},
      ],
    };
    /**
     * Transforms the entries used by ids.
     *
     * @param {*} sort Sort direction or ordering rule.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    const ids = sort => collectionOverviewEntries(collection, {sort}).map(e => e.bottling.id);
    assert.deepEqual(ids('scoreDesc'), ['a', 'b', 'd', 'c']);
    assert.deepEqual(ids('scoreAsc'), ['b', 'a', 'd', 'c']);
    assert.deepEqual(ids('tastedDesc'), ['c', 'a', 'b', 'd']);
    assert.deepEqual(ids('tastedAsc'), ['b', 'a', 'c', 'd']);
  }
);

test(
  'last updated sorting includes bottle changes and falls back to creation timestamps',
  () => {
    const collection = {
      bottlings: [
        {
          id: 'a', name: 'Alpha', updatedAt: '2026-01-01T00:00:00Z', bottles: [
            {
              id: 'a1',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-11-15T00:00:00Z',
            },
            {
              id: 'a2',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-02-01T00:00:00Z',
            }],
        },
        {
          id: 'b',
          name: 'Beta',
          createdAt: '2026-04-01T00:00:00Z',
          bottles: [{id: 'b1', createdAt: '2026-04-02T00:00:00Z'}],
        },
        {id: 'c', name: 'Gamma', bottles: []},
      ],
    };
    /**
     * Transforms the entries used by ids.
     *
     * @param {*} sort Sort direction or ordering rule.
     * @param {string=} mode Selected mode controlling the operation.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    const ids = (sort, mode = 'bottlings') =>
      collectionOverviewEntries(collection, {sort, mode}).map(e => mode === 'bottles' ? e.bottle.id : e.bottling.id);
    assert.deepEqual(ids('updatedDesc'), ['a', 'b', 'c']);
    assert.deepEqual(ids('updatedAsc'), ['b', 'a', 'c']);
    assert.deepEqual(ids('updatedDesc', 'bottles'), ['a1', 'b1', 'a2']);
    assert.deepEqual(ids('updatedAsc', 'bottles'), ['a2', 'b1', 'a1']);
  }
);

test('release subtitles participate in search and name ordering without changing the main name', () => {
  const collection = sample();
  collection.bottlings[0].name = 'Kilchoman Genesis';
  collection.bottlings[0].subtitle = 'Fermenting – Stage 5';
  collection.bottlings[1].name = 'Kilchoman Genesis';
  collection.bottlings[1].subtitle = 'Distilling – Stage 6';
  assert.deepEqual(collectionOverviewEntries(collection, {search: 'Fermenting', ...selectors}).map(entry => entry.bottling.id), ['a']);
  assert.deepEqual(collectionOverviewEntries(collection, {search: 'Stage 5', mode: 'bottles', ...selectors}).map(entry => entry.bottle.id), ['a-1', 'a-2', 'a-3']);
  assert.deepEqual(collectionOverviewEntries(collection, {...selectors}).map(entry => entry.bottling.id), ['z', 'a']);
  assert.deepEqual(collectionOverviewEntries(collection, {sort: 'nameDesc', ...selectors}).map(entry => entry.bottling.id), ['a', 'z']);
});
