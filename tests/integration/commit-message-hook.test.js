import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateMessage} from '../../scripts/validate-commit-message.js';

/**
 * Derives the run result from the supplied values.
 *
 * @param {*} dir Directory containing the affected files.
 * @param {*} cmd Value used by this operation.
 * @param {*} args Arguments forwarded to the operation.
 * @return {*} Result computed from the supplied inputs.
 */
const run = (dir, cmd, args) => spawnSync(cmd, args, {cwd: dir, encoding: 'utf8'});

/**
 * Normalizes the success text for subsequent processing.
 *
 * @param {*} dir Directory containing the affected files.
 * @param {*} cmd Value used by this operation.
 * @param {!Array<*>} args Arguments forwarded to the operation.
 * @return {*} Combined text from the input values.
 */
const success = (dir, cmd, ...args) => {
  const result = run(dir, cmd, args);
  assert.equal(result.status, 0, `Failed ${cmd} ${args.join(' ')}: ${result.stderr}\n${result.stdout}`);
  return result.stdout.trim();
};

/**
 * Writes fixture data to the local filesystem.
 *
 * @param {*} t Temporary or input value for the calculation.
 * @return {*} Combined text from the input values.
 */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-hooks-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  success(dir, 'git', 'init', '-b', 'develop');
  success(dir, 'git', 'config', 'user.name', 'Hook Tester');
  success(dir, 'git', 'config', 'user.email', 'hooks@example.invalid');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}\n');
  for (const name of [
    'validate-commit-message.js',
    'release-automation.js',
    'release-version.js',
    'release-manifest.js',
    'install-git-hooks.js',
  ]) {
    fs.mkdirSync(path.join(dir, 'scripts'), {recursive: true});
    fs.copyFileSync(path.join('scripts', name), path.join(dir, 'scripts', name));
  }
  fs.mkdirSync(path.join(dir, '.githooks'));
  fs.copyFileSync('.githooks/commit-msg', path.join(dir, '.githooks/commit-msg'));
  fs.chmodSync(path.join(dir, '.githooks/commit-msg'), 0o755);
  return dir;
}

test(
  'commit-msg parser shares the release Conventional Commits validator',
  () => {
    assert.equal(validateMessage('fix(warehouse): Fach korrigieren\n').level, 'patch');
    assert.equal(validateMessage('docs!: neue Konfiguration\n\nBREAKING CHANGE: alt entfernt\n').level, 'major');
    assert.throws(() => validateMessage('Korrigiere Lager\n'), /Conventional-Commit/);
    assert.throws(() => validateMessage('fix: \n'), /Conventional-Commit/);
  }
);

test(
  'locally installed commit-msg hook blocks bad commits and accepts valid ones',
  t => {
    const dir = fixture(t);
    success(dir, process.execPath, 'scripts/install-git-hooks.js');
    assert.equal(success(dir, 'git', 'config', '--local', '--get', 'core.hooksPath'), '.githooks');
    fs.writeFileSync(path.join(dir, 'change.txt'), 'updated\n');
    success(dir, 'git', 'add', '.');
    const bad = run(dir, 'git', ['commit', '-m',
      'Refactor unit tests without prefix']);
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /Commit abgelehnt/);
    assert.notEqual(run(dir, 'git', ['rev-parse', '--verify', 'HEAD']).status, 0);
    success(dir, 'git', 'commit', '-m', 'refactor(tests): tests verbessern');
    assert.equal(success(dir, 'git', 'log', '-1', '--format=%s'), 'refactor(tests): tests verbessern');
    fs.writeFileSync(path.join(dir, 'change.txt'), 'updated again\n');
    success(dir, 'git', 'add', '.');
    const alsoBad = run(dir, 'git', ['commit', '-m', 'Update tests']);
    assert.notEqual(alsoBad.status, 0);
    // The local hook is not a security boundary: CI must still reject bypassed
    // commits.
    success(dir, 'git', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'Update tests');
    const ci = run(dir, process.execPath, ['scripts/release-automation.js', 'validate', '--range', 'HEAD^..HEAD']);
    assert.notEqual(ci.status, 0);
    assert.match(ci.stderr, /Conventional-Commit/);
  }
);

test(
  'hook installer is idempotent and refuses to override existing hook paths',
  t => {
    const dir = fixture(t);
    success(dir, process.execPath, 'scripts/install-git-hooks.js');
    success(dir, process.execPath, 'scripts/install-git-hooks.js');
    success(dir, 'git', 'config', '--local', 'core.hooksPath', '.existing');
    const refused = run(dir, process.execPath, ['scripts/install-git-hooks.js']);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /anderer core.hooksPath/);
    assert.equal(success(dir, 'git', 'config', '--local', '--get', 'core.hooksPath'), '.existing');
  }
);

test(
  'real Git merge commits are allowed, but fake Merge subjects are not',
  t => {
    const dir = fixture(t);
    success(dir, process.execPath, 'scripts/install-git-hooks.js');
    fs.writeFileSync(path.join(dir, 'base.txt'), 'base\n');
    success(dir, 'git', 'add', '.');
    success(dir, 'git', 'commit', '-m', 'chore: initial setup');
    success(dir, 'git', 'checkout', '-b', 'feature');
    fs.writeFileSync(path.join(dir, 'feature.txt'), 'feature\n');
    success(dir, 'git', 'add', '.');
    success(dir, 'git', 'commit', '-m', 'feat: add feature');
    success(dir, 'git', 'checkout', 'develop');
    fs.writeFileSync(path.join(dir, 'develop.txt'), 'develop\n');
    success(dir, 'git', 'add', '.');
    const fake = run(dir, 'git', ['commit', '-m', 'Merge feature into develop']);
    assert.notEqual(fake.status, 0);
    success(dir, 'git', 'commit', '-m', 'fix: develop cleanup');
    success(dir, 'git', 'merge', '--no-ff', 'feature', '-m', 'Merge feature into develop');
    assert.equal(success(dir, 'git', 'log', '-1', '--format=%s'), 'Merge feature into develop');
  }
);

test(
  'hook installer does not silently replace a preexisting default commit-msg hook',
  t => {
    const dir = fixture(t);
    const pathToHook = success(dir, 'git', 'rev-parse', '--git-path', 'hooks/commit-msg');
    fs.writeFileSync(path.resolve(dir, pathToHook), '#!/bin/sh\nexit 0\n');
    const refused = run(dir, process.execPath, ['scripts/install-git-hooks.js']);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /vorhandener commit-msg-Hook/);
    assert.equal(run(dir, 'git', ['config', '--local', '--get', 'core.hooksPath']).status, 1);
  }
);
