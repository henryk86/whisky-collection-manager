import {domElements, domText, domMatches, domIndex, domScope, assertDom} from './component-dom.js';
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
       * Ignores listener registration in this DOM-free test double.
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
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
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
       * Simulates a bottling without a cover photo.
       * @return {string} Empty path to exercise the no-photo state.
       */
      coverPhoto: () => '',
      /**
       * Supplies the fixed distillery label used by this fixture.
       * @return {string} Fixture label 'Talisker'.
       */
      distilleryNames: () => 'Talisker',
    };
    createHomeView({
      state, selectors,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Page content passed by the view.
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

test('home shows the saved founding year and never assumes 2026', async () => {
  assert.match(await domText(renderHome(1997)), /COLLECTION · EST\. 1997/);
  const unset = renderHome(null);
  await assertDom(unset, "[class=\"hero-footnote\"]", {"text": new RegExp("^COLLECTION$")});
  assert.doesNotMatch(await domText(unset), /EST\. 2026/);
});

test(
  'dashboard has four stats; opened and closed are independent bottle counts',
  async () => {
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
    const stats = domScope(html, ".stats");
    assert.equal((await domElements(stats, '[class="panel stat"]')).length, 4);
    await assertDom(stats, "span:has(+ strong)", {text: "Geöffnet", nextText: "1"});
    await assertDom(stats, "span:has(+ strong)", {text: "Geschlossen", nextText: "2"});
    assert.ok(
      await domIndex(stats, 'span', {text: 'Geschlossen'}) < await domIndex(stats, 'span', {text: 'Geöffnet'}),
      'Geschlossen must be shown before Geöffnet'
    );
    await assertDom(stats, "span:has(+ strong)", {text: "Bestand gesamt", nextText: "4"});
    assert.equal((new RegExp("Unvollständig|Ungeöffnet \\/ geöffnet").test(await domText(stats))), false);
  }
);

test(
  'overview shows bottler only when distillery is missing, in cards and table',
  async () => {
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
    await assertDom(renderHome(null, [b]), "[class=\"card-kicker\"]", {"text": new RegExp("Signatory Vintage")});
    const table = renderHome(null, [b], [], 'table');
    assert.match((await domElements(table, 'button[data-act="collection-sort-column"][data-column="distillery"]'))[0].text.trim(), /Destillerie \/ Abfüller/);
    await assertDom(table, "td", {"text": new RegExp("^Signatory Vintage$")});
    assert.match(await domText(renderHome(null, [{...b, bottler: '<script>alert(1)</script>'}])), new RegExp("<script>alert\\(1\\)<\\/script>"));
  }
);

test(
  'settings exposes a persistent founding-year form next to existing backup controls',
  async () => {
    const html = createSettingsView({
      collection: {settings: {establishedYear: 1989}, distilleries: []},
      backupDashboard: null,
    })();
    assert.ok((await domElements(html, '[id="collection-settings-form"]')).length > 0);
    assert.ok((await domElements(html, '[name="establishedYear"][value="1989"]')).length > 0);
    assert.match(await domText(html), /Gründungsjahr speichern/);
    assert.match(await domText(html), /Datensicherung/);
  }
);

test(
  'overview omits empty age, alcohol and year instead of showing placeholder units',
  async () => {
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
    assert.ok((await domElements(card, 'h3')).some(heading => heading.text.trim() === 'Ohne Angaben'));
    assert.equal((await domElements(card, '[class="card-facts muted"]')).length, 0);
    assert.equal((/– Jahre|– %|NaN/.test(await domText(card)) || await domMatches(card, "div.card-kicker", {text: ""})), false);
    const table = renderHome(null, [blank], [], 'table');
    const cells = (await domElements(table, 'tbody tr td'));
    const nameIndex = cells.findIndex(cell => cell.text.trim().startsWith('Ohne Angaben'));
    assert.ok(nameIndex >= 0);
    assert.ok(cells.slice(nameIndex + 1).some((cell, index, remaining) => remaining.slice(index, index + 3).length === 3 && remaining.slice(index, index + 3).every(item => item.text.trim() === '')));
    assert.equal((new RegExp("– %|– Jahre").test(await domText(table))), false);

    const withAbv = {...blank, abv: 46.5};
    const abvCard = renderHome(null, [withAbv]);
    await assertDom(abvCard, "[class=\"card-facts muted\"]", {"text": new RegExp("^46.5 % Vol\\.$")});
    assert.equal((new RegExp("Jahre| · 46").test(await domText(abvCard))), false);
    const withZero = renderHome(null, [{...blank, ageYears: 0, abv: 0}]);
    await assertDom(withZero, "[class=\"card-facts muted\"]", {"text": new RegExp("^0 Jahre · 0 % Vol\\.$")});
  }
);

test(
  'advanced filter toggle uses the intended filter icon and a separate chevron, never a text glyph',
  async () => {
    const html = renderHome(null);
    const toggle = domScope(html, 'button.btn.collection-filter-toggle');
    assert.ok(toggle, 'advanced filter toggle exists');
    assert.ok((await domElements(toggle, '[class="collection-filter-icon"]')).length > 0);
    assert.ok((await domElements(toggle, '[class="collection-filter-chevron"]')).length > 0);
    assert.ok((await domElements(toggle, '[aria-expanded="false"]')).length > 0);
    assert.doesNotMatch(await domText(toggle), /⌄/);
  }
);
