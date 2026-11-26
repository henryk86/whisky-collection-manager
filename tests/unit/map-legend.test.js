import test from 'node:test';
import assert from 'node:assert/strict';
import {legendMarkerDiameter} from '../../public/js/views/map.js';
import {markerDiameter} from '../../public/js/domain/distillery-map.js';

test('legend marker sizes remain compact relative to real map markers', () => {
  assert.deepEqual([1, 10, 100].map(legendMarkerDiameter), [21, 27, 37]);
  assert.ok(legendMarkerDiameter(100) < markerDiameter(100));
});
