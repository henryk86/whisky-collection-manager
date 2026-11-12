#!/usr/bin/env node
/** One version source for a main merge -> vX.Y.Z release. No network dependencies. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

export function verifyReleaseMetadata(root = ROOT, { allowReadmeMismatch = false } = {}) {
    const content = name => fs.readFileSync(path.join(root, name), 'utf8');
    const pkg = JSON.parse(content('package.json'));
    const version = pkg.version;
    parseVersion(version);
    const lock = JSON.parse(content('package-lock.json'));
    if (lock.version !== version || lock.packages?.['']?.version !== version) {
        throw new Error('Versionen von package.json und package-lock.json stimmen nicht ueberein.');
    }
    if (!allowReadmeMismatch && !content('README.md').startsWith(`# Whisky Collection Manager v${version}\n`)) {
        throw new Error('README.md enthaelt nicht die Release-Version im Titel.');
    }
    if (!content('docs/TESTSTATUS.md').startsWith(`# Teststatus - Whisky Collection Manager v${version}\n`)) {
        throw new Error(`docs/TESTSTATUS.md enthaelt nicht die Release-Version v${version}. Bitte release:bump verwenden.`);
    }
    const changelog = content('CHANGELOG.md');
    const match = /^# Changelog\s*\n\s*## ([^\s]+) - (\d{4}-\d{2}-\d{2})\s*\n([\s\S]*?)(?=\n## |$)/.exec(changelog);
    if (!match || match[1] !== version || !/^- /m.test(match[3]) || /BITTE_ERGAENZEN/.test(match[3])) {
        throw new Error(`CHANGELOG.md braucht einen ausgefuellten obersten Eintrag fuer ${version}.`);
    }
    return { version, tag: `v${version}` };
}

function validateFreshVersion(version) {
    const output = execFileSync('git', ['tag', '--list', 'v*'], { cwd: ROOT, encoding: 'utf8' });
    const versions = output.split(/\s+/).filter(tag => /^v\d+\.\d+\.\d+$/.test(tag));
    if (versions.some(tag => compareVersions(version, tag.slice(1)) <= 0)) {
        throw new Error(`v${version} ist nicht neuer als alle bereits vorhandenen Release-Tags. Version auf develop erhoehen.`);
    }
}

export function updateReadmeTitle(source, version) {
    const heading = `# Whisky Collection Manager v${version}`;
    if (/^# [^\n]*(?:Whisky Collection Manager|Whisky-Collection-Manager)[^\n]*$/im.test(source)) {
        return source.replace(/^# [^\n]*(?:Whisky Collection Manager|Whisky-Collection-Manager)[^\n]*$/im, heading);
    }
    // Existing README may have a generic or unversioned H1. Do not leave two H1s.
    if (/^# [^\n]+/m.test(source)) return source.replace(/^# [^\n]+/m, heading);
    return `${heading}\n\n${source}`;
}

function syncReadme() {
    const { version } = verifyReleaseMetadata(ROOT, { allowReadmeMismatch: true });
    const before = read('README.md');
    const after = updateReadmeTitle(before, version);
    if (after !== before) write('README.md', after);
    verifyReleaseMetadata();
    console.log(`README-Titel synchronisiert: v${version}`);
}

/** A version bump starts a new test cycle. Never inherit passed checks from an old release. */
export function pendingTestStatus(version, note, date) {
    parseVersion(version);
    return `# Teststatus - Whisky Collection Manager v${version}

**Stand:** ${date}. **Status:** Pruefungen fuer v${version} noch ausstehend. Fruehere Pruefungen: [TESTHISTORIE.md](TESTHISTORIE.md).

## Durchgefuehrte Pruefungen

| Pruefung | Ergebnis | Einordnung |
| --- | --- | --- |
| \`npm run release:check\` | **Noch nicht ausgefuehrt** | Nach dem Versionswechsel ausfuehren. |
| \`npm run check\` | **Noch nicht ausgefuehrt** | Syntax, Uebersetzungen und Dokumentationslinks. |
| \`npm test\` | **Noch nicht ausgefuehrt** | Unit- und Integrationstests; Ergebnis erst nach dem Testlauf eintragen. |
| \`npm run test:browser\` | **Nicht lokal ausgeführt** | Browserpruefungen separat dokumentieren. |
| Docker-Image-Build / ARM64-Live-Test | **Nicht lokal ausgeführt** | Nach einem Release auf dem Zielsystem pruefen. |

## Aenderungen v${version}

- ${note.trim()}

Nach Durchfuehrung der Pruefungen die Ergebnisse und ihre Grenzen hier dokumentieren.
`;
}

function archivePreviousTestStatus(version, source) {
    const header = `## Testbericht v${version} (vor dem naechsten Versionswechsel)`;
    const history = read('docs/TESTHISTORIE.md');
    if (history.includes(header)) return;
    // Demote former H2 headings under the archived report's H2.
    const report = source.replace(/^## /gm, '### ')
        .replace(/^# Teststatus[^\n]*\n/, `${header}\n`);
    write('docs/TESTHISTORIE.md', `${history.trimEnd()}\n\n---\n\n${report.trim()}\n`);
}

function bump(part, note) {
    if (!note?.trim() || note.length > 500 || /[\r\n]/.test(note)) {
        throw new Error('Ein kurzer, einzeiliger Changelog-Eintrag ist erforderlich.');
    }
    const { version: current } = verifyReleaseMetadata(ROOT, { allowReadmeMismatch: true });
    // Check all inputs before changing any tracked file.
    const previousStatus = read('docs/TESTSTATUS.md');
    read('docs/TESTHISTORIE.md');
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
    archivePreviousTestStatus(current, previousStatus);
    write('docs/TESTSTATUS.md', pendingTestStatus(version, note, date));
    verifyReleaseMetadata();
    console.log(`Version ${current} -> ${version}. Jetzt nach develop committen und danach develop -> main mergen.`);
}

const isCLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
    try {
        const command = process.argv[2];
        if (command === 'check') {
            const { tag } = verifyReleaseMetadata();
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
        process.exitCode = 1;
    }
}
