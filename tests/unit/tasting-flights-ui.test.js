import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';
import {parseRoute, routeUrl} from '../../public/js/navigation/routes.js';
import {flightForTasting, flightEntries} from '../../shared/tasting-flights.js';

const tasting = {
  id: 'note-1',
  tastedOn: '2026-11-15',
  title: 'A tasting',
  rating: 85,
  tastingNotes: {nose: '', palate: '', finish: ''},
  flavorProfile: null,
  whiskyColor: null,
};
const collection = {
  distilleries: [],
  bottlings: [{id: 'b-1', name: 'Islay whisky', tastings: [tasting]}],
  externalTastings: [],
  tastingFlights: [{
    id: 'flight-1',
    name: 'Islay comparison',
    date: '2026-11-15',
    notes: 'peat and smoke',
    tastingIds: ['note-1'],
    createdAt: '2026-11-15T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
  }],
};

test(
  'flight routes support direct navigation and back links without impacting \
ordinary tasting URLs',
  () => {
    assert.deepEqual(
      parseRoute(routeUrl('tasting-flight', 'flight-1').split('?')[1]),
      {page: 'tasting-flight', selected: 'flight-1'}
    );
    const url = routeUrl('tasting', 'b-1', {
      tastingId: 'new',
      flightId: 'flight-1',
    });
    assert.equal(parseRoute(url.split('?')[1]).flightId, 'flight-1');
    assert.equal(
      parseRoute(routeUrl('external-tasting', 'new', {flightId: 'flight-1'})
        .split('?')[1]).flightId,
      'flight-1'
    );
    assert.equal(
      parseRoute(routeUrl('tasting', 'b-1', {tastingId: 'note-1'})
        .split('?')[1]).flightId,
      undefined
    );
  }
);

test(
  'flight UI shows the session and individual notes with stable one-flight \
membership links',
  () => {
    let html = ''; const state =
      {collection, page: 'tastings-home', selected: null};
    const view = createTastingsView({
      state,
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} value Value to process.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: value => html =
        value,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.home();
    assert.match(html, /Islay comparison/);
    assert.match(html, /data-act="tasting-flight-new"/);
    state.page = 'tasting-flight'; state.selected = 'flight-1'; view.flight();
    assert.doesNotMatch(html, /data-act="tasting-flight-new-owned"/);
    // The add panel is optional, hidden until clicking the add button.
    assert.match(html, /data-act="tasting-flight-toggle-add"/);
    view.toggleFlightAdd();
    assert.match(html, /data-act="tasting-flight-new-owned"/);
    assert.match(html, /data-act="tasting-flight-move"/);
    assert.match(html, /data-act="tasting-flight-note-open"/);
    assert.match(html, /peat and smoke/);
    state.page = 'tasting'; state.selected = 'b-1'; state.tastingId =
      'note-1'; view.editor();
    assert.match(html, /data-act="tasting-open-flight"/);
    assert.match(html, /Position 1 von 1/);
    assert.equal(flightForTasting(collection, 'note-1').id, 'flight-1');
    assert.equal(
      flightEntries(collection, collection.tastingFlights[0])[0].record.id,
      'note-1'
    );
  }
);
