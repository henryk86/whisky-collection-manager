import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sealOfflineBundle, verifyOfflineBundle } from '../../scripts/offline-bundle.js';
import { prepareStartup } from '../../scripts/start.js';

const assets = [
    'public/ai/models/u2netp.onnx',
    'public/ai/vendor/ort.wasm.min.mjs',
    'public/ai/vendor/ort-wasm-simd-threaded.mjs',
    'public/ai/vendor/ort-wasm-simd-threaded.wasm',
    'public/ai/licenses/Apache-2.0.txt',
    'public/ai/licenses/ONNX-Runtime-Web-NOTICE.txt',
];
function write(root, name, content) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
}
function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-offline-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const pkg = {version:'0.20.0'};
    const lock = {packages:{'':{version:pkg.version},'node_modules/three':{version:'0.187.0'}}};
    write(root, 'package.json', JSON.stringify(pkg));
    write(root, 'package-lock.json', JSON.stringify(lock));
    write(root, '.env.example', 'HTTPS_ENABLED=false\n');
    for (const asset of assets) write(root, asset, `fixture:${asset}`);
    write(root, '.offline/npm-cache/_cacache/content-v2/sha512/ab/cd/123', 'cached tarball fixture');
    write(root, '.offline/npm-cache/_cacache/index-v5/01/02/fixture', 'cached index');
    write(root, '.offline/npm-cache/_logs/private.log', 'private npm log must not be shipped');
    return root;
}

test('offline seal captures npm cache, AI model, vendor runtime and licenses but excludes npm logs', t => {
    const root = fixture(t);
    const manifest = sealOfflineBundle(root);
    assert.equal(manifest.version, '0.20.0');
    assert.ok(manifest.assets['public/ai/models/u2netp.onnx']);
    assert.ok(manifest.assets['.offline/npm-cache/_cacache/content-v2/sha512/ab/cd/123']);
    assert.ok(!fs.existsSync(path.join(root, '.offline/npm-cache/_logs')));
    assert.deepEqual(verifyOfflineBundle(root), manifest);
});

test('offline archive rejects changed model bytes, tampered npm cache and changed application version', t => {
    const root = fixture(t);
    sealOfflineBundle(root);
    write(root, 'public/ai/models/u2netp.onnx', 'tampered');
    assert.throws(() => verifyOfflineBundle(root), /missing or modified.*u2netp/);
    write(root, 'public/ai/models/u2netp.onnx', 'fixture:public/ai/models/u2netp.onnx');
    write(root, '.offline/npm-cache/_cacache/content-v2/sha512/ab/cd/123', 'other tarball');
    assert.throws(() => verifyOfflineBundle(root), /missing or modified.*npm-cache/);
    write(root, '.offline/npm-cache/_cacache/content-v2/sha512/ab/cd/123', 'cached tarball fixture');
    write(root, 'package.json', JSON.stringify({version:'0.20.1'}));
    assert.throws(() => verifyOfflineBundle(root), /metadata\/version/);
});

test('offline archive rejects symlinks and unsafe manifest paths', t => {
    const root = fixture(t);
    sealOfflineBundle(root);
    const manifestPath = path.join(root, '.offline/manifest.json');
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    data.assets['../password.txt'] = '0'.repeat(64);
    write(root, '.offline/manifest.json', JSON.stringify(data));
    assert.throws(() => verifyOfflineBundle(root), /Unexpected file in offline manifest/);
    delete data.assets['../password.txt'];
    write(root, '.offline/manifest.json', JSON.stringify(data));
    const vendor = path.join(root, 'public/ai/models/u2netp.onnx');
    fs.rmSync(vendor);
    fs.symlinkSync(path.join(root, 'package.json'), vendor);
    assert.throws(() => verifyOfflineBundle(root), /Symlink in offline archive path/);
});

test('offline startup installs from an isolated cache and verifies AI assets, never fetching network data', t => {
    const root = fixture(t);
    sealOfflineBundle(root);
    const calls=[];
    prepareStartup({root, env:{HTTPS_ENABLED:'false'}, execute:(binary,args) => {
        calls.push([binary,...args]);
        if (args.includes('ci')) {
            assert.ok(args.includes('--offline'));
            assert.ok(args.includes('--ignore-scripts'));
            const cache = args[args.indexOf('--cache') + 1];
            assert.notEqual(cache, path.join(root,'.offline/npm-cache'));
            assert.ok(fs.existsSync(path.join(cache,'_cacache/content-v2/sha512/ab/cd/123')));
            write(root, 'node_modules/three/package.json', JSON.stringify({version:'0.187.0'}));
            write(root, 'node_modules/.package-lock.json', JSON.stringify({packages:{'node_modules/three':{version:'0.187.0'}}}));
            write(cache, '_cacache/index-v5/01/02/fixture', 'npm changed this index');
        }
    }});
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], [process.execPath, 'scripts/prepare-cutout-assets.js', '--verify']);
    assert.deepEqual(verifyOfflineBundle(root).version, '0.20.0');
    assert.equal(fs.existsSync(calls[0][calls[0].indexOf('--cache')+1]), false);
});

test('an incomplete offline bundle must fail closed before attempting npm installation', t => {
    const root = fixture(t);
    let called=false;
    assert.throws(() => prepareStartup({root, env:{HTTPS_ENABLED:'false'},execute:()=>{called=true;}}),/manifest missing/);
    assert.equal(called,false);
});

test('offline release workflow archives source dependencies, validates restoration and blocks promotion on failures', () => {
    const release = fs.readFileSync('.github/workflows/release.yml','utf8');
    assert.match(release, /Build and verify fully offline installation ZIP/);
    assert.match(release, /npm_config_offline=true/);
    assert.match(release, /node scripts\/offline-bundle\.js seal/);
    assert.match(release, /docker image save --platform "\$platform"/);
    assert.match(release, /docker load/);
    assert.match(release, /--network none/);
    assert.match(release, /needs: \[prepare, package, docker, docker-offline\]/);
    assert.match(fs.readFileSync('.dockerignore','utf8'), /^\.offline$/m);
    assert.match(fs.readFileSync('.gitignore','utf8'), /^\.offline\/$/m);
});
