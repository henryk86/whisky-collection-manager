import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';
import {addActionLabel, newBottlingIcon} from '../../public/js/ui/action-icons.js';

const bottling = {id: 'b1', name: 'Sample', tastings: [], distillery: 'Demo'};
/**
 * Derives the render result from the supplied values.
 *
 * @param {*} page Page or view being rendered or selected.
 * @param {*} tastingId Value used by this operation.
 * @return {string} Resulting text.
 */
const render = (page, tastingId) => {
  let html = '';
  const state = {
    page,
    selected: 'b1',
    tastingId,
    collection: {bottlings: [bottling], externalTastings: [], distilleries: []},
  };
  const view = createTastingsView({
    state,
    /**
     * Updates the shell state for its caller.
     *
     * @param {*} value Value to process.
     */
    shell: value => {
      html =
        value;
    },
    /**
     * Updates the navigate state for its caller.
     */
    navigate() {},
    /**
     * Performs the refresh lifecycle action.
     */
    refresh() {},
  });
  view[page === 'tastings' ? 'list' : 'editor']();
  return html;
};

test('add action in the owned tasting list is inside its framed panel', () => {
  const html = render('tastings');
  assert.doesNotMatch(html, /class="tasting-add-action"/);
  assert.match(
    html,
    /<section class="analytics-panel tasting-list-section">\s*<div class="tasting-panel-heading ds-section-header">[\s\S]*?data-act="tastings-new"[^>]*><svg class="new-icon"/
  );
});

test(
  'editor actions belong to the first form card and the section heading has no duplicate margin',
  async () => {
    const html = render('tasting', 'new');
    const start = html.indexOf('class="tasting-record-fields analytics-panel tasting-edit-meta-panel"');
    const end = html.indexOf('class="tasting-top-row"', start);
    assert.ok(start !== -1 && end > start);
    const panel = html.slice(start, end);
    assert.match(panel, /data-act="flavor-detail-undo"/);
    assert.match(panel, /data-act="flavor-detail-redo"/);
    assert.match(panel, /data-tasting-date/);
    assert.match(panel, /data-tasting-title/);
    assert.ok(panel.indexOf('data-tasting-date') <
      panel.indexOf('data-tasting-title'));
    assert.ok(
      panel.indexOf('data-tasting-title') <
      panel.indexOf('class="actions tasting-editor-actions"'),
      'actions should follow date and title'
    );
    assert.doesNotMatch(
      html.match(/<div class="section-head tasting-editor-section-head">[\s\S]*?<\/div>/)?.[0] || '',
      /flavor-detail-undo/
    );
  }
);

test(
  'every translated plus action can share the common SVG and accessible text',
  () => {
    const markup = addActionLabel('+ Weitere Flasche');
    assert.match(markup, /<svg class="new-icon"/);
    assert.match(markup, />Weitere Flasche<\/span>/);
    assert.doesNotMatch(markup, /\+ Weitere Flasche/);
    assert.match(newBottlingIcon, /stroke-width="2.2"/);
  }
);
