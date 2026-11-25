import test from 'node:test';
import assert from 'node:assert/strict';
import {bottlingOriginLabel} from '../../public/js/domain/bottling-origin.js';
import {createHomeView} from '../../public/js/views/home.js';
import {createSettingsView} from '../../public/js/views/settings.js';

/**
 * Renders home for collection ui customization.test.
 *
 * @param {*} establishedYear Established year used by this operation.
 * @param {!Array<*>=} bottlings Bottlings used by this operation.
 * @param {!Array<*>=} physicalBottles Physical bottles used by this
 * operation.
 * @param {string=} view View used by this operation.
 * @return {undefined} Structured result assembled from the input data.
 */
function renderHome(establishedYear, bottlings = [], physicalBottles = [],
  view = 'cards') {
  const former = {
    document: globalThis.document,
    location: globalThis.location,
    history: globalThis.history,
  };
  let html;
  try {
    const field = {
      /**
       * Updates the add event listener state for its caller.
       */
      addEventListener() {},
    };
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: () =>
        field,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    globalThis.location = {pathname: '/', search: ''};
    globalThis.history =
    {
      /**
       * Reports the replace state error condition.
       */
      replaceState() {throw new Error('No history change expected');},
    };
    const state = {
      collection: {bottlings, settings: {establishedYear}},
      pageNumber: 1,
      pageSize: 24,
      search: '',
      status: 'all',
      completion: 'all',
      sort: 'name',
      view,
    };
    const selectors = {
      /**
       * Derives the all bottles result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      allBottles: () => physicalBottles,
      /**
       * Derives the bottles result from the supplied values.
       *
       * @param {*} bottleId Value used by this operation.
       * @return {*} Result computed from the supplied inputs.
       */
      bottles: bottleId => bottlings.find(b => b.id === bottleId)?.bottles || [],
      /**
       * Derives the cover photo result from the supplied values.
       * @return {string} Resulting text.
       */
      coverPhoto: () => '',
      /**
       * Derives the distillery names result from the supplied values.
       * @return {string} Resulting text.
       */
      distilleryNames: () => 'Talisker',
    };
    createHomeView({
      state, selectors,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} content Content to render, store or examine.
       */
      shell: content => {html = content;},
    })();
    return html;
  } finally {
    for (const [name, value] of Object.entries(former)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
}

test('home shows the saved founding year and never assumes 2026', () => {
  assert.match(renderHome(1997), /COLLECTION · EST\. 1997/);
  const unset = renderHome(null);
  assert.match(unset, /class="hero-footnote">COLLECTION<\/span>/);
  assert.doesNotMatch(unset, /EST\. 2026/);
});

test(
  'dashboard has four stats; opened and closed are independent bottle counts',
  () => {
    const physicalBottles = [
      {status: 'closed'},
      {status: 'closed'},
      {status: 'open'},
      {status: 'empty'},
    ];
    const html = renderHome(
      null,
      [{
        id: 'one',
        name: 'One',
        distilleryIds: [],
        bottles: [],
        createdAt: '2026-01-01',
      }],
      physicalBottles
    );
    const stats = html.slice(html.indexOf('<div class="stats">'), html.indexOf('<div class="toolbar collection-filters"'));
    assert.equal((stats.match(/class="panel stat"/g) || []).length, 4);
    assert.match(stats, /<span>Geöffnet<\/span>\s*<strong>1<\/strong>/);
    assert.match(stats, /<span>Geschlossen<\/span>\s*<strong>2<\/strong>/);
    assert.ok(
      stats.indexOf('<span>Geschlossen</span>') < stats.indexOf('<span>Geöffnet</span>'),
      'Geschlossen must be shown before Geöffnet'
    );
    assert.match(stats, /<span>Bestand gesamt<\/span>\s*<strong>4<\/strong>/);
    assert.doesNotMatch(stats, /Unvollständig|Ungeöffnet \/ geöffnet/);
  }
);

test(
  'overview shows bottler only when distillery is missing, in cards and table',
  () => {
    const b = {
      id: 'one',
      name: 'Independent',
      distilleryIds: [],
      bottler: 'Signatory Vintage',
      bottles: [],
      createdAt: '2026-01-01',
    };
    assert.equal(bottlingOriginLabel(b, () => 'wrong distillery'), 'Signatory Vintage');
    assert.equal(bottlingOriginLabel({...b, distilleryIds: ['d1']}, () => 'Talisker'), 'Talisker');
    assert.equal(bottlingOriginLabel({...b, bottler: '  '}, () => 'wrong'), '');
    assert.match(renderHome(null, [b]), /class="card-kicker">Signatory Vintage/);
    const table = renderHome(null, [b], [], 'table');
    assert.match(
      table,
      new RegExp('data-act="collection-sort-column" data-col' + 'umn="distillery"[^>]*>Destillerie \\/ Abfü' + 'ller')
    );
    assert.match(table, /<td>Signatory Vintage<\/td>/);
    assert.match(
      renderHome(null, [{...b, bottler: '<script>alert(1)</script>'}]),
      /&lt;script&gt;alert\(1\)&lt;\/script&gt;/
    );
  }
);

test(
  'settings exposes a persistent founding-year form next to existing backup controls',
  () => {
    const html = createSettingsView({
      collection: {settings: {establishedYear: 1989}, distilleries: []},
      backupDashboard: null,
    })();
    assert.match(html, /id="collection-settings-form"/);
    assert.match(html, /name="establishedYear"[^>]*value="1989"/);
    assert.match(html, /Gründungsjahr speichern/);
    assert.match(html, /Datensicherung/);
  }
);

test(
  'overview omits empty age, alcohol and year instead of showing placeholder units',
  () => {
    const blank = {
      id: 'no-meta',
      name: 'Ohne Angaben',
      createdAt: '2026-01-01',
      distilleryIds: [],
      ageYears: null,
      abv: undefined,
      releaseYear: null,
    };
    const card = renderHome(null, [blank]);
    assert.match(card, /<h3(?: data-i18n-ignore)?>Ohne Angaben<\/h3>/);
    assert.doesNotMatch(card, /class="card-facts muted"/);
    assert.doesNotMatch(card, /– Jahre|– %|NaN|<div class="card-kicker"><\/div>/);
    const table = renderHome(null, [blank], [], 'table');
    assert.match(
      table,
      new RegExp('<strong>Ohne Angaben<\\/strong>[\\s\\S]*?<' + 'td><\\/td>\\s*<td><\\/td>\\s*<td><\\/td>')
    );
    assert.doesNotMatch(table, /– %|– Jahre/);

    const withAbv = {...blank, abv: 46.5};
    const abvCard = renderHome(null, [withAbv]);
    assert.match(abvCard, /class="card-facts muted">46.5 % Vol\.<\/div>/);
    assert.doesNotMatch(abvCard, /Jahre| · 46/);
    const withZero = renderHome(null, [{...blank, ageYears: 0, abv: 0}]);
    assert.match(withZero, /class="card-facts muted">0 Jahre · 0 % Vol\.<\/div>/);
  }
);


test(
  'advanced filter toggle uses the intended filter icon and a separate chevron, never a text glyph',
  () => {
    const html = renderHome(null);
    const toggle = html.match(new RegExp('<button[^>]*class="btn collection-filter-t' + 'oggle"[^>]*>[\\s\\S]*?<\\/button>'))?.[0];
    assert.ok(toggle, 'advanced filter toggle exists');
    assert.match(toggle, /class="collection-filter-icon"/);
    assert.match(toggle, /class="collection-filter-chevron"/);
    assert.match(toggle, /aria-expanded="false"/);
    assert.doesNotMatch(toggle, /⌄/);
  }
);
