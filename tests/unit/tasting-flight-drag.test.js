import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reorderFlightIds} from '../../public/js/features/flight-order.js';
import {createTastingsView} from '../../public/js/views/tastings.js';

const original = ['a', 'b', 'c', 'd'];
test(
  'flight drag insertion works forward, backward, and skips no-op drops',
  () => {
    assert.deepEqual(reorderFlightIds(original, 'a', 'c', false), ['b', 'a', 'c', 'd']);
    assert.deepEqual(reorderFlightIds(original, 'a', 'c', true), ['b', 'c', 'a', 'd']);
    assert.deepEqual(reorderFlightIds(original, 'd', 'b', false), ['a', 'd', 'b', 'c']);
    assert.deepEqual(reorderFlightIds(original, 'd', 'b', true), ['a', 'b', 'd', 'c']);
    assert.equal(reorderFlightIds(original, 'a', 'b', false), null);
    assert.equal(reorderFlightIds(original, 'd', 'c', true), null);
    assert.equal(reorderFlightIds(original, 'a', 'a', true), null);
    assert.equal(reorderFlightIds(original, 'unknown', 'b', false), null);
    assert.deepEqual(original, ['a', 'b', 'c', 'd'], 'input array is never mutated');
  }
);

test(
  'flight renders a separate drag grip without making note buttons draggable',
  () => {
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
       * Derives the shell result from the supplied values.
       *
       * @param {*} value Value to process.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: value => html = value,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.flight();
    assert.equal((html.match(/data-flight-drag/g) || []).length, 3);
    assert.equal((html.match(/data-act="tasting-flight-note-open"/g) || []).length, 3);
    assert.match(html, /aria-label="Reihenfolge per Ziehen ändern"/);
    assert.match(html, /data-act="tasting-flight-move"/, 'keyboard/accessible buttons remain');
  }
);
