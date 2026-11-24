/**
 * @fileoverview Enforces Google's 80-column limit for new JavaScript code.
 *
 * Historical long lines are fingerprinted, not silently ignored: moving or
 * editing one triggers a violation. Indivisible literal exceptions require
 * an explicit review rather than an automatic global allowance.
 */
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {listJavaScriptFiles} from './javascript-files.js';

const baselineName = 'scripts/style-width-legacy.json';
const isMain = process.argv[1] && path.resolve(process.argv[1]) ===
  fileURLToPath(import.meta.url);

/**
 * Computes a stable fingerprint for one overlong source line.
 * @param {string} line Literal source line without its newline.
 * @return {string} SHA-256 digest of the original line.
 */
function digest(line) {
  return createHash('sha256').update(line).digest('hex');
}

/**
 * Returns overlong lines not covered by an unchanged source baseline.
 * @param {string} source JavaScript source text.
 * @param {!Object<string, number>=} allowed Original long-line hash counts.
 * @param {number=} limit Character limit per line.
 * @return {!Array<{line: number, length: number}>} Violations with positions.
 */
export function widthViolations(source, allowed = {}, limit = 80) {
  const remaining = {...allowed};
  const issues = [];
  for (const [index, line] of source.split('\n').entries()) {
    if (line.length <= limit) continue;
    const hash = digest(line);
    if ((remaining[hash] ?? 0) > 0) {
      remaining[hash] -= 1;
    } else {
      issues.push({line: index + 1, length: line.length});
    }
  }
  return issues;
}

/**
 * Checks all JavaScript lines against the immutable legacy inventory.
 * @param {string=} directory Repository root.
 * @param {string=} baseline Filename containing original line hashes.
 * @return {{checked: number, exceptions: number,
 *     issues: !Array<string>}} Summary and newly noncompliant lines.
 */
export function checkLineWidth(directory = process.cwd(),
  baseline = baselineName) {
  const allowed = JSON.parse(fs.readFileSync(
    path.resolve(directory, baseline), 'utf8'));
  const files = listJavaScriptFiles(directory);
  const issues = [];
  let exceptions = 0;
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(directory, file), 'utf8');
    const violations = widthViolations(source, allowed[file] ?? {});
    for (const issue of violations) {
      issues.push(`${file}:${issue.line}: ${issue.length} columns (max 80)`);
    }
    exceptions += Object.values(allowed[file] ?? {}).reduce((a, b) => a + b, 0);
  }
  return {checked: files.length, exceptions, issues};
}

if (isMain) {
  const result = checkLineWidth();
  if (result.issues.length) {
    console.error('New or modified JavaScript lines exceed 80 columns:');
    for (const issue of result.issues.slice(0, 60)) {
      console.error(`  ${issue}`);
    }
    if (result.issues.length > 60) {
      console.error(`  ... and ${result.issues.length - 60} more`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Line width OK: ${result.checked} files; ` +
      `${result.exceptions} unchanged legacy lines >80 columns.`);
  }
}
