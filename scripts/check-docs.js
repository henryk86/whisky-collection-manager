#!/usr/bin/env node
/** Validate relative Markdown links so documentation cannot silently drift.
 * External URLs and in-page fragment links are deliberately not fetched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const documents = [
    path.join(root, 'README.md'),
    path.join(root, 'CHANGELOG.md'),
    path.join(root, 'AGENTS.md'),
    ...fs.readdirSync(path.join(root, 'docs')).filter(name => name.endsWith('.md')).map(name => path.join(root, 'docs', name)),
];
let examined = 0;
const failures = [];
const currentStateDocs = new Set([
    'ANALYSE.md', 'ANFORDERUNGEN.md', 'ARCHITEKTUR.md', 'ENTWICKLUNG.md',
    'KARTE.md', 'LAGER.md', 'PHOTO_FREISTELLUNG.md',
]);
for (const file of documents) {
    const content = fs.readFileSync(file, 'utf8');
    // Fachunterlagen beschreiben den aktuellen Stand. Historische
    // Versionsueberschriften gehoeren ausschliesslich in den Changelog.
    if (currentStateDocs.has(path.basename(file))) {
        for (const heading of content.matchAll(/^#{2,6} [^\n]*\(\s*(?:ab\s+)?v\d+\.\d+\.\d+\s*\)[ \t]*$/gm)) {
            failures.push(`${path.relative(root, file)}: outdated version heading: ${heading[0]}`);
        }
    }
    // Inline Markdown links and images, not source code or external destinations.
    for (const [, destination] of content.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g)) {
        const raw = destination.trim().replace(/^<([^>]+)>$/, '$1').split(/\s+"/u)[0];
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu.test(raw)) continue;
        const local = raw.split('#')[0].split('?')[0];
        if (!local) continue;
        examined += 1;
        let resolved;
        try { resolved = path.resolve(path.dirname(file), decodeURIComponent(local)); }
        catch { failures.push(`${path.relative(root, file)}: malformed link ${raw}`); continue; }
        if ((!resolved.startsWith(root + path.sep) && resolved !== root) || !fs.existsSync(resolved)) {
            failures.push(`${path.relative(root, file)} -> ${raw}`);
        }
    }
}
if (failures.length) {
    console.error('Documentation checks failed:\n' + failures.map(line => `- ${line}`).join('\n'));
    process.exitCode = 1;
} else {
    console.log(`${documents.length} Markdown files, ${examined} relative links: OK`);
}
