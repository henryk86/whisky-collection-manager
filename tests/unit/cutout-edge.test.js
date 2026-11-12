import test from 'node:test';
import assert from 'node:assert/strict';
import { sharpenCutoutAlpha, EDGE_ALPHA_LOW, EDGE_ALPHA_HIGH } from '../../public/js/features/cutout/edge.js';

test('cutout edge refinement removes faint background blending and retains a narrow antialias transition', () => {
    const original = [0, 8, 48, 90, EDGE_ALPHA_LOW, 120, 130, 150, 170, 180, EDGE_ALPHA_HIGH, 220, 255];
    const rgba = new Uint8ClampedArray(original.flatMap(alpha => [41, 80, 120, alpha]));
    sharpenCutoutAlpha(rgba);
    const result = original.map((_, i) => rgba[i * 4 + 3]);
    assert.deepEqual(result.slice(0, 5), [0, 0, 0, 0, 0]);
    assert.deepEqual(result.slice(-3), [255, 255, 255]);
    assert.ok(result[5] > 0 && result[5] < result[6] && result[6] < result[7]);
    assert.ok(result[7] < result[8] && result[8] < result[9] && result[9] < 255);
    // All actual bottle RGB samples remain untouched; only alpha is sharpened.
    for (let index = 0; index < original.length; index++)
        assert.deepEqual(Array.from(rgba.slice(index * 4, index * 4 + 3)), [41, 80, 120]);
});

test('cutout edge refinement is deterministic, idempotent for empty/opaque pixels, and rejects malformed inputs', () => {
    const blank = new Uint8ClampedArray([10, 20, 30, 0, 60, 70, 80, 255]);
    assert.equal(sharpenCutoutAlpha(blank), blank);
    assert.deepEqual(Array.from(blank), [10, 20, 30, 0, 60, 70, 80, 255]);
    assert.throws(() => sharpenCutoutAlpha(new Uint8ClampedArray(5)), /RGBA/);
});
