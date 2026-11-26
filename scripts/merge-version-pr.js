#!/usr/bin/env node
/** Merge only the immutable version PR; branch protection is never bypassed. */
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {prepareSyncPR} from './sync-release-branches.js';
/**
 * Executes the GitHub CLI without interactive input.
 * @param {...string} args GitHub CLI arguments.
 * @return {string} Trimmed standard output.
 */
const gh = (...args) => execFileSync('gh', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();

/**
 * Delays the next polling attempt.
 * @param {number} ms Delay in milliseconds.
 * @return {Promise<void>} Resolves when the timer fires.
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validates version pr for merge version pr.
 *
 * @param {*} pr Pull-request metadata returned by the GitHub CLI.
 * @param {string} branch Expected release-version branch name.
 * @param {string} snapshot Expected immutable head commit SHA.
 */
export function assertVersionPR(pr, branch, snapshot) {
  if (pr?.baseRefName !== 'main' || pr.headRefName !== branch || pr.headRefOid !== snapshot ||
    !['OPEN', 'MERGED'].includes(pr.state))
    throw new Error('Existing version PR does not match the approved release snapshot');
}

/**
 * Verifies and merges the workflow-generated version pull request.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Promise<(!Object)>} Release tag and branch, with a flag indicating a completed or previously merged PR.
 */
export async function mergeVersionPR({tag, merge, repo = process.env.GITHUB_REPOSITORY}) {
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('GITHUB_REPOSITORY must be set');
  if (!process.env.GH_TOKEN) throw new Error('GH_TOKEN required for protected main PR');
  const {branch, snapshot, alreadyMerged} = prepareSyncPR({tag, merge});
  if (alreadyMerged) return {tag, branch, alreadyMerged: true};
  let pr;
  try {
    pr = JSON.parse(gh('pr', 'view', branch, '--repo', repo, '--json', 'number,state,baseRefName,headRefName,headRefOid'));
  }
  catch {
    gh(
      'pr',
      'create',
      '--repo',
      repo,
      '--base',
      'main',
      '--head',
      branch,
      '--title',
      `chore(release): synchronize ${tag}`,
      '--body',
      `Automated metadata-only synchronization from the verified tag ${tag}. No application code changes.`
    );
    pr = JSON.parse(gh('pr', 'view', branch, '--repo', repo, '--json', 'number,state,baseRefName,headRefName,headRefOid'));
  }
  assertVersionPR(pr, branch, snapshot);
  if (pr.state === 'MERGED') return {tag, branch, alreadyMerged: true};
  try {gh('pr', 'merge', String(pr.number), '--repo', repo, '--merge');}
  catch {
    // If required checks are pending, queue GitHub's normal auto-merge.
    // This requires repository auto-merge enabled; never use --admin.
    gh('pr', 'merge', String(pr.number), '--repo', repo, '--auto', '--merge');
  }
  for (let attempt = 0; attempt < 90; attempt++) {
    const state = JSON.parse(gh('pr', 'view', String(pr.number), '--repo', repo, '--json', 'state,mergedAt'));
    if (state.state === 'MERGED' && state.mergedAt) return {tag, branch, merged: true};
    if (state.state === 'CLOSED') throw new Error('Version PR was closed without merging');
    await sleep(10000);
  }
  throw new Error(
    'Version PR not yet merged after 15 minutes. Check required status checks and re-run the failed publish job.');
}
const main = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) mergeVersionPR({tag: process.argv[2], merge: process.argv[3]}).then(data => console.log(JSON.stringify(data)))
  .catch(error => {console.error(error.message); process.exitCode = 1;});
