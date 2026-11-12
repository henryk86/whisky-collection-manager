import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { ROOT, IMAGE_DIR } from '../storage/paths.js';
import { fail } from '../domain/errors.js';
const WEB = path.resolve(fileURLToPath(new URL('../../public/', import.meta.url)));
function decodePath(encoded) {
    try { return decodeURIComponent(encoded); }
    catch (error) {
        if (error instanceof URIError) throw fail('Ungültiger Pfad', 400);
        throw error;
    }
}

/** Hash the actual inline theme bootstrap and import map; no unsafe-inline scripts. */
function htmlSecurityHeaders(html) {
    const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi)]
        .map(([, body]) => `'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`);
    return {
        'Content-Security-Policy': [
            "default-src 'self'",
            `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://tile.openstreetmap.org",
            "font-src 'self' data:",
            "connect-src 'self'",
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
            "base-uri 'none'",
            "object-src 'none'",
        ].join('; '),
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
}

export async function serveStatic(req, res, url) {
    let file;
    if (url.pathname === '/vendor/html5-qrcode.min.js') {
        const vendor = path.resolve(WEB, '../node_modules/html5-qrcode/html5-qrcode.min.js');
        if (!fs.existsSync(vendor)) {
            throw fail('Scanner-Bibliothek fehlt. Bitte npm install ausführen.', 503);
        }
        res.writeHead(200, {
            'Content-Type': 'text/javascript; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600'
        });
        return pipeline(fs.createReadStream(vendor), res);
    }
    // Only these fixed Three.js ESM files are exposed from node_modules.
    // No CDN dependency and no arbitrary access to installed packages.
    const threeFiles = {
        '/vendor/three.module.js':'build/three.module.js',
        '/vendor/three.core.js':'build/three.core.js',
        '/vendor/three/addons/controls/OrbitControls.js':'examples/jsm/controls/OrbitControls.js'
    };
    if (Object.hasOwn(threeFiles, url.pathname)) {
        const vendor=path.resolve(WEB,'../node_modules/three',threeFiles[url.pathname]);
        if (!fs.existsSync(vendor)) throw fail('Three.js fehlt. Bitte npm ci ausführen.',503);
        res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8',
            'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600'});
        return pipeline(fs.createReadStream(vendor), res);
    }
    if (url.pathname.startsWith('/images/')) {
        const name = decodePath(url.pathname.slice(1));
        file = path.resolve(ROOT, name);
        if (!file.startsWith(IMAGE_DIR + path.sep)) {
            throw fail('Ungültiger Bildpfad', 403);
        }
    }
    else {
        const name = url.pathname === '/' ? 'index.html' : decodePath(url.pathname.slice(1));
        file = path.resolve(WEB, name);
        if (file !== WEB && !file.startsWith(WEB + path.sep)) {
            throw fail('Ungültiger Pfad', 403);
        }
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        throw fail('Datei nicht gefunden', 404);
    }
    const ext = path.extname(file).toLowerCase();
    const types = {
        '.webmanifest': 'application/manifest+json; charset=utf-8', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon'
    };
    res.writeHead(200, {
        'Content-Type': types[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache',
        ...(ext === '.html' ? htmlSecurityHeaders(fs.readFileSync(file, 'utf8')) : {})
    });
    await pipeline(fs.createReadStream(file), res);
}
