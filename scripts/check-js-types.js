/** @fileoverview Semantic JSDoc checks for pure frontend models and native rendering. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {listJavaScriptFiles} from './javascript-files.js';

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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = [
    ...listJavaScriptFiles(process.cwd(), ['public/js/domain', 'public/js/views/models']),
    'public/js/ui/bindings.js', 'public/js/ui/render-plan.js', 'public/js/ui/dom-renderer.js',
  ];
  const issues = semanticTypeDiagnostics(files);
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else console.log(`${files.length} frontend domain, view-model and rendering modules: semantic JSDoc types OK.`);
}
