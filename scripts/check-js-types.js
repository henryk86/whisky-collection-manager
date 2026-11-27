/** @fileoverview Semantic JSDoc checks for first-party JavaScript contracts. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {listJavaScriptFiles, JAVASCRIPT_ROOTS} from './javascript-files.js';

/**
 * Uses TypeScript's semantic analyzer to check JavaScript contracts and browser-library declarations.
 * Type resolution also uses the installed Node declarations.
 * @param {string[]} files JavaScript entry points with checked contracts.
 * @return {string[]} Compiler diagnostics with source locations.
 */
export function semanticTypeDiagnostics(files) {
  const vendorTypes = fileURLToPath(new URL('../types/browser-vendors.d.ts', import.meta.url));
  const compiler = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
  const result = spawnSync(process.execPath, [compiler, '--allowJs', '--checkJs', '--noEmit',
    '--skipLibCheck', 'false', '--strict', 'false', '--types', 'node', '--target', 'ES2022',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--resolveJsonModule', '--pretty', 'false',
    ...files.map(file => path.resolve(file)), vendorTypes], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`TypeScript compiler terminated by ${result.signal}`);
  if (result.status === 0) return [];
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return output ? output.split(/\r?\n(?=\S)/) : [`TypeScript compiler exited with status ${result.status}`];
}

/**
 * Lists every first-party production and tooling module for the mandatory CI check.
 * Tests retain their separate, less restrictive documentation policy.
 * @param {string=} directory Repository root.
 * @return {string[]} Modules whose semantic diagnostics must be empty.
 */
export function checkedContractFiles(directory = process.cwd()) {
  return auditContractFiles(directory);
}

/**
 * Lists all first-party modules except test code for a full semantic audit.
 * @param {string=} directory Repository root.
 * @return {string[]} Production and tooling JavaScript paths, without exclusions for individual diagnostics.
 */
export function auditContractFiles(directory = process.cwd()) {
  return listJavaScriptFiles(directory, JAVASCRIPT_ROOTS.filter(root => root !== 'tests'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = checkedContractFiles();
  const issues = semanticTypeDiagnostics(files);
  if (issues.length) {
    console.error(issues.join('\n'));
    console.error(`${issues.length} semantic JSDoc diagnostics in ${files.length} checked modules.`);
    process.exitCode = 1;
  } else console.log(`${files.length} production and tooling modules: semantic JSDoc types OK.`);
}
