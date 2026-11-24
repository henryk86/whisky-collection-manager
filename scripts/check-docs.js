#!/usr/bin/env node
/** Validate relative Markdown links so documentation cannot silently drift.
 * External URLs and in-page fragment links are deliberately not fetched.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const documents = [
  path.join(root, 'README.md'),
  path.join(root, 'CHANGELOG.md'),
  path.join(root, 'AGENTS.md'),
  ...fs.readdirSync(path.join(root, 'docs')).filter(name =>
    name.endsWith('.md')).map(name => path.join(root, 'docs', name)),
  path.join(root, 'tests/visual/README.md'),
  path.join(root, '.github/pull_request_template.md'),
];
let examined = 0;
const failures = [];
const currentStateDocs = new Set(fs.readdirSync(path.join(root, 'docs'))
  .filter(name => name.endsWith('.md')));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const status = fs.readFileSync(path.join(root, 'docs/TESTSTATUS.md'), 'utf8');
if (!readme.startsWith(`# Whisky Collection Manager v${version}\n`)) failures.push('README.md: version differs from package.json');
if (!status.startsWith(`# Teststatus - Whisky Collection Manager v${version}\n`)) failures.push('docs/TESTSTATUS.md: version differs from package.json');
if (fs.existsSync(path.join(root, 'docs/TESTHISTORIE.md'))) failures.push('docs/TESTHISTORIE.md: secondary history forbidden; use CHANGELOG.md');
const dataArchitecture =
  fs.readFileSync(path.join(root, 'docs/ARCHITEKTUR.md'), 'utf8');
const photoDoc = fs.readFileSync(path.join(root, 'docs/PHOTO_FREISTELLUNG.md'), 'utf8');
const currentSchema = fs.readFileSync(
  path.join(root, 'server/storage/collection-store.js'),
  'utf8'
).match(/schemaVersion:\s*(\d+)/)?.[1];
if (!currentSchema) failures.push('Unable to determine current Collection schema');
else {
  if (!dataArchitecture.includes(`Schema ${currentSchema}`)) failures.push('docs/ARCHITEKTUR.md: current schema missing');
  if (!photoDoc.includes(`Schema ${currentSchema}`)) failures.push('docs/PHOTO_FREISTELLUNG.md: current schema missing');
}
for (const file of documents) {
  const content = fs.readFileSync(file, 'utf8');
  // Fachunterlagen beschreiben den aktuellen Stand. Historische
  // Versionsueberschriften gehoeren ausschliesslich in den Changelog.
  if (currentStateDocs.has(path.basename(file))) {
    if (/^#{2,6} .*\b(?:Phase [1-9]|v\d+\.\d+\.\d+)\b/gmi.test(content)) {
      failures.push(`${path.relative(root, file)}: historical section heading belongs in CHANGELOG.md`);
    }
    for (const heading of content.matchAll(/^#{2,6} [^\n]*\(\s*(?:ab\s+)?v\d+\.\d+\.\d+\s*\)[ \t]*$/gm)) {
      failures.push(`${path.relative(root, file)}: outdated version heading: ${heading[0]}`);
    }
  }
  // Inline Markdown links and images, not source code or external destinations.
  for (const [, destination] of content.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g)) {
    const raw = destination.trim().replace(/^<([^>]+)>$/, '$1')
      .split(/\s+"/u)[0];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu.test(raw)) continue;
    const local = raw.split('#')[0].split('?')[0];
    if (!local) continue;
    examined += 1;
    let resolved;
    try {resolved = path.resolve(path.dirname(file), decodeURIComponent(local));}
    catch {failures.push(`${path.relative(root, file)}: malformed link ${raw}`); continue;}
    if ((!resolved.startsWith(root + path.sep) && resolved !== root) ||
      !fs.existsSync(resolved)) {
      failures.push(`${path.relative(root, file)} -> ${raw}`);
    }
  }
}
if (failures.length) {
  console.error('Documentation checks failed:\n' + failures.map(line =>
    `- ${line}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${documents.length} Markdown files, ${examined} relative links: OK`);
}
