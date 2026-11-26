import {domElements, domText, domScope} from './component-dom.js';
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
  async () => {
    for (const page of ['tasting', 'external-tasting']) {
      const html = render(page).markup;
      const section = domScope(html, '.analytics-panel.tasting-rating-panel');
      assert.match(await domText(section), /Gesamtbewertung/);
      assert.ok((await domElements(section, '[class="tasting-rating-comment"]')).length > 0);
      assert.match(await domText(section), /Kommentar zur Bewertung/);
      assert.match(await domText(section), new RegExp("Sehr rund\\nMit <Charakter> & Struktur"));
      assert.equal((await domElements(section, '[data-tasting-rating-comment]')).length, 0, 'saved tasting begins read-only');
    }
  }
);

test(
  'rating comment is optional, is edited below the glasses and does not become a sensory note',
  async () => {
    const draft = render('tasting', false).markup;
    const [comment] = (await domElements(draft, '.tasting-rating-panel textarea[data-tasting-rating-comment][maxlength="10000"][rows="3"]'));
    assert.equal(comment.value, '');
    assert.equal((await domElements(draft, 'textarea[data-tasting-rating-comment]')).length, 1);
    assert.ok((await domElements(draft, '[data-tasting-note="nose"]')).length > 0);
    assert.equal((await domElements(draft, '[data-tasting-note]')).length, 3);
    const externalDraft = render('external-tasting', false).markup;
    assert.ok((await domElements(externalDraft, '[data-tasting-rating-comment]')).length > 0);
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
    assert.equal((await domElements(html, '[class="tasting-rating-comment"]')).length, 0);
  }
);
