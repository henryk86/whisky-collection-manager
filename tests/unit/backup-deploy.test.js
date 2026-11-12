import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(file, 'utf8');

test('Pi deployment has exactly one service, one published HTTPS port and durable storage', () => {
    const compose = read('docker-compose.yml');
    assert.match(compose, /name: whisky-collection-manager/);
    assert.match(compose, /ghcr\.io\/henryk86\/whisky-collection-manager:\$\{IMAGE_TAG:-latest\}/);
    assert.match(compose, /\bservices:\s*\n  app:/);
    assert.doesNotMatch(compose, /^  backup-worker:/m);
    assert.match(compose, /'3543:3543'/);
    assert.doesNotMatch(compose, /'3100:3100'/);
    assert.match(compose, /HTTP_ENABLED: 'false'/);
    assert.match(compose, /HTTPS_ENABLED: 'true'/);
    assert.match(compose, /APP_INTERNAL_URL: https:\/\/127\.0\.0\.1:3543/);
    assert.match(compose, /NODE_EXTRA_CA_CERTS: \/run\/certs\/server-cert\.pem/);
    assert.match(compose, /\$\{WCM_DATA_DIR:.*\}\/storage:\/srv\/whisky/);
    assert.match(compose, /\$\{WCM_DATA_DIR:.*\}\/backup-control:\/backup-control/);
    assert.match(compose, /\$\{WCM_DATA_DIR:.*\}\/backup-targets:\/backup-targets/);
    assert.match(compose, /backup-admin-token:\/run\/secrets\/backup-admin-token:ro/);
    assert.match(compose, /backup-worker-token:\/run\/secrets\/backup-worker-token:ro/);
    assert.match(compose, /restic-password:\/run\/secrets\/restic-password:ro/);
    assert.match(compose, /rclone:\/config\/rclone/);
    assert.match(compose, /security_opt:/);
    assert.match(compose, /read_only: true/);
    assert.equal(fs.existsSync('deploy/compose.yaml'), false);
    const ignored = read('.dockerignore') + read('.gitignore');
    for (const secret of ['certs', 'data', 'images', 'documents', 'backups', 'deploy/secrets', 'deploy/backup-control', 'deploy/rclone']) {
        assert.ok(ignored.includes(secret), `must ignore ${secret}`);
    }
});

test('single combined image ships app, scheduler, Restic/Rclone; release builds one multiarch image', () => {
    const app = read('docker/app.Dockerfile');
    assert.match(app, /npm ci --omit=dev/);
    assert.match(app, /^FROM node:22-bookworm-slim$/m);
    assert.match(app, /apt-get install -y --no-install-recommends ca-certificates restic rclone openssh-client/);
    assert.doesNotMatch(app, /node:22-alpine|apk add/);
    assert.match(app, /COPY --chown=node:node worker\//);
    assert.match(app, /entrypoint\.js/);
    assert.match(app, /EXPOSE 3543/);
    assert.doesNotMatch(app, /EXPOSE 3100/);
    assert.doesNotMatch(app, /COPY\s+\.\s+\./);
    assert.equal(fs.existsSync('docker/backup-worker.Dockerfile'), false);
    const runner = read('docker/entrypoint.js');
    assert.match(runner, /launch\('app', 'server\/index\.js'\)/);
    assert.match(runner, /launch\('backup', 'worker\/backup-worker\.js'\)/);
    assert.match(runner, /https\.get\(url/);
    assert.match(runner, /new URL\('\/api\/version'/, 'supervisor readiness must use the lightweight version endpoint');
    assert.doesNotMatch(runner, /new URL\('\/api\/collection'/, 'readiness must not load the collection');
    const publish = read('.github/workflows/release.yml');
    assert.match(publish, /packages: write/);
    assert.match(publish, /docker\/build-push-action@v7/);
    assert.match(publish, /platforms: linux\/arm64,linux\/amd64/);
    assert.match(publish, /file: docker\/app\.Dockerfile/);
    assert.doesNotMatch(publish, /docker\/backup-worker\.Dockerfile/);
    assert.doesNotMatch(publish, /suffix: '-backup'/);
    const checks = read('.github/workflows/check.yml');
    assert.match(checks, /actions\/checkout@v7/);
    assert.match(checks, /actions\/setup-node@v7/);
    assert.equal(JSON.parse(read('package.json')).devDependencies['playwright-core'], '1.64.1');
});
