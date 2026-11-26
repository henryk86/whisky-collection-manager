import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {availableOverviewDistilleries, collectionOverviewEntries}
  from '../../public/js/domain/collection-overview.js';
import {homePageUrl, overviewModeFromSearch, paginate}
  from '../../public/js/domain/pagination.js';
import {createHomeView} from '../../public/js/views/home.js';

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
    assert.equal(renderedText(paginate(bottles, 2, 2).items[0].bottle.id), 'a-3');
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
      renderedText(paginate(collectionOverviewEntries(collection, {mode: 'bottles', volumeType: 'standard', ...options}), 1, 1).total),
      2
    );
  }
);

test(
  'bottle mode is bookmarkable and the default bottling URL is backward compatible',
  () => {
    assert.equal(renderedText(homePageUrl(1)), '/');
    assert.equal(renderedText(homePageUrl(4)), '/?page=4');
    assert.equal(renderedText(homePageUrl(1, 'bottles')), '/?mode=bottles');
    assert.equal(renderedText(homePageUrl(4, 'bottles')), '/?mode=bottles&page=4');
    assert.equal(renderedText(overviewModeFromSearch('?mode=bottles&page=2')), 'bottles');
    assert.equal(renderedText(overviewModeFromSearch('?mode=unknown')), 'bottlings');
  }
);

test(
  'physical bottle cards use their own photo, identifier, status and volume; table rows stay distinct',
  () => {
    const collection = sample();
    const original = {
      document: globalThis.document,
      history: globalThis.history,
      location: globalThis.location,
    };
    const field = {
      /**
       * Ignores listener registration in this DOM-free test double.
       */
      addEventListener() {},
    };
    let html = '';
    const state = {
      collection,
      overviewMode: 'bottles',
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
    try {
      globalThis.document = {
        /**
         * Derives the query selector result from the supplied values.
         * @return {!Object} Result computed from the supplied inputs.
         */
        querySelector: () =>
          field,
        /**
         * Simulates an element query with no matches.
         * @return {Array<never>} Empty match list; the simulated root has no matching elements.
         */
        querySelectorAll: () => [],
      };
      globalThis.history =
      {
        /**
         * Reports the replace state error condition.
         */
        replaceState() {throw new Error('No history change expected');},
      };
      globalThis.location = {pathname: '/', search: '?mode=bottles'};
      const view = createHomeView({
        state, selectors: {
          /**
           * Derives the all bottles result from the supplied values.
           * @return {!Array<*>} Resulting entries in their output order.
           */
          allBottles: () => collection.bottlings.flatMap(b => b.bottles),
          /**
           * Derives the bottles result from the supplied values.
           *
           * @param {*} id Identifier of the affected record.
           * @return {!Array<*>} Resulting entries in their output order.
           */
          bottles: id => collection.bottlings.find(b => b.id === id)?.bottles || [],
          /**
           * Supplies a fixed cover-photo path for the image rendering assertion.
           * @return {string} Fixture photo path 'bottling-cover.jpg'.
           */
          coverPhoto: () => 'bottling-cover.jpg',
          distilleryNames: selectors.distilleryNames,
        },
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
         */
        shell(value) {html = value;},
      });
      view();
      assert.equal((renderedText(html).match(/<article\b/g) || []).length, 3);
      assert.equal((renderedText(html).match(/data-bottle-id=/g) || []).length, 3);
      assert.match(renderedText(html), /data-bottle-id="a-1"[\s\S]*?one\.jpg/);
      assert.match(renderedText(html), /data-bottle-id="a-2"[\s\S]*?two\.jpg/);
      /**
       * Finds the rendered article for one physical bottle.
       *
       * @param {*} id Identifier of the affected record.
       * @return {string|undefined} Serialized article with the requested physical-bottle ID, or undefined.
       */
      const cardFor = id => (renderedText(html).match(/<article\b[\s\S]*?<\/article>/g) || []).find(card => renderedText(card).includes(`data-bottle-id="${id}"`));
      assert.match(renderedText(cardFor('a-1')), /src="\/one\.jpg"/);
      assert.match(renderedText(cardFor('a-2')), /src="\/two\.jpg"/);
      // Only bottles with no photo inherit the displayed bottling cover.
      assert.match(renderedText(cardFor('a-3')), /src="\/bottling-cover\.jpg"/);
      assert.doesNotMatch(renderedText(cardFor('a-1')), /bottling-cover\.jpg/);
      assert.doesNotMatch(renderedText(cardFor('a-2')), /bottling-cover\.jpg/);
      assert.equal((renderedText(html).match(/class="collection-mode-toggle"/g) || []).length, 1);
      assert.match(
        renderedText(html),
        new RegExp(
          'class="section-head ds-page-header collect' + 'ion-heading"[\\s\\S]*class="collection-mod' +
          'e-toggle"[\\s\\S]*class="stats"'
        )
      );
      assert.ok(renderedText(html).indexOf('class="collection-mode-toggle"') < renderedText(html).indexOf('class="stats"'));
      assert.match(renderedText(html), /#000102 · 50 ml/);
      assert.match(renderedText(html), /<span class="badge open">Geöffnet<\/span>/);
      assert.match(renderedText(html), /<span class="badge sample">Sample<\/span>/);
      assert.match(renderedText(html), /1–3 von 3 Flaschen/);
      assert.match(renderedText(html), /id="filter-distillery"/);
      assert.match(renderedText(html), /id="filter-volume-type"/);
      assert.match(renderedText(html), /<option value="sample"\s*>Samples<\/option>/);
      const toolbar = renderedText(html).slice(
        renderedText(html).indexOf('<div class="toolbar collection-filters"'),
        renderedText(html).indexOf('<div class="pagination-topline"') === -1 ?
          html.length : renderedText(html).indexOf('<div class="pagination-topline"')
      );
      assert.ok(toolbar, 'overview toolbar must exist');
      assert.equal((renderedText(toolbar).match(/<select id="filter-/g) || []).length, 6,
        'all six existing selectors remain available');
      assert.match(renderedText(toolbar), /data-flavor-profile-status/, 'profile status lives in the flavor overlay');
      assert.match(renderedText(toolbar), /data-act="toggle-collection-filters" aria-expanded="false"/);
      assert.match(renderedText(toolbar), /id="collection-filter-extra"/);
      assert.ok(renderedText(toolbar).indexOf('id="filter-sort"') < renderedText(toolbar).indexOf('id="filter-distillery"'));
      assert.ok(renderedText(toolbar).indexOf('data-act="toggle-view"') < renderedText(toolbar).indexOf('id="filter-distillery"'));
      assert.match(renderedText(toolbar), /<select id="filter-distillery" aria-label="Destillerie filtern">/);
      assert.match(renderedText(toolbar), /<select id="filter-volume-type" aria-label="Flaschentyp filtern">/);
      assert.match(renderedText(toolbar), /<select id="filter-rating" aria-label="Nach Bewertung filtern">/);
      state.view = 'table';
      view();
      assert.equal((renderedText(html).match(/<tr class="clickable"/g) || []).length, 3);
      assert.match(renderedText(html), /data-act="collection-sort-column" data-column="inventory"[^>]*>Flasche/);
      assert.match(renderedText(html), /data-bottle-id="a-2"/);
      assert.match(renderedText(html), /#000102/);
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
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
    assert.equal(renderedText(paginate(bottlingEntries).total), 1);
    assert.equal(renderedText(paginate(bottleEntries).total), 28);
    assert.equal(renderedText(paginate(bottleEntries).pageCount), 2);
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
    assert.equal(renderedText(matchesOverviewRating(collection.bottlings[0], '5')), true);
    assert.equal(renderedText(matchesOverviewRating(collection.bottlings[0], '4')), false);
    assert.equal(renderedText(matchesOverviewRating(collection.bottlings[1], 'unrated')), true);
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
    assert.equal(renderedText(matchesOverviewRating(collection.bottlings[0], '1')), true, 'zero belongs to the first glass');
    assert.equal(renderedText(matchesOverviewRating({tastings: [{id: 'edge', tastedOn: date, rating: 20.1}]}, '2')), true);
  }
);

test(
  'glencairn rating is drawn over the bottle image with five proportional fills and unique IDs per bottle',
  async () => {
    const {collectionCardRating} = await import('../../public/js/views/home.js');
    const bottling = {
      id: 'own',
      tastings: [{id: 'new', tastedOn: '2026-11-15', rating: 87.5}],
    };
    const a = collectionCardRating(bottling, 'bottle-1');
    const b = collectionCardRating(bottling, 'bottle-2');
    assert.match(renderedText(a), /class="collection-card-rating"/);
    assert.equal((renderedText(a).match(/glencairn-rating-symbol/g) || []).length, 5);
    assert.match(renderedText(a), /y="236\.125" width="220" height="94\.875"/);
    assert.match(renderedText(a), /overview-rating-bottle-1-0/);
    assert.match(renderedText(b), /overview-rating-bottle-2-0/);
    assert.doesNotMatch(renderedText(b), /overview-rating-bottle-1-0/);
    assert.equal(renderedText(collectionCardRating({id: 'no-score', tastings: []})), '');
  }
);


test(
  'collection filters expand in place and active chips reset a single selection',
  () => {
    const collection = {settings: {}, bottlings: [], distilleries: []};
    const state = {
      page: 'home',
      collection,
      search: '',
      status: 'open',
      completion: 'all',
      sort: 'name',
      distillery: 'all',
      rating: 'all',
      volumeType: 'all',
      view: 'cards',
      overviewMode: 'bottlings',
      pageNumber: 1,
      pageSize: 12,
    };
    let html = '';
    const original = {
      document: globalThis.document,
      location: globalThis.location,
      history: globalThis.history,
    };
    const filterElement = {dataset: {expanded: 'false'}};
    try {
      globalThis.location = {pathname: '/', search: ''};
      globalThis.history = {
        /**
         * Suppresses history replacement in the simulated browser.
         */
        replaceState() {},
        /**
         * Suppresses history insertion in the simulated browser.
         */
        pushState() {},
      };
      globalThis.document = {
        /**
         * Derives the query selector result from the supplied values.
         * @return {!Object} Result computed from the supplied inputs.
         */
        querySelector: () => filterElement,
      };
      const view = createHomeView({
        state, selectors: {
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
           * Simulates a missing cover photo.
           * @return {null} No photo path.
           */
          coverPhoto: () => null,
          /**
           * Derives the distillery names result from the supplied values.
           * @return {!Array<*>} Resulting entries in their output order.
           */
          distilleryNames: () => [],
        },
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
         */
        shell: markup => {html = markup;},
      });
      view();
      assert.match(renderedText(html), /data-expanded="false"/);
      assert.match(renderedText(html), /data-reset-collection-filter="status"/);
      const toggle = {
        dataset: {act: 'toggle-collection-filters'},
        /**
         * Updates attribute in the current state.
         *
         * @param {*} name Environment variable or setting name.
         * @param {*} value Value to process.
         */
        setAttribute(name, value) {this[name] = value;},
      };
      view.handleClick(toggle);
      assert.equal(renderedText(filterElement.dataset.expanded), 'true');
      assert.equal(renderedText(toggle['aria-expanded']), 'true');
      view();
      assert.match(renderedText(html), /data-expanded="true"/);
      view.handleClick({dataset: {resetCollectionFilter: 'status'}});
      assert.equal(renderedText(state.status), 'all');
      assert.doesNotMatch(renderedText(html), /data-reset-collection-filter="status"/);
      assert.match(renderedText(html), /data-expanded="true"/, 'expanded filters stay open when values change');
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
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

test(
  'sort options include price, score, changed and tasting dates and are selectable in both modes',
  () => {
    const collection = sample();
    const original = {
      document: globalThis.document,
      location: globalThis.location,
      history: globalThis.history,
    };
    const state = {
      collection,
      page: 'home',
      overviewMode: 'bottlings',
      view: 'cards',
      sort: 'tastedDesc',
      search: '',
      status: 'all',
      completion: 'all',
      distillery: 'all',
      volumeType: 'all',
      rating: 'all',
      pageNumber: 1,
      pageSize: 24,
    };
    let markup = '';
    try {
      globalThis.document = {
        /**
         * Simulates an element lookup that finds nothing.
         * @return {null} Null to represent a missing element.
         */
        querySelector: () => null,
      };
      globalThis.location = {pathname: '/', search: ''};
      globalThis.history = {
        /**
         * Suppresses history replacement in the simulated browser.
         */
        replaceState() {},
      };
      const view = createHomeView({
        state, selectors: {
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
        },
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} html Page content passed by the view.
         */
        shell: html => {markup = html;},
      });
      view();
      for (const value of [
        'nameDesc',
        'distillery',
        'distilleryDesc',
        'priceAsc',
        'priceDesc',
        'scoreDesc',
        'scoreAsc',
        'updatedDesc',
        'updatedAsc',
        'tastedDesc',
        'tastedAsc',
      ]) {
        assert.match(renderedText(markup), new RegExp(`<option value="${value}"`));
      }
      assert.match(renderedText(markup), /<option value="tastedDesc" selected>/);
      assert.match(renderedText(markup), /Ø Kaufpreis aufsteigend/);
      state.overviewMode = 'bottles';
      view();
      assert.match(renderedText(markup), /Kaufpreis aufsteigend/);
      assert.doesNotMatch(renderedText(markup), /Ø Kaufpreis aufsteigend/);
    } finally {
      for (const [name, value] of Object.entries(original)) {
        if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
      }
    }
  }
);
