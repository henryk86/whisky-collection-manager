import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('npm start runs cutout preparation before launching the server, without reinstalling valid dependencies', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-start-process-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const name of ['package.json', 'package-lock.json', '.env.example']) {
        fs.copyFileSync(path.join(projectRoot, name), path.join(root, name));
    }
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.mkdirSync(path.join(root, 'server'));
    fs.copyFileSync(path.join(projectRoot, 'scripts/start.js'), path.join(root, 'scripts/start.js'));
    // The two controlled substitutes validate the actual npm/start process flow.
    // No external ONNX download, certificate tool or network is required.
    fs.writeFileSync(path.join(root, 'scripts/prepare-cutout-assets.js'), 'console.log("[smoke] cutout prepared")\n');
    fs.writeFileSync(path.join(root, 'server/index.js'), 'console.log("[smoke] server launched")\n');
    fs.writeFileSync(path.join(root, '.env'), 'HTTPS_ENABLED=false\nHTTP_ENABLED=true\n');

    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const installed = {};
    for (const [name, entry] of Object.entries(lock.packages)) {
        if (!name.startsWith('node_modules/')) continue;
        const directory = path.join(root, name);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ version: entry.version }));
        installed[name] = entry;
    }
    fs.writeFileSync(path.join(root, 'node_modules/.package-lock.json'), JSON.stringify({ packages: installed }));

    const npmExecPath = process.env.npm_execpath;
    const command = npmExecPath && fs.existsSync(npmExecPath) ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
    const args = npmExecPath && fs.existsSync(npmExecPath) ? [npmExecPath, 'start'] : ['start'];
    const result = spawnSync(command, args, {
        cwd: root,
        encoding: 'utf8',
        timeout: 15000,
        shell: process.platform === 'win32' && command.endsWith('.cmd'),
        env: { ...process.env, HTTPS_ENABLED: 'false', HTTP_ENABLED: 'true' },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /Installing missing\/stale npm dependencies/);
    const prepared = result.stdout.indexOf('[smoke] cutout prepared');
    const started = result.stdout.indexOf('[smoke] server launched');
    assert.ok(prepared >= 0 && started > prepared, result.stdout);
});
