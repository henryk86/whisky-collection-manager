/**
 * @fileoverview Validates public JavaScript contracts against Google JSDoc.
 *
 * Exported functions and classes need typed JSDoc without legacy exemptions.
 * Named internal functions and methods are checked by
 * check-jsdoc-complete.js, including functions without prior comments.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {listJavaScriptFiles} from './javascript-files.js';
import {parseJavaScript, declarationOf, isFunction} from './javascript-ast.js';
import {docsFor, hasTypedContract} from './jsdoc-contract.js';

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

/**
 * Inspects direct exported functions and classes in an ES module.
 * @param {string} file Relative source path.
 * @param {string} source Original JavaScript text.
 * @return {!Array<{key: string, documented: boolean}>} Export names and contract validity.
 */
export function inspectExports(file, source) {
  const {program, comments} = parseJavaScript(file, source);
  const entries = [];
  for (const statement of program.body) {
    if (!['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(statement.type)) continue;
    const declaration = declarationOf(statement);
    if (!declaration) continue;
    const docs = docsFor(statement, source, comments);
    if (declaration.type === 'FunctionDeclaration' && declaration.id) {
      entries.push({key: `${file}#${declaration.id.name}`, documented: hasTypedContract(declaration, docs)});
    } else if (declaration.type === 'ClassDeclaration' && declaration.id) {
      const documented = docs.some(doc => doc.description) && declaration.body.body.filter(member => member.kind === 'constructor').every(member =>
        !member.value.params.length || hasTypedContract(member.value, docsFor(member, source, comments)));
      entries.push({key: `${file}#${declaration.id.name}`, documented});
    } else if (declaration.type === 'VariableDeclaration') {
      for (const item of declaration.declarations) {
        if (isFunction(item.init)) entries.push({key: `${file}#${source.slice(item.id.start, item.id.end)}`, documented: hasTypedContract(item.init, docs)});
      }
    }
  }
  return entries;
}

/**
 * Lists exported APIs without complete typed documentation.
 *
 * @param {string} file Relative JavaScript filename.
 * @param {string} source ES module contents.
 * @return {!Array<string>} Stable undocumented export identifiers.
 */
export function undocumentedExports(file, source) {
  return inspectExports(file, source).filter(item => !item.documented).map(item => item.key);
}

/**
 * Checks all first-party public functions for typed JSDoc contracts.
 *
 * @param {string=} directory Repository root, defaulting to cwd.
 * @return {{checked: number, incomplete: !Array<string>}} Source count and
 *     exported APIs missing a complete documentation contract.
 */
export function checkJSDoc(directory = process.cwd()) {
  const files = listJavaScriptFiles(directory,
    ['public', 'server', 'shared', 'scripts', 'worker', 'docker',
      'extension']).map(file => path.join(directory, file));
  const incomplete = files.flatMap(file => undocumentedExports(path.relative(directory, file).replaceAll(path.sep, '/'), fs.readFileSync(file, 'utf8')));
  return {checked: files.length, incomplete};
}

if (isMain) {
  const result = checkJSDoc();
  if (result.incomplete.length) {
    for (const key of result.incomplete) {
      console.error(`Missing typed JSDoc on exported API: ${key}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`JSDoc exports OK: ${result.checked} sources; ` + 'no legacy exemptions.');
  }
}
