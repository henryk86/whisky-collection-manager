import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';

const script = fs.readFileSync('deploy/setup-pi.sh');
const template = fs.readFileSync('deploy/.env.example', 'utf8');

const createProject = (envContent = null, legacyEnv = null) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-pi-cert-'));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-pi-home-'));
    const deploy = path.join(root, 'deploy');
    fs.mkdirSync(deploy);
    fs.writeFileSync(path.join(deploy, 'setup-pi.sh'), script);
    fs.writeFileSync(path.join(deploy, '.env.example'), template);
    if (envContent !== null) fs.writeFileSync(path.join(root, '.env'), envContent);
    if (legacyEnv !== null) fs.writeFileSync(path.join(deploy, '.env'), legacyEnv);
    const run = (args = [], overrides = {}) => execFileSync('sh', [path.join(deploy, 'setup-pi.sh'), ...args], {
        cwd: root,
        env: { ...process.env, HOME: home, WHISKY_LAN_IP: '', ...overrides },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    const dataDir = path.join(home, 'whisky-collection-manager-data');
    const cert = path.join(dataDir, 'secrets/certs/server-cert.pem');
    return { root, deploy, dataDir, run, cert, cleanup: () => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); } };
};

// OpenSSL's `x509 -checkhost/-checkip` can report a mismatch while exiting with 0
// (e.g. on GitHub Actions Ubuntu). Check the certificate through Node's stable
// X509Certificate API instead of relying on an OpenSSL CLI exit status.
const certificateHas = (certificate, flag, name, match = true) => {
    const x509 = new X509Certificate(fs.readFileSync(certificate));
    let actual;
    if (flag === '-checkhost') actual = x509.checkHost(name) !== undefined;
    else if (flag === '-checkip') actual = x509.checkIP(name) !== undefined;
    else throw new Error(`Unbekannte Zertifikatsprüfung: ${flag}`);
    assert.equal(actual, match, `${name}: SAN=${x509.subjectAltName}`);
};

test('Pi setup copies the Docker Compose .env template and certifies configured hosts and IPv4 addresses', () => {
    const { root, deploy, run, cert, cleanup } = createProject();
    try {
        run();
        assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), template + `\n# Persistente Laufzeitdaten (ausserhalb des Git-Repositories)\nWCM_DATA_DIR=${path.dirname(cert).split('/secrets/certs')[0]}\n`);
        const token = path.join(path.dirname(cert), '../backup-admin-token');
        const tokenBefore = fs.readFileSync(token);
        const firstCert = fs.readFileSync(cert);
        for (const name of ['localhost', 'home-pi', 'home-pi.local', 'whisky-pi.local', 'raspberrypi.local']) {
            certificateHas(cert, '-checkhost', name);
        }
        for (const ip of ['127.0.0.1', '192.168.178.40']) certificateHas(cert, '-checkip', ip);
        assert.equal(fs.statSync(path.join(path.dirname(cert), 'server-key.pem')).mode & 0o777, 0o600);
        run(); // Regular setup must never overwrite the existing certificate.
        assert.deepEqual(fs.readFileSync(cert), firstCert);
        run(['--renew-cert']);
        assert.notDeepEqual(fs.readFileSync(cert), firstCert);
        assert.deepEqual(fs.readFileSync(token), tokenBefore);
        const backups = fs.readdirSync(path.dirname(cert)).filter(name => name.startsWith('previous.'));
        assert.equal(backups.length, 1);
        assert.deepEqual(fs.readFileSync(path.join(path.dirname(cert), backups[0], 'server-cert.pem')), firstCert);
    } finally {
        cleanup();
    }
});

test('Changing only .env allows custom DNS/IP SANs after explicit certificate renewal', () => {
    const initialEnv = [
        'IMAGE_TAG=v0.6.36',
        'TZ=Europe/Berlin',
        'CERT_DNS_NAMES="home-pi, home-pi.local"',
        "CERT_IP_ADDRESSES='192.168.178.40'"
    ].join('\n') + '\n';
    const project = createProject(initialEnv);
    try {
        project.run();
        certificateHas(project.cert, '-checkhost', 'home-pi.local');
        certificateHas(project.cert, '-checkhost', 'backup.lan', false);
        certificateHas(project.cert, '-checkip', '10.20.30.40', false);
        const initialCert = fs.readFileSync(project.cert);
        const changedEnv = initialEnv
            .replace('home-pi, home-pi.local', 'home-pi, home-pi.local, backup.lan, office-pi.local')
            .replace('192.168.178.40', '192.168.178.40, 10.20.30.40');
        fs.writeFileSync(path.join(project.root, '.env'), changedEnv);
        project.run();
        assert.deepEqual(fs.readFileSync(project.cert), initialCert, 'Only --renew-cert may replace certificate');
        project.run(['--renew-cert']);
        certificateHas(project.cert, '-checkhost', 'backup.lan');
        certificateHas(project.cert, '-checkhost', 'office-pi.local');
        certificateHas(project.cert, '-checkhost', 'home-pi.local');
        certificateHas(project.cert, '-checkhost', 'whisky-pi.local', false);
        certificateHas(project.cert, '-checkip', '10.20.30.40');
        certificateHas(project.cert, '-checkip', '127.0.0.1');
        assert.match(fs.readFileSync(path.join(project.root, '.env'), 'utf8'), /WCM_DATA_DIR=/);
    } finally {
        project.cleanup();
    }
});

test('Pi setup imports older deploy/.env and supports the original WHISKY_LAN_IP override', () => {
    const project = createProject(null, 'IMAGE_TAG=v0.6.35\nTZ=Europe/Berlin\n');
    try {
        project.run([], { WHISKY_LAN_IP: '10.1.1.5' });
        const current = fs.readFileSync(path.join(project.root, '.env'), 'utf8');
        assert.match(current, /IMAGE_TAG=v0\.6\.35/);
        assert.match(current, /CERT_DNS_NAMES=home-pi,home-pi.local/);
        assert.match(current, /CERT_IP_ADDRESSES=127\.0\.0\.1,192\.168\.178\.40/);
        certificateHas(project.cert, '-checkip', '10.1.1.5');
    } finally {
        project.cleanup();
    }
});

test('Invalid SAN values are rejected before replacing certificates; .env is never sourced as shell code', () => {
    const project = createProject(template);
    try {
        project.run();
        const original = fs.readFileSync(project.cert);
        const evil = path.join(project.root, 'should-not-exist');
        fs.writeFileSync(path.join(project.root, '.env'),
            `IMAGE_TAG=latest\nUNRELATED=$(touch ${evil})\nCERT_DNS_NAMES=home-pi,https://evil.test\nCERT_IP_ADDRESSES=127.0.0.1\n`);
        assert.throws(() => project.run(['--renew-cert']));
        assert.deepEqual(fs.readFileSync(project.cert), original);
        assert.equal(fs.existsSync(evil), false);
        fs.writeFileSync(path.join(project.root, '.env'),
            'CERT_DNS_NAMES=home-pi,home-pi.local\nCERT_IP_ADDRESSES=127.0.0.1,999.22.3.4\n');
        assert.throws(() => project.run(['--renew-cert']));
        assert.deepEqual(fs.readFileSync(project.cert), original);
    } finally {
        project.cleanup();
    }
});

test('Legacy directories are untouched and never migrated', () => {
    const project = createProject();
    try {
        fs.mkdirSync(path.join(project.deploy, 'storage/data'), { recursive: true });
        fs.writeFileSync(path.join(project.deploy, 'storage/data/collection.json'), '{"legacy":true}');
        project.run();
        assert.equal(fs.readFileSync(path.join(project.deploy, 'storage/data/collection.json'), 'utf8'), '{"legacy":true}');
        assert.equal(fs.existsSync(path.join(project.dataDir, 'storage/data/collection.json')), false);
        assert.throws(() => project.run(['--migrate-data']));
    } finally { project.cleanup(); }
});
