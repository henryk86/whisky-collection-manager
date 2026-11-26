import {domElements, domIndex, domScope, assertDomOrder} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';

test(
  'the tasting edit card uses date, title, actions as three grid columns',
  async () => {
    let html = '';
    const state = {
      page: 'tasting',
      selected: 'b1',
      tastingId: 'new',
      collection: {
        bottlings: [{id: 'b1', name: 'Example', tastings: []}],
        distilleries: [],
      },
    };
    createTastingsView({
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: markup => html = markup,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).editor();
    const panel = domScope(html, '.tasting-record-fields.analytics-panel.tasting-edit-meta-panel');
    await assertDomOrder(html, '.tasting-edit-meta-panel', '.tasting-top-row');
    assert.ok(await domIndex(panel, '[data-tasting-date]') < await domIndex(panel, '[data-tasting-title]'));
    assert.ok(await domIndex(panel, '[data-tasting-title]') < await domIndex(panel, '.actions.tasting-editor-actions'));
    assert.ok((await domElements(panel, '[data-act="flavor-detail-undo"]')).length > 0);
    assert.ok((await domElements(panel, '[data-act="flavor-detail-redo"]')).length > 0);
  }
);
