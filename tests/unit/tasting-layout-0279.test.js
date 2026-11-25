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
    const start = html.indexOf('class="tasting-record-fields analytics-panel tasting-edit-meta-panel"');
    const end = html.indexOf('class="tasting-top-row"', start);
    assert.ok(start > -1 && end > start);
    const panel = html.slice(start, end);
    assert.ok(panel.indexOf('data-tasting-date') < panel.indexOf('data-tasting-title'));
    assert.ok(panel.indexOf('data-tasting-title') < panel.indexOf('class="actions tasting-editor-actions"'));
    assert.match(panel, /data-act="flavor-detail-undo"/);
    assert.match(panel, /data-act="flavor-detail-redo"/);
  }
);
