import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {ROOT, IMAGE_DIR} from '../storage/paths.js';
import {fail} from '../domain/errors.js';
const WEB = path.resolve(fileURLToPath(new URL('../../public/', import.meta.url)));
const SHARED = path.resolve(WEB, '../shared');
// Only browser-safe shared modules are served. Node-only backup modules stay
// private.
export const SHARED_BROWSER_FILES = new Set([
  'resource-delta.js',
  'warehouse-bottle-projection.js',
  'api-error-codes.js',
  'api-error-field-labels.js',
  'flavor-profile.js',
  'whisky-colors.js',
  'whisky-color-names.js',
  'tasting.js',
  'tasting-subject.js',
  'tasting-records.js',
  'standalone-tastings.js',
  'tasting-flights.js',
  'collection-saved-views.js',
  'photo-images.js',
  'warehouse-compartments.js',
  'warehouse-placement.js',
  'photo-adjustments.js',
]);
function decodePath(encoded) {
  try {return decodeURIComponent(encoded);}
  catch (error) {
    if (error instanceof
      URIError) throw fail('Ungültiger Pfad', 400, "api.errors.invalidPath");
    throw error;
  }
}

/**
 * Hash the actual inline theme bootstrap and import map; no unsafe-inline
 * scripts.
 */
function htmlSecurityHeaders(html) {
  const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([, body]) => `'sha256-${crypto.createHash('sha256').update(body)
      .digest('base64')}'`);
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://tile.openstreetmap.org",
      "font-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      // PDF previews use an authenticated same-origin URL, never a blob frame.
      "frame-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'",
    ].join('; '),
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

/** Metadata validation prevents re-sending large local AI models and WASM files.
 * Unversioned paths still require revalidation; never mark them immutable. */
function streamStatic(req, res, file, contentType, cacheControl, securityHeaders = {}) {
  const stat = fs.statSync(file);
  const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs)
    .toString(16)}"`;
  const lastModified = stat.mtime.toUTCString();
  const headers = {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': cacheControl,
    'ETag': etag,
    'Last-Modified': lastModified,
    ...securityHeaders,
  };
  const ifNoneMatch = req.headers?.['if-none-match'];
  // If-None-Match takes precedence over If-Modified-Since, even on a miss.
  const etagMatches = typeof ifNoneMatch === 'string' &&
    (ifNoneMatch.trim() === '*' || ifNoneMatch.split(',').some(value =>
      value.trim().replace(/^W\//, '') === etag.replace(/^W\//, '')));
  const ifModifiedSince = req.headers?.['if-modified-since'];
  const since = typeof ifModifiedSince === 'string' ?
    Date.parse(ifModifiedSince) : NaN;
  const modifiedSinceMatches = ifNoneMatch === undefined &&
    Number.isFinite(since) &&
    Math.floor(stat.mtimeMs / 1000) * 1000 <= since;
  if (etagMatches || modifiedSinceMatches) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(200, headers);
  return pipeline(fs.createReadStream(file), res);
}

export async function serveStatic(req, res, url) {
  // Runtime data must never become static assets, even if DATA_ROOT was
  // misconfigured inside public/.
  if (/^\/(?:data|documents|backups|secrets)(?:\/|$)/.test(url.pathname)) {
    throw fail('Datei nicht gefunden', 404, 'api.errors.fileNotFound');
  }
  let file;
  if (url.pathname === '/vendor/html5-qrcode.min.js') {
    const vendor = path.resolve(WEB, '../node_modules/html5-qrcode/html5-qrcode.min.js');
    if (!fs.existsSync(vendor)) throw fail(
      'Scanner-Bibliothek fehlt. Bitte npm install ausführen.',
      503,
      "api.errors.scannerLibraryIsMissingRunNpmInstall"
    );
    return streamStatic(
      req,
      res,
      vendor,
      'text/javascript; charset=utf-8',
      'public, max-age=3600'
    );
  }
  // Only these fixed Three.js ESM files are exposed from node_modules.
  // No CDN dependency and no arbitrary access to installed packages.
  const threeFiles = {
    '/vendor/three.module.js': 'build/three.module.js',
    '/vendor/three.core.js': 'build/three.core.js',
    '/vendor/three/addons/controls/OrbitControls.js': 'examples/jsm/controls/OrbitControls.js',
  };
  if (Object.hasOwn(threeFiles, url.pathname)) {
    const vendor = path.resolve(WEB, '../node_modules/three', threeFiles[url.pathname]);
    if (!fs.existsSync(vendor)) throw fail(
      'Three.js fehlt. Bitte npm ci ausführen.',
      503,
      "api.errors.threeJsIsMissingRunNpmCi"
    );
    return streamStatic(
      req,
      res,
      vendor,
      'text/javascript; charset=utf-8',
      'public, max-age=3600'
    );
  }
  if (url.pathname.startsWith('/shared/')) {
    const name = decodePath(url.pathname.slice('/shared/'.length));
    if (!SHARED_BROWSER_FILES.has(name)) throw fail('Datei nicht gefunden', 404, "api.errors.fileNotFound");
    file = path.join(SHARED, name);
  } else if (url.pathname.startsWith('/images/')) {
    const name = decodePath(url.pathname.slice(1));
    file = path.resolve(ROOT, name);
    if (!file.startsWith(IMAGE_DIR +
      path.sep)) throw fail('Ungültiger Bildpfad', 403, "api.errors.invalidImagePath");
  } else {
    const name = url.pathname === '/' ? 'index.html' :
      decodePath(url.pathname.slice(1));
    file = path.resolve(WEB, name);
    if (file !== WEB && !file.startsWith(WEB +
      path.sep)) throw fail('Ungültiger Pfad', 403, "api.errors.invalidPath");
  }
  if (!fs.existsSync(file) || !fs.statSync(file)
    .isFile()) throw fail('Datei nicht gefunden', 404, "api.errors.fileNotFound");
  const ext = path.extname(file).toLowerCase();
  const types = {
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.onnx': 'application/octet-stream',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
  };
  // Paths such as /ai/vendor/ort.wasm.min.mjs and /ai/models/u2netp.onnx
  // have no version/hash in the URL. They MUST revalidate before reuse.
  const versionedAi = url.pathname.startsWith('/ai/') &&
    /(?:^|\/)(?:v?\d+\.\d+\.\d+|[a-f0-9]{16,})(?:\/|[-.])/i
      .test(url.pathname.slice(4));
  const cacheControl = versionedAi ? 'public, max-age=31536000, immutable' :
    'no-cache';
  return streamStatic(
    req,
    res,
    file,
    types[ext] || 'application/octet-stream',
    cacheControl,
    ext === '.html' ? htmlSecurityHeaders(fs.readFileSync(file, 'utf8')) : {}
  );
}
