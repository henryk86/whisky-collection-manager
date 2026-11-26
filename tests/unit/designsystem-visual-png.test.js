import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePNG, comparePNG, encodeRGB} from '../../scripts/visual-png.js';

test(
  'visual comparison detects a changed pixel and yields an actual PNG diff',
  () => {
    const first = encodeRGB(2, 2, Buffer.from([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]));
    const second = encodeRGB(2, 2, Buffer.from([255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255]));
    const result = comparePNG(first, second);
    assert.equal(result.changed, 1);
    assert.equal(result.percent, 25);
    assert.deepEqual(result.dimensions, [2, 2, 2, 2]);
    const heatmap = decodePNG(result.diff);
    assert.deepEqual([heatmap.width, heatmap.height], [2, 2]);
    assert.deepEqual([...heatmap.pixels.slice(3, 6)], [255, 29, 45]);
  }
);

test(
  'visual comparison ignores tiny RGB shifts under the configured threshold',
  () => {
    const a = encodeRGB(1, 1, Buffer.from([100, 100, 100]));
    const b = encodeRGB(1, 1, Buffer.from([105, 102, 107]));
    assert.equal(comparePNG(a, b, 36).percent, 0);
    assert.equal(comparePNG(a, b, 1).percent, 100);
    assert.throws(() => decodePNG(Buffer.from('invalid')), /Not a PNG/);
  }
);
