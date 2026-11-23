import assert from 'node:assert/strict';
import test from 'node:test';
import {undocumentedExports} from '../../scripts/check-jsdoc.js';

test('JavaScript style: a new exported function requires typed JSDoc', () => {
  const source = 'export function render(value) { return value; }\n';
  assert.deepEqual(undocumentedExports('sample.js', source),
    ['sample.js#render']);
});

test('JavaScript style: typed JSDoc documents an exported function', () => {
  const source = `/**
 * Renders a verified value.
 * @param {string} value Display text.
 * @return {string} Display text.
 */
export function render(value) { return value; }
`;
  assert.deepEqual(undocumentedExports('sample.js', source), []);
});

test('JavaScript style: exported arrow functions require typed JSDoc', () => {
  const source = 'export const render = value => value;\n';
  assert.deepEqual(undocumentedExports('sample.js', source),
    ['sample.js#render']);
});

test('JavaScript style: non-function values do not need function JSDoc', () => {
  const source = "export const VERSION = '1.12.0';\n";
  assert.deepEqual(undocumentedExports('sample.js', source), []);
});


test('JavaScript style: a parameter-free export documents its return', () => {
  const source = `/**
 * Returns the current count.
 * @return {number} Count.
 */
export function count() { return 5; }
`;
  assert.deepEqual(undocumentedExports('sample.js', source), []);
});
