import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';
import {addActionLabel, newBottlingIcon}
  from '../../public/js/ui/action-icons.js';

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
      html = value;
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
  assert.doesNotMatch(renderedText(html), /class="tasting-add-action"/);
  assert.match(
    renderedText(html),
    new RegExp(
      '<section class="analytics-panel tasting-li' + 'st-section">\\s*<div class="tasting-panel-' +
      'heading ds-section-header">[\\s\\S]*?data-' +
      'act="tastings-new"[^>]*><svg class="new-ic' +
      'on"'
    )
  );
});

test(
  'editor actions belong to the first form card and the section heading has no duplicate margin',
  async () => {
    const html = render('tasting', 'new');
    const start = renderedText(html).indexOf('class="tasting-record-fields analytics-panel tasting-edit-meta-panel"');
    const end = renderedText(html).indexOf('class="tasting-top-row"', start);
    assert.ok(start !== -1 && end > start);
    const panel = renderedText(html).slice(start, end);
    assert.match(renderedText(panel), /data-act="flavor-detail-undo"/);
    assert.match(renderedText(panel), /data-act="flavor-detail-redo"/);
    assert.match(renderedText(panel), /data-tasting-date/);
    assert.match(renderedText(panel), /data-tasting-title/);
    assert.ok(renderedText(panel).indexOf('data-tasting-date') < renderedText(panel).indexOf('data-tasting-title'));
    assert.ok(
      renderedText(panel).indexOf('data-tasting-title') < renderedText(panel).indexOf('class="actions tasting-editor-actions"'),
      'actions should follow date and title'
    );
    assert.doesNotMatch(
      renderedText(html).match(/<div class="section-head tasting-editor-section-head">[\s\S]*?<\/div>/)?.[0] || '',
      /flavor-detail-undo/
    );
  }
);

test(
  'every translated plus action can share the common SVG and accessible text',
  () => {
    const markup = addActionLabel('+ Weitere Flasche');
    assert.match(renderedText(markup), /<svg class="new-icon"/);
    assert.match(renderedText(markup), />Weitere Flasche<\/span>/);
    assert.doesNotMatch(renderedText(markup), /\+ Weitere Flasche/);
    assert.match(renderedText(newBottlingIcon), /stroke-width="2.2"/);
  }
);
