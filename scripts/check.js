/** Dependency-free syntax and module-boundary checks for the whole repository. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
function files(directory) {
    return fs.readdirSync(directory, {
        withFileTypes: true
    }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? files(file) : file.endsWith('.js') ? [path.resolve(file)] : [];
    });
}
const sources = ['public', 'server', 'worker', 'docker', 'scripts', 'extension', 'tests', 'shared'].filter(fs.existsSync).flatMap(files);
const graph = new Map();
for (const file of sources) {
    const result = spawnSync(process.execPath, ['--check', file], {
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        throw new Error(result.stderr || `Syntax check failed: ${file}`);
    }
    const source = fs.readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/^[ \t]*(?:import|export)\s+(?:[^;]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)]
        .map(match => match[1]).filter(specifier => specifier.startsWith('.'))
        .map(specifier => path.resolve(path.dirname(file), specifier));
    for (const dependency of imports) {
        if (!fs.existsSync(dependency)) {
            throw new Error(`Missing import: ${file} -> ${dependency}`);
        }
    }
    graph.set(file, imports);
}
const visited = new Set();
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
console.log(`${sources.length} JavaScript files: syntax/imports OK, no circular imports.`);

const i18nCheck = spawnSync(process.execPath, ['scripts/check-i18n.js'], {encoding: 'utf8'});
if (i18nCheck.status !== 0) throw new Error(i18nCheck.stderr || i18nCheck.stdout);
process.stdout.write(i18nCheck.stdout);

const docCheck = spawnSync(process.execPath, ['scripts/check-docs.js'], {encoding: 'utf8'});
if (docCheck.status !== 0) throw new Error(docCheck.stderr || docCheck.stdout);
process.stdout.write(docCheck.stdout);
