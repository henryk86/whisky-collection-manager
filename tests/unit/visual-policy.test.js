import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCapture, browserWarning, compareGeometry, pixelMode} from '../../scripts/visual-policy.js';

const rect = [0, 80, 360, 50];
const baseline = {
  overflow: 0, main: rect, header: rect, heading: null, panel: null,
  grid: null, field: null, dialog: null, footer: null
};

function capture(overrides = {}) {
  return {
    before: baseline, after: baseline, dimensions: [390, 1100, 390, 1100],
    changed: 140, mode: 'diagnostic', ...overrides
  };
}

test('visual pixel policy defaults to diagnosis and requires explicit opt-in for strict', () => {
  assert.equal(pixelMode([], {}), 'diagnostic');
  assert.equal(pixelMode(['--strict-pixels'], {}), 'strict');
  assert.equal(pixelMode([], {WCM_VISUAL_PIXEL_MODE: 'strict'}), 'strict');
  assert.throws(() => pixelMode([], {WCM_VISUAL_PIXEL_MODE: 'disabled'}), /Invalid pixel mode/);
});

test('different browser versions give one actionable warning or abort strict comparison', () => {
  assert.match(browserWarning('Chrome/159', 'Chrome/144', 'diagnostic'), /browser mismatch/);
  assert.equal(browserWarning('Chrome/144', 'Chrome/144', 'strict'), null);
  assert.throws(() => browserWarning('Chrome/159', 'Chrome/144', 'strict'), /Strict pixel verification was not started/);
});

test('high pixel difference with unchanged geometry is diagnostic, not a failed PR gate', () => {
  assert.deepEqual(assessCapture(capture()), {
    geometryErrors: [], pixelChanged: true, blocking: false, status: 'diagnostic',
  });
  assert.equal(assessCapture(capture({mode: 'strict'})).status, 'failed');
  assert.equal(assessCapture(capture({changed: 1})).pixelChanged, true);
  assert.equal(assessCapture(capture({changed: 0, mode: 'strict'})).status, 'passed');
});

test('changed component geometry and horizontal overflow still fail regardless of pixel mode', () => {
  const shifted = {...baseline, header: [5, 80, 360, 50]};
  assert.match(compareGeometry(baseline, shifted).join(''), /header moved/);
  assert.equal(assessCapture(capture({after: shifted, changed: 0})).status, 'failed');
  assert.match(compareGeometry(baseline, {...baseline, overflow: 15}).join(''), /horizontal overflow/);
  assert.equal(assessCapture(capture({after: {...baseline, overflow: 15}})).blocking, true);
  assert.equal(assessCapture(capture({dimensions: [390, 1100, 390, 1080]})).blocking, true);
  assert.equal(assessCapture(capture({before: null})).blocking, true);
});
