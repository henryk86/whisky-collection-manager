#!/usr/bin/env node
/** Integrity seal for source releases that carry a complete npm cache and local
 * AI runtime. This script deliberately never downloads anything itself.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OFFLINE_MANIFEST = '.offline/manifest.json';
const MODEL_FILES = [
    'public/ai/models/u2netp.onnx',
    'public/ai/vendor/ort.wasm.min.mjs',
    'public/ai/vendor/ort-wasm-simd-threaded.mjs',
    'public/ai/vendor/ort-wasm-simd-threaded.wasm',
];
const MANIFEST_FILES = ['package.json', 'package-lock.json', ...MODEL_FILES,
    'public/ai/licenses/Apache-2.0.txt', 'public/ai/licenses/ONNX-Runtime-Web-NOTICE.txt'];
const validSha = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

function safePath(root, relative) {
    if (typeof relative !== 'string' || !relative || path.posix.isAbsolute(relative)
        || relative.includes('\\') || relative.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error(`Unsafe offline archive path: ${relative}`);
    }
    const target = path.join(root, relative);
    // Neither input assets nor their parents may be symlinks to private files.
    let segment = root;
    for (const part of relative.split('/')) {
        segment = path.join(segment, part);
        if (fs.lstatSync(segment, { throwIfNoEntry: false })?.isSymbolicLink()) {
            throw new Error(`Symlink in offline archive path: ${relative}`);
        }
    }
    return target;
}

function hashFile(filename) {
    const hash = crypto.createHash('sha256');
    const fd = fs.openSync(filename, 'r');
    try {
        const chunk = Buffer.allocUnsafe(1024 * 1024);
        for (;;) {
            const n = fs.readSync(fd, chunk, 0, chunk.length, null);
            if (!n) break;
            hash.update(chunk.subarray(0, n));
        }
    } finally { fs.closeSync(fd); }
    return hash.digest('hex');
}

function allFiles(root, relative) {
    const directory = safePath(root, relative);
    if (!fs.existsSync(directory)) throw new Error(`Missing offline npm cache: ${relative}`);
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    return entries.flatMap(entry => {
        const name = `${relative}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`Symlink in offline npm cache: ${name}`);
        if (entry.isDirectory()) return allFiles(root, name);
        if (!entry.isFile()) throw new Error(`Unexpected file type in offline npm cache: ${name}`);
        return [name];
    });
}

export function sealOfflineBundle(root = ROOT) {
    const cachePath = path.join(root, '.offline', 'npm-cache');
    if (!fs.existsSync(cachePath)) throw new Error('Offline npm cache missing.');
    // Keep precisely the content-addressed store; never archive npm logs or auth/configuration.
    for (const entry of fs.readdirSync(cachePath)) {
        if (entry !== '_cacache') fs.rmSync(path.join(cachePath, entry), { recursive: true, force: true });
    }
    const cached = allFiles(root, '.offline/npm-cache/_cacache');
    if (!cached.some(name => name.includes('/content-v2/'))) {
        throw new Error('Offline npm cache is empty: run npm ci with --cache .offline/npm-cache first.');
    }
    const files = [...MANIFEST_FILES, ...cached];
    const hashes = Object.fromEntries(files.sort().map(name => {
        const filename = safePath(root, name);
        if (!fs.statSync(filename).isFile()) throw new Error(`Missing required offline asset: ${name}`);
        return [name, hashFile(filename)];
    }));
    const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    const manifest = { schema: 1, version, npm: 'locked npm ci --offline', assets: hashes };
    const destination = path.join(root, OFFLINE_MANIFEST);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
}

export function verifyOfflineBundle(root = ROOT) {
    const name = path.join(root, OFFLINE_MANIFEST);
    if (!fs.existsSync(name)) throw new Error('Offline bundle manifest missing.');
    const manifest = JSON.parse(fs.readFileSync(name, 'utf8'));
    const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    if (manifest.schema !== 1 || manifest.version !== version || !manifest.assets || Array.isArray(manifest.assets)
        || typeof manifest.assets !== 'object') throw new Error('Offline bundle metadata/version invalid.');
    for (const required of MANIFEST_FILES) {
        if (!validSha(manifest.assets[required])) throw new Error(`Offline bundle missing required hash: ${required}`);
    }
    const entries = Object.entries(manifest.assets);
    if (!entries.some(([name]) => name.startsWith('.offline/npm-cache/_cacache/content-v2/'))) {
        throw new Error('Offline bundle has no npm tarball content.');
    }
    for (const [relative, checksum] of entries) {
        if (!MANIFEST_FILES.includes(relative) && !relative.startsWith('.offline/npm-cache/_cacache/')) {
            throw new Error(`Unexpected file in offline manifest: ${relative}`);
        }
        if (!validSha(checksum)) throw new Error(`Invalid checksum in offline manifest: ${relative}`);
        const filename = safePath(root, relative);
        if (!fs.existsSync(filename) || !fs.statSync(filename).isFile() || hashFile(filename) !== checksum) {
            throw new Error(`Offline asset missing or modified: ${relative}`);
        }
    }
    return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const command = process.argv[2];
        if (command === 'seal') {
            const manifest = sealOfflineBundle();
            console.log(`Offline archive sealed: ${Object.keys(manifest.assets).length} verified files (v${manifest.version}).`);
        } else if (command === 'verify') {
            const manifest = verifyOfflineBundle();
            console.log(`Offline archive valid: ${Object.keys(manifest.assets).length} SHA-256 checks (v${manifest.version}).`);
        } else throw new Error('Usage: node scripts/offline-bundle.js seal|verify');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
