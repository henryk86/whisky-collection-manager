import test from 'node:test';
import assert from 'node:assert/strict';
import { reorderedPhotoIds } from '../../public/js/features/photo-order.js';

test('photo order moves forward and backward without changing the original list', () => {
    const ids = ['first', 'second', 'third', 'fourth'];
    assert.deepEqual(reorderedPhotoIds(ids, 'first', 'third'), ['second', 'third', 'first', 'fourth']);
    assert.deepEqual(reorderedPhotoIds(ids, 'fourth', 'second'), ['first', 'fourth', 'second', 'third']);
    assert.deepEqual(ids, ['first', 'second', 'third', 'fourth']);
});

test('photo order ignores invalid targets and a drop on the dragged photo', () => {
    const ids = ['first', 'second', 'third'];
    assert.equal(reorderedPhotoIds(ids, 'first', 'first'), null);
    assert.equal(reorderedPhotoIds(ids, 'missing', 'first'), null);
    assert.equal(reorderedPhotoIds(ids, 'first', undefined), null);
});
