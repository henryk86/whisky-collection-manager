/**
 * @fileoverview Deterministic JavaScript formatting for the repository.
 *
 * TypeScript is used only as a formatter: it does not transpile the source.
 * Google JavaScript Style's two-space indentation and mandatory semicolons
 * are enforced without rewriting template literal content or domain logic.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {listJavaScriptFiles} from './javascript-files.js';
import {
  insertTrailingCommas, separateFunctions, wrapLongExpressions,
  wrapLongStructures, wrapStandaloneComments
} from './style-layout.js';

const write = process.argv.includes('--write');
const options = {
  ...ts.getDefaultFormatCodeSettings(),
  indentSize: 2,
  tabSize: 2,
  convertTabsToSpaces: true,
  newLineCharacter: '\n',
  insertSpaceAfterCommaDelimiter: true,
  insertSpaceAfterSemicolonInForStatements: true,
  insertSpaceBeforeAndAfterBinaryOperators: true,
  insertSpaceAfterKeywordsInControlFlowStatements: true,
  insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: false,
  placeOpenBraceOnNewLineForFunctions: false,
  placeOpenBraceOnNewLineForControlBlocks: false,
  trimTrailingWhitespace: true,
  semicolons: ts.SemicolonPreference.Insert,
};

/**
 * Applies source-formatting edits until the output becomes idempotent.
 *
 * @param {string} file Absolute source path used for language-service
 * context.
 * @param {string} original Original JavaScript text.
 * @return {string} Mechanically formatted source with a final newline.
 */
function format(file, original) {
  let source = original.replace(/\r\n/g, '\n');
  const seen = new Set();
  for (let pass = 0; pass < 16; pass++) {
    const wrapped = insertTrailingCommas(file,
      separateFunctions(file, wrapStandaloneComments(file,
        wrapLongExpressions(file, wrapLongStructures(file, source)))));
    if (seen.has(wrapped)) {
      throw new Error(`Non-converging formatter for ${file}`);
    }
    seen.add(wrapped);
    source = wrapped;
    const host = {
      /**
       * Retrieves script file names from the available state.
       * @return {!Array<string>} Resulting entries in their output order.
       */
      getScriptFileNames: () => [file],
      /**
       * Retrieves script version from the available state.
       * @return {string} Resulting text.
       */
      getScriptVersion: () => '0',
      /**
       * Retrieves script snapshot from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getScriptSnapshot: () => ts.ScriptSnapshot.fromString(source),
      /**
       * Retrieves compilation settings from the available state.
       * @return {!Object} Result computed from the supplied inputs.
       */
      getCompilationSettings: () => ({allowJs: true, checkJs: false}),
      /**
       * Retrieves current directory from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getCurrentDirectory: () => process.cwd(),
      /**
       * Retrieves default lib file name from the available state.
       *
       * @param {*} settings Configuration settings to apply.
       * @return {*} Result computed from the supplied inputs.
       */
      getDefaultLibFileName: settings => ts.getDefaultLibFilePath(settings),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
    };
    const languageService = ts.createLanguageService(host);
    let formatted = source;
    const templateBoundaries = new Set();
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest,
      true, ts.ScriptKind.JS);
    /**
     * Records interpolation boundaries where whitespace is not literal HTML.
     *
     * @param {!ts.Node} node Syntax node to inspect.
     */
    function collectTemplateBoundaries(node) {
      if (ts.isTemplateExpression(node)) {
        templateBoundaries.add(node.head.end);
        for (const span of node.templateSpans) {
          templateBoundaries.add(span.literal.getStart(parsed));
          if (span.literal.kind === ts.SyntaxKind.TemplateMiddle) {
            templateBoundaries.add(span.literal.end);
          }
        }
      }
      ts.forEachChild(node, collectTemplateBoundaries);
    }
    collectTemplateBoundaries(parsed);
    try {
      const edits = languageService.getFormattingEditsForDocument(
        file,
        options
      );
      for (const edit of edits.sort((a, b) => b.span.start - a.span.start)) {
        const {start, length} = edit.span;
        // TypeScript removes deliberate newlines at interpolation boundaries.
        // Keep these breaks so long HTML expressions stay within 80 columns.
        if (length && !edit.newText.includes('\n') &&
          source.slice(start, start + length).includes('\n') &&
          /^\s*$/.test(source.slice(start, start + length)) &&
          (templateBoundaries.has(start) ||
            templateBoundaries.has(start + length))) continue;
        formatted = formatted.slice(0, start) + edit.newText +
          formatted.slice(start + length);
      }
    } finally {
      languageService.dispose();
    }
    formatted = formatted.replace(/\n*$/, '\n');
    if (formatted === source &&
      separateFunctions(file, wrapStandaloneComments(file,
        wrapLongExpressions(file, wrapLongStructures(file, formatted)))) ===
      formatted) return formatted;
    source = formatted;
  }
  throw new Error(`Formatter did not stabilize for ${file}`);
}

const files = listJavaScriptFiles();
const invalid = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const formatted = format(path.resolve(file), source);
  if (source === formatted) continue;
  invalid.push(file);
  if (write) fs.writeFileSync(file, formatted);
}
if (invalid.length) {
  console.log(`${write ? 'Formatted' : 'Needs formatting'}: ${invalid
    .length}/${files.length} JavaScript files`);
  for (const file of invalid.slice(0, 30)) console.log(`  ${file}`);
  if (invalid.length > 30) console.log(`  ... and ${invalid.length - 30} more`);
  if (!write) {
    console.error('Run `npm run format:js` before committing.');
    process.exitCode = 1;
  }
} else {
  console.log(`JavaScript formatting OK: ${files.length} files.`);
}
