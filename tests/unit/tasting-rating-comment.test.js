import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';

const record = {
  id: 'one',
  tastedOn: '2026-11-22',
  title: '',
  rating: 80,
  ratingComment: 'Sehr rund\nMit <Charakter> & Struktur',
  flavorProfile: null,
  whiskyColor: null,
  tastingNotes: {nose: 'Vanille', palate: 'Frucht', finish: 'Lang'},
};

/**
 * Renders the tasting rating comment.test state.
 *
 * @param {*} page Page used by this operation.
 * @param {boolean=} existing Existing used by this operation.
 * @return {!Object} Structured result for the caller.
 */
function render(page, existing = true) {
  let markup = '';
  const state = {
    page,
    selected: page === 'external-tasting' ? (existing ? 'one' : 'new') : 'b1',
    tastingId: existing ? 'one' : 'new',
    collection: {
      distilleries: [],
      bottlings: [{
        id: 'b1', name: 'Example', tastings: existing ?
          [record] : [],
      }],
      externalTastings: existing ?
        [{...record, bottling: {name: 'External whisky'}}] : [],
    },
  };
  const view = createTastingsView({
    state,
    /**
     * Derives the shell result from the supplied values.
     *
     * @param {*} html HTML markup to render or inspect.
     * @return {*} Result computed from the supplied inputs.
     */
    shell: html => markup =
      html,
    /**
     * Updates the navigate state for its caller.
     */
    navigate() {},
    /**
     * Performs the refresh lifecycle action.
     */
    refresh() {},
  });
  view.editor();
  return {markup, view};
}

test(
  'saved owned and external tasting show the rating comment next to the \
rating, safely escaped',
  () => {
    for (const page of ['tasting', 'external-tasting']) {
      const html = render(page).markup;
      const section = html.split('class="analytics-panel tasting-rating-panel"'
      )[1];
      assert.match(section, /Gesamtbewertung/);
      assert.match(section, /class="tasting-rating-comment"/);
      assert.match(section, /Kommentar zur Bewertung/);
      assert.match(section, /Sehr rund\nMit &lt;Charakter&gt; &amp; Struktur/);
      assert.doesNotMatch(
        section,
        /data-tasting-rating-comment/,
        'saved tasting begins read-only'
      );
    }
  }
);

test(
  'rating comment is optional, is edited below the glasses and does not \
become a sensory note',
  () => {
    const draft = render('tasting', false).markup;
    assert.match(
      draft,
      new RegExp(
        'tasting-rating-panel[\\s\\S]*?data-tasting' +
        '-rating-comment maxlength="10000" rows="3"'
      )
    );
    assert.match(
      draft,
      new RegExp(
        '<textarea data-tasting-rating-comment maxl' +
        'ength="10000" rows="3"><\\/textarea>'
      )
    );
    assert.match(draft, /data-tasting-note="nose"/);
    assert.equal((draft.match(/data-tasting-note="/g) || []).length, 3);
    const externalDraft = render('external-tasting', false).markup;
    assert.match(externalDraft, /data-tasting-rating-comment/);
    const absent = {...record, ratingComment: ''};
    let html = '';
    const state = {
      page: 'tasting',
      selected: 'b1',
      tastingId: 'one',
      collection: {
        distilleries: [],
        bottlings: [{id: 'b1', name: 'Example', tastings: [absent]}],
      },
    };
    createTastingsView({
      state,
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} value Value to process.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: value => html =
        value,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).editor();
    assert.doesNotMatch(html, /class="tasting-rating-comment"/);
  }
);
