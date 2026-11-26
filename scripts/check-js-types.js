/** @fileoverview Semantic JSDoc checks for first-party JavaScript contracts. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {listJavaScriptFiles, JAVASCRIPT_ROOTS} from './javascript-files.js';

/**
 * Checks the actual JavaScript and its JSDoc with TypeScript's semantic analyzer.
 * Dependencies participate in type resolution; diagnostics are enforced on the
 * supplied modules, not on unrelated legacy code reached through imports.
 * @param {string[]} files JavaScript entry points with checked contracts.
 * @return {string[]} Compiler diagnostics with source locations.
 */
export function semanticTypeDiagnostics(files) {
  const program = ts.createProgram(files, {
    allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, resolveJsonModule: true,
  });
  return files.flatMap(filename => {
    const source = program.getSourceFile(filename);
    if (!source) return [`${filename}: source file not found`];
    return program.getSemanticDiagnostics(source).map(diagnostic => {
      const {line} = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      return `${filename}:${line + 1}: TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`;
    });
  });
}

/**
 * Lists the runtime-independent and browser contracts currently enforced by CI.
 * Node-only backup helpers and the dual-environment template loader require
 * Node type declarations, which are not yet part of the locked dependencies.
 * @param {string=} directory Repository root.
 * @return {string[]} Modules whose semantic diagnostics must be empty.
 */
export function checkedContractFiles(directory = process.cwd()) {
  const modelRoots = ['public/js/domain', 'public/js/views/models', 'public/js/navigation', 'public/js/theme', 'public/js/i18n', 'shared'];
  const serverOnly = new Set(['shared/backup-password.js', 'shared/backup-zip.js']);
  const componentModules = [
    'action-icons', 'action-result', 'bindings', 'buttons', 'content', 'dom-reconcile', 'dom-renderer', 'dom',
    'fields', 'flight-planning-help', 'format', 'glencairn-icon', 'headers', 'modal-layout', 'navigation-controls',
    'notifications', 'refresh-resources', 'render-plan', 'section-navigation', 'shell', 'tab-navigation',
    'warehouse-assignment', 'warehouse-furniture-activation', 'whisky-color-selector',
  ];
  const photoModules = ['adjustments', 'image-io', 'mask-brush', 'preview-zoom', 'view-model'];
  return [
    ...listJavaScriptFiles(directory, modelRoots).filter(file => !serverOnly.has(file.replaceAll('\\', '/'))),
    ...componentModules.map(name => `public/js/ui/${name}.js`),
    ...photoModules.map(name => `public/js/features/photo-editor/${name}.js`),
    'public/js/views/collection-flavor-controller.js', 'public/js/views/collection-saved-views-controller.js',
  ];
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
  const audit = process.argv.includes('--all');
  const files = audit ? auditContractFiles() : checkedContractFiles();
  const issues = semanticTypeDiagnostics(files);
  if (issues.length) {
    console.error(issues.join('\n'));
    console.error(`${issues.length} semantic JSDoc diagnostics in ${files.length} checked modules.`);
    process.exitCode = 1;
  } else console.log(`${files.length} ${audit ? 'production and tooling' : 'domain, shared, navigation and presentation'} modules: semantic JSDoc types OK.`);
}
