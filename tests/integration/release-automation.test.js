import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {classifyCommit, analyzeCommits, parseGitLog, notesForPlan} from '../../scripts/release-automation.js';

/**
 * Normalizes the run text for subsequent processing.
 *
 * @param {*} cwd Current working directory for path resolution.
 * @param {*} cmd Value used by this operation.
 * @param {!Array<*>} args Arguments forwarded to the operation.
 * @return {*} Result computed from the supplied inputs.
 */
const run = (cwd, cmd, ...args) =>
  execFileSync(cmd, args, {cwd, encoding: 'utf8'}).trim();

/**
 * Writes write data to the local filesystem.
 *
 * @param {*} dir Directory containing the affected files.
 * @param {*} name Environment variable or setting name.
 * @param {*} data Input data to process.
 */
const write = (dir, name, data) => {
  const file =
    path.join(dir, name); fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, data);
};

/**
 * Serializes fixture data to JSON.
 *
 * @param {*} t Temporary or input value for the calculation.
 * @return {*} Serialized JSON text.
 */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-semrel-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  run(dir, 'git', 'init', '-b', 'main');
  run(dir, 'git', 'config', 'user.name', 'Release Tester');
  run(dir, 'git', 'config', 'user.email', 'tester@example.invalid');
  write(
    dir,
    'package.json',
    JSON.stringify({type: 'module', version: '1.4.0'}) + '\n'
  );
  write(
    dir,
    'package-lock.json',
    JSON.stringify({version: '1.4.0', packages: {'': {version: '1.4.0'}}}) + '\n'
  );
  write(dir, 'README.md', '# Whisky Collection Manager v1.4.0\n');
  write(
    dir,
    'CHANGELOG.md',
    '# Changelog\n\n## 1.4.0 - 2026-11-16\n\n- Baseline\n'
  );
  write(
    dir,
    'docs/TESTSTATUS.md',
    '# Teststatus - Whisky Collection Manager v1.4.0\n\n| `npm test` | **532/532 bestanden** | x |\n'
  );
  fs.mkdirSync(path.join(dir, 'scripts'), {recursive: true});
  for (const script of ['release-version.js', 'release-manifest.js', 'release-automation.js'])
    fs.copyFileSync(
      path.join('scripts', script),
      path.join(dir, 'scripts', script)
    );
  run(dir, 'git', 'add', '.'); run(dir, 'git', 'commit', '-m', 'chore: start release test fixture');
  run(dir, 'git', 'tag', 'v1.4.0');
  run(dir, 'git', 'branch', 'develop');
  return dir;
}

/**
 * Performs the commit lifecycle action.
 *
 * @param {*} dir Directory containing the affected files.
 * @param {*} text Text to process.
 * @param {string=} file File resource to read, write or inspect.
 */
function commit(dir, text, file = 'feature.txt') {
  write(dir, file, `${Math.random().toString(36).slice(2)}\n`);
  run(dir, 'git', 'add', '--', file);
  run(dir, 'git', 'commit', '-m', text);
}

/**
 * Updates the merge state for its caller.
 *
 * @param {*} dir Directory containing the affected files.
 */
function merge(dir) {
  run(dir, 'git', 'checkout', 'main'); run(
    dir,
    'git',
    'merge',
    '--no-ff',
    'develop',
    '-m',
    'Merge develop into main'
  );
}

/**
 * Parses plan data from JSON input.
 *
 * @param {*} dir Directory containing the affected files.
 * @return {*} Parsed JSON value.
 */
function plan(dir) {
  return JSON.parse(run(
    dir,
    process.execPath,
    'scripts/release-automation.js',
    'plan',
    '--json'
  ));
}

/**
 * Derives the snapshot result from the supplied values.
 *
 * @param {*} dir Directory containing the affected files.
 * @return {!Object} Structured result assembled from the input data.
 */
function snapshot(dir) {
  const out =
    path.join(dir, '..', `${path.basename(dir)}-notes`); fs.mkdirSync(out, {recursive: true}); return {
      out,
      result: run(
        dir,
        process.execPath,
        'scripts/release-automation.js',
        'snapshot',
        '--output',
        out
      ),
    };
}

test(
  'Conventional Commits decide major > minor > patch; maintenance alone is one patch',
  () => {
    assert.equal(
      classifyCommit('fix(warehouse): Umlagern korrigieren').level,
      'patch'
    );
    assert.equal(classifyCommit('feat: tasting flights').level, 'minor');
    assert.equal(classifyCommit('feat!: incompatible API').level, 'major');
    assert.equal(
      classifyCommit('refactor(api): optimize storage').level,
      'none'
    );
    assert.equal(
      classifyCommit(
        'docs: improve handbook',
        'BREAKING CHANGE: config changed'
      ).level,
      'major'
    );
    assert.equal(
      analyzeCommits([
        {subject: 'docs: handbook', sha: '1'},
        {subject: 'test: coverage', sha: '2'},
      ]).level,
      'patch'
    );
    assert.equal(
      analyzeCommits([
        {subject: 'fix: bug', sha: '1'},
        {subject: 'feat: new page', sha: '2'},
      ]).level,
      'minor'
    );
    assert.throws(() => classifyCommit('Update code'), /Conventional-Commit/);
    assert.throws(() => classifyCommit('feat: '), /Conventional-Commit/);
    assert.deepEqual(parseGitLog('abc\0fix: x\0body\0\ndef\0feat: y\0\0\n'), [
      {sha: 'abc', subject: 'fix: x', body: 'body'},
      {sha: 'def', subject: 'feat: y', body: ''},
    ]);
    assert.match(notesForPlan({
      tag: 'v1.5.0', previousTag: 'v1.4.0', commits: [
        {...classifyCommit('feat(ui): new page'), sha: 'abcdef01234'}],
    }), /feat\(ui\): new page/);
  }
);

test(
  'merge produces a versioned off-branch snapshot; next merge increments from tag, retry reuses it',
  t => {
    const dir = fixture(t);
    run(dir, 'git', 'checkout', 'develop');
    commit(dir, 'fix(warehouse): change shelf');
    commit(dir, 'feat(tasting): add option', 'tasting.txt');
    merge(dir);
    const mergeSha = run(dir, 'git', 'rev-parse', 'HEAD');
    const first = plan(dir);
    assert.equal(first.version, '1.5.0');
    assert.equal(first.level, 'minor');
    assert.equal(first.commits.length, 2);
    snapshot(dir);
    const tagSha = run(dir, 'git', 'rev-parse', 'v1.5.0^{commit}');
    assert.notEqual(tagSha, mergeSha);
    assert.equal(run(dir, 'git', 'rev-parse', 'v1.5.0^'), mergeSha);
    assert.equal(run(dir, 'git', 'rev-parse', 'main'), mergeSha);
    assert.equal(run(dir, 'git', 'rev-parse', 'develop') !== mergeSha, true);
    assert.equal(
      JSON.parse(run(dir, 'git', 'show', 'v1.5.0:package.json')).version,
      '1.5.0'
    );
    assert.equal(
      JSON.parse(run(dir, 'git', 'show', 'main:package.json')).version,
      '1.4.0'
    );
    assert.match(
      run(dir, 'git', 'show', 'v1.5.0:CHANGELOG.md'),
      /feat\(tasting\): add option/
    );
    // The generated, tagged document must meet the same reporting contract
    // as docs/TESTSTATUS.md on develop, even before snapshot-specific tests
    // run.
    const releaseStatus = run(dir, 'git', 'show', 'v1.5.0:docs/TESTSTATUS.md');
    assert.match(releaseStatus, /npm test[^\n]*\*\*Noch nicht ausgeführt\*\*/);
    assert.match(
      releaseStatus,
      /npm run test:browser[^\n]*\*\*Nicht lokal ausgeführt\*\*/
    );
    assert.match(releaseStatus, /CHANGELOG\.md/);
    run(dir, process.execPath, 'scripts/release-version.js', 'check');
    run(dir, 'git', 'checkout', 'main');
    assert.deepEqual(
      plan(dir),
      {
        head: mergeSha,
        version: '1.5.0',
        tag: 'v1.5.0',
        previousTag: null,
        commits: [],
        level: 'reuse',
        reuse: true,
        snapshot: tagSha,
      }
    );
    snapshot(dir); // no v1.5.1, no new branch commits
    assert.equal(run(dir, 'git', 'rev-parse', 'main'), mergeSha);
    run(dir, 'git', 'checkout', 'develop');
    commit(dir, 'fix: repair import', 'import.txt');
    merge(dir);
    assert.equal(plan(dir).version, '1.5.1');
    snapshot(dir);
    assert.equal(
      run(dir, 'git', 'rev-parse', 'v1.5.1^'),
      run(dir, 'git', 'rev-parse', 'main')
    );
    const history = run(dir, 'git', 'show', 'v1.5.1:CHANGELOG.md');
    assert.match(history, /## 1\.5\.1/);
    assert.match(history, /## 1\.5\.0/);
    assert.throws(
      () => run(dir, 'git', 'show', 'v1.5.1:docs/TESTHISTORIE.md'),
      /Command failed/
    );
  }
);

test(
  'nonconventional commits fail instead of silently publishing an arbitrary version',
  t => {
    const dir = fixture(t);
    run(dir, 'git', 'checkout', 'develop');
    commit(dir, 'plain commit message');
    assert.throws(
      () => run(
        dir,
        process.execPath,
        'scripts/release-automation.js',
        'validate',
        '--range',
        'main..develop'
      ),
      /Command failed/
    );
    merge(dir);
    assert.throws(() => plan(dir), /Command failed/);
  }
);

test(
  'a main fast-forward or direct push is not a permitted release trigger',
  t => {
    const dir = fixture(t);
    commit(dir, 'fix: direct main edit');
    assert.throws(() => plan(dir), /Command failed/);
  }
);

/**
 * Migration from the former per-commit versioning scheme. In real projects
 * develop may already say 1.4.0 while main still says 1.3.3.
 *
 * @param {*} t T used by this operation.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {*} Serialized JSON text.
 */
function legacyFixture(t, {tagCurrent = false, historicalSubjects = []} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-semrel-legacy-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  run(dir, 'git', 'init', '-b', 'main');
  run(dir, 'git', 'config', 'user.name', 'Release Tester');
  run(dir, 'git', 'config', 'user.email', 'tester@example.invalid');
  write(
    dir,
    'package.json',
    JSON.stringify({type: 'module', version: '1.3.3'}) + '\n'
  );
  write(
    dir,
    'package-lock.json',
    JSON.stringify({version: '1.3.3', packages: {'': {version: '1.3.3'}}}) + '\n'
  );
  write(dir, 'README.md', '# Whisky Collection Manager v1.3.3\n');
  write(
    dir,
    'CHANGELOG.md',
    '# Changelog\n\n## 1.3.3 - 2026-11-15\n\n- Historical release\n'
  );
  write(
    dir,
    'docs/TESTSTATUS.md',
    '# Teststatus - Whisky Collection Manager v1.3.3\n'
  );
  fs.mkdirSync(path.join(dir, 'scripts'), {recursive: true});
  for (const script of ['release-version.js', 'release-manifest.js'])
    fs.copyFileSync(
      path.join('scripts', script),
      path.join(dir, 'scripts', script)
    );
  run(dir, 'git', 'add', '.'); run(
    dir,
    'git',
    'commit',
    '-m',
    'chore: last pre-automation main release'
  );
  run(dir, 'git', 'tag', 'v1.3.3');
  run(dir, 'git', 'branch', 'develop'); run(dir, 'git', 'checkout', 'develop');
  // This manual version update occurred BEFORE installing the new release
  // workflow.
  write(
    dir,
    'package.json',
    JSON.stringify({type: 'module', version: '1.4.0'}) + '\n'
  );
  write(
    dir,
    'package-lock.json',
    JSON.stringify({version: '1.4.0', packages: {'': {version: '1.4.0'}}}) + '\n'
  );
  write(dir, 'README.md', '# Whisky Collection Manager v1.4.0\n');
  write(
    dir,
    'CHANGELOG.md',
    '# Changelog\n\n## 1.4.0 - 2026-11-16\n\n- Last manual release\n\n## 1.3.3 - 2026-11-15\n\n- Historical release\n'
  );
  write(
    dir,
    'docs/TESTSTATUS.md',
    '# Teststatus - Whisky Collection Manager v1.4.0\n'
  );
  run(dir, 'git', 'add', '.'); run(
    dir,
    'git',
    'commit',
    '-m',
    'chore: complete existing release v1.4.0'
  );
  if (tagCurrent) run(dir, 'git', 'tag', 'v1.4.0');
  for (const subject of historicalSubjects) commit(dir, subject, `legacy-${historicalSubjects.indexOf(subject)}.txt`);
  fs.copyFileSync(
    'scripts/release-automation.js',
    path.join(dir, 'scripts/release-automation.js')
  );
  run(dir, 'git', 'add', '.'); run(
    dir,
    'git',
    'commit',
    '-m',
    'chore: adopt automatic release workflow'
  );
  return dir;
}

test(
  'first automation merge accepts pre-existing higher develop version without a v1.4.0 tag',
  t => {
    const dir = legacyFixture(t);
    commit(dir, 'fix: repair warehouse relocation');
    merge(dir);
    const first = plan(dir);
    assert.equal(first.legacyTransition, true);
    assert.equal(first.version, '1.4.1'); // never downgrade to v1.3.4
    snapshot(dir);
    const changes = run(dir, 'git', 'show', 'v1.4.1:CHANGELOG.md');
    assert.match(changes, /## 1\.4\.0/); // branch history retained
    assert.match(changes, /## 1\.3\.3/);
    assert.equal(
      run(dir, 'git', 'show', 'main:package.json').includes('1.3.3'),
      false
    );
    assert.equal(
      JSON.parse(run(dir, 'git', 'show', 'main:package.json')).version,
      '1.4.0'
    );
    run(dir, 'git', 'checkout', 'develop');
    commit(dir, 'fix: second patch', 'second.txt');
    merge(dir);
    assert.equal(plan(dir).version, '1.4.2');
  }
);

test(
  'first automation merge with the existing v1.4.0 tag starts at v1.4.1',
  t => {
    const dir = legacyFixture(t, {tagCurrent: true});
    commit(dir, 'fix: release automation fix');
    merge(dir);
    assert.equal(plan(dir).version, '1.4.1');
  }
);

test(
  'first merge exempts historical nonconventional commits and previously released features only',
  t => {
    const dir = legacyFixture(t, {
      historicalSubjects: [
        'Refactor unit tests to remove file system dependencies and CSS assertions',
        'feat: already part of manually versioned v1.4.0',
      ],
    });
    commit(dir, 'fix(ci): correct transition handling');
    merge(dir);
    const preview = plan(dir);
    assert.equal(preview.legacyTransition, true);
    assert.equal(preview.version, '1.4.1'); // historical feat does not cause 1.5.0
    assert.equal(preview.level, 'patch');
    assert.equal(preview.ignoredLegacyCommits, 3); // manual v1.4.0 plus two historical changes
    assert.deepEqual(preview.commits.map(c => c.subject), [
      'fix(ci): correct transition handling',
      'chore: adopt automatic release workflow',
    ]);
    snapshot(dir);
    assert.match(run(dir, 'git', 'show', 'v1.4.1:CHANGELOG.md'), /## 1\.4\.0/);
    assert.match(
      run(dir, 'git', 'show', 'v1.4.1:CHANGELOG.md'),
      /fix\(ci\): correct transition handling/
    );
    run(dir, 'git', 'checkout', 'develop');
    commit(dir, 'fix(ci): another valid patch', 'second.txt');
    merge(dir);
    assert.equal(plan(dir).version, '1.4.2');
  }
);

test(
  'the same first merge rejects commits without a type AFTER automation adoption',
  t => {
    const dir = legacyFixture(t, {
      historicalSubjects: [
        'Refactor unit tests to remove file system dependencies and CSS assertions',
      ],
    });
    commit(dir, 'new commit without prefix');
    merge(dir);
    assert.throws(() => plan(dir), /Command failed/);
  }
);

test(
  'adoption cutover works even if main and develop already share the same version',
  t => {
    const dir = fixture(t);
    run(dir, 'git', 'checkout', 'develop');
    // Simulate main without the automation script, but keep the checked-in
    // package version equal to develop so legacyTransition is false.
    run(dir, 'git', 'checkout', 'main');
    run(dir, 'git', 'rm', 'scripts/release-automation.js');
    run(
      dir,
      'git',
      'commit',
      '-m',
      'chore: simulate old main before automation'
    );
    run(dir, 'git', 'tag', 'v1.4.0-old-main');
    run(dir, 'git', 'checkout', 'develop');
    // Develop already has the automation script in this fixture. Merge history
    // is explicitly tested by creating a fresh feature branch from old main.
    run(dir, 'git', 'checkout', '-b', 'transition', 'main');
    commit(dir, 'Refactor unit tests without Conventional Commits');
    fs.copyFileSync(
      'scripts/release-automation.js',
      path.join(dir, 'scripts/release-automation.js')
    );
    run(dir, 'git', 'add', '.');
    run(dir, 'git', 'commit', '-m', 'chore: introduce release automation');
    commit(dir, 'fix: post-cutover change', 'post.txt');
    run(dir, 'git', 'checkout', 'main');
    run(
      dir,
      'git',
      'merge',
      '--no-ff',
      'transition',
      '-m',
      'Merge develop into main'
    );
    const result = plan(dir);
    assert.equal(result.legacyTransition, false);
    assert.equal(result.level, 'patch');
    assert.equal(result.ignoredLegacyCommits, 1);
    // The main-only commit removing the automation script is not introduced
    // by the develop-side merge; it must never be classified or counted.
    assert.deepEqual(result.commits.map(c => c.subject), [
      'fix: post-cutover change',
      'chore: introduce release automation',
    ]);
    assert.equal(result.version, '1.4.1');
  }
);

test(
  'after automation installation a manual version bump on develop is rejected',
  t => {
    const dir = fixture(t);
    run(dir, 'git', 'checkout', 'develop');
    write(
      dir,
      'package.json',
      JSON.stringify({type: 'module', version: '1.5.0'}) + '\n'
    );
    run(dir, 'git', 'add', '.'); run(dir, 'git', 'commit', '-m', 'feat: attempt manual version bump');
    merge(dir);
    assert.throws(() => plan(dir), /Command failed/);
  }
);

test(
  'free-account release gate accepts only the matching merged same-repository PR',
  async () => {
    const {isApprovedReleaseMerge, verifyMergedPRs} =
      await import('../../scripts/verify-merged-pr.js');
    const sha = 'a'.repeat(40), repo = 'owner/whisky-collection-manager';
    const pr = {
      merged_at: '2026-11-16T12:00:00Z',
      merge_commit_sha: sha,
      base: {ref: 'main', repo: {full_name: repo}},
      head: {ref: 'develop', repo: {full_name: repo}},
    };
    assert.equal(isApprovedReleaseMerge(pr, sha, repo), true);
    assert.equal(verifyMergedPRs([pr], sha, repo), true);
    for (const altered of [
      {...pr, merged_at: null},
      {...pr, merge_commit_sha: 'b'.repeat(40)},
      {...pr, base: {...pr.base, ref: 'develop'}},
      {...pr, head: {...pr.head, ref: 'feature'}},
      {...pr, head: {...pr.head, repo: {full_name: 'fork/repository'}}},
      {...pr, base: {...pr.base, repo: {full_name: 'fork/repository'}}},
    ]) {
      assert.equal(isApprovedReleaseMerge(altered, sha, repo), false);
      assert.throws(
        () => verifyMergedPRs([altered], sha, repo),
        /Release blocked/
      );
    }
    assert.throws(() => verifyMergedPRs([], sha, repo), /Release blocked/);
  }
);

test(
  'main release gate recognizes approved version PRs without starting a second release',
  async () => {
    const {verifyMainMerge} = await import('../../scripts/verify-merged-pr.js');
    const sha = 'a'.repeat(40), repo = 'owner/repo';
    const version = {
      merged_at: '2026-11-16T20:00:00Z',
      merge_commit_sha: sha,
      title: 'chore(release): synchronize v1.4.1',
      user: {login: 'github-actions[bot]'},
      head: {ref: 'release/version-v1.4.1', repo: {full_name: repo}},
      base: {ref: 'main', repo: {full_name: repo}},
    };
    assert.equal(verifyMainMerge([version], sha, repo), 'version-sync');
    const release = {
      ...version, title: 'Merge develop into main',
      head: {ref: 'develop', repo: {full_name: repo}},
    };
    assert.equal(verifyMainMerge([release], sha, repo), 'release');
    assert.throws(() => verifyMainMerge(
      [{...version, head: {...version.head, ref: 'dependabot/npm'}}],
      sha,
      repo
    ));
    assert.throws(() => verifyMainMerge(
      [{...version, user: {login: 'malicious-user'}}],
      sha,
      repo
    ));
  }
);

test(
  'version PR API merge helper rejects swapped heads and foreign targets',
  async () => {
    const {assertVersionPR} = await import('../../scripts/merge-version-pr.js');
    const pr = {
      number: 42,
      state: 'OPEN',
      baseRefName: 'main',
      headRefName: 'release/version-v1.4.1',
      headRefOid: 'abc',
    };
    assert.doesNotThrow(() => assertVersionPR(pr, pr.headRefName, 'abc'));
    assert.throws(() => assertVersionPR({...pr, headRefOid: 'def'}, pr.headRefName, 'abc'));
    assert.throws(() => assertVersionPR({...pr, baseRefName: 'develop'}, pr.headRefName, 'abc'));
    assert.throws(() => assertVersionPR(
      {...pr, headRefName: 'dependabot/npm'},
      pr.headRefName,
      'abc'
    ));
  }
);
