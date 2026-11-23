import test from 'node:test';
import assert from 'node:assert/strict';
import {createHomeView} from '../../public/js/views/home.js';
import {createAnalyticsView} from '../../public/js/views/analytics.js';
import {shelfContents} from '../../public/js/views/warehouse-shelf-details.js';

test('M5: collection summary cards use the shared panel renderer without nesting panels', () => {
  const previous = {document: globalThis.document, location: globalThis.location, history: globalThis.history};
  let html = '';
  try {
    const placeholder = {addEventListener() {}, focus() {} };
    globalThis.document = {querySelector: () => placeholder, querySelectorAll: () => []};
    globalThis.location = {pathname: '/', search: ''};
    globalThis.history = {replaceState() {} };
    const state = {
      collection: {bottlings: [], distilleries: [], settings: {}},
      page: 'home', pageNumber: 1, pageSize: 24, search: '', status: 'all',
      completion: 'all', sort: 'name', view: 'cards'
    };
    const selectors = {allBottles: () => [], bottles: () => [], coverPhoto: () => '', distilleryNames: () => ''};
    createHomeView({state, selectors, shell: markup => {html = markup;}})();
    assert.equal((html.match(/class="panel stat" data-ds-panel="standard"/g) || []).length, 4);
    assert.match(html, /class="empty-state" data-ds-empty-state="collection"/);
    assert.doesNotMatch(html, /class="panel stat"[^>]*>\s*<div class="panel"/);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
});

test('M5: analytics KPIs use the same panel contract but keep chart-specific styles separate', () => {
  let html = '';
  const state = {
    collection: {schemaVersion: 6, bottlings: [], distilleries: []},
    selected: 'overview', analyticsFilters: {}, analyticsPeriod: 'month'
  };
  createAnalyticsView({state, shell: markup => {html = markup;}})();
  assert.match(html, /class="panel stat analytics-metric" data-ds-panel="standard"/);
  assert.match(html, /class="analytics-panel" data-ds-panel="analytics"/);
  assert.match(html, /data-ds-empty-state="inline"/);
});

test('M5: warehouse shelf actions share the toolbar renderer and keep bottle event bindings', () => {
  const room = {id: 'r1', name: 'Lager', furniture: [{id: 'f1', name: 'Regal', shelves: [{id: 's1', name: 'Fach', capacity: 5}]}]};
  const bottle = {id: 'p1', bottlingId: 'b1', name: 'A&B', number: '000111', status: 'closed'};
  const html = shelfContents({rooms: [room], bottles: [bottle], assignments: {p1: 's1'}}, 's1', [{id: 'b1', abv: 46}])?.html || '';
  assert.match(html, /class="actions warehouse-shelf-detail-actions" data-ds-action-toolbar="inline"/);
  assert.match(html, /data-act="warehouse-assign" data-id="p1"/);
  assert.match(html, /href="\/\?bottling=b1"/);
  assert.match(html, /A&amp;B/);
});
