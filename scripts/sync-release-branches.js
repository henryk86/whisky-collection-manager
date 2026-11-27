#!/usr/bin/env node
/** Prepare a protected-main release PR and synchronize develop only after
 * that PR merges.
 * No direct writes to protected main and no force pushes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {writeSourceManifest} from './release-manifest.js';
import {verifyReleaseMetadata} from './release-version.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RELEASE_METADATA = [
  'package.json', 'package-lock.json', 'README.md', 'README.en.md', 'CHANGELOG.md',
  'docs/TESTSTATUS.md', 'wcm-source-manifest.json',
];
/**
 * Runs a Git command in the release repository.
 * @param {...string} args Git arguments.
 * @return {string} Trimmed standard output.
 */
const git = (...args) => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();

/**
 * Runs Git in the supplied working directory.
 * @param {string} cwd Working directory.
 * @param {...string} args Git arguments.
 * @return {string} Trimmed standard output.
 */
const gitAt = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();

/**
 * Reads direct parent hashes for the revision.
 * @param {string} rev Commit revision.
 * @return {string[]} Parent commit hashes.
 */
const parents = rev => git('rev-list', '--parents', '-n', '1', rev).split(/\s+/).slice(1);

/**
 * Tests whether one revision is reachable from another.
 * @param {string} older Potential ancestor.
 * @param {string} newer Descendant revision.
 * @return {boolean} Git ancestry result.
 */
const ancestor = (older, newer) => {
  try {git('merge-base', '--is-ancestor', older, newer); return true;}
  catch {return false;}
};

/**
 * Reads the package version from a particular Git revision.
 * @param {string} ref Revision containing package.json.
 * @return {string} Version recorded in that revision.
 */
const versionAt = ref => JSON.parse(git('show', `${ref}:package.json`)).version;

/**
 * Reject stale, moved or unrelated refs before attempting any remote update.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Release snapshot commit and develop parent at the release merge.
 */
export function releaseRefs({tag, merge}) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag))
    throw new Error(`Invalid release tag: ${tag}`);
  if (!/^[a-f0-9]{40}$/.test(merge)) throw new Error('Invalid approved merge SHA');
  const snapshot = git('rev-parse', `${tag}^{commit}`);
  if (parents(snapshot).length !== 1 || parents(snapshot)[0] !== merge ||
    git('log', '-1', '--format=%s', snapshot) !== `WCM Release Snapshot ${tag}`)
    throw new Error('Tag does not reference the approved versioned release snapshot');
  if (versionAt(snapshot) !== tag.slice(1)) throw new Error('Tag and application version differ');
  if (parents(merge).length !== 2) throw new Error('Release origin must be a two-parent merge');
  return {snapshot, developAtMerge: parents(merge)[1]};
}

/**
 * Writes prepare diverged develop data to the local filesystem.
 *
 * @param {!Object} options Options controlling the operation.
 * @return {*} Commit ID of the prepared develop synchronization result.
 */
function prepareDivergedDevelop({tip, base, snapshot, tag}) {
  if (!ancestor(base, tip)) throw new Error('develop was rewritten after the approved merge; refusing synchronization');
  // A change to a release metadata file after approval must not be discarded.
  const changed = git('diff', '--name-only', `${base}..${tip}`, '--', ...RELEASE_METADATA).split('\n').filter(Boolean);
  if (changed.length) throw new Error(`develop changed release metadata since the merge: ${changed.join(', ')}. Manual resolution required.`);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-release-branch-'));
  let attached = false;
  try {
    git('worktree', 'add', '--detach', temp, tip);
    attached = true;
    for (const file of RELEASE_METADATA) {
      fs.mkdirSync(path.dirname(path.join(temp, file)), {recursive: true});
      fs.writeFileSync(path.join(temp, file), execFileSync('git', ['show', `${snapshot}:${file}`], {cwd: ROOT}));
    }
    // New application code on develop must receive a matching, freshly
    // computed source manifest rather than the snapshot's old hashes.
    writeSourceManifest(temp);
    verifyReleaseMetadata(temp);
    gitAt(temp, 'add', '--', ...RELEASE_METADATA);
    if (gitAt(temp, 'diff', '--cached', '--name-only')) {
      gitAt(
        temp,
        '-c',
        'user.name=github-actions[bot]',
        '-c',
        'user.email=41898282+github-actions[bot]@users.noreply.github.com',
        'commit',
        '-m',
        `chore(release): synchronize ${tag} on develop`
      );
    }
    return gitAt(temp, 'rev-parse', 'HEAD');
  } finally {
    if (attached) git('worktree', 'remove', '--force', temp);
    fs.rmSync(temp, {recursive: true, force: true});
  }
}

/**
 * A version PR can only contain the tested, immutable release snapshot.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Synchronization branch, release references and already-merged status.
 */
export function prepareSyncPR({tag, merge}) {
  const {snapshot} = releaseRefs({tag, merge});
  git('fetch', '--no-tags', 'origin',
    '+refs/heads/main:refs/remotes/origin/main',
    '+refs/heads/develop:refs/remotes/origin/develop');
  const main = git('rev-parse', 'refs/remotes/origin/main');
  const branch = `release/version-${tag}`;
  if (main !== merge) {
    if (isCompletedMainSync({tag, merge, main, snapshot}))
      return {tag, branch, main, snapshot, alreadyMerged: true};
    throw new Error('main changed after the approved develop merge; refusing version PR.');
  }
  const remote = git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`).split(/\s+/)[0];
  if (remote && remote !== snapshot) throw new Error('Version PR branch exists but points at another commit');
  if (!remote) git('push', 'origin', `${snapshot}:refs/heads/${branch}`);
  return {tag, branch, main, snapshot, alreadyMerged: false};
}

/**
 * Validate that GitHub merged the exact tagged release commit through a PR.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {boolean} True when main already contains the expected release synchronization merge.
 */
function isCompletedMainSync({tag, merge, main, snapshot}) {
  const mainParents = parents(main);
  return mainParents.length === 2 && mainParents[0] === merge && mainParents[1] === snapshot
    && versionAt(main) === tag.slice(1);
}

/**
 * After the protected-main PR succeeds, update only the unprotected develop
 * ref.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Final main and develop references and whether develop was unchanged.
 */
export function finishSync({tag, merge}) {
  const {snapshot, developAtMerge} = releaseRefs({tag, merge});
  git('fetch', '--no-tags', 'origin',
    '+refs/heads/main:refs/remotes/origin/main',
    '+refs/heads/develop:refs/remotes/origin/develop');
  const main = git('rev-parse', 'refs/remotes/origin/main');
  const develop = git('rev-parse', 'refs/remotes/origin/develop');
  if (!isCompletedMainSync({tag, merge, main, snapshot}))
    throw new Error('Protected main does not contain the approved version PR merge; refusing develop sync.');
  let target;
  if (ancestor(develop, main)) target = main;
  else if (ancestor(main, develop)) {
    if (versionAt(develop) !== tag.slice(1))
      throw new Error('develop includes main release but reports a different version');
    target = develop;
  } else {
    const subjects = git('log', '--format=%s', `${developAtMerge}..${develop}`).split('\n');
    const already = subjects.includes(`chore(release): synchronize ${tag} on develop`);
    if (already && versionAt(develop) === tag.slice(1)) target = develop;
    else target = prepareDivergedDevelop({
      tip: develop, base: developAtMerge,
      snapshot, tag,
    });
  }
  if (target !== develop && !ancestor(target, main) && !ancestor(main, target)) {
    try {git('merge-tree', '--write-tree', main, target);}
    catch {
      throw new Error('develop synchronization would conflict with the next main merge. Resolve manually.');
    }
  }
  if (target !== develop) git('push', 'origin', `${target}:refs/heads/develop`);
  return {tag, main, develop: target, unchanged: target === develop};
}

const running = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (running) {
  try {
    const [command, ...args] = process.argv.slice(2);
    /**
     * Finds the value of a command-line option in the current arguments.
     * @param {string} name Option name.
     * @return {(string|null|undefined)} Following argument, null when absent, or undefined when no value follows.
     */
    const get = name => {
      const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null;
    };
    const tag = get('--tag'), merge = get('--merge');
    if (!['prepare', 'finish'].includes(command) || !tag || !merge)
      throw new Error('Usage: sync-release-branches.js prepare|finish --tag vX.Y.Z --merge 40_HEX_SHA');
    const result = command === 'prepare' ? prepareSyncPR({tag, merge}) : finishSync({tag, merge});
    console.log(JSON.stringify(result));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
