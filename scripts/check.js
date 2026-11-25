/**
 * Dependency-free syntax and module-boundary checks for the whole repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
/**
 * Derives the files result from the supplied values.
 *
 * @param {*} directory Directory containing the requested data.
 * @return {*} Combined text from the input values.
 */
function files(directory) {
  return fs.readdirSync(directory, {withFileTypes: true, }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : file.endsWith('.js') ? [path.resolve(file)] : [];
  });
}
const sources = [
  'public',
  'server',
  'worker',
  'docker',
  'scripts',
  'extension',
  'tests',
  'shared',
].filter(fs.existsSync).flatMap(files);
const graph = new Map();
for (const file of sources) {
  const result = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8', });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Syntax check failed: ${file}`);
  }
  const source = fs.readFileSync(file, 'utf8').replace(/\\\r?\n/g, '');
  const imports = [...source.matchAll(/^[ \t]*(?:import|export)\s+(?:[^;]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)].map(match => match[1]).filter(specifier => specifier.startsWith('.'))
    .map(specifier => path.resolve(path.dirname(file), specifier));
  for (const dependency of imports) {
    if (!fs.existsSync(dependency)) {
      throw new Error(`Missing import: ${file} -> ${dependency}`);
    }
  }
  graph.set(file, imports);
}
// Dependency direction is enforced for all future refactors, not just this
// move.
for (const [file, imports] of graph) {
  const relative = path.relative('.', file).replaceAll(path.sep, '/');
  if (relative.startsWith('server/') || relative.startsWith('worker/')) {
    for (const dependency of imports) {
      if (path.relative('.', dependency).replaceAll(path.sep, '/').startsWith('public/')) {
        throw new Error(`Backend must not import public/ assets: ${relative} -> ${dependency}`);
      }
    }
  }
  if (relative.startsWith('shared/')) {
    for (const dependency of imports) {
      if (path.relative('.', dependency).replaceAll(path.sep, '/').startsWith('public/')) {
        throw new Error(`Shared module imports frontend code: ${relative} -> ${dependency}`);
      }
    }
    const content = fs.readFileSync(file, 'utf8').replace(/\\\r?\n/g, '');
    if (/\b(?:window|document)\s*(?:\.|\[)/.test(content)) {
      throw new Error(`Shared module accesses browser DOM: ${relative}`);
    }
  }
}
const visited = new Set();
/**
 * Transforms the entries used by visit.
 *
 * @param {*} file File resource to read, write or inspect.
 * @param {!Array<*>=} stack Value used by this operation.
 */
function visit(file, stack = []) {
  if (stack.includes(file)) {
    throw new Error(`Circular imports: ${[...stack, file].map(name => path.relative('.', name)).join(' -> ')}`);
  }
  if (visited.has(file)) {
    return;
  }
  for (const dependency of graph.get(file) || []) {
    visit(dependency, [...stack, file]);
  }
  visited.add(file);
}
for (const file of graph.keys()) {
  visit(file);
}
// Every relative import reachable from the frontend must be actually served.
// Existence and syntax checks alone missed an N-4a shared module blocked by
// the restrictive HTTP allowlist, causing a blank application in CI Chromium.
const {SHARED_BROWSER_FILES} = await import('../server/http/static-files.js');
const browserVisited = new Set();
const browserShared = new Set();
/**
 * Validates the verify browser imports state and rejects invalid inputs.
 *
 * @param {*} file File resource to read, write or inspect.
 */
function verifyBrowserImports(file) {
  if (browserVisited.has(file)) return;
  browserVisited.add(file);
  const relative = path.relative('.', file).replaceAll(path.sep, '/');
  if (relative.startsWith('shared/')) {
    const name = relative.slice('shared/'.length);
    if (!SHARED_BROWSER_FILES.has(name)) {
      throw new Error(`Frontend imports /shared/${name}, but static HTTP allowlist blocks it`);
    }
    browserShared.add(name);
  } else if (!relative.startsWith('public/')) {
    throw new Error(`Frontend imports an inaccessible module: ${relative}`);
  }
  for (const dependency of graph.get(file) || []) verifyBrowserImports(dependency);
}
for (const file of sources.filter(name => path.relative('.', name).replaceAll(path.sep, '/').startsWith('public/'))) {
  verifyBrowserImports(file);
}
console.log(`${browserShared.size} frontend shared modules: HTTP allowlist OK.`);

// Validate local assets referenced by browser tests before running Chromium.
// In particular, an import refactor must rename the fixture on disk as well.
const fixtureReferences = new Set();
for (const file of sources.filter(file => file.includes(`${path.sep}tests${path.sep}`))) {
  const source = fs.readFileSync(file, 'utf8').replace(/\\\r?\n/g, '');
  for (const match of source.matchAll(
    new RegExp(
      'new URL\\(\\s*[\'"](\\.\\.\\/fixtures\\/[^' + '\'"]+)[\'"]\\s*,\\s*import\\.meta\\.url\\s' + '*\\)',
      'g'
    ))) {
    const fixture = path.resolve(path.dirname(file), match[1]);
    if (!fs.existsSync(fixture)) {
      throw new Error(`Missing test fixture: ${path.relative('.', fixture)} (referenced by ${path.relative('.', file)})`);
    }
    fixtureReferences.add(fixture);
  }
}
console.log(`${fixtureReferences.size} test fixture files: references OK.`);

// These view listeners are explicitly audited as local, ephemeral DOM/widget
// lifecycles. All other application events belong in the delegated events.js.
// A new direct binding in a view must be reviewed and listed here deliberately.
const allowedViewListeners = new Map([
  ['warehouse.js',
    12],       // SVG pointer/keyboard interactions and transient dialogs.
  ['warehouse-room-transfer.js', 9], // Modal-local import/export controls.
]);
for (const file of sources.filter(name => name.includes(`${path.sep}public${path.sep}js${path.sep}views${path.sep}`))) {
  const view = path.relative(path.resolve('public/js/views'), file).replaceAll(path.sep, '/');
  const listenerCount = (fs.readFileSync(file, 'utf8').match(/\.addEventListener\s*\(/g) || []).length;
  const allowedCount = allowedViewListeners.get(view) ?? 0;
  if (listenerCount !== allowedCount) {
    throw new Error(
      `View-Event-Lifecycle: ${view} has ${listenerCount} direct listeners (approved: ${allowedCount}). Use delegated events.js or review the explicit exception.`);
  }
}

// Architectural rule: user confirmation must be an application modal, not a
// native prompt that bypasses our accessibility and nested-dialog lifecycle.
for (const file of sources.filter(name => name.includes(`${path.sep}public${path.sep}`))) {
  const source = fs.readFileSync(file, 'utf8').replace(/\\\r?\n/g, '');
  const relative = path.relative('.', file).replaceAll(path.sep, '/');
  // The modal controller intentionally exports its own `confirm()` method.
  // That is an application dialog, not the native window.confirm API.
  const forbidden = relative === 'public/js/ui/modal.js'
    ? /\b(?:window|globalThis)\.(?:alert|prompt|confirm)\s*\(/
    : /(?<![\w.])(?:(?:window|globalThis)\.)?(?:alert|prompt|confirm)\s*\(/;
  if (forbidden.test(source)) {
    throw new Error(`Native browser dialog forbidden: ${path.relative('.', file)}`);
  }
}

console.log(`${sources.length} JavaScript files: syntax/imports OK, no circular imports.`);

const i18nCheck = spawnSync(process.execPath, ['scripts/check-i18n.js'], {encoding: 'utf8'});
if (i18nCheck.status !== 0) throw new Error(i18nCheck.stderr || i18nCheck.stdout);
process.stdout.write(i18nCheck.stdout);

// N-4: all server-side error identities must exist in both UI catalogs and
// the small API-only English fallback. No locale-specific message matching.
const deMessages = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
const enMessages = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
const {apiErrorFallbacks} = await import('../shared/api-error-fallbacks.js');
const apiCodes = new Set();
for (const [file, imports] of graph) {
  const relative = path.relative('.', file).replaceAll(path.sep, '/');
  if (!relative.startsWith('server/')) continue;
  const contents = fs.readFileSync(file, 'utf8').replace(/\\\r?\n/g, '');
  for (const [, code] of contents.matchAll(/['"](api\.errors\.[a-zA-Z0-9]+)['"]/g)) apiCodes.add(code);
}
for (const code of apiCodes) {
  if (!Object.hasOwn(deMessages, code) || !Object.hasOwn(enMessages, code) || !Object.hasOwn(apiErrorFallbacks, code) || enMessages[code] !== apiErrorFallbacks[code]) {
    throw new Error(`Missing or inconsistent API error translation: ${code}`);
  }
}
console.log(`${apiCodes.size} server API error codes: German/English/fallback catalog OK.`);
// N-7: structured backup worker diagnostics must be present in both languages.
const backupCodes = new Set();
for (const file of sources.filter(name =>
  ['worker/', 'shared/backup-job-errors.js'].some(prefix =>
    path.relative('.', name).replaceAll(path.sep, '/').startsWith(prefix)))) {
  const content = fs.readFileSync(file, 'utf8').replace(/\\\r?\n/g, '');
  for (const [, code] of content.matchAll(/['"](backup\.errors\.[a-zA-Z0-9]+)['"]/g)) backupCodes.add(code);
}
for (const code of backupCodes) {
  if (!Object.hasOwn(deMessages, code) || !Object.hasOwn(enMessages, code)) {
    throw new Error(`Missing backup worker error translation: ${code}`);
  }
}
const {apiErrorFieldLabels} = await import('../shared/api-error-field-labels.js');
for (const field of Object.keys(apiErrorFieldLabels)) {
  const key = `api.fields.${field}`;
  if (!Object.hasOwn(deMessages, key) || !Object.hasOwn(enMessages, key) ||
    enMessages[key] !== apiErrorFieldLabels[field]) {
    throw new Error(`Missing or inconsistent API field name: ${key}`);
  }
}
console.log(`${backupCodes.size} backup worker errors and ${Object.keys(apiErrorFieldLabels).length} API field names: German/English OK.`);


const docCheck = spawnSync(process.execPath, ['scripts/check-docs.js'], {encoding: 'utf8'});
if (docCheck.status !== 0) throw new Error(docCheck.stderr || docCheck.stdout);
process.stdout.write(docCheck.stdout);

// B-5: Application-source-content tests are forbidden in *all* unit and
// integration
// suites. Test observable output/behaviour instead; configuration/security
// contracts belong in the dedicated deployment checker invoked below.
for (const file of sources.filter(name => name.includes(`${path.sep}tests${path.sep}`))) {
  if (!/(?:unit|integration)/.test(path.relative('tests', file))) continue;
  const relative = path.relative('.', file).replaceAll(path.sep, '/');
  const source = fs.readFileSync(file, 'utf8').replace(/\\\r?\n/g, '');
  const forbidden =
    new RegExp(
      '(?:readFileSync|readFile)\\s*\\(\\s*(?:[\'' + '"`](?:\\.\\.\\/)*|new URL\\(\\s*[\'"`](?:' +
      '\\.\\.\\/)*)(?:public\\/js\\/|public\\/sty' +
      'les\\/|server\\/|shared\\/|worker\\/|docke' +
      'r\\/entrypoint\\.js)'
    );
  const delegated =
    new RegExp('\\bread\\(\\s*[\'"](?:public\\/js\\/|publi' + 'c\\/styles\\/|server\\/|shared\\/|worker\\' + '/)');
  if (forbidden.test(source) || delegated.test(source)) {
    throw new Error(`B-5: Source-code text test forbidden in ${relative}. Use behavioural tests.`);
  }
}
const deployCheck = spawnSync(process.execPath, ['scripts/check-deployment-config.js'], {encoding: 'utf8'});
if (deployCheck.status !== 0) throw new Error(deployCheck.stderr || deployCheck.stdout);
process.stdout.write(deployCheck.stdout);
console.log('B-5: No application-source-text unit/integration assertions.');

// Repository-wide Google JavaScript formatting and public API JSDoc contracts.
// Both are checked in CI via npm run check; no automatic formatting in CI.
for (const script of [
  'check-html-templates.js',
  'format-html-templates.js',
  'check-css-colors.js',
  'format-js.js',
  'format-css.js',
  'check-jsdoc.js',
  'check-jsdoc-complete.js',
]) {
  const validation = spawnSync(process.execPath, [`scripts/${script}`], {encoding: 'utf8', });
  if (validation.status !== 0) {
    throw new Error(validation.stderr || validation.stdout || `${script} failed`);
  }
  process.stdout.write(validation.stdout);
}
