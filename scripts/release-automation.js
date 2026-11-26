#!/usr/bin/env node
/**
 * Automatic release planning from Conventional Commits; never writes
 * main/develop.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  compareVersions, nextVersion, parseVersion, applyAutomatedRelease,
  verifyReleaseMetadata
} from './release-version.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Runs Git in the release repository.
 * @param {...string} args Git command arguments.
 * @return {string} Trimmed standard output.
 */
const git = (...args) => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
const TYPES = new Set([
  'fix',
  'feat',
  'perf',
  'revert',
  'refactor',
  'docs',
  'test',
  'ci',
  'build',
  'chore',
  'style',
]);
const LABELS = {
  major: 'Inkompatible Aenderungen',
  minor: 'Neue Funktionen',
  patch: 'Fehlerbehebungen und Verbesserungen',
  none: 'Wartung und Dokumentation',
};

/**
 * Classifies a conventional commit by its required release impact.
 *
 * @param {string} subject Conventional Commit subject line.
 * @param {string=} body Request or response body.
 * @return {!Object} Structured result for the caller.
 */
export function classifyCommit(subject, body = '') {
  const match = /^([a-z]+)(?:\(([a-z\d._/-]+)\))?(!)?: (\S.+|\S)$/.exec(subject.trim());
  if (!match || !TYPES.has(match[1])) throw new Error(`Commit ohne gueltigen Conventional-Commit-Typ: ${subject}`);
  const [, type, scope, breaking, description] = match;
  if (description.length > 180) throw new Error(`Commit-Beschreibung zu lang: ${subject}`);
  const isBreaking = Boolean(breaking) || /^BREAKING(?:-| )CHANGE:\s*\S/m.test(body);
  const level = isBreaking ? 'major' : type === 'feat' ? 'minor' : ['fix', 'perf', 'revert'].includes(type) ? 'patch' : 'none';
  return {type, scope: scope || '', description, subject, level};
}

/**
 * Aggregates commit classifications for the release proposal.
 *
 * @param {*} commits Commit records containing subject, body and SHA in the release range.
 * @return {!Object} Structured result for the caller.
 */
export function analyzeCommits(commits) {
  if (!commits.length) throw new Error('Seit dem letzten Release sind keine neuen Commits vorhanden.');
  const parsed = commits.map(commit => ({...classifyCommit(commit.subject, commit.body || ''), sha: commit.sha}));
  const level = parsed.some(c => c.level === 'major') ? 'major' : parsed.some(c => c.level === 'minor') ? 'minor' : 'patch';
  return {level, commits: parsed};
}

/**
 * Parses git log for release automation.
 *
 * @param {string} output NUL-delimited git log output containing SHA, subject and body triples.
 * @return {!Array<!Object>} Resulting list of values.
 */
export function parseGitLog(output) {
  const parts = output.split('\0');
  const commits = [];
  for (let i = 0; i + 2 < parts.length; i += 3) {
    const sha = parts[i].trim(), subject = parts[i + 1].trim(), body = parts[i + 2].trim();
    if (sha) commits.push({sha, subject, body});
  }
  return commits;
}

/**
 * Builds release notes from the approved release plan.
 *
 * @param {*} plan Release plan with the next tag, previous tag and classified commits.
 * @return {string} Markdown release notes grouped from the planned commit range.
 */
export function notesForPlan(plan) {
  const rows = [
    `# ${plan.tag}`,
    '',
    `Automatisch aus den Commits seit ${plan.previousTag || 'dem letzten Versionsstand'} ermittelt.`,
    '',
  ];
  if (plan.ignoredLegacyCommits) rows.push(
    `${plan.ignoredLegacyCommits} historische Commits vor Einfuehrung der Commit-Konvention wurden nicht erneut klassifiziert.`,
    ''
  );
  for (const [level, title] of Object.entries(LABELS)) {
    const subset = plan.commits.filter(c => c.level === level);
    if (!subset.length) continue;
    rows.push(`## ${title}`, '');
    for (const commit of subset) rows.push(`- ${commit.subject.replace(/[\r\n]/g, ' ')} (${commit.sha.slice(0, 7)})`);
    rows.push('');
  }
  return rows.join('\n').trimEnd() + '\n';
}

/**
 * Checks whether a revision resolves to a commit.
 * @param {string} ref Git revision or reference.
 * @return {boolean} Whether Git can resolve the commit.
 */
const gitExists = (ref) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {cwd: ROOT, stdio: 'ignore'}); return true;
  } catch {return false;}
};

/**
 * Checks commit ancestry using Git's merge-base exit status.
 * @param {string} ancestor Potential ancestor revision.
 * @param {string} head Descendant revision to inspect.
 * @return {boolean} Whether the ancestor is reachable from the descendant.
 */
const isAncestor = (ancestor, head) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, head], {cwd: ROOT, stdio: 'ignore'}); return true;
  } catch {return false;}
};

/**
 * Reads the direct parents of a commit in Git's order.
 * @param {string} rev Commit revision.
 * @return {string[]} Parent commit hashes, empty for a root commit.
 */
const commitParents = (rev) => git('rev-list', '--parents', '-n', '1', rev).split(/\s+/).slice(1);

/**
 * Checks if a path exists in the tree of a particular revision.
 * @param {string} ref Git revision.
 * @param {string} name Repository-relative tree path.
 * @return {boolean} Whether the tree contains the path.
 */
const hasFileAt = (ref, name) => {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${name}`], {cwd: ROOT, stdio: 'ignore'}); return true;
  } catch {return false;}
};

/**
 * A release-snapshot tag has an off-branch commit whose sole parent is the
 * main merge.
 *
 * @param {string} head Git revision against which existing release tags are inspected.
 * @return {*} Entries that meet the selection criteria.
 */
function knownReleases(head) {
  const refs = git('tag', '--list', 'v*').split(/\s+/).filter(x => /^v\d+\.\d+\.\d+$/.test(x));
  return refs.flatMap(tag => {
    const sha = git('rev-parse', `${tag}^{commit}`);
    const parents = commitParents(sha);
    const snapshot = git('show', '-s', '--format=%s', sha) === `WCM Release Snapshot ${tag}`;
    const anchor = snapshot ? (parents.length === 1 ? parents[0] : null) : sha;
    return anchor && isAncestor(anchor, head) ? [{tag, version: tag.slice(1), sha, anchor, snapshot}] : [];
  }).sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Computes the next release version and required operations.
 *
 * @param {!Object=} options Optional configuration for the operation.
 * @return {(!Object)} Structured result assembled from the input data.
 */
export function planRelease({head = 'HEAD', requireMerge = true} = {}) {
  const sha = git('rev-parse', head);
  const parents = commitParents(sha);
  if (requireMerge && parents.length !== 2) throw new Error(
    'main darf nur ueber einen Merge-Commit aus develop veroeffentlicht werden (kein Squash oder Direktpush).');
  const releases = knownReleases(sha), latest = releases[0];
  // Re-running the exact push must reuse its snapshot/tag, not bump twice.
  if (latest?.snapshot && latest.anchor === sha) {
    return {
      head: sha,
      version: latest.version,
      tag: latest.tag,
      previousTag: null,
      commits: [],
      level: 'reuse',
      reuse: true,
      snapshot: latest.sha,
    };
  }
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  parseVersion(baseline);
  // The first merge after installing this automation may legitimately bring
  // the last manually maintained version from develop (e.g. 1.4.0 while
  // main still contains 1.3.x). This is NOT a new manual bump. Allow it
  // exactly once, when the automation script did not exist on main before
  // this merge. All later merges must leave the checked-in version alone.
  const beforeVersion = JSON.parse(git('show', `${parents[0]}:package.json`)).version;
  const introducingAutomation =
    !hasFileAt(parents[0], 'scripts/release-automation.js') && hasFileAt(sha, 'scripts/release-automation.js');
  const legacyTransition = baseline !== beforeVersion && introducingAutomation && !releases.some(release => release.snapshot)
    && compareVersions(baseline, beforeVersion) > 0;
  if (baseline !== beforeVersion && !legacyTransition)
    throw new Error('Keine manuellen Versionsspruenge auf develop: das Release wird nach dem main-Merge versioniert.');
  if (legacyTransition) {
    // Only accept the old, fully synchronized release metadata, not an
    // arbitrary package.json version inserted into the merge.
    // Do not run release:check on a development checkout: its source
    // manifest intentionally reflects the previous packaged release.
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
    if (lock.version !== baseline || lock.packages?.['']?.version !== baseline
      || !readme.includes(`Whisky Collection Manager v${baseline}`)
      || !changelog.includes(`## ${baseline} -`))
      throw new Error('Vorhandene Versionsmetadaten beim einmaligen Automatik-Umstieg sind inkonsistent.');
  }
  if (latest && compareVersions(baseline, latest.version) < 0 && !latest.snapshot)
    throw new Error('Entwicklungs-Version ist aelter als der letzte erreichbare Release-Tag.');
  // During the transition, the checked-in 1.4.0 may be newer than the
  // latest reachable tag. Never downgrade it to a 1.3.x release.
  const current = latest && compareVersions(latest.version, baseline) > 0 ? latest.version : baseline;
  // Consider only commits introduced by develop (second merge parent), never
  // main-only commits already present before the merge. --topo-order matters:
  // multiple Git commits can share a timestamp, so date ordering alone makes
  // the historical policy cutover index nondeterministic across machines.
  const from = latest?.anchor || parents[0];
  if (!from || !isAncestor(from, sha) || from === sha) throw new Error('Kein neuer develop-Stand seit dem letzten Release.');
  let commits = parseGitLog(git('log', '--topo-order', '--no-merges', '--format=%H%x00%s%x00%b%x00', `${parents[0]}..${parents[1]}`));
  let ignoredLegacyCommits = 0;
  if (introducingAutomation) {
    // On the first main merge, the range still contains commits created
    // before Conventional Commits were required. Do NOT rewrite history or
    // silently exempt commits made after the automation was introduced.
    // The commit which first adds this script is the exact policy cutover.
    const additions = git(
      'log',
      '--topo-order',
      '--diff-filter=A',
      '--reverse',
      '--format=%H',
      `${parents[0]}..${parents[1]}`,
      '--',
      'scripts/release-automation.js'
    ).split(/\s+/).filter(Boolean);
    if (additions.length !== 1) throw new Error('Der Einfuehrungs-Commit der Release-Automatik ist nicht eindeutig ermittelbar.');
    const cutoverIndex = commits.findIndex(commit => commit.sha === additions[0]);
    if (cutoverIndex < 0) throw new Error('Der Einfuehrungs-Commit muss ein eigener Nicht-Merge-Commit sein.');
    ignoredLegacyCommits = commits.length - cutoverIndex - 1;
    commits = commits.slice(0, cutoverIndex + 1);
  }
  const analysis = analyzeCommits(commits);
  const version = nextVersion(current, analysis.level), tag = `v${version}`;
  if (releases.some(release => compareVersions(version, release.version) <= 0) || gitExists(`refs/tags/${tag}`)) {
    throw new Error(`Tag ${tag} existiert bereits oder ist nicht neuer als die vorhandenen Releases.`);
  }
  return {
    head: sha,
    version,
    tag,
    previousTag: latest?.tag || `v${current}`,
    level: analysis.level,
    commits: analysis.commits,
    reuse: false,
    legacyTransition,
    ignoredLegacyCommits,
  };
}

/**
 * Reads the value following a named command-line option.
 * @param {string[]} args Command-line arguments.
 * @param {string} name Option name to find.
 * @return {(string|undefined)} Following argument, or undefined if absent.
 */
function parseOption(args, name) {
  const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined;
}

/**
 * Validates range against its constraints.
 *
 * @param {string} range Git BASE..HEAD revision range whose commit messages must be valid.
 */
function validateRange(range) {
  if (!range || !/^[a-zA-Z0-9_./~^{}-]+\.\.[a-zA-Z0-9_./~^{}-]+$/.test(range))
    throw new Error('Commit-Validierung erfordert --range BASE..HEAD');
  const commits = parseGitLog(git('log', '--no-merges', '--format=%H%x00%s%x00%b%x00', range));
  for (const commit of commits) classifyCommit(commit.subject, commit.body);
  console.log(`${commits.length} Conventional Commits: OK`);
}

/**
 * Runs the release automation entry point.
 */
function main() {
  const [, , command, ...args] = process.argv;
  if (command === 'validate') {
    validateRange(parseOption(args, '--range'));
    return;
  }
  if (!['plan', 'snapshot'].includes(command)) throw new Error('Usage: release-automation.js validate --range BASE..HEAD | plan [--json] | snapshot --output DIR');
  const plan = planRelease();
  if (command === 'plan') {
    if (args.includes('--json')) console.log(JSON.stringify(plan));
    else console.log(`${plan.tag} (${plan.level}; ${plan.commits.length} Commits${plan.ignoredLegacyCommits ? `, ${plan.ignoredLegacyCommits} historische Commits ausgenommen` : ''}${plan.reuse ? ', Wiederholung' : ''})`);
    return;
  }
  const dir = parseOption(args, '--output');
  if (!dir) throw new Error('snapshot braucht --output DIR');
  fs.mkdirSync(dir, {recursive: true});
  if (!plan.reuse) {
    if (git('status', '--porcelain')) throw new Error('Der Release-Snapshot erfordert einen sauberen Git-Checkout.');
    // Detach before the snapshot commit: a local checkout may still be on main.
    git('checkout', '--detach', plan.head);
    applyAutomatedRelease(plan.version, plan.commits, plan.head, plan.previousTag);
    verifyReleaseMetadata();
    // Never commit to main: the only parent of the release snapshot is the
    // approved main merge.
    git(
      'add',
      '--',
      'package.json',
      'package-lock.json',
      'README.md',
      'CHANGELOG.md',
      'docs/TESTSTATUS.md',
      'wcm-source-manifest.json'
    );
    git(
      '-c',
      'user.name=github-actions[bot]',
      '-c',
      'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit',
      '-m',
      `WCM Release Snapshot ${plan.tag}`
    );
    const snapshot = git('rev-parse', 'HEAD');
    if (commitParents(snapshot).join(' ') !== plan.head) throw new Error('Release-Snapshot hat einen falschen Parent.');
    git('tag', plan.tag, snapshot);
  } else {
    if (git('rev-parse', `${plan.tag}^{commit}`) !== plan.snapshot) throw new Error('Vorhandener Release-Tag ist ungueltig.');
  }
  const notes = plan.reuse
    ? git('show', `${plan.tag}:CHANGELOG.md`).split(/\n## /)[1]?.split(/\n## /)[0] || `${plan.tag} (Wiederholung)`
    : notesForPlan(plan);
  fs.writeFileSync(path.join(dir, 'release-notes.md'), notes.endsWith('\n') ? notes : notes + '\n');
  fs.writeFileSync(path.join(dir, 'release-info.txt'), `tag=${plan.tag}\nversion=${plan.version}\n`);
  console.log(`Release-Snapshot ${plan.tag}: ${git('rev-parse', `${plan.tag}^{commit}`)}`);
}
const isCLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  try {main();} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
