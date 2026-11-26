/** @fileoverview Semantic JSDoc checks for first-party JavaScript contracts. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {listJavaScriptFiles, JAVASCRIPT_ROOTS} from './javascript-files.js';

/**
 * Uses TypeScript's semantic analyzer to check JavaScript contracts and browser-library declarations.
 * Type resolution also uses the installed Node declarations.
 * @param {string[]} files JavaScript entry points with checked contracts.
 * @return {string[]} Compiler diagnostics with source locations.
 */
export function semanticTypeDiagnostics(files) {
  const vendorTypes = fileURLToPath(new URL('../types/browser-vendors.d.ts', import.meta.url));
  const program = ts.createProgram([...files, vendorTypes], {
    allowJs: true, checkJs: true, noEmit: true, skipLibCheck: false,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, resolveJsonModule: true,
  });
  const diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()];
  const configurationIssues = diagnostics.map(diagnostic =>
    `TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
  return [...configurationIssues, ...[...files, vendorTypes].flatMap(filename => {
    const source = program.getSourceFile(filename);
    if (!source) return [`${filename}: source file not found`];
    return program.getSemanticDiagnostics(source).map(diagnostic => {
      const {line} = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      return `${filename}:${line + 1}: TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`;
    });
  })];
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
