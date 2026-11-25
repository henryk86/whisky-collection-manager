/**
 * @fileoverview Enforces the 80-column limit in all project JavaScript.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {listJavaScriptFiles} from './javascript-files.js';

const isMain = process.argv[1] && path.resolve(process.argv[1]) ===
  fileURLToPath(import.meta.url);

/**
 * Reports every source line longer than the configured character limit.
 *
 * @param {string} source JavaScript source text.
 * @param {number=} limit Maximum number of characters per line.
 * @return {!Array<{line: number, length: number}>} One-based violations.
 */
export function widthViolations(source, limit = 80) {
  const issues = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (line.length > limit) {
      issues.push({line: index + 1, length: line.length});
    }
  }
  return issues;
}

/**
 * Checks every JavaScript source, including scripts and tests.
 *
 * @param {string=} directory Repository root.
 * @return {{checked: number, issues: !Array<string>}} File count and errors.
 */
export function checkLineWidth(directory = process.cwd()) {
  const files = listJavaScriptFiles(directory);
  const issues = [];
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(directory, file), 'utf8');
    for (const issue of widthViolations(source)) {
      issues.push(`${file}:${issue.line}: ${issue.length} columns (max 80)`);
    }
  }
  return {checked: files.length, issues};
}

if (isMain) {
  const result = checkLineWidth();
  if (result.issues.length) {
    console.error('JavaScript lines exceed 80 columns:');
    for (const issue of result.issues.slice(0, 60)) {
      console.error(`  ${issue}`);
    }
    if (result.issues.length > 60) {
      console.error(`  ... and ${result.issues.length - 60} more`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Line width OK: ${result.checked} files; no exceptions.`);
  }
}
