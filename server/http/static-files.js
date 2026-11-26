import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {ROOT, DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, BACKUP_DIR} from '../storage/paths.js';
import {HTTPS_KEY_FILE} from '../config.js';
import {fail} from '../domain/errors.js';
const WEB = path.resolve(fileURLToPath(new URL('../../public/', import.meta.url)));
const SHARED = path.resolve(WEB, '../shared');
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const PRIVATE_LOCATIONS = [
  DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, BACKUP_DIR, path.join(ROOT, 'secrets'),
  ...['data', 'images', 'documents', 'backups', 'secrets'].map(name => path.join(WEB, name)),
  HTTPS_KEY_FILE,
  ...['BACKUP_CONTROL_DIR', 'BACKUP_TARGET_ROOT', 'RCLONE_CONFIG',
    'BACKUP_ADMIN_TOKEN_FILE', 'BACKUP_WORKER_TOKEN_FILE', 'RESTIC_PASSWORD_FILE']
    .map(name => process.env[name]).filter(Boolean).map(name => path.resolve(name)),
];

/**
 * Checks containment using path components, including Windows path semantics.
 * @param {string} location Allowed directory or exact file path.
 * @param {string} file Candidate absolute path.
 * @return {boolean} Whether the file is the location itself or a descendant.
 */
function containsPath(location, file) {
  const relative = path.relative(location, file);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/**
 * Rejects private storage exposed through misplaced or aliased public paths.
 * @param {string} file Lexically resolved public file path.
 * @param {string} realFile Canonical filesystem path after resolving links.
 * @return {boolean} Whether the requested file belongs to configured private storage.
 */
function isPrivateLocation(file, realFile) {
  return PRIVATE_LOCATIONS.some(location => containsPath(location, file) ||
    (fs.existsSync(location) && containsPath(fs.realpathSync(location), realFile)));
}

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
/**
 * Decodes a URL path and converts malformed percent encoding into a bad-request error.
 * @param {string} encoded Encoded request path.
 * @return {string} Decoded path.
 */
function decodePath(encoded) {
  try {
    const decoded = decodeURIComponent(encoded);
    if (decoded.includes('\0')) throw new URIError('NUL in path');
    return decoded;
  }
  catch (error) {
    if (error instanceof URIError) throw fail('Ungültiger Pfad', 400, "api.errors.invalidPath");
    throw error;
  }
}

/**
 * Hash the actual inline theme bootstrap and import map; no unsafe-inline
 * scripts.
 *
 * @param {string} html Static HTML document whose inline scripts require CSP hashes.
 * @return {!Object} Security headers containing the exact inline-script hashes and restrictive CSP.
 */
function htmlSecurityHeaders(html) {
  // HTML parsing normalizes CRLF and CR before CSP checks inline scripts.
  const normalized = html.replace(/\r\n?/g, '\n');
  const hashes = [...normalized.matchAll(/<script\b(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi)].map(([, body]) => `'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`);
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

/**
 * Metadata validation prevents re-sending large local AI models and WASM
 * files. Unversioned paths still require revalidation; never mark them
 * immutable.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {!Object} res Outgoing HTTP response.
 * @param {*} file Source file or file name being processed.
 * @param {string} contentType Media type of the static file.
 * @param {string} cacheControl Cache policy for the resource.
 * @param {!Object=} securityHeaders Additional security headers, including CSP for HTML documents.
 * @return {*} Whether the requested condition is met.
 */
function streamStatic(req, res, file, contentType, cacheControl,
  securityHeaders = {}) {
  const stat = fs.statSync(file);
  const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
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
    (ifNoneMatch.trim() === '*' || ifNoneMatch.split(',').some(value => value.trim().replace(/^W\//, '') === etag.replace(/^W\//, '')));
  const ifModifiedSince = req.headers?.['if-modified-since'];
  const since = typeof ifModifiedSince === 'string' ? Date.parse(ifModifiedSince) : NaN;
  const modifiedSinceMatches = ifNoneMatch === undefined && Number.isFinite(since) && Math.floor(stat.mtimeMs / 1000) * 1000 <= since;
  if (etagMatches || modifiedSinceMatches) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(200, headers);
  return pipeline(fs.createReadStream(file), res);
}

/**
 * Serves permitted public files using safe paths and response headers.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {!Object} res Outgoing HTTP response.
 * @param {URL} url Parsed request URL.
 * @return {!Promise<*>} Completion of serving or rejecting the requested public resource.
 */
export async function serveStatic(req, res, url) {
  // Runtime data must never become static assets, even if DATA_ROOT was
  // misconfigured inside public/.
  if (/^\/(?:data|documents|backups|secrets)(?:\/|$)/.test(url.pathname)) {
    throw fail('Datei nicht gefunden', 404, 'api.errors.fileNotFound');
  }
  let file;
  let base;
  if (url.pathname === '/vendor/html5-qrcode.min.js') {
    const vendor = path.resolve(WEB, '../node_modules/html5-qrcode/html5-qrcode.min.js');
    if (!fs.existsSync(vendor)) throw fail(
      'Scanner-Bibliothek fehlt. Bitte npm install ausführen.',
      503,
      "api.errors.scannerLibraryIsMissingRunNpmInstall"
    );
    return streamStatic(req, res, vendor, 'text/javascript; charset=utf-8', 'public, max-age=3600');
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
    if (!fs.existsSync(vendor)) throw fail('Three.js fehlt. Bitte npm ci ausführen.', 503, "api.errors.threeJsIsMissingRunNpmCi");
    return streamStatic(req, res, vendor, 'text/javascript; charset=utf-8', 'public, max-age=3600');
  }
  if (url.pathname.startsWith('/shared/')) {
    const name = decodePath(url.pathname.slice('/shared/'.length));
    if (!SHARED_BROWSER_FILES.has(name)) throw fail('Datei nicht gefunden', 404, "api.errors.fileNotFound");
    base = SHARED;
    file = path.join(SHARED, name);
  } else if (url.pathname.startsWith('/images/')) {
    const name = decodePath(url.pathname.slice(1));
    base = IMAGE_DIR;
    file = path.resolve(ROOT, name);
    if (!containsPath(base, file)) throw fail('Ungültiger Bildpfad', 403, "api.errors.invalidImagePath");
  } else {
    const name = url.pathname === '/' ? 'index.html' : decodePath(url.pathname.slice(1));
    base = WEB;
    file = path.resolve(WEB, name);
    if (!containsPath(base, file)) throw fail('Ungültiger Pfad', 403, "api.errors.invalidPath");
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw fail('Datei nicht gefunden', 404, "api.errors.fileNotFound");
  const realFile = fs.realpathSync(file);
  if (!containsPath(fs.realpathSync(base), realFile)) {
    throw fail('Ungültiger Pfad', 403, "api.errors.invalidPath");
  }
  if (base !== IMAGE_DIR && isPrivateLocation(file, realFile)) {
    throw fail('Datei nicht gefunden', 404, "api.errors.fileNotFound");
  }
  const ext = path.extname(realFile).toLowerCase();
  if (base === IMAGE_DIR && !RASTER_EXTENSIONS.has(ext)) {
    throw fail('Datei nicht gefunden', 404, "api.errors.fileNotFound");
  }
  // Open the checked canonical path, not the unchecked symlink alias.
  file = realFile;
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
    /(?:^|\/)(?:v?\d+\.\d+\.\d+|[a-f0-9]{16,})(?:\/|[-.])/i.test(url.pathname.slice(4));
  const cacheControl = base === IMAGE_DIR ? 'private, no-cache' :
    versionedAi ? 'public, max-age=31536000, immutable' : 'no-cache';
  return streamStatic(
    req,
    res,
    file,
    types[ext] || 'application/octet-stream',
    cacheControl,
    ext === '.html' ? htmlSecurityHeaders(fs.readFileSync(file, 'utf8')) : {}
  );
}
