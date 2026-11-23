import test from 'node:test';
import assert from 'node:assert/strict';
import {clampPhotoZoom, constrainPhotoPan, zoomPhotoAt} from '../../public/js/ui/photo-zoom.js';

const stage = {width: 600, height: 400};
const photo = {width: 500, height: 300};

test('photo viewer zoom has safe lower and upper bounds', () => {
  assert.equal(clampPhotoZoom(0), 1);
  assert.equal(clampPhotoZoom(99), 6);
  assert.equal(clampPhotoZoom(2.5), 2.5);
  const center = {x: 300, y: 200};
  assert.deepEqual(zoomPhotoAt({zoom: 1, x: 0, y: 0}, 0, center, stage, photo), {zoom: 1, x: 0, y: 0});
  assert.deepEqual(zoomPhotoAt({zoom: 1, x: 0, y: 0}, 9, center, stage, photo), {zoom: 6, x: 0, y: 0});
});

test('zoom anchors the pointed part of the image and clamps panning to its visible extent', () => {
  const point = {x: 400, y: 250};
  const zoomed = zoomPhotoAt({zoom: 1, x: 0, y: 0}, 2, point, stage, photo);
  assert.deepEqual(zoomed, {zoom: 2, x: -100, y: -50});
  const clamped = constrainPhotoPan({zoom: 2, x: -1000, y: 700}, stage, photo);
  assert.deepEqual(clamped, {zoom: 2, x: -200, y: 100});
  assert.deepEqual(zoomPhotoAt(zoomed, 1, point, stage, photo), {zoom: 1, x: 0, y: 0});
});

test('a photo narrower than the viewport cannot be dragged into empty horizontal space', () => {
  const portrait = {width: 100, height: 400};
  assert.deepEqual(constrainPhotoPan({zoom: 2, x: 80, y: 500}, stage, portrait), {zoom: 2, x: 0, y: 200});
});
