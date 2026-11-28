import test from 'node:test';
import assert from 'node:assert/strict';
import {assertModalBackdrop, decodePNG, comparePNG, encodeRGB} from '../../scripts/visual-png.js';

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

for (const [theme, maximum] of [['light', [57, 73, 87]], ['dark', [36, 42, 49]]]) {
  test(`expanded modal backdrop validates ${theme} captures`, () => {
    const width = 24, height = 32;
    const dialog = [7, 5, 17, 27];
    const rgb = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 3;
        const inside = x >= 7 && x < 17 && y >= 5 && y < 27;
        rgb.set(inside ? [255, 254, 250] : maximum, offset);
      }
    }
    const clean = encodeRGB(width, height, rgb);
    assert.doesNotThrow(() => assertModalBackdrop(clean, width, height, dialog, maximum));
    assert.throws(() => assertModalBackdrop(clean, width, height + 1, dialog, maximum), /dimensions/);
    // Simulate an undimmed stripe extending beyond the dialog on both sides.
    for (let y = 12; y < 16; y++) {
      for (let x = 2; x < 22; x++) rgb.set([247, 245, 239], (y * width + x) * 3);
    }
    const damaged = encodeRGB(width, height, rgb);
    assert.throws(() => assertModalBackdrop(damaged, width, height, dialog, maximum), /backdrop is not fully rendered/);
  });
}
