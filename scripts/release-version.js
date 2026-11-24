#!/usr/bin/env node
/**
 * One version source for a main merge -> vX.Y.Z release. No network
 * dependencies.
 */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeSourceManifest, verifySourceManifest, FILENAME} from './release-manifest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

const write = (name, value) => fs.writeFileSync(path.join(ROOT, name), value);

export function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value || '');
  if (!match) throw new Error(`Ungueltige Release-Version: ${value} (erwartet X.Y.Z ohne Suffix)`);
  return match.slice(1).map(Number);
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
  }
  return 0;
}

export function nextVersion(current, part) {
  const [major, minor, patch] = parseVersion(current);
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  if (part === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error('Verwendung: npm run release:bump -- patch|minor|major "Changelog-Eintrag"');
}

export function verifyReleaseMetadata(root = ROOT, {allowReadmeMismatch = false} = {}) {
  const content = name => fs.readFileSync(path.join(root, name), 'utf8');
  const pkg = JSON.parse(content('package.json'));
  const version = pkg.version;
  parseVersion(version);
  const lock = JSON.parse(content('package-lock.json'));
  if (lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error('Versionen von package.json und package-lock.json stimmen nicht ueberein.');
  }
  if (!allowReadmeMismatch && !content('README.md')
    .startsWith(`# Whisky Collection Manager v${version}\n`)) {
    throw new Error('README.md enthaelt nicht die Release-Version im Titel.');
  }
  if (!content('docs/TESTSTATUS.md')
    .startsWith(`# Teststatus - Whisky Collection Manager v${version}\n`)) {
    throw new Error(`docs/TESTSTATUS.md enthaelt nicht die Release-Version v${version}. Bitte release:bump verwenden.`);
  }
  const changelog = content('CHANGELOG.md');
  const match = /^# Changelog\s*\n\s*## ([^\s]+) - (\d{4}-\d{2}-\d{2})\s*\n([\s\S]*?)(?=\n## |$)/.exec(changelog);
  if (!match || match[1] !== version || !/^- /m.test(match[3]) ||
    /BITTE_ERGAENZEN/.test(match[3])) {
    throw new Error(`CHANGELOG.md braucht einen ausgefuellten obersten Eintrag fuer ${version}.`);
  }
  if (compareVersions(version, '1.3.0') >= 0 &&
    !fs.existsSync(path.join(root, FILENAME))) {
    throw new Error(`Quellcode-Manifest ${FILENAME} fehlt im Release v${version}.`);
  }
  if (fs.existsSync(path.join(root, FILENAME))) verifySourceManifest(root);
  return {version, tag: `v${version}`};
}

function validateFreshVersion(version) {
  const output = execFileSync(
    'git',
    ['tag', '--list', 'v*'],
    {cwd: ROOT, encoding: 'utf8'}
  );
  const versions = output.split(/\s+/).filter(tag => /^v\d+\.\d+\.\d+$/
    .test(tag));
  if (versions.some(tag => compareVersions(version, tag.slice(1)) <= 0)) {
    throw new Error(`v${version} ist nicht neuer als alle bereits vorhandenen Release-Tags. Version auf develop erhoehen.`);
  }
}

export function updateReadmeTitle(source, version) {
  const heading = `# Whisky Collection Manager v${version}`;
  if (/^# [^\n]*(?:Whisky Collection Manager|Whisky-Collection-Manager)[^\n]*$/im.test(source)) {
    return source.replace(
      /^# [^\n]*(?:Whisky Collection Manager|Whisky-Collection-Manager)[^\n]*$/im,
      heading
    );
  }
  // Existing README may have a generic or unversioned H1. Do not leave two H1s.
  if (/^# [^\n]+/m.test(source)) return source.replace(/^# [^\n]+/m, heading);
  return `${heading}\n\n${source}`;
}

function syncReadme() {
  const {version} = verifyReleaseMetadata(ROOT, {allowReadmeMismatch: true});
  const before = read('README.md');
  const after = updateReadmeTitle(before, version);
  if (after !== before) write('README.md', after);
  verifyReleaseMetadata();
  console.log(`README-Titel synchronisiert: v${version}`);
}

/**
 * A version bump starts a new test cycle. Never inherit passed checks from an
 * old release.
 */
export function pendingTestStatus(version, note, date) {
  parseVersion(version);
  return `# Teststatus - Whisky Collection Manager v${version}

**Stand:** ${date}. **Status:** Pruefungen fuer v${version} noch ausstehend. Vergangene Releases und Aenderungen: [Changelog](../CHANGELOG.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| \`npm run release:check\` | **Noch nicht ausgefuehrt** | Nach dem Versionswechsel ausfuehren. |
| \`npm run check\` | **Noch nicht ausgefuehrt** | Syntax, Uebersetzungen und Dokumentationslinks. |
| \`npm test\` | **Noch nicht ausgefuehrt** | Unit- und Integrationstests; Ergebnis erst nach dem Testlauf eintragen. |
| \`npm run test:browser\` | **Nicht lokal ausgeführt** | Browserpruefungen separat dokumentieren. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

Nach Durchfuehrung der Pruefungen die Ergebnisse und ihre Grenzen hier dokumentieren. Aenderungen stehen ausschliesslich im Changelog.
`;
}

function bump(part, note) {
  if (!note?.trim() || note.length > 500 || /[\r\n]/.test(note)) {
    throw new Error('Ein kurzer, einzeiliger Changelog-Eintrag ist erforderlich.');
  }
  const {version: current} =
    verifyReleaseMetadata(ROOT, {allowReadmeMismatch: true});
  // Check all inputs before changing any tracked file.
  const version = nextVersion(current, part);
  const pkg = JSON.parse(read('package.json'));
  pkg.version = version;
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');
  const lock = JSON.parse(read('package-lock.json'));
  lock.version = version;
  lock.packages[''].version = version;
  write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  write('README.md', updateReadmeTitle(read('README.md'), version));
  const date = new Date().toISOString().slice(0, 10);
  write('CHANGELOG.md', read('CHANGELOG.md').replace(/^# Changelog\s*\n/,
    `# Changelog\n\n## ${version} - ${date}\n\n- ${note.trim()}\n\n`));
  write('docs/TESTSTATUS.md', pendingTestStatus(version, note, date));
  writeSourceManifest(ROOT);
  verifyReleaseMetadata();
  console.log(`Version ${current} -> ${version}. Jetzt nach develop committen und danach develop -> main mergen.`);
}

/**
 * Create the versioned release snapshot; a later verified step synchronizes
 * both branches.
 */
export function applyAutomatedRelease(version, commits, mergeSha, previousTag) {
  parseVersion(version);
  if (!commits.length || !/^[a-f0-9]{40}$/
    .test(mergeSha)) throw new Error('Invalid automated release plan');
  const current = JSON.parse(read('package.json')).version;
  // Release snapshots are intentionally not merged into main. Carry forward
  // the changelog from the previous tag, not stale development metadata.
  if (!/^v\d+\.\d+\.\d+$/
    .test(previousTag)) throw new Error('Invalid previous release tag');
  const releasedFile = name => {
    try {
      return execFileSync('git', ['show', `${previousTag}:${name}`],
        {cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
    }
    catch {return null;} // Initial transition if no previous tag exists.
  };
  // At first adoption, develop can contain a newer *manually released*
  // version than the latest reachable tag on main. Its changelog already
  // records that history. From the first automated release onwards, always
  // inherit release metadata from the newest snapshot tag instead.
  const useTaggedHistory = compareVersions(previousTag.slice(1), current) >= 0;
  const previousChangelog = (useTaggedHistory &&
    releasedFile('CHANGELOG.md')) || read('CHANGELOG.md');
  const pkg = JSON.parse(read('package.json'));
  pkg.version = version;
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');
  const lock = JSON.parse(read('package-lock.json'));
  lock.version = version;
  lock.packages[''].version = version;
  write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  write('README.md', updateReadmeTitle(read('README.md'), version));
  const date = new Date().toISOString().slice(0, 10);
  const changes = commits.map(commit => `- ${commit.subject
    .replace(/[\r\n]/g, ' ')}`).join('\n');
  write('CHANGELOG.md', previousChangelog.replace(/^# Changelog\s*\n/,
    `# Changelog\n\n## ${version} - ${date}\n\n${changes}\n\n`));
  write(
    'docs/TESTSTATUS.md',
    `# Teststatus - Whisky Collection Manager v${version}\n\n`
    + `**Stand:** ${date}. Automatischer Release-Snapshot aus Merge ${mergeSha.slice(0, 12)} (${previousTag}).\n\n`
    + `## Pruefungen\n\n`
    + `- \`npm test\`: **Noch nicht ausgefuehrt** auf dem Release-Snapshot; die Node-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.\n`
    + `- \`npm run test:browser\`: **Nicht lokal ausgeführt** auf dem Release-Snapshot; die Browser-CI des Merge-Quellstands war vor Erstellung des Tags erfolgreich.\n`
    + `- Vor Erstellung des Tags: GitHub-CI fuer den Merge-Quellstand mit \`npm run check\`, \`npm test\` und \`npm run test:browser\`.\n`
    + `- Release-Metadaten und SHA-256-Quellmanifest werden im Snapshot separat geprueft.\n`
    + `- Docker/ARM64/AMD64 sowie ZIP-/Offline-Archive werden vom Release-Workflow vor der Veroeffentlichung geprueft.\n`
    + `- Externe Hardware-/Pi-Pruefungen sind nicht Bestandteil dieses CI-Laufs.\n\n`
    + `Aenderungen und fruehere Releases: [Changelog](../CHANGELOG.md).\n`
  );
  writeSourceManifest(ROOT);
  verifyReleaseMetadata();
}

const isCLI = process.argv[1] && path.resolve(process.argv[1]) ===
  fileURLToPath(import.meta.url);
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
    if (process.argv[2] === 'check' && error.message ===
      'Source manifest differs from release files') {
      console.error('Hinweis: Auf unveroeffentlichtem develop nach Quellcodeaenderungen erwartet. release:check ist nur fuer unveraenderte Release-Snapshots vorgesehen.');
    }
    process.exitCode = 1;
  }
}
