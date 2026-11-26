import {domElements, domText, domIndex, domScope, assertDom, assertDomOrder} from './component-dom.js';
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
 * @return {import('../../public/js/ui/render-plan.js').RenderContent} Captured tasting page plan for the requested route.
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
     * Captures the rendered page in the fixture for later assertions.
     *
     * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
     */
    shell: value => {
      html = value;
    },
    /**
     * Suppresses navigation so the scenario can inspect the current view.
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

test('add action in the owned tasting list is inside its framed panel', async () => {
  const html = render('tastings');
  assert.equal((await domElements(html, '[class="tasting-add-action"]')).length, 0);
  await assertDom(html, "section.analytics-panel.tasting-list-section > .tasting-panel-heading.ds-section-header [data-act=\"tastings-new\"] > svg.new-icon");
});

test(
  'editor actions belong to the first form card and the section heading has no duplicate margin',
  async () => {
    const html = render('tasting', 'new');
    const panel = domScope(html, '.tasting-record-fields.analytics-panel.tasting-edit-meta-panel');
    await assertDomOrder(html, '.tasting-edit-meta-panel', '.tasting-top-row');
    assert.ok((await domElements(panel, '[data-act="flavor-detail-undo"]')).length > 0);
    assert.ok((await domElements(panel, '[data-act="flavor-detail-redo"]')).length > 0);
    assert.ok((await domElements(panel, '[data-tasting-date]')).length > 0);
    assert.ok((await domElements(panel, '[data-tasting-title]')).length > 0);
    assert.ok(await domIndex(panel, '[data-tasting-date]') < await domIndex(panel, '[data-tasting-title]'));
    assert.ok(
      await domIndex(panel, '[data-tasting-title]') < await domIndex(panel, '.actions.tasting-editor-actions'),
      'actions should follow date and title'
    );
    await assertDom(html, '.tasting-editor-section-head [data-act="flavor-detail-undo"]', {}, true);
  }
);

test(
  'every translated plus action can share the common SVG and accessible text',
  async () => {
    const markup = addActionLabel('+ Weitere Flasche');
    assert.ok((await domElements(markup, 'svg[class="new-icon"]')).length > 0);
    await assertDom(markup, "span", {"text": new RegExp("^Weitere Flasche$")});
    assert.doesNotMatch(await domText(markup), /\+ Weitere Flasche/);
    await assertDom(newBottlingIcon, "[stroke-width=\"2.2\"]");
  }
);
