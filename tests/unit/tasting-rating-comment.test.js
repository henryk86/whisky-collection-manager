import {renderedText} from '../helpers/rendering.js';
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
        id: 'b1', name: 'Example', tastings: existing ? [record] : [],
      }],
      externalTastings: existing ? [{...record, bottling: {name: 'External whisky'}}] : [],
    },
  };
  const view = createTastingsView({
    state,
    /**
     * Captures the rendered page in the fixture for later assertions.
     *
     * @param {import('../../public/js/ui/render-plan.js').RenderContent} html Page content passed by the view.
     * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
     */
    shell: html => markup = html,
    /**
     * Suppresses navigation so the scenario can inspect the current view.
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
  'saved owned and external tasting show the rating comment next to the rating, safely escaped',
  () => {
    for (const page of ['tasting', 'external-tasting']) {
      const html = render(page).markup;
      const section = renderedText(html).split('class="analytics-panel tasting-rating-panel"')[1];
      assert.match(renderedText(section), /Gesamtbewertung/);
      assert.match(renderedText(section), /class="tasting-rating-comment"/);
      assert.match(renderedText(section), /Kommentar zur Bewertung/);
      assert.match(renderedText(section), /Sehr rund\nMit &lt;Charakter&gt; &amp; Struktur/);
      assert.doesNotMatch(renderedText(section), /data-tasting-rating-comment/, 'saved tasting begins read-only');
    }
  }
);

test(
  'rating comment is optional, is edited below the glasses and does not become a sensory note',
  () => {
    const draft = render('tasting', false).markup;
    assert.match(
      renderedText(draft),
      new RegExp('tasting-rating-panel[\\s\\S]*?data-tasting' + '-rating-comment maxlength="10000" rows="3"')
    );
    assert.match(
      renderedText(draft),
      new RegExp('<textarea data-tasting-rating-comment maxl' + 'ength="10000" rows="3"><\\/textarea>')
    );
    assert.match(renderedText(draft), /data-tasting-note="nose"/);
    assert.equal((renderedText(draft).match(/data-tasting-note="/g) || []).length, 3);
    const externalDraft = render('external-tasting', false).markup;
    assert.match(renderedText(externalDraft), /data-tasting-rating-comment/);
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
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: value => html = value,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).editor();
    assert.doesNotMatch(renderedText(html), /class="tasting-rating-comment"/);
  }
);
