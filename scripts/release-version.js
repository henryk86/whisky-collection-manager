#!/usr/bin/env node
/**
 * One version source for a main merge -> vX.Y.Z release. No network
 * dependencies.
 */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeSourceManifest, verifySourceManifest, FILENAME}
  from './release-manifest.js';

const PENDING_STATUS = 'Noch nicht ausgeführt';
const LOCAL_PENDING_STATUS = 'Nicht lokal ausgeführt';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Reads a UTF-8 file from the release repository.
 * @param {string} name Path relative to the repository root.
 * @return {string} File contents.
 */
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

/**
 * Writes write data to the local filesystem.
 *
 * @param {*} name Environment variable or setting name.
 * @param {*} value Value to process.
 * @return {void} Writes the file synchronously.
 */
const write = (name, value) => fs.writeFileSync(path.join(ROOT, name), value);

/**
 * Parses version for release version.
 *
 * @param {*} value Input value to process.
 * @return {!Array<number>} Numeric major, minor and patch components of the validated version.
 */
export function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value || '');
  if (!match) throw new Error(`Ungueltige Release-Version: ${value} (erwartet X.Y.Z ohne Suffix)`);
  return match.slice(1).map(Number);
}

/**
 * Compares semantic version components in release order.
 *
 * @param {string} left First semantic version to compare.
 * @param {string} right Second semantic version to compare.
 * @return {number} Negative, zero or positive value according to semantic version ordering.
 */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
  }
  return 0;
}

/**
 * Calculates the next semantic version for the chosen release level.
 *
 * @param {*} current Current resource data to update.
 * @param {string} part Version component to increment: major, minor or patch.
 * @return {string} Semantic version after incrementing the selected component and resetting lower components.
 */
export function nextVersion(current, part) {
  const [major, minor, patch] = parseVersion(current);
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  if (part === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error('Verwendung: npm run release:bump -- patch|minor|major "Changelog-Eintrag"');
}

/**
 * Validates release metadata for release version.
 *
 * @param {*=} root Root element or directory.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {!Object} Verified release version and corresponding Git tag.
 */
export function verifyReleaseMetadata(root = ROOT, {allowReadmeMismatch =
  false} = {}) {
  /**
   * Reads release metadata from the repository under verification.
   * @param {string} name Repository-relative filename.
   * @return {string} UTF-8 file contents.
   */
  const content = name => fs.readFileSync(path.join(root, name), 'utf8');
  const pkg = JSON.parse(content('package.json'));
  const version = pkg.version;
  parseVersion(version);
  const lock = JSON.parse(content('package-lock.json'));
  if (lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error('Versionen von package.json und package-lock.json stimmen nicht ueberein.');
  }
  for (const name of ['README.md', 'README.en.md']) {
    if (!allowReadmeMismatch && !content(name).startsWith(`# Whisky Collection Manager v${version}\n`)) {
      throw new Error(`${name} enthaelt nicht die Release-Version im Titel.`);
    }
  }
  if (!content('docs/TESTSTATUS.md').startsWith(`# Teststatus - Whisky Collection Manager v${version}\n`)) {
    throw new Error(`docs/TESTSTATUS.md enthaelt nicht die Release-Version v${version}. Bitte release:bump verwenden.`);
  }
  const changelog = content('CHANGELOG.md');
  const match =
    new RegExp(
      '^# Changelog\\s*\\n\\s*## ([^\\s]+) - (\\d' + '{4}-\\d{2}-\\d{2})\\s*\\n([\\s\\S]*?)(?=\\' + 'n## |$)'
    ).exec(changelog);
  if (!match || match[1] !== version || !/^- /m.test(match[3]) || /BITTE_ERGAENZEN/.test(match[3])) {
    throw new Error(`CHANGELOG.md braucht einen ausgefuellten obersten Eintrag fuer ${version}.`);
  }
  if (compareVersions(version, '1.3.0') >= 0 && !fs.existsSync(path.join(root, FILENAME))) {
    throw new Error(`Quellcode-Manifest ${FILENAME} fehlt im Release v${version}.`);
  }
  if (fs.existsSync(path.join(root, FILENAME))) verifySourceManifest(root);
  return {version, tag: `v${version}`};
}

/**
 * Rejects a release version that does not advance beyond existing semantic-version tags.
 * @param {string} version Proposed semantic version.
 */
function validateFreshVersion(version) {
  const output = execFileSync('git', ['tag', '--list', 'v*'], {cwd: ROOT, encoding: 'utf8'});
  const versions = output.split(/\s+/).filter(tag => /^v\d+\.\d+\.\d+$/.test(tag));
  if (versions.some(tag => compareVersions(version, tag.slice(1)) <= 0)) {
    throw new Error(`v${version} ist nicht neuer als alle bereits vorhandenen Release-Tags. Version auf develop erhoehen.`);
  }
}

/**
 * Updates readme title for release version.
 *
 * @param {string} source Current README Markdown.
 * @param {string} version Semantic version to include in the heading.
 * @return {*} Text assembled for the caller.
 */
export function updateReadmeTitle(source, version) {
  const heading = `# Whisky Collection Manager v${version}`;
  if (new RegExp('^# [^\\n]*(?:Whisky Collection Manager|Whi' + 'sky-Collection-Manager)[^\\n]*$', 'im').test(source)) {
    return source.replace(
      new RegExp('^# [^\\n]*(?:Whisky Collection Manager|Whi' + 'sky-Collection-Manager)[^\\n]*$', 'im'),
      heading
    );
  }
  // Existing README may have a generic or unversioned H1. Do not leave two H1s.
  if (/^# [^\n]+/m.test(source)) return source.replace(/^# [^\n]+/m, heading);
  return `${heading}\n\n${source}`;
}

/**
 * Synchronizes the README title with the release metadata and verifies the resulting version.
 */
function syncReadme() {
  const {version} = verifyReleaseMetadata(ROOT, {allowReadmeMismatch: true});
  for (const name of ['README.md', 'README.en.md']) {
    const before = read(name);
    const after = updateReadmeTitle(before, version);
    if (after !== before) write(name, after);
  }
  verifyReleaseMetadata();
  console.log(`README-Titel synchronisiert: v${version}`);
}

/**
 * A version bump starts a new test cycle. Never inherit passed checks from an
 * old release.
 *
 * @param {string} version Release version awaiting verification.
 * @param {string} note Changelog description of the release being tested.
 * @param {*} date Date value to process.
 * @return {string} Markdown status document recording that checks for the new release are pending.
 */
export function pendingTestStatus(version, note, date) {
  parseVersion(version);
  return `# Teststatus - Whisky Collection Manager v${version}

**Stand:** ${date}. **Status:** Pruefungen fuer v${version} noch ausstehend. Vergangene Releases und Aenderungen: [Changelog](../CHANGELOG.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| \`npm run release:check\` | **${PENDING_STATUS}** | Nach dem Versionswechsel ausfuehren. |
| \`npm run check\` | **${PENDING_STATUS}** | Syntax, Uebersetzungen und Dokumentationslinks. |
| \`npm test\` | **${PENDING_STATUS}** | Unit- und Integrationstests; Ergebnis erst nach dem Testlauf eintragen. |
| \`npm run test:browser\` | **${LOCAL_PENDING_STATUS}** | Browserpruefungen separat dokumentieren. |
| Docker-Image-Build / ARM64-Live-Test | **${LOCAL_PENDING_STATUS}** | Nach einem Release auf dem Zielsystem pruefen. |

Nach Durchfuehrung der Pruefungen die Ergebnisse und ihre Grenzen hier dokumentieren. Aenderungen stehen ausschliesslich im Changelog.
`;
}

/**
 * Parses bump data from JSON input.
 *
 * @param {string} part Requested semantic version increment.
 * @param {string} note Single-line changelog entry for the new version.
 */
function bump(part, note) {
  if (!note?.trim() || note.length > 500 || /[\r\n]/.test(note)) {
    throw new Error('Ein kurzer, einzeiliger Changelog-Eintrag ist erforderlich.');
  }
  const {version: current} = verifyReleaseMetadata(ROOT, {allowReadmeMismatch: true});
  // Check all inputs before changing any tracked file.
  const version = nextVersion(current, part);
  const pkg = JSON.parse(read('package.json'));
  pkg.version = version;
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');
  const lock = JSON.parse(read('package-lock.json'));
  lock.version = version;
  lock.packages[''].version = version;
  write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  for (const name of ['README.md', 'README.en.md']) write(name, updateReadmeTitle(read(name), version));
  const date = new Date().toISOString().slice(0, 10);
  write('CHANGELOG.md', read('CHANGELOG.md').replace(/^# Changelog\s*\n/, `# Changelog\n\n## ${version} - ${date}\n\n- ${note.trim()}\n\n`));
  write('docs/TESTSTATUS.md', pendingTestStatus(version, note, date));
  writeSourceManifest(ROOT);
  verifyReleaseMetadata();
  console.log(`Version ${current} -> ${version}. Jetzt nach develop committen und danach develop -> main mergen.`);
}

/**
 * Create the versioned release snapshot; a later verified step synchronizes
 * both branches.
 *
 * @param {string} version New semantic version approved by the release plan.
 * @param {*} commits Classified commits included in the release changelog.
 * @param {string} mergeSha SHA of the approved merge commit.
 * @param {string} previousTag Previous release tag used as the changelog boundary.
 */
export function applyAutomatedRelease(version, commits, mergeSha, previousTag) {
  parseVersion(version);
  if (!commits.length || !/^[a-f0-9]{40}$/.test(mergeSha)) throw new Error('Invalid automated release plan');
  const current = JSON.parse(read('package.json')).version;
  // Release snapshots are intentionally not merged into main. Carry forward
  // the changelog from the previous tag, not stale development metadata.
  if (!/^v\d+\.\d+\.\d+$/.test(previousTag)) throw new Error('Invalid previous release tag');
  /**
   * Reads a file from the preceding release tag when it exists.
   * @param {string} name Repository-relative file path.
   * @return {(string|null)} Released contents, or null when unavailable.
   */
  const releasedFile = name => {
    try {
      return execFileSync('git', ['show', `${previousTag}:${name}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
    }
    catch {return null;} // Initial transition if no previous tag exists.
  };
  // At first adoption, develop can contain a newer *manually released*
  // version than the latest reachable tag on main. Its changelog already
  // records that history. From the first automated release onwards, always
  // inherit release metadata from the newest snapshot tag instead.
  const useTaggedHistory = compareVersions(previousTag.slice(1), current) >= 0;
  const previousChangelog = (useTaggedHistory && releasedFile('CHANGELOG.md')) || read('CHANGELOG.md');
  const pkg = JSON.parse(read('package.json'));
  pkg.version = version;
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');
  const lock = JSON.parse(read('package-lock.json'));
  lock.version = version;
  lock.packages[''].version = version;
  write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  for (const name of ['README.md', 'README.en.md']) write(name, updateReadmeTitle(read(name), version));
  const date = new Date().toISOString().slice(0, 10);
  const changes = commits.map(commit => `- ${commit.subject.replace(/[\r\n]/g, ' ')}`).join('\n');
  write('CHANGELOG.md', previousChangelog.replace(/^# Changelog\s*\n/, `# Changelog\n\n## ${version} - ${date}\n\n${changes}\n\n`));
  write(
    'docs/TESTSTATUS.md',
    `# Teststatus - Whisky Collection Manager v${version}\n\n`
    + `**Stand:** ${date}. Automatischer Release-Snapshot aus Merge ${mergeSha.slice(0, 12)} (${previousTag}).\n\n`
    + `## Pruefungen\n\n`
    + `- \`npm test\`: **${PENDING_STATUS}**`
    + ` auf dem Release-Snapshot; `
    + `die Node-CI des Merge-Quellstands war vor Erstellung `
    + `des Tags erfolgreich.\n`
    + `- \`npm run test:browser\`: **${LOCAL_PENDING_STATUS}**`
    + ` auf dem Release-Snapshot; `
    + `die Browser-CI des Merge-Quellstands war vor Erstellung `
    + `des Tags erfolgreich.\n`
    + `- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit \`npm run check\`, \`npm test\` und \`npm run test:browser\`.\n`
    + `- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.\n`
    + `- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.\n`
    + `- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.\n\n`
    + `Aenderungen und fruehere Releases: [Changelog](../CHANGELOG.md).\n`
  );
  writeSourceManifest(ROOT);
  verifyReleaseMetadata();
}

const isCLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  try {
    const command = process.argv[2];
    if (command === 'check') {
      const {tag} = verifyReleaseMetadata();
      if (process.argv.includes('--fresh')) validateFreshVersion(tag.slice(1));
      console.log(`Release-Metadaten OK: ${tag}`);
    } else if (command === 'tag') {
      console.log(verifyReleaseMetadata().tag);
    } else if (command === 'sync') {
      syncReadme();
    } else if (command === 'bump') {
      bump(process.argv[3], process.argv.slice(4).join(' '));
    } else {
      throw new Error('Verwendung: release-version.js check [--fresh] | tag | sync | bump patch|minor|major "Aenderungen"');
    }
  } catch (error) {
    console.error(error.message);
    if (process.argv[2] === 'check' && error.message === 'Source manifest differs from release files') {
      console.error(
        'Hinweis: Auf unveroeffentlichtem develop nach Quellcodeaenderungen erwartet. release:check ist nur fuer unveraenderte Release-Snapshots vorgesehen.');
    }
    process.exitCode = 1;
  }
}
