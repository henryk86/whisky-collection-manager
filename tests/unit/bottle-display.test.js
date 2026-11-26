import test from 'node:test';
import assert from 'node:assert/strict';
import {bottleMeta} from '../../public/js/domain/bottle-display.js';

test('bottle metadata puts separators only between actual values', () => {
  assert.equal(bottleMeta({}), '');
  assert.equal(bottleMeta({inventoryNumber: '000123', }), '');
  assert.equal(bottleMeta({purchasePrice: 0, }), '0 EUR');
  assert.equal(bottleMeta({
    purchaseDate: '2026-11-05', purchasePrice: 45,
  }, value => value), 'Kauf: 2026-11-05 \u00b7 45 EUR');
});
