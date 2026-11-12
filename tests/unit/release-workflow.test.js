import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compareVersions, nextVersion, parseVersion, updateReadmeTitle, verifyReleaseMetadata } from '../../scripts/release-version.js';
import { prohibitedReleasePath } from '../../scripts/verify-release-files.js';
const read = file => fs.readFileSync(file, 'utf8');

test('release version parser and automatic bump support patch/minor/major', () => {
    assert.deepEqual(parseVersion('0.6.32'), [0, 6, 32]);
    assert.equal(nextVersion('0.6.32', 'patch'), '0.6.33');
    assert.equal(nextVersion('0.6.32', 'minor'), '0.7.0');
    assert.equal(nextVersion('0.6.32', 'major'), '1.0.0');
    assert.equal(compareVersions('0.6.32', '0.6.31'), 1);
    assert.equal(compareVersions('0.7.0', '0.6.99'), 1);
    assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
    assert.throws(() => parseVersion('v0.6.32'), /Ungueltige/);
    assert.throws(() => nextVersion('1.2.3', 'none'), /Verwendung/);
});

test('release files match app, lockfile, README and top changelog', () => {
    const release = verifyReleaseMetadata();
    const expected = JSON.parse(read('package.json')).version;
    assert.equal(release.version, expected);
    assert.equal(release.tag, `v${expected}`);
});

test('GHCR images and ZIP are published only by the release workflow', () => {
    const workflow = read('.github/workflows/release.yml');
    const checks = read('.github/workflows/check.yml');
    assert.match(workflow, /branches: \[main\]/);
    assert.match(workflow, /types: \[published\]/);
    assert.match(workflow, /gh release create/);
    assert.match(workflow, /--draft/);
    assert.match(workflow, /gh release upload/);
    assert.match(workflow, /gh release edit/);
    assert.match(workflow, /docker buildx imagetools create/);
    assert.match(workflow, /needs: \[prepare, package, docker\]/);
    assert.match(workflow, /--draft=false/);
    assert.match(workflow, /needs: \[prepare, package, docker\]/);
    assert.match(workflow, /docker\/build-push-action@v7/);
    assert.match(workflow, /platforms: linux\/arm64,linux\/amd64/);
    assert.doesNotMatch(workflow, /suffix: '-backup'/);
    assert.match(workflow, /file: docker\/app\.Dockerfile/);
    assert.match(workflow, /packages: write/);
    assert.match(workflow, /git archive/);
    assert.match(workflow, /verify-release-files\.js/);
    assert.doesNotMatch(workflow, /branches: \[main, master\]/);
    assert.equal(fs.existsSync('.github/workflows/docker-publish.yml'), false);
    assert.equal(fs.existsSync('extension/manifest.json'), false, 'extension lives in private repository');
    assert.match(checks, /branches: \[develop\]/);
    assert.match(checks, /branches: \[develop, main\]/);
    assert.match(checks, /release-version\.js check --fresh/);
    assert.match(checks, /actions\/checkout@v7/);
    assert.match(checks, /actions\/setup-node@v7/);
    assert.equal(JSON.parse(read('package.json')).devDependencies['playwright-core'], '1.64.1');
});

test('Docker build and the uploaded images validate package.json before latest is updated', () => {
    const dockerfile = read('docker/app.Dockerfile');
    const workflow = read('.github/workflows/release.yml');
    assert.doesNotThrow(() => JSON.parse(read('package.json')));
    assert.match(dockerfile, /JSON\.parse\(fs\.readFileSync\(f/);
    assert.match(dockerfile, /node --check docker\/entrypoint\.js/);
    assert.match(workflow, /docker pull --platform/);
    assert.match(workflow, /docker run --rm --platform/);
    assert.match(workflow, /--entrypoint node/);
    assert.match(workflow, /require\("\/app\/package\.json"\)\.version/);
    assert.match(workflow, /--check \/app\/docker\/entrypoint\.js/);
    assert.match(workflow, /node --version && restic version && rclone version && ssh -V/);
    assert.match(workflow, /needs: \[prepare, package, docker\]/);
});

test('release ZIP rejects secrets but retains source and example config', () => {
    for (const unsafe of [
        '.env', 'deploy/.env', 'certs/server-key.pem', 'data/collection.json',
        'images/bottle.png', 'documents/receipt.pdf', 'backups/2026.zip',
        'deploy/storage/data/collection.json', 'deploy/secrets/restic-password',
        'deploy/rclone/rclone.conf', 'deploy/backup-control/profiles.json',
        'deploy/backup-control/backup-zip-password',
        'node_modules/foo.js', '../data/collection.json'
    ]) assert.ok(prohibitedReleasePath(unsafe), unsafe);
    for (const safe of [
        '.env.example', 'deploy/.env.example', 'package.json',
        'public/assets/logo-original.svg', 'public/index.html',
        'public/js/features/backups/controller.js', 'docker-compose.yml',
        '.github/workflows/release.yml'
    ]) assert.equal(prohibitedReleasePath(safe), false, safe);
    const compose = read('docker-compose.yml');
    assert.equal((compose.match(/\$\{IMAGE_TAG:-latest\}/g) || []).length, 1);
    assert.match(read('.gitignore'), /\/backups\//);
    assert.match(read('.dockerignore'), /!public\/js\/features\/backups\/\*\*/);
});


test('README heading can be repaired without relaxing CI metadata validation', () => {
    const version = '0.8.8';
    assert.equal(updateReadmeTitle('# Whisky Collection Manager\n\nText', version), '# Whisky Collection Manager v0.8.8\n\nText');
    assert.equal(updateReadmeTitle('# Whisky Collection Manager v0.8.7\n\nText', version), '# Whisky Collection Manager v0.8.8\n\nText');
    assert.equal(updateReadmeTitle('# Project overview\n\nText', version), '# Whisky Collection Manager v0.8.8\n\nText');
    assert.equal(updateReadmeTitle('Text only', version), '# Whisky Collection Manager v0.8.8\n\nText only');
    assert.equal((updateReadmeTitle('# Other title\n', version).match(/^# /gm) || []).length, 1);
});
