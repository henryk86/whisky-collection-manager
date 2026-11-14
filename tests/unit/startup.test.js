import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { needsNpmCi, localTlsStatus, prepareStartup } from '../../scripts/start.js';

const packages = {
    '': { version: '0.17.15' },
    'node_modules/three': { version: '0.187.0' },
    'node_modules/playwright-core': { version: '1.65.0', dev: true },
};

function fixture(t, { installed = true, certificate = true } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-autostart-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ packages }));
    fs.writeFileSync(path.join(root, '.env.example'), 'HTTPS_ENABLED=true\n');
    if (installed) install(root);
    if (certificate) {
        fs.mkdirSync(path.join(root, 'certs'), { recursive: true });
        fs.writeFileSync(path.join(root, 'certs/server-cert.pem'), 'cert');
        fs.writeFileSync(path.join(root, 'certs/server-key.pem'), 'key');
    }
    return root;
}

function install(root, { dev = true } = {}) {
    const installed = {};
    for (const [name, entry] of Object.entries(packages)) {
        if (!name.startsWith('node_modules/') || (!dev && entry.dev)) continue;
        fs.mkdirSync(path.join(root, name), { recursive: true });
        fs.writeFileSync(path.join(root, name, 'package.json'), JSON.stringify({ version: entry.version }));
        installed[name] = entry;
    }
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'node_modules/.package-lock.json'), JSON.stringify({ packages: installed }));
}

test('npm start skips npm ci when the installation matches the lockfile, but always verifies local cutout assets', t => {
    const root = fixture(t);
    const calls = [];
    prepareStartup({ root, env: { HTTPS_ENABLED: 'true' }, execute: (binary, args) => calls.push([binary, ...args]) });
    assert.equal(needsNpmCi(root), false);
    assert.deepEqual(calls, [[process.execPath, 'scripts/prepare-cutout-assets.js']]);
});

test('npm start installs missing dependencies using npm ci before preparing cutout', t => {
    const root = fixture(t, { installed: false });
    const calls = [];
    prepareStartup({ root, env: { npm_execpath: '/nonexistent/npm-cli.js', HTTPS_ENABLED: 'true' }, execute: (binary, args) => {
        calls.push([binary, ...args]);
        if (args.includes('ci')) install(root);
    } });
    assert.equal(calls.length, 2);
    assert.ok(calls[0].includes('ci'));
    assert.deepEqual(calls[1], [process.execPath, 'scripts/prepare-cutout-assets.js']);
});

test('npm start detects mismatched dependency versions and incomplete node_modules', t => {
    const root = fixture(t);
    assert.equal(needsNpmCi(root), false);
    fs.rmSync(path.join(root, 'node_modules/three/package.json'));
    assert.equal(needsNpmCi(root), true);
    install(root);
    fs.writeFileSync(path.join(root, 'node_modules/.package-lock.json'), JSON.stringify({ packages: { ...packages, 'node_modules/three': { version: '0.1.0' } } }));
    assert.equal(needsNpmCi(root), true);
});

test('production npm start does not require devDependencies after npm ci --omit=dev', t => {
    const root = fixture(t);
    install(root, { dev: false });
    assert.equal(needsNpmCi(root, { production: true }), false);
    assert.equal(needsNpmCi(root), true);
});

test('npm start provisions missing local HTTPS once without replacing an existing .env', t => {
    const root = fixture(t, { certificate: false });
    fs.writeFileSync(path.join(root, '.env'), 'HTTPS_ENABLED=true\nALLOWED_HOSTS=myserver.local\n');
    const calls = [];
    prepareStartup({ root, env: {}, execute: (binary, args) => {
        calls.push(args[0]);
        if (args[0] === 'scripts/setup-https.js') {
            fs.mkdirSync(path.join(root, 'certs'), { recursive: true });
            fs.writeFileSync(path.join(root, 'certs/server-cert.pem'), 'cert');
            fs.writeFileSync(path.join(root, 'certs/server-key.pem'), 'key');
        }
    } });
    assert.deepEqual(calls, ['scripts/prepare-cutout-assets.js', 'scripts/setup-https.js']);
    assert.match(fs.readFileSync(path.join(root, '.env'), 'utf8'), /ALLOWED_HOSTS=myserver.local/);
    assert.equal(localTlsStatus(root), 'ready');
});

test('npm start creates .env only on first local startup; explicit HTTP and custom certificates are respected', t => {
    const root = fixture(t, { certificate: false });
    let setupCount = 0;
    prepareStartup({ root, env: { HTTPS_ENABLED: 'false' }, execute: (_binary, args) => {
        if (args[0] === 'scripts/setup-https.js') setupCount++;
    } });
    assert.equal(setupCount, 0);
    assert.equal(localTlsStatus(root, { HTTPS_ENABLED: 'false' }), 'disabled');
    assert.ok(fs.existsSync(path.join(root, '.env')));
    fs.writeFileSync(path.join(root, '.env'), 'HTTPS_CERT_FILE=custom/my-cert.pem\n');
    assert.equal(localTlsStatus(root), 'custom-missing');
    assert.throws(() => prepareStartup({ root, env: {}, execute: () => {} }), /Configured HTTPS certificate/);
});

test('npm start never launches after a failed installation or cutout preparation', t => {
    const root = fixture(t, { installed: false });
    assert.throws(() => prepareStartup({ root, env: {}, execute: () => { throw new Error('offline'); } }), /offline/);
    install(root);
    assert.throws(() => prepareStartup({ root, env: {}, execute: () => { throw new Error('bad asset'); } }), /bad asset/);
});
