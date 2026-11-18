import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function fixture(t, provider = 'cloudflare') {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-dns01-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    const project = path.join(temp, 'source');
    const data = path.join(temp, 'data');
    const bindir = path.join(temp, 'bin');
    fs.mkdirSync(path.join(project, 'deploy'), { recursive: true });
    fs.mkdirSync(bindir);
    fs.copyFileSync(path.join(root, 'deploy/letsencrypt.sh'), path.join(project, 'deploy/letsencrypt.sh'));
    fs.mkdirSync(path.join(data, 'secrets/letsencrypt'), { recursive: true });
    const creds = path.join(data, 'secrets/letsencrypt/dns-credentials.ini');
    const ini = provider === 'netcup-clouddns'
        ? 'dns_netcup_api_v1_key = fake-test-key\n'
        : provider === 'netcup-legacy'
            ? 'dns_netcup_customer_id = 123456\ndns_netcup_api_key = fake-test-key\ndns_netcup_api_password = fake-test-password\n'
            : 'dns_cloudflare_api_token = fake-test-token\n';
    fs.writeFileSync(creds, ini, { mode: 0o600 });
    fs.writeFileSync(path.join(project, '.env'), [
        `WCM_DATA_DIR=${data}`, 'LE_DOMAIN=whisky.example.org', 'LE_EMAIL=admin@example.org',
        `LE_DNS_PROVIDER=${provider}`, 'LE_DNS_PROPAGATION_SECONDS=60', ''
    ].join('\n'));
    const log = path.join(temp, 'docker.log');
    // No Docker or network access: mock the CLI, producing local ephemeral test
    // certificates only. The production Certbot execution is not simulated.
    const docker = path.join(bindir, 'docker');
    fs.writeFileSync(docker, `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [ "$1" = run ]; then
  mkdir -p "$TEST_DATA/secrets/letsencrypt/config/live/whisky.example.org"
  if [ "$MOCK_ISSUE_NEW" = 1 ]; then
    openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 30 -subj /CN=whisky.example.org \\
      -addext subjectAltName=DNS:whisky.example.org \\
      -keyout "$TEST_DATA/secrets/letsencrypt/config/live/whisky.example.org/privkey.pem" \\
      -out "$TEST_DATA/secrets/letsencrypt/config/live/whisky.example.org/fullchain.pem" >/dev/null 2>&1
  fi
fi
if [ "$1" = compose ] && [ "$2" = --profile ] && [ "$3" = letsencrypt ] && [ "$4" = ps ]; then
  [ "$MOCK_PROXY_RUNNING" = 1 ] && echo letsencrypt-proxy
fi
`, { mode: 0o755 });
    const env = {
        ...process.env, PATH: `${bindir}:${process.env.PATH}`, DOCKER_LOG: log, TEST_DATA: data,
        MOCK_ISSUE_NEW: '1', MOCK_PROXY_RUNNING: '0'
    };
    for (const key of ['WCM_DATA_DIR', 'LE_DOMAIN', 'LE_EMAIL', 'LE_DNS_PROVIDER', 'LE_DNS_PROPAGATION_SECONDS']) delete env[key];
    function run(action, overrides = {}) {
        return spawnSync('sh', [path.join(project, 'deploy/letsencrypt.sh'), action], {
            env: { ...env, ...overrides }, encoding: 'utf8'
        });
    }
    return { data, creds, log, run };
}

test('DNS-01 is optional; check performs no certificate issuance or Docker change', t => {
    const x = fixture(t);
    const result = x.run('check');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Konfiguration gueltig/);
    assert.equal(fs.existsSync(x.log), false);
});

test('DNS-01 credentials must be private and invalid domains fail closed', t => {
    const x = fixture(t);
    fs.chmodSync(x.creds, 0o644);
    const result = x.run('check');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Modus 600/);
    assert.equal(fs.existsSync(x.log), false);
    fs.chmodSync(x.creds, 0o600);
    const bad = x.run('check', { LE_DOMAIN: '127.0.0.1' });
    assert.notEqual(bad.status, 0);
    assert.equal(fs.existsSync(x.log), false);
    const conflictingPorts = x.run('check', { HTTPS_PUBLIC_PORT: '443', LE_HTTPS_PUBLIC_PORT: '443' });
    assert.notEqual(conflictingPorts.status, 0);
    assert.match(conflictingPorts.stderr, /duerfen nicht gleich sein/);
});

test('issue publishes a verified pair atomically and renew leaves it intact when unchanged', t => {
    const x = fixture(t);
    let result = x.run('issue');
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const cert = path.join(x.data, 'secrets/letsencrypt/published/current/fullchain.pem');
    assert.ok(fs.readFileSync(cert, 'utf8').includes('BEGIN CERTIFICATE'));
    const before = fs.readFileSync(cert);
    assert.match(fs.readFileSync(x.log, 'utf8'), /certbot\/dns-cloudflare:latest certonly/);
    assert.match(fs.readFileSync(x.log, 'utf8'), /--dns-cloudflare-credentials \/run\/secrets\/dns.ini/);
    result = x.run('renew', { MOCK_ISSUE_NEW: '0' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /unveraendert/);
    assert.deepEqual(fs.readFileSync(cert), before);
    assert.doesNotMatch(fs.readFileSync(x.log, 'utf8'), /compose --profile letsencrypt exec/);
});

test('RFC2136 uses its own plugin and certificate updates reload an active proxy', t => {
    const x = fixture(t, 'rfc2136');
    let result = x.run('issue');
    assert.equal(result.status, 0, result.stderr);
    const current = path.join(x.data, 'secrets/letsencrypt/published/current');
    const first = fs.readlinkSync(current);
    result = x.run('renew', { MOCK_PROXY_RUNNING: '1' });
    assert.equal(result.status, 0, result.stderr);
    assert.notEqual(fs.readlinkSync(current), first);
    const log = fs.readFileSync(x.log, 'utf8');
    assert.match(log, /certbot\/dns-rfc2136:latest certonly/);
    assert.match(log, /--dns-rfc2136-credentials \/run\/secrets\/dns.ini/);
    assert.match(log, /compose --profile letsencrypt exec -T letsencrypt-proxy nginx -t/);
    assert.match(log, /compose --profile letsencrypt exec -T letsencrypt-proxy nginx -s reload/);
});

test('netcup CloudDNS uses the v1 API key, supported ARM64 image and explicit authenticator', t => {
    const x = fixture(t, 'netcup-clouddns');
    let result = x.run('check', { LE_DNS_PROPAGATION_SECONDS: '' });
    assert.equal(result.status, 0, result.stderr);
    result = x.run('issue', { LE_DNS_PROPAGATION_SECONDS: '' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const log = fs.readFileSync(x.log, 'utf8');
    assert.match(log, /coldfix\/certbot-dns-netcup:v2\.1\.0 certbot certonly/);
    assert.match(log, /--authenticator dns-netcup/);
    assert.match(log, /--dns-netcup-credentials \/run\/secrets\/dns\.ini/);
    assert.match(log, /--dns-netcup-propagation-seconds 900/);
    assert.doesNotMatch(log, /--dns-netcup --dns-netcup-credentials/);
    result = x.run('renew', { MOCK_ISSUE_NEW: '0' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(x.log, 'utf8'), /coldfix\/certbot-dns-netcup:v2\.1\.0 certbot renew/);
});

test('netcup CloudDNS rejects legacy-only credentials without invoking Docker', t => {
    const x = fixture(t, 'netcup-clouddns');
    fs.writeFileSync(x.creds, 'dns_netcup_api_key = fake-legacy-key\n', { mode: 0o600 });
    const result = x.run('check');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /dns_netcup_api_v1_key fehlt/);
    assert.equal(fs.existsSync(x.log), false);
});

test('netcup Legacy credentials use the same plugin but require three legacy fields', t => {
    const x = fixture(t, 'netcup-legacy');
    let result = x.run('issue');
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(x.log, 'utf8'), /--authenticator dns-netcup/);
    fs.writeFileSync(x.creds, 'dns_netcup_customer_id = 123456\n', { mode: 0o600 });
    result = x.run('check');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /dns_netcup_api_key fehlt/);
});

test('NGINX public TLS validates the internal HTTPS upstream', () => {
    const config = fs.readFileSync(path.join(root, 'deploy/nginx-letsencrypt.conf'), 'utf8');
    assert.match(config, /proxy_pass https:\/\/app:3543;/);
    assert.match(config, /proxy_ssl_verify on;/);
    assert.match(config, /proxy_ssl_name localhost;/);
    assert.match(config, /ssl_certificate \/etc\/nginx\/wcm-letsencrypt\/current\/fullchain\.pem;/);
    assert.match(config, /proxy_ssl_trusted_certificate \/etc\/nginx\/wcm-certs\/server-cert\.pem;/);
});

test('NGINX certificate mounts are not hidden by the Alpine /var/run tmpfs', () => {
    const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
    const proxy = compose.split('  letsencrypt-proxy:')[1];
    assert.ok(proxy, 'letsencrypt-proxy service exists');
    assert.match(proxy, /\/secrets\/letsencrypt\/published:\/etc\/nginx\/wcm-letsencrypt:ro/);
    assert.match(proxy, /\/secrets\/certs:\/etc\/nginx\/wcm-certs:ro/);
    assert.doesNotMatch(proxy, /\/secrets\/letsencrypt\/published:\/run\//);
    assert.match(proxy, /user: '\$\{LE_PROXY_UID:-1000\}:\$\{LE_PROXY_GID:-1000\}'/);
    assert.match(proxy, /cap_drop:\s*\n\s*- ALL/);
    assert.doesNotMatch(proxy, /cap_add:/);
});
