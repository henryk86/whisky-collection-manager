import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../../scripts/check-doc-impact.js', import.meta.url));
function git(cwd, args) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
}
function fixture(action) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-doc-impact-'));
    try {
        git(cwd, ['init', '-q']);
        git(cwd, ['config', 'user.email', 'test@example.invalid']);
        git(cwd, ['config', 'user.name', 'Documentation Test']);
        fs.mkdirSync(path.join(cwd, 'public'), {recursive: true});
        fs.mkdirSync(path.join(cwd, 'docs'), {recursive: true});
        fs.writeFileSync(path.join(cwd, 'public/app.js'), 'export const test = 1;\n');
        fs.writeFileSync(path.join(cwd, 'docs/ARCHITEKTUR.md'), '# Architecture\n');
        git(cwd, ['add', '.']);
        git(cwd, ['commit', '-qm', 'test: base']);
        action(cwd);
    } finally {
        fs.rmSync(cwd, {recursive: true, force: true});
    }
}
function check(cwd, {env = {}} = {}) {
    return spawnSync(process.execPath, [script, '--range', 'HEAD^..HEAD'], {cwd, encoding: 'utf8', env: {...process.env, DOCS_DECLARATION: '', ...env}});
}
test('doc impact rejects a code change without documentation or a reason', () => fixture(cwd => {
    fs.writeFileSync(path.join(cwd, 'public/app.js'), 'export const test = 2;\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-qm', 'fix: change app']);
    const result = check(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Documentation impact/);
}));
test('doc impact accepts an accompanying current document', () => fixture(cwd => {
    fs.writeFileSync(path.join(cwd, 'public/app.js'), 'export const test = 2;\n');
    fs.writeFileSync(path.join(cwd, 'docs/ARCHITEKTUR.md'), '# Current architecture\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-qm', 'docs: update behavior']);
    assert.equal(check(cwd).status, 0);
}));
test('doc impact accepts a concrete justified exception but not an empty one', () => fixture(cwd => {
    fs.writeFileSync(path.join(cwd, 'public/app.js'), 'export const test = 2;\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-qm', 'refactor: preserve behavior']);
    assert.equal(check(cwd, {env: {DOCS_DECLARATION: 'Docs-Impact: none - Refactor only; UI and API contracts are identical.'}}).status, 0);
    assert.equal(check(cwd, {env: {DOCS_DECLARATION: 'Docs-Impact: none'}}).status, 1);
}));
test('doc impact treats changelog alone as insufficient', () => fixture(cwd => {
    fs.writeFileSync(path.join(cwd, 'public/app.js'), 'export const test = 2;\n');
    fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), '# Changelog\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-qm', 'feat: with changelog']);
    assert.equal(check(cwd).status, 1);
}));
test('doc impact does not require changes for docs-only commits', () => fixture(cwd => {
    fs.writeFileSync(path.join(cwd, 'docs/ARCHITEKTUR.md'), '# Updated current architecture\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-qm', 'docs: improve clarity']);
    assert.equal(check(cwd).status, 0);
}));
