import {renderedText, domElements} from '../helpers/rendering.js';
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
  'flight routes support direct navigation and back links without impacting ordinary tasting URLs',
  () => {
    assert.deepEqual(
      parseRoute(renderedText(routeUrl('tasting-flight', 'flight-1')).split('?')[1]),
      {page: 'tasting-flight', selected: 'flight-1'}
    );
    const url = routeUrl('tasting', 'b-1', {
      tastingId: 'new',
      flightId: 'flight-1',
    });
    assert.equal(parseRoute(renderedText(url).split('?')[1]).flightId, 'flight-1');
    assert.equal(
      parseRoute(renderedText(routeUrl('external-tasting', 'new', {flightId: 'flight-1'})).split('?')[1]).flightId,
      'flight-1'
    );
    assert.equal(parseRoute(renderedText(routeUrl('tasting', 'b-1', {tastingId: 'note-1'})).split('?')[1]).flightId, undefined);
  }
);

test(
  'flight UI shows the session and individual notes with stable one-flight membership links',
  () => {
    let html = ''; const state = {collection, page: 'tastings-home', selected: null};
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
    view.home();
    assert.match(renderedText(html), /Islay comparison/);
    assert.ok(domElements(html, '[data-act="tasting-flight-new"]').length > 0);
    state.page = 'tasting-flight'; state.selected = 'flight-1'; view.flight();
    assert.equal(domElements(html, '[data-act="tasting-flight-new-owned"]').length, 0);
    // The add panel is optional, hidden until clicking the add button.
    assert.ok(domElements(html, '[data-act="tasting-flight-toggle-add"]').length > 0);
    view.toggleFlightAdd();
    assert.ok(domElements(html, '[data-act="tasting-flight-new-owned"]').length > 0);
    assert.ok(domElements(html, '[data-act="tasting-flight-move"]').length > 0);
    assert.ok(domElements(html, '[data-act="tasting-flight-note-open"]').length > 0);
    assert.match(renderedText(html), /peat and smoke/);
    state.page = 'tasting'; state.selected = 'b-1'; state.tastingId = 'note-1'; view.editor();
    assert.ok(domElements(html, '[data-act="tasting-open-flight"]').length > 0);
    assert.match(renderedText(html), /Position 1 von 1/);
    assert.equal(renderedText(flightForTasting(collection, 'note-1').id), 'flight-1');
    assert.equal(renderedText(flightEntries(collection, collection.tastingFlights[0])[0].record.id), 'note-1');
  }
);
