import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryCountGroups } from '../../public/js/domain/inventory-counts.js';

const labels = bottles => inventoryCountGroups(bottles).map(group => group.label);
test('all four disjoint groups exactly match the requested wording', () => {
    assert.deepEqual(labels([
        { volumeType: 'standard', status: 'closed' }, { volumeType: 'standard', status: 'closed' },
        { volumeType: 'standard', status: 'open' },
        { volumeType: 'sample', status: 'closed' }, { volumeType: 'sample', status: 'open' },
    ]), ['2 Standardflaschen', '1 offene Standardflasche', '1 Sample', '1 offenes Sample']);
});
test('closed is default and empty is not mentioned', () => {
    assert.deepEqual(labels([{volumeType:'standard'}, {volumeType:'sample',status:'empty'}]), ['1 Standardflasche']);
    assert.deepEqual(labels([{volumeType:'sample',status:'empty'}, {volumeType:'standard',status:'empty'}]), []);
    assert.deepEqual(labels([]), []);
});
test('plural and legacy physical bottles', () => {
    assert.deepEqual(labels([{}, { volumeType:'sample',status:'open'}, {volumeType:'sample',status:'open'}]),
        ['1 Standardflasche', '2 offene Samples']);
});
