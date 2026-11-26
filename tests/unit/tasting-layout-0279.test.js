import {renderedText, domElements} from '../helpers/rendering.js';
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
    const start = renderedText(html).indexOf('class="tasting-record-fields analytics-panel tasting-edit-meta-panel"');
    const end = renderedText(html).indexOf('class="tasting-top-row"', start);
    assert.ok(start > -1 && end > start);
    const panel = renderedText(html).slice(start, end);
    assert.ok(renderedText(panel).indexOf('data-tasting-date') < renderedText(panel).indexOf('data-tasting-title'));
    assert.ok(renderedText(panel).indexOf('data-tasting-title') < renderedText(panel).indexOf('class="actions tasting-editor-actions"'));
    assert.ok(domElements(panel, '[data-act="flavor-detail-undo"]').length > 0);
    assert.ok(domElements(panel, '[data-act="flavor-detail-redo"]').length > 0);
  }
);
