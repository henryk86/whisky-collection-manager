import {renderedText} from '../helpers/rendering.js';
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
       * Derives the shell result from the supplied values.
       *
       * @param {*} markup HTML markup for the selected content.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: markup => html = markup,
      /**
       * Updates the navigate state for its caller.
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
    assert.match(renderedText(panel), /data-act="flavor-detail-undo"/);
    assert.match(renderedText(panel), /data-act="flavor-detail-redo"/);
  }
);
