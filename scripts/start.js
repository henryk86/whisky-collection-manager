#!/usr/bin/env node
/** Cross-platform local startup: install only missing dependencies, prepare
 * offline cutout assets, provision initial local TLS and launch the server.
 * The Docker supervisor has its own build-time setup and is not changed here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return null; }
}

/** Use npm's installed lockfile to detect stale or partial installations.
 * Unlike blindly running npm ci at every start, this works offline after
 * the initial install and does not delete node_modules unnecessarily.
 */
export function needsNpmCi(root, { production = false } = {}) {
    const wanted = readJson(path.join(root, 'package-lock.json'));
    const installed = readJson(path.join(root, 'node_modules', '.package-lock.json'));
    if (!wanted?.packages || !installed?.packages) return true;
    for (const [name, entry] of Object.entries(wanted.packages)) {
        if (!name.startsWith('node_modules/') || (production && entry.dev)) continue;
        if (installed.packages[name]?.version !== entry.version) return true;
        if (!fs.existsSync(path.join(root, name, 'package.json'))) return true;
    }
    return false;
}

function readEnvFile(root) {
    const result = {};
    const file = path.join(root, '.env');
    if (!fs.existsSync(file)) return result;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match) continue;
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        } else {
            value = value.replace(/\s+#.*$/, '').trim();
        }
        result[match[1]] = value;
    }
    return result;
}

export function localTlsStatus(root, env = process.env) {
    const fileEnv = readEnvFile(root);
    const setting = (key, fallback) => env[key] ?? fileEnv[key] ?? fallback;
    const enabled = String(setting('HTTPS_ENABLED', 'true')).toLowerCase();
    if (enabled === 'false' || enabled === '0') return 'disabled';
    if (enabled !== 'true' && enabled !== '1') return 'configured'; // Server validates bad values.
    const key = setting('HTTPS_KEY_FILE', 'certs/server-key.pem');
    const cert = setting('HTTPS_CERT_FILE', 'certs/server-cert.pem');
    const isReady = file => {
        const location = path.resolve(root, file);
        try { return fs.statSync(location).size > 0; }
        catch { return false; }
    };
    if (isReady(key) && isReady(cert)) return 'ready';
    // Never overwrite an operator-managed certificate or an externally set path.
    if (key !== 'certs/server-key.pem' || cert !== 'certs/server-cert.pem') return 'custom-missing';
    return 'missing';
}

function npmCommand(env) {
    // npm supplies npm_execpath to npm run scripts. This avoids spawning
    // npm.cmd through a shell on Windows (Node 22 disallows that by default).
    const npmCli = env.npm_execpath;
    if (npmCli && fs.existsSync(npmCli)) return [process.execPath, [npmCli]];
    return [process.platform === 'win32' ? 'npm.cmd' : 'npm', []];
}

function defaultExecute(command, args, { root, env }) {
    const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' && command.endsWith('.cmd') });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${path.basename(command)} ${args.join(' ')} failed (${result.status ?? result.signal}).`);
}

/** Exposed for deterministic tests without installing packages or downloading models. */
export function prepareStartup({ root = ROOT, env = process.env, execute = defaultExecute } = {}) {
    const production = env.NODE_ENV === 'production';
    if (needsNpmCi(root, { production })) {
        console.log('[Start] Installing missing/stale npm dependencies...');
        const [binary, prefix] = npmCommand(env);
        execute(binary, [...prefix, 'ci', ...(production ? ['--omit=dev'] : [])], { root, env });
        if (needsNpmCi(root, { production })) {
            throw new Error('npm ci did not install all dependencies. Check package-lock.json and node_modules.');
        }
    }

    console.log('[Start] Checking local bottle cutout assets...');
    execute(process.execPath, ['scripts/prepare-cutout-assets.js'], { root, env });

    if (!fs.existsSync(path.join(root, '.env')) && !production) {
        fs.copyFileSync(path.join(root, '.env.example'), path.join(root, '.env'), fs.constants.COPYFILE_EXCL);
        console.log('[Start] Created .env from .env.example.');
    }
    const tls = localTlsStatus(root, env);
    if (tls === 'custom-missing') {
        throw new Error('Configured HTTPS certificate/key missing. Supply the configured files or update HTTPS_CERT_FILE and HTTPS_KEY_FILE.');
    }
    if (tls === 'missing') {
        console.log('[Start] Creating initial local HTTPS certificate...');
        execute(process.execPath, ['scripts/setup-https.js'], { root, env });
        if (localTlsStatus(root, env) !== 'ready') {
            throw new Error('HTTPS setup did not create usable certificate and key files. Install mkcert or OpenSSL, then rerun npm start.');
        }
    }
}

export function launchServer({ root = ROOT, env = process.env } = {}) {
    const server = spawn(process.execPath, ['server/index.js'], { cwd: root, env, stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => server.kill(signal));
    }
    server.on('error', error => { console.error(`[Start] Server failed: ${error.message}`); process.exitCode = 1; });
    server.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
    return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        prepareStartup();
        launchServer();
    } catch (error) {
        console.error(`[Start] ${error.message}`);
        process.exitCode = 1;
    }
}
