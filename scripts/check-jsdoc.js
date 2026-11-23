/**
 * Checks exported JavaScript APIs against the documented legacy exceptions.
 *
 * The baseline acknowledges existing undocumented exports; it cannot be
 * extended by ordinary code changes. Newly exported functions/classes must
 * carry typed JSDoc, and existing entries disappear from the debt count as
 * they gain documentation.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const roots = ['public', 'server', 'shared', 'scripts', 'worker', 'docker',
  'extension'];
const baselinePath = 'scripts/jsdoc-legacy-baseline.json';
const scriptPath = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;

/**
 * Lists JavaScript modules without traversing vendored dependencies.
 * @param {string} directory Source directory.
 * @return {!Array<string>} Sorted source filenames.
 */
function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (['node_modules', 'vendor', '.git', 'test-artifacts'].includes(entry.name)) {
      return [];
    }
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(file);
    return entry.isFile() && file.endsWith('.js') ? [file] : [];
  });
}

/**
 * Returns whether an exported function has typed public API documentation.
 * @param {!ts.Node} node Export declaration or named function.
 * @return {boolean} Whether its JSDoc states parameters and return type.
 */
function hasTypedJSDoc(node) {
  const tags = ts.getJSDocTags(node);
  const tagNames = new Set(tags.map(tag => tag.tagName.text));
  if (ts.isClassDeclaration(node)) return tagNames.has('constructor');
  const parameters = node.parameters?.length ?? 0;
  return (!parameters || tagNames.has('param') || tagNames.has('type')) &&
    (tagNames.has('return') || tagNames.has('returns'));
}

/**
 * Returns public function/class symbols not carrying typed JSDoc.
 * @param {string} file Source path, relative to the working directory.
 * @param {string} source JavaScript module contents.
 * @return {!Array<string>} Stable file#symbol keys for the legacy inventory.
 */
export function undocumentedExports(file, source) {
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  const undocumented = [];
  for (const statement of syntax.statements) {
    if (!statement.modifiers?.some(mod =>
      mod.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      const name = statement.name?.text;
      if (name && !hasTypedJSDoc(statement)) {
        undocumented.push(`${file}#${name}`);
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (!initializer || (!ts.isArrowFunction(initializer) &&
          !ts.isFunctionExpression(initializer))) continue;
        const name = declaration.name.getText(syntax);
        if (!hasTypedJSDoc(statement)) {
          undocumented.push(`${file}#${name}`);
        }
      }
    }
  }
  return undocumented;
}

/**
 * Verifies that no newly exported API lacks typed JSDoc.
 * @param {string=} directory Repository root (defaults to cwd).
 * @param {string=} exceptions Relative baseline filename.
 * @return {{checked: number, legacy: number, added: !Array<string>}}
 *     Source count, legacy debt and new undocumented exports.
 */
export function checkJSDoc(directory = process.cwd(),
  exceptions = baselinePath) {
  const allowed = new Set(JSON.parse(fs.readFileSync(
    path.resolve(directory, exceptions), 'utf8')));
  const files = roots.flatMap(root =>
    listFiles(path.join(directory, root))).sort();
  const missing = files.flatMap(file => undocumentedExports(
    path.relative(directory, file).replaceAll(path.sep, '/'),
    fs.readFileSync(file, 'utf8')));
  return {
    checked: files.length, legacy: missing.length,
    added: missing.filter(key => !allowed.has(key))
  };
}

if (isMain) {
  const result = checkJSDoc();
  if (result.added.length) {
    console.error('New exported APIs require typed @param/@return JSDoc:');
    for (const key of result.added) console.error(`  ${key}`);
    process.exitCode = 1;
  } else {
    console.log(`JSDoc OK: ${result.checked} sources, ` +
      `${result.legacy} documented legacy exceptions.`);
  }
}
