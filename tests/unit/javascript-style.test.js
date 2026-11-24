import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {widthViolations} from '../../scripts/check-line-width.js';
import {checkJSDoc, undocumentedExports} from '../../scripts/check-jsdoc.js';
import {jsdocViolations} from '../../scripts/check-jsdoc-complete.js';
import {
  separateFunctions, wrapLongStructures,
  insertTrailingCommas
} from '../../scripts/style-layout.js';

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

test('JavaScript style: documents every argument, not just the first', () => {
  const source = `/**
 * Renders a verified value and an optional label.
 * @param {string} value Value to display.
 * @return {string} Display text.
 */
export function render(value, label) { return value + label; }
`;
  assert.deepEqual(undocumentedExports('sample.js', source),
    ['sample.js#render']);
});

test('JavaScript style: rejects untyped and wrongly named parameters', () => {
  const source = `/**
 * Returns the requested label.
 * @param {string} other Wrong identifier.
 * @return {string} Label.
 */
export const label = name => name;
`;
  assert.deepEqual(undocumentedExports('sample.js', source),
    ['sample.js#label']);
});

test('JavaScript style: rejects JSDoc without a meaningful summary', () => {
  const source = `/** @return {number} */
export const count = () => 1;
`;
  assert.deepEqual(undocumentedExports('sample.js', source),
    ['sample.js#count']);
});

test(
  'JavaScript style: void functions do not require artificial returns',
  () => {
    const source = `/**
 * Clears the transient collection cache.
 */
export function clear() {cache.clear();}
`;
    assert.deepEqual(undocumentedExports('sample.js', source), []);
  }
);

test('JavaScript style: new lines above 80 columns fail', () => {
  const line = 'const x = ' + 'someIdentifier'.repeat(6) + ';';
  assert.deepEqual(widthViolations(line), [{line: 1, length: line.length}]);
});

test(
  'JavaScript style: unchanged exceptions cannot hide another occurrence',
  () => {
    const source = 'x'.repeat(81);
    const hash = createHash('sha256').update(source).digest('hex');
    assert.deepEqual(widthViolations(source + '\n' + source, {[hash]: 1}),
      [{line: 2, length: 81}]);
  }
);


test(
  'JavaScript style: every export needs full JSDoc, without exceptions',
  () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'wcm-jsdoc-contract-'));
    try {
      mkdirSync(path.join(directory, 'public'), {recursive: true});
      const filename = path.join(directory, 'public/sample.js');
      writeFileSync(filename, 'export const count = () => 1;\n');
      assert.deepEqual(checkJSDoc(directory).incomplete,
        ['public/sample.js#count']);
      writeFileSync(filename, `/**
 * Returns the current count.
 * @return {number} Current count.
 */
export const count = () => 1;
`);
      assert.deepEqual(checkJSDoc(directory).incomplete, []);
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  }
);

test(
  'JavaScript style: internal six-argument functions need complete tags',
  () => {
    const incomplete = `/** Computes the silhouette from the mask. */
function silhouetteAngle(labels, id, width, height, scaleX, scaleY) {
  return null;
}`;
    const issues = jsdocViolations('mask.js', incomplete);
    assert.ok(issues.some(issue => issue.includes('expected 6 @param')));
    assert.ok(issues.some(issue => issue.includes('typed @return')));
  }
);

test('JavaScript style: internal declarations require JSDoc', () => {
  const source = 'function secret(name) { return name; }';
  assert.ok(jsdocViolations('backups.js', source)
    .some(issue => issue.includes('missing JSDoc')));
});

test('JavaScript style: named arrows and methods require JSDoc', () => {
  const source = `const checkToken = token => token.length > 0;
class Example {
  check(value) { return Boolean(value); }
}
const handlers = {onClose: () => false};`;
  const issues = jsdocViolations('sample.js', source);
  assert.equal(issues.filter(issue => issue.includes('missing JSDoc')).length,
    3);
});

test('JavaScript style: anonymous inline callbacks need no JSDoc', () => {
  const source = 'const result = [1, 2].map(value => value * 2);';
  assert.deepEqual(jsdocViolations('sample.js', source), []);
});

test('JavaScript style: full internal JSDoc is valid', () => {
  const complete = `/**
 * Estimates the tilt of a selected connected component.
 * @param {!Int32Array} labels Segmentation labels by pixel.
 * @param {number} id Connected-component identifier.
 * @param {number} width Segmentation width in pixels.
 * @param {number} height Segmentation height in pixels.
 * @param {number} scaleX Horizontal scale from mask to photo.
 * @param {number} scaleY Vertical scale from mask to photo.
 * @return {?number} Rotation in radians or null on invalid contour.
 */
function silhouetteAngle(labels, id, width, height, scaleX, scaleY) {
  return null;
}`;
  assert.deepEqual(jsdocViolations('mask.js', complete), []);
});

test('JavaScript style: documented local arrows also need complete JSDoc',
  () => {
    const source = `/** Sorts photo IDs for persistence. */
const reorder = (ids, photoId) => ids.slice();`;
    assert.ok(jsdocViolations('photo-order.js', source)
      .some(issue => issue.includes('expected 2 @param')));
  });

test('JavaScript style: @returns is rejected for Google-style @return',
  () => {
    const source = `/**
 * Returns the number of active sessions.
 * @returns {number} Session count.
 */
function count() { return 1; }`;
    assert.ok(jsdocViolations('sessions.js', source)
      .some(issue => issue.includes('not @returns')));
  });

test(
  'JavaScript style: splits long object entries without altering strings',
  () => {
    const source = `export const empty = () => ({
  schemaVersion: 6, nextInventoryNumber: 1, reservedInventoryNumbers: [], settings: {establishedYear: null}, bottlings: [], tastingFlights: []
});\n`;
    const wrapped = wrapLongStructures('sample.js', source);
    assert.match(wrapped, /schemaVersion: 6,\n/);
    assert.match(wrapped, /nextInventoryNumber: 1,\n/);
    assert.match(wrapped, /settings: \{establishedYear: null\}/);
    assert.match(wrapped, /tastingFlights: \[\]/);
  }
);

test('JavaScript style: trailing commas belong to multiline literals', () => {
  const source = 'const x = {\n  a: 1,\n  b: 2\n};\n';
  assert.match(insertTrailingCommas('sample.js', source), /b: 2,\n/);
  assert.equal(insertTrailingCommas('sample.js', source),
    insertTrailingCommas(
      'sample.js',
      insertTrailingCommas('sample.js', source)
    ));
});

test(
  'JavaScript style: inserts blank lines before the next function JSDoc',
  () => {
    const source = `function first() { return 1; }
/** Describes the second function. */
function second() { return 2; }
`;
    const formatted = separateFunctions('sample.js', source);
    assert.match(formatted, /\}\n\n\/\*\*/);
    assert.equal(formatted, separateFunctions('sample.js', formatted));
  }
);


test('JavaScript style: classes document their constructor parameters', () => {
  const source = `/** Represents a public HTTP error for API clients. */
export class HttpError { constructor(message) { this.message = message; } }
`;
  assert.deepEqual(undocumentedExports('sample.js', source),
    ['sample.js#HttpError']);
});

test('JavaScript style: optional chaining stays syntactically intact', () => {
  const source = `const compare = () => veryLongNamedHelperFunction(
  anotherLongNamedHelperFunction(input)?.tastedOn, second?.tastedOn, true);
`;
  const wrapped = wrapLongStructures('sample.js', source);
  assert.match(wrapped, /\?\.tastedOn/);
  assert.doesNotMatch(wrapped, /\?\s+\.tastedOn/);
});

test('JavaScript style: separates consecutive arrow-function exports', () => {
  const source = 'export const first = () => 1;\nexport const second = () => 2;\n';
  assert.match(separateFunctions('sample.js', source),
    /=> 1;\n\nexport const second/);
});
