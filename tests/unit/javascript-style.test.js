import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {widthViolations} from '../../scripts/check-line-width.js';
import {checkJSDoc, inspectExports, undocumentedExports} from '../../scripts/check-jsdoc.js';
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
  'JavaScript style: edited legacy exports cannot reuse an old exemption',
  () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'wcm-jsdoc-contract-'));
    try {
      mkdirSync(path.join(directory, 'public'), {recursive: true});
      mkdirSync(path.join(directory, 'scripts'));
      const source = 'export const count = () => 1;\n';
      const file = 'public/sample.js';
      const [entry] = inspectExports(file, source);
      writeFileSync(path.join(directory, file), source);
      writeFileSync(path.join(directory, 'scripts/legacy.json'),
        JSON.stringify([entry.key]));
      writeFileSync(path.join(directory, 'scripts/signatures.json'),
        JSON.stringify({[entry.key]: entry.signature}));
      assert.deepEqual(checkJSDoc(directory, 'scripts/legacy.json',
        'scripts/signatures.json').changed, []);
      writeFileSync(path.join(directory, file),
        'export const count = () => 2;\n');
      assert.deepEqual(checkJSDoc(directory, 'scripts/legacy.json',
        'scripts/signatures.json').changed, [entry.key]);
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  }
);

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
