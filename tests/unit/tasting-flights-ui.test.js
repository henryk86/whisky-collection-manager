import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute, routeUrl} from '../../public/js/navigation/routes.js';

test(
  'flight routes support direct navigation and back links without impacting ordinary tasting URLs',
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
      parseRoute(routeUrl('external-tasting', 'new', {flightId: 'flight-1'}).split('?')[1]).flightId,
      'flight-1'
    );
    assert.equal(parseRoute(routeUrl('tasting', 'b-1', {tastingId: 'note-1'}).split('?')[1]).flightId, undefined);
  }
);
