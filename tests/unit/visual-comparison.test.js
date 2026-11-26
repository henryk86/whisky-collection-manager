import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, existsSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {compareCaptures, loadCaptures} from '../../scripts/visual-compare.js';
import {encodeRGB} from '../../scripts/visual-png.js';

/**
 * Build a small, deterministic rendered capture for comparator tests.
 * @param {number} value RGB value.
 * @param {number=} overflow Horizontal overflow.
 * @param {number=} x Geometry coordinate.
 * @return {!Object} Capture image and geometry.
 */
function capture(value, overflow = 0, x = 0) {
  return {
    image: encodeRGB(1, 1, Buffer.from([value, value, value])),
    geometry: {overflow, main: [x, 0, 1, 1]},
  };
}

const report = {
  browser: 'Chrome/test', snapshotClock: 'fixed',
  timezone: 'Europe/Berlin', locale: 'de-DE',
};
const id = 'modal-edit__390__light';
const other = 'modal-new__390__dark';

test('comparison classifies changed, new, removed and identical captures',
  () => {
    const output = mkdtempSync(path.join(tmpdir(), 'wcm-comparison-'));
    try {
      const before = {
        report, entries: new Map([
          [id, capture(100)], [other, capture(42)],
          ['help__390__dark', capture(22)],
        ]),
      };
      const after = {
        report, entries: new Map([
          [id, capture(101)], ['settings__390__dark', capture(10)],
          ['help__390__dark', capture(22)],
        ]),
      };
      const changes = compareCaptures(before, after, output);
      assert.deepEqual(changes.map(c => c.kind), ['changed', 'removed', 'new']);
      assert.equal(changes[0].percent, 100);
      assert.ok(existsSync(path.join(output, `${id}-diff.png`)));
      assert.ok(!existsSync(path.join(output, `${other}-after.png`)));
      assert.deepEqual(compareCaptures(before, after, output), changes);
      after.entries.set(id, capture(102));
      assert.notEqual(compareCaptures(before, after, output)[0].digest, changes[0].digest);
    } finally {
      rmSync(output, {recursive: true, force: true});
    }
  });

test('geometry changes require review while overflow and environment fail',
  () => {
    const output = mkdtempSync(path.join(tmpdir(), 'wcm-comparison-'));
    try {
      const before = {report, entries: new Map([[id, capture(42)]])};
      const after = {report, entries: new Map([[id, capture(42, 0, 4)]])};
      const [change] = compareCaptures(before, after, output);
      assert.equal(change.percent, 0);
      assert.equal(change.geometryChanged, true);
      assert.ok(existsSync(path.join(output, `${id}-geometry.json`)));
      after.entries.set(id, capture(42, 2));
      assert.throws(() => compareCaptures(before, after, output), /overflow/);
      after.report = {...report, browser: 'Chrome/other'};
      assert.throws(() => compareCaptures(before, after, output), /browser/);
    } finally {
      rmSync(output, {recursive: true, force: true});
    }
  });

/**
 * Create a screenshot with deliberately changed pixel coordinates.
 * @param {!Array<number>} positions Changed pixel indices.
 * @param {number=} x Geometry coordinate.
 * @return {!Object} Capture.
 */
function noisyCapture(positions, x = 0) {
  const pixels = Buffer.alloc(400 * 400 * 3, 100);
  for (const pos of positions) pixels.fill(101, pos * 3, pos * 3 + 3);
  return {
    image: encodeRGB(400, 400, pixels),
    geometry: {overflow: 0, main: [x, 0, 400, 400]},
  };
}

test('small pixel differences are tolerated and remain reviewable', () => {
  const output = mkdtempSync(path.join(tmpdir(), 'wcm-noise-'));
  try {
    const before = {report, entries: new Map([[id, noisyCapture([])]])};
    const after = {report, entries: new Map([[id, noisyCapture([0, 1, 800])]])};
    const ignored = [];
    assert.deepEqual(compareCaptures(before, after, output, ignored), []);
    assert.equal(ignored.length, 1);
    assert.equal(ignored[0].kind, 'rendering-noise');
    assert.ok(existsSync(path.join(output, `${id}-diff.png`)));
    for (const positions of [[0, 1, 2], [0, 401, 802],
    Array.from({length: 16}, (_, i) => i)]) {
      after.entries.set(id, noisyCapture(positions));
      assert.deepEqual(compareCaptures(before, after, output), []);
    }
    after.entries.set(id, noisyCapture(Array.from({length: 17}, (_, i) => i)));
    assert.equal(compareCaptures(before, after, output).length, 1);
    after.entries.set(id, noisyCapture([0], 2));
    assert.equal(compareCaptures(before, after, output)[0].geometryChanged, true);
  } finally {
    rmSync(output, {recursive: true, force: true});
  }
});


test('expanded planner captures use their measured full viewport height',
  () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'wcm-expanded-'));
    try {
      const expanded = 'modal-flight-expanded__390__dark';
      const height = 1800;
      const image = encodeRGB(390, height, Buffer.alloc(390 * height * 3));
      writeFileSync(path.join(directory, 'report.json'), JSON.stringify({
        ...report, failed: 0, results: [{id: expanded}],
      }));
      writeFileSync(path.join(directory, `${expanded}.png`), image);
      const geometryPath = path.join(directory, `${expanded}.json`);
      writeFileSync(geometryPath, JSON.stringify({
        overflow: 0, captureHeight: height,
      }));
      assert.equal(loadCaptures(directory).entries.size, 1);
      writeFileSync(geometryPath, JSON.stringify({
        overflow: 0, captureHeight: 1100,
      }));
      assert.throws(() => loadCaptures(directory), /Invalid capture dimensions/);
      writeFileSync(geometryPath, JSON.stringify({overflow: 0}));
      assert.throws(() => loadCaptures(directory), /Invalid capture dimensions/);
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });
