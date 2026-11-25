import test from 'node:test';
import assert from 'node:assert/strict';
import {directColors, missingDesignTokens} from
  '../../scripts/check-css-colors.js';

test('CSS colour check accepts design tokens and transparent geometry', () => {
  assert.deepEqual(directColors(`
    .panel {
      color: var(--ds-color-text);
      border-color: var(--ds-color-border);
      background: color-mix(in srgb, var(--gold) 14%, transparent);
      white-space: nowrap;
    }
  `), []);
});

test('CSS colour check rejects hex, RGB and legacy colour fallbacks', () => {
  assert.deepEqual(directColors(`
    .panel {
      color: #abc;
      box-shadow: 0 1px 3px rgba(0,0,0,.3);
      background: var(--danger, #bb4848);
    }
  `), ['#abc', '0 1px 3px rgba(0,0,0,.3)',
    'var(--danger, #bb4848)']);
});

test('CSS colour check finds colour keywords but ignores comments', () => {
  assert.deepEqual(directColors(`
    /* Color: #fff; */
    .badge { color: white; background: black; }
  `), ['white', 'black']);
});

test('CSS colour check finds missing design tokens across stylesheets', () => {
  assert.deepEqual(missingDesignTokens([
    ':root { --ds-color-surface: #fff; }',
    '.panel { background: var(--ds-color-surface); ' + 'color: var(--ds-color-missing); }',
  ]), ['--ds-color-missing']);
});
