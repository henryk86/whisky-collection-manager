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
 * @param {string} file Absolute source path used for language-service context.
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
      getScriptFileNames: () => [file],
      getScriptVersion: () => '0',
      getScriptSnapshot: () => ts.ScriptSnapshot.fromString(source),
      getCompilationSettings: () => ({allowJs: true, checkJs: false}),
      getCurrentDirectory: () => process.cwd(),
      getDefaultLibFileName: settings => ts.getDefaultLibFilePath(settings),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
    };
    const languageService = ts.createLanguageService(host);
    let formatted = source;
    try {
      const edits = languageService.getFormattingEditsForDocument(
        file,
        options
      );
      for (const edit of edits.sort((a, b) => b.span.start - a.span.start)) {
        const {start, length} = edit.span;
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
