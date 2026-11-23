import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const sh = (cwd, ...args) => execFileSync(args[0], args.slice(1), {cwd, encoding: 'utf8'}).trim();
const text = (dir, name, value) => {const f = path.join(dir, name); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, value);};
const config = (dir) => {
  sh(dir, 'git', 'config', 'user.name', 'Release Test');
  sh(dir, 'git', 'config', 'user.email', 'release@example.invalid');
};
function fixture(t, {moving = false, modifiedMetadata = false, minimalManifest = false} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-branch-sync-'));
  t.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
  const dir = path.join(tmp, 'work'), remote = path.join(tmp, 'remote.git');
  fs.mkdirSync(dir); sh(tmp, 'git', 'init', '--bare', remote); sh(dir, 'git', 'init', '-b', 'main'); config(dir);
  for (const file of ['release-version.js', 'release-manifest.js', 'release-automation.js', 'sync-release-branches.js', 'verify-version-pr.js']) {
    const src = path.resolve('scripts', file);
    text(dir, `scripts/${file}`, fs.readFileSync(src, 'utf8'));
  }
  text(dir, 'package.json', JSON.stringify({name: 'wcm-fixture', type: 'module', version: '1.4.0'}) + '\n');
  text(dir, 'package-lock.json', JSON.stringify({version: '1.4.0', packages: {'': {version: '1.4.0'}}}) + '\n');
  text(dir, 'README.md', '# Whisky Collection Manager v1.4.0\n\nIntroduction.\n');
  text(dir, 'CHANGELOG.md', '# Changelog\n\n## 1.4.0 - 2026-11-16\n\n- Historical information\n');
  text(dir, 'docs/TESTSTATUS.md', '# Teststatus - Whisky Collection Manager v1.4.0\n');
  if (!minimalManifest) for (let i = 0; i < 20; i++) text(dir, `public/js/stable-${i}.js`, `export const stable${i} = ${i};\n`);
  sh(dir, process.execPath, 'scripts/release-manifest.js', 'create');
  sh(dir, 'git', 'add', '.'); sh(dir, 'git', 'commit', '-m', 'chore: baseline');
  sh(dir, 'git', 'remote', 'add', 'origin', remote);
  sh(dir, 'git', 'push', 'origin', 'main');
  sh(dir, 'git', 'branch', 'develop'); sh(dir, 'git', 'push', 'origin', 'develop');
  sh(dir, 'git', 'checkout', 'develop');
  text(dir, 'feature.txt', 'approved functionality\n');
  sh(dir, 'git', 'add', '.'); sh(dir, 'git', 'commit', '-m', 'fix: approved change');
  sh(dir, 'git', 'push', 'origin', 'develop');
  sh(dir, 'git', 'checkout', 'main');
  sh(dir, 'git', 'merge', '--no-ff', 'develop', '-m', 'Merge pull request from develop');
  const merge = sh(dir, 'git', 'rev-parse', 'HEAD');
  sh(dir, 'git', 'push', 'origin', 'main');
  sh(dir, 'git', 'checkout', '--detach', merge);
  text(dir, 'package.json', JSON.stringify({name: 'wcm-fixture', type: 'module', version: '1.4.1'}) + '\n');
  text(dir, 'package-lock.json', JSON.stringify({version: '1.4.1', packages: {'': {version: '1.4.1'}}}) + '\n');
  text(dir, 'README.md', '# Whisky Collection Manager v1.4.1\n\nIntroduction.\n');
  text(dir, 'CHANGELOG.md', '# Changelog\n\n## 1.4.1 - 2026-11-16\n\n- fix: approved change\n\n## 1.4.0 - 2026-11-16\n\n- Historical information\n');
  text(dir, 'docs/TESTSTATUS.md', '# Teststatus - Whisky Collection Manager v1.4.1\n\nRelease CI pending\n');
  sh(dir, process.execPath, 'scripts/release-manifest.js', 'create');
  sh(dir, 'git', 'add', '.'); sh(dir, 'git', 'commit', '-m', 'WCM Release Snapshot v1.4.1');
  const snapshot = sh(dir, 'git', 'rev-parse', 'HEAD');
  sh(dir, 'git', 'tag', 'v1.4.1'); sh(dir, 'git', 'push', 'origin', 'refs/tags/v1.4.1');
  if (moving || modifiedMetadata) {
    sh(dir, 'git', 'checkout', 'develop');
    text(dir, 'public/js/new-feature.js', 'export const next = true;\n');
    if (modifiedMetadata) text(dir, 'README.md', '# Locally revised readme v1.4.0\n');
    sh(dir, 'git', 'add', '.'); sh(dir, 'git', 'commit', '-m', 'feat: next changes while release builds');
    sh(dir, 'git', 'push', 'origin', 'develop');
  }
  return {dir, remote, merge, snapshot};
}
function prepare({dir, merge}) {
  return JSON.parse(sh(dir, process.execPath, 'scripts/sync-release-branches.js', 'prepare', '--tag', 'v1.4.1', '--merge', merge));
}
function mergeVersionPR(state) {
  const {dir} = state;
  const pr = prepare(state);
  if (pr.alreadyMerged) return pr;
  assert.equal(pr.branch, 'release/version-v1.4.1');
  assert.equal(remoteRef(dir, pr.branch), state.snapshot);
  sh(dir, 'git', 'checkout', 'main');
  sh(dir, 'git', 'fetch', 'origin');
  sh(dir, 'git', 'merge', '--no-ff', `refs/remotes/origin/${pr.branch}`,
    '-m', 'Merge pull request #2 from bot/release/version-v1.4.1');
  sh(dir, 'git', 'push', 'origin', 'main');
  return pr;
}
function finish({dir, merge}) {
  return JSON.parse(sh(dir, process.execPath, 'scripts/sync-release-branches.js', 'finish', '--tag', 'v1.4.1', '--merge', merge));
}
const get = (dir, branch, name) => sh(dir, 'git', 'show', `refs/remotes/origin/${branch}:${name}`);
const remoteRef = (dir, branch) => sh(dir, 'git', 'ls-remote', 'origin', `refs/heads/${branch}`).split(/\s+/)[0];

test('protected main is never directly pushed; a merged release PR synchronizes both branches', t => {
  const state = fixture(t), {dir, merge, snapshot} = state;
  const initialMain = remoteRef(dir, 'main');
  const pr = prepare(state);
  assert.equal(pr.alreadyMerged, false);
  assert.equal(remoteRef(dir, 'main'), initialMain);
  assert.equal(remoteRef(dir, pr.branch), snapshot);
  mergeVersionPR(state);
  const mergedMain = remoteRef(dir, 'main');
  assert.notEqual(mergedMain, snapshot);
  const result = finish(state);
  assert.equal(result.main, mergedMain);
  assert.equal(result.develop, mergedMain);
  assert.equal(remoteRef(dir, 'main'), mergedMain);
  assert.equal(remoteRef(dir, 'develop'), mergedMain);
  sh(dir, 'git', 'fetch', 'origin');
  for (const branch of ['main', 'develop']) {
    assert.equal(JSON.parse(get(dir, branch, 'package.json')).version, '1.4.1');
    assert.equal(JSON.parse(get(dir, branch, 'package-lock.json')).version, '1.4.1');
    assert.match(get(dir, branch, 'README.md'), /^# Whisky Collection Manager v1\.4\.1/);
    assert.match(get(dir, branch, 'docs/TESTSTATUS.md'), /v1\.4\.1/);
    assert.match(get(dir, branch, 'CHANGELOG.md'), /## 1\.4\.1/);
    assert.equal(JSON.parse(get(dir, branch, 'wcm-source-manifest.json')).version, '1.4.1');
  }
  assert.equal(prepare(state).alreadyMerged, true);
  assert.equal(finish(state).unchanged, true);
});

test('develop can advance while release PR is being merged; source and manifest preserved', t => {
  const state = fixture(t, {moving: true}), {dir} = state;
  const initial = remoteRef(dir, 'develop');
  mergeVersionPR(state);
  const result = finish(state);
  assert.notEqual(result.develop, initial);
  sh(dir, 'git', 'fetch', 'origin');
  assert.match(get(dir, 'develop', 'public/js/new-feature.js'), /next = true/);
  assert.equal(JSON.parse(get(dir, 'develop', 'package.json')).version, '1.4.1');
  assert.ok(JSON.parse(get(dir, 'develop', 'wcm-source-manifest.json')).files['public/js/new-feature.js']);
  assert.equal(finish(state).unchanged, true);
});

test('unexpected release metadata edits fail without changing develop', t => {
  const state = fixture(t, {modifiedMetadata: true});
  mergeVersionPR(state);
  const before = remoteRef(state.dir, 'develop');
  assert.throws(() => finish(state), /Command failed/);
  assert.equal(remoteRef(state.dir, 'develop'), before);
});

test('finish refuses to synchronize develop before main merged the version PR', t => {
  const state = fixture(t);
  prepare(state);
  assert.throws(() => finish(state), /Command failed/);
  assert.equal(remoteRef(state.dir, 'main'), state.merge);
});

test('invalid tag and stale main refuse to create a version PR', t => {
  const state = fixture(t), {dir} = state;
  assert.throws(() => sh(dir, process.execPath, 'scripts/sync-release-branches.js',
    'prepare', '--tag', 'v1.4.1', '--merge', '0'.repeat(40)), /Command failed/);
  sh(dir, 'git', 'checkout', 'main');
  text(dir, 'unapproved.txt', 'main was edited\n');
  sh(dir, 'git', 'add', '.'); sh(dir, 'git', 'commit', '-m', 'fix: changed main');
  sh(dir, 'git', 'push', 'origin', 'main');
  assert.throws(() => prepare(state), /Command failed/);
});

test('next develop release derives only one new minor bump after version PR', t => {
  const state = fixture(t), {dir} = state;
  mergeVersionPR(state); finish(state);
  sh(dir, 'git', 'fetch', 'origin');
  sh(dir, 'git', 'checkout', '-B', 'develop', 'refs/remotes/origin/develop');
  text(dir, 'following-feature.txt', 'another feature\n');
  sh(dir, 'git', 'add', '.'); sh(dir, 'git', 'commit', '-m', 'feat: next release feature');
  sh(dir, 'git', 'push', 'origin', 'develop');
  sh(dir, 'git', 'checkout', '-B', 'main', 'refs/remotes/origin/main');
  sh(dir, 'git', 'merge', '--no-ff', 'develop', '-m', 'Merge develop into main');
  const result = JSON.parse(sh(dir, process.execPath, 'scripts/release-automation.js', 'plan', '--json'));
  assert.equal(result.version, '1.5.0');
  assert.deepEqual(result.commits.map(c => c.subject), ['feat: next release feature']);
});

test('release in-flight develop commits survive the next merge', t => {
  const state = fixture(t, {moving: true}), {dir} = state;
  mergeVersionPR(state); finish(state);
  sh(dir, 'git', 'fetch', 'origin');
  sh(dir, 'git', 'checkout', '-B', 'develop', 'refs/remotes/origin/develop');
  text(dir, 'next.txt', 'a further fix\n');
  sh(dir, 'git', 'add', '.'); sh(dir, 'git', 'commit', '-m', 'fix: further changes');
  sh(dir, 'git', 'push', 'origin', 'develop');
  sh(dir, 'git', 'checkout', '-B', 'main', 'refs/remotes/origin/main');
  sh(dir, 'git', 'merge', '--no-ff', 'develop', '-m', 'Merge develop into main');
  const result = JSON.parse(sh(dir, process.execPath, 'scripts/release-automation.js', 'plan', '--json'));
  assert.equal(result.version, '1.5.0');
  assert.ok(result.commits.some(c => c.subject === 'feat: next changes while release builds'));
});

test('conflicting future main merge must prevent develop update', t => {
  const state = fixture(t, {moving: true, minimalManifest: true});
  mergeVersionPR(state);
  const before = remoteRef(state.dir, 'develop');
  assert.throws(() => finish(state), /Command failed/);
  assert.equal(remoteRef(state.dir, 'develop'), before);
});

test('version PR verifier allows only the exact tagged metadata snapshot from the release bot', t => {
  const state = fixture(t), {dir, merge, snapshot} = state;
  prepare(state);
  const check = env => execFileSync(process.execPath, ['scripts/verify-version-pr.js'], {
    cwd: dir, encoding: 'utf8', env: {
      ...process.env,
      GITHUB_REPOSITORY: 'owner/repo', PR_SOURCE: 'release/version-v1.4.1',
      PR_HEAD_SHA: snapshot, PR_BASE_SHA: merge, PR_AUTHOR: 'github-actions[bot]', ...env
    }
  }).trim();
  assert.match(check(), /Trusted v1\.4\.1/);
  assert.throws(() => check({PR_HEAD_SHA: merge}), /Command failed/);
  assert.throws(() => check({PR_AUTHOR: 'stranger'}), /Command failed/);
  assert.throws(() => check({PR_SOURCE: 'dependabot/npm-update'}), /Command failed/);
});
