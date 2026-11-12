#!/usr/bin/env node
/** Download pinned, locally hosted AI runtime assets during installation/image build.
 * These files are deliberately not fetched from the user's browser or a CDN at runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = '1.31.1';
const targets = [
    {
        name: 'ai/models/u2netp.onnx',
        urls: [
            'https://huggingface.co/edgetools/u2netp/resolve/main/u2netp.onnx',
            'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
        ],
        bytes: 4574861,
        sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
    },
    ...['ort.wasm.min.mjs', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'].map(name => ({
        name: `ai/vendor/${name}`,
        urls: [
            `https://cdn.jsdelivr.net/npm/onnxruntime-web@${runtime}/dist/${name}`,
            `https://unpkg.com/onnxruntime-web@${runtime}/dist/${name}`,
        ],
        minimumBytes: name.endsWith('.wasm') ? 1000000 : 10000,
    })),
];

function valid(bytes, entry) {
    if (entry.bytes != null && bytes.length !== entry.bytes) return false;
    if (entry.minimumBytes && bytes.length < entry.minimumBytes) return false;
    if (entry.sha256 && crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) return false;
    if (entry.name.endsWith('.wasm') && bytes.toString('hex', 0, 4) !== '0061736d') return false;
    if (entry.name.endsWith('.onnx') && bytes.length < 1000000) return false;
    return true;
}

async function download(entry) {
    const target = path.join(root, 'public', entry.name);
    if (fs.existsSync(target) && valid(fs.readFileSync(target), entry)) return;
    if (process.argv.includes('--verify')) throw new Error(`${entry.name} fehlt oder ist beschädigt. npm run cutout:prepare ausführen.`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    let content;
    let lastError;
    for (const url of entry.urls) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const candidate = Buffer.from(await response.arrayBuffer());
            if (!valid(candidate, entry)) throw new Error('Dateigröße, Format oder Prüfsumme stimmt nicht');
            content = candidate;
            break;
        } catch (error) {
            lastError = error;
            console.warn(`${entry.name}: Downloadversuch fehlgeschlagen (${error.message})`);
        }
    }
    if (!content) throw new Error(`${entry.name}: ${lastError?.message || 'Keine Quelle erreichbar'}`);
    const temp = `${target}.tmp-${process.pid}`;
    try { fs.writeFileSync(temp, content, { mode: 0o644 }); fs.renameSync(temp, target); }
    finally { fs.rmSync(temp, { force: true }); }
    console.log(`${entry.name}: ${content.length} Bytes bereitgestellt`);
}

try {
    for (const item of targets) await download(item);
    console.log('KI-Freistellung: lokale Laufzeit und Modell sind bereit.');
} catch (error) {
    console.error(`KI-Freistellung konnte nicht vorbereitet werden: ${error.message}`);
    process.exitCode = 1;
}
