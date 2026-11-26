import {domElements} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';

test(
  'flight renders a separate drag grip without making note buttons draggable',
  async () => {
    let html = '';
    const notes = [80, 100, undefined].map((rating, i) => ({id: `note-${i}`, tastedOn: '2026-11-15', title: `Note ${i}`, rating}));
    const state = {
      page: 'tasting-flight', selected: 'flight-a', collection: {
        distilleries: [], externalTastings: [],
        bottlings: [{id: 'owned', name: 'Sample bottling', tastings: notes}],
        tastingFlights: [{
          id: 'flight-a',
          name: 'Flight',
          date: '2026-11-15',
          notes: '',
          tastingIds: notes.map(n => n.id),
          createdAt: '2026-11-15T00:00:00Z',
          updatedAt: '2026-11-15T00:00:00Z',
        }],
      },
    };
    const view = createTastingsView({
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
    });
    view.flight();
    assert.equal((await domElements(html, '[data-flight-drag]')).length, 3);
    assert.equal((await domElements(html, '[data-act="tasting-flight-note-open"]')).length, 3);
    assert.ok((await domElements(html, '[aria-label="Reihenfolge per Ziehen ändern"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="tasting-flight-move"]')).length > 0, 'keyboard/accessible buttons remain');
  }
);
