/**
 * @fileoverview Enforces typed JSDoc on all named functions in JavaScript.
 *
 * Production and tooling functions require full contracts. Tests may use
 * concise or partial documentation for local helpers and test doubles;
 * their supplied tags must still be consistent with the function.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {listJavaScriptFiles} from './javascript-files.js';
import {parseJavaScript, forEachChild, declarationOf, isFunction, returnsValue, parameterBinding} from './javascript-ast.js';
import {parseJSDoc, docsFor, parameterTags} from './jsdoc-contract.js';

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

/**
 * Finds direct module-level bindings initialized by the template loader.
 * @param {*} file Parsed module.
 * @return {Set<string>} Template factory identifiers.
 */
function templateRenderers(file) {
  const loaders = new Set();
  for (const statement of file.body) {
    if (statement.type !== 'ImportDeclaration' || !/(?:^|\/)templates\.js$/.test(statement.source.value)) continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'loadTemplates') loaders.add(specifier.local.name);
    }
  }
  const renderers = new Set();
  for (const statement of file.body) {
    const node = declarationOf(statement);
    if (node?.type !== 'VariableDeclaration' || node.kind !== 'const') continue;
    for (const item of node.declarations) {
      const call = item.init?.type === 'AwaitExpression' ? item.init.argument : null;
      if (item.id.type === 'Identifier' && call?.type === 'CallExpression' && call.callee.type === 'Identifier' && loaders.has(call.callee.name)) renderers.add(item.id.name);
    }
  }
  return renderers;
}

/**
 * Recognizes direct returns of a template factory, excluding shadowed identifiers.
 * @param {*} fn Function under inspection.
 * @param {Set<string>} renderers Module-level factory identifiers.
 * @return {boolean} Whether a direct factory call is returned.
 */
function directlyReturnsPlan(fn, renderers) {
  if (!renderers.size) return false;
  const candidates = new Set(renderers);
  /**
   * Excludes identifiers bound by declarations or parameters in the function.
   * @param {*} binding Binding pattern to traverse.
   */
  function excludeBinding(binding) {
    if (!binding) return;
    if (binding.type === 'Identifier') candidates.delete(binding.name);
    else if (binding.type === 'Property') excludeBinding(binding.value);
    else if (binding.type === 'AssignmentPattern') excludeBinding(binding.left);
    else if (binding.type === 'RestElement') excludeBinding(binding.argument);
    else forEachChild(binding, excludeBinding);
  }

  /**
   * Visits local declarations that could hide a module-level template factory.
   * @param {*} node Syntax node in the function body.
   */
  function visit(node) {
    if (isFunction(node)) {
      excludeBinding(node.id);
      if (node !== fn) return;
      for (const param of node.params) excludeBinding(param);
    }
    if (node.type === 'VariableDeclarator' || node.type === 'ClassDeclaration') excludeBinding(node.id);
    if (node.type === 'CatchClause') excludeBinding(node.param);
    forEachChild(node, visit);
  }
  visit(fn);
  /**
   * Checks direct call expressions, including conditional return branches.
   * @param {*} expression Returned expression.
   * @return {boolean} Whether the expression directly calls a template factory.
   */
  function isPlan(expression) {
    if (expression.type === 'ConditionalExpression') return isPlan(expression.consequent) || isPlan(expression.alternate);
    return expression.type === 'CallExpression' && expression.callee.type === 'Identifier' && candidates.has(expression.callee.name);
  }
  return returnsValue(fn, isPlan);
}

/**
 * Validates JSDoc existence, parameter types, and returns on every named
 * function. Anonymous inline callbacks do not create new named interfaces.
 *
 * @param {string} filename Name reported alongside violations.
 * @param {string} source JavaScript source to inspect.
 * @return {!Array<string>} Violations with source-line locations.
 */
export function jsdocViolations(filename, source) {
  const {program: file, comments} = parseJavaScript(filename, source);
  const issues = [];
  for (const comment of comments.filter(comment => comment.type === 'Block' && comment.value.startsWith('*'))) {
    for (const issue of parseJSDoc(comment).issues) issues.push(`${filename}:${comment.loc.start.line}: invalid JSDoc syntax: ${issue}`);
  }
  const requireComplete = !filename.replaceAll('\\', '/').startsWith('tests/');
  const renderers = templateRenderers(file);
  // Match known generated boilerplate, not arbitrary wording or comment length.
  const placeholder = /^(?:Derives the .+ result from the supplied values\.|Combined text from the input values\.|Resulting (?:value|text|list of values)\.|Data used for the comparison\.|Structured result (?:for the caller|assembled from the input data)\.|Result (?:computed from the supplied inputs|of this expression)\.|Value returned by the delegated operation\.|Promise (?:fulfilled when the operation completes|for the asynchronous operation)\.|Calculated numeric (?:result|value)\.|Whether the (?:operation matched or succeeded|condition is satisfied)\.|Entries (?:that meet the selection criteria|transformed for the consuming code)\.|Computed value, or null when the input has no match\.|Performs the .+ lifecycle action\.|Updates the .+ state for its caller\.|Builds the localized .+ text for the current language\.|Calculates the .+ numeric value\.|Coordinates asynchronous work for .+\.)$|\bused by this operation\.$/;

  /**
   * Checks the declared interface against the function syntax.
   *
   * @param {*} owner Syntax node carrying the documentation.
   * @param {*} fn Function or method being documented.
   * @param {boolean} moduleLevel Whether the function is a module-level binding.
   */
  function inspect(owner, fn, moduleLevel) {
    const docs = docsFor(owner, source, comments);
    const prefix = `${filename}:${owner.loc.start.line}`;
    if (!docs.length) {
      if (requireComplete) issues.push(`${prefix}: missing JSDoc on named function`);
      return;
    }
    const tags = docs.flatMap(doc => doc.tags);
    if (tags.some(tag => ['typedef', 'type', 'enum', 'fileoverview'].includes(tag.kind))) return;
    const description = docs.find(doc => doc.description)?.description;
    if (requireComplete && !description) issues.push(`${prefix}: missing meaningful JSDoc description`);
    if (requireComplete && (placeholder.test((description ?? '').replace(/\s+/g, ' ')) || tags.some(tag =>
      ['param', 'return', 'returns'].includes(tag.kind) && placeholder.test(tag.description.replace(/\s+/g, ' '))))) {
      issues.push(`${prefix}: JSDoc uses a known placeholder instead of explaining the contract`);
    }
    const params = fn.params;
    const allParams = parameterTags(tags);
    const documented = allParams.filter(tag => !tag.name.includes('.'));
    const seen = new Set();
    for (const tag of allParams) {
      if (seen.has(tag.name)) issues.push(`${prefix}: duplicate @param ${tag.name}`);
      seen.add(tag.name);
    }
    if (requireComplete && documented.length !== params.length) issues.push(`${prefix}: expected ${params.length} @param tags, found ${documented.length}`);
    if (!requireComplete && params.every(param => parameterBinding(param).type === 'Identifier')) {
      for (const tag of documented) {
        if (!params.some(param => parameterBinding(param).name === tag.name)) issues.push(`${prefix}: @param ${tag.name} does not name a parameter`);
      }
    }
    for (const [index, param] of params.entries()) {
      const binding = parameterBinding(param);
      const name = binding.type === 'Identifier' ? binding.name : null;
      const tag = name ? documented.find(tag => tag.name === name) : documented[index];
      if (!tag) {
        if (requireComplete) issues.push(`${prefix}: undocumented parameter ` + (name ?? `#${index + 1}`));
        continue;
      }
      if (requireComplete && !tag.type) issues.push(`${prefix}: @param ${tag.name} has no valid type`);
      else if (requireComplete && param.type === 'AssignmentPattern' && !tag.optional) issues.push(`${prefix}: defaulted @param ${tag.name} must be optional`);
      if (requireComplete && !tag.description) issues.push(`${prefix}: @param ${tag.name} has no explanation`);
    }
    if (requireComplete && tags.some(tag => tag.kind === 'returns')) issues.push(`${prefix}: use Google JSDoc @return, not @returns`);
    const result = tags.filter(tag => ['return', 'returns'].includes(tag.kind));
    if (requireComplete && returnsValue(fn) && (result.length !== 1 || !result[0].type)) issues.push(`${prefix}: non-void function requires typed @return`);
    if (moduleLevel && result[0]?.type === 'string' && directlyReturnsPlan(fn, renderers)) issues.push(`${prefix}: @return {string} contradicts a direct template RenderPlan return`);
    if (result.length > 1) issues.push(`${prefix}: duplicate @return`);
    if (requireComplete && result.length && !result[0].description) issues.push(`${prefix}: @return has no explanation`);
  }

  /**
   * Locates named declarations, methods and assigned functions with their comment owners.
   * @param {*} node Current syntax node.
   * @param {!Array<*>=} parents Ancestors from the module to the current parent.
   */
  function visit(node, parents = []) {
    const parent = parents.at(-1);
    const grandparent = parents.at(-2);
    const exportOwner = parent?.type === 'ExportNamedDeclaration' || parent?.type === 'ExportDefaultDeclaration';
    if (node.type === 'FunctionDeclaration') inspect(exportOwner ? parent : node, node, parents.length === (exportOwner ? 2 : 1));
    else if (node.type === 'VariableDeclarator' && isFunction(node.init)) {
      const exported = ['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(grandparent?.type);
      inspect(exported ? grandparent : parent, node.init, parents.length === (exported ? 3 : 2));
    } else if (['Property', 'PropertyDefinition', 'MethodDefinition'].includes(node.type) && isFunction(node.value)) inspect(node, node.value, false);
    else if (node.type === 'FunctionExpression' && node.id && !['VariableDeclarator', 'Property', 'PropertyDefinition', 'MethodDefinition'].includes(parent?.type)) {
      const assignment = parent?.type === 'AssignmentExpression' && parent.operator === '=' && grandparent?.type === 'ExpressionStatement';
      inspect(assignment ? grandparent : node, node, false);
    }
    forEachChild(node, child => visit(child, [...parents, node]));
  }
  visit(file);
  return issues;
}

/**
 * Checks all first-party JavaScript sources, with relaxed contracts in tests.
 *
 * @param {string=} directory Project root; defaults to the working directory.
 * @return {{checked: number, issues: !Array<string>}} Coverage and failures.
 */
export function checkCompleteJSDoc(directory = process.cwd()) {
  const files = listJavaScriptFiles(directory);
  return {
    checked: files.length,
    issues: files.flatMap(name => jsdocViolations(name, fs.readFileSync(path.resolve(directory, name), 'utf8'))),
  };
}

if (isMain) {
  const result = checkCompleteJSDoc();
  if (result.issues.length) {
    for (const issue of result.issues.slice(0, 80)) console.error(issue);
    if (result.issues.length > 80) console.error(`... and ${result.issues.length - 80} further JSDoc violations`);
    process.exitCode = 1;
  } else {
    console.log(`JSDoc contracts OK: ${result.checked} JS files (relaxed test policy).`);
  }
}
