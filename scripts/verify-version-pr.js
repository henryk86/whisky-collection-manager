#!/usr/bin/env node
/**
 * Check that a main-targeted version PR is exactly the tagged, metadata-only
 * release.
 */
import {execFileSync} from 'node:child_process';
import {releaseRefs, RELEASE_METADATA} from './sync-release-branches.js';
const git = (...args) => execFileSync('git', args, {encoding: 'utf8'}).trim();

export function verifyVersionPR({branch, head, base, author}) {
  const match = /^release\/version-(v\d+\.\d+\.\d+)$/.exec(branch || '');
  if (!match || !['github-actions[bot]', process.env
    .GITHUB_REPOSITORY?.split('/')[0]].includes(author))
    throw new Error('Only the release bot or repository owner may open version PRs');
  const tag = match[1], {snapshot} = releaseRefs({tag, merge: base});
  if (head !== snapshot) throw new Error('Version PR head must be the immutable tagged snapshot');
  const changed = git('diff', '--name-only', base, snapshot).split('\n')
    .filter(Boolean);
  if (!changed.length || changed.some(file => !RELEASE_METADATA.includes(file)))
    throw new Error(`Version PR contains unexpected files: ${changed.join(', ')}`);
  return {tag, changed};
}
if (process.argv[1]?.endsWith('verify-version-pr.js')) {
  try {
    const result = verifyVersionPR({
      branch: process.env.PR_SOURCE, head: process.env.PR_HEAD_SHA,
      base: process.env.PR_BASE_SHA, author: process.env.PR_AUTHOR,
    });
    console.log(`Trusted ${result.tag} version PR: ${result.changed
      .join(', ')}`);
  } catch (e) {console.error(e.message); process.exitCode = 1;}
}
