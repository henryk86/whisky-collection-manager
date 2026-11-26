/** Versioned source-file fingerprints make ZIP upgrades auditable without
 * keeping
 * the previous release unpacked. Never include mutable user data or local keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const FILENAME = 'wcm-source-manifest.json';
export const MODULE_DIRS = ['public/js', 'server', 'shared', 'worker'];
/**
 * Calculates the release manifest checksum for a file.
 * @param {string} file File path.
 * @return {string} Hexadecimal SHA-256 digest.
 */
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Computes the reproducible source manifest for a release.
 *
 * @param {*} root Root element or directory.
 * @return {!Object} Structured result for the caller.
 */
export function sourceManifest(root) {
  const files = {};
  /**
   * Orders the scan records using the configured comparison.
   *
   * @param {*} dir Directory containing the affected files.
   */
  function scan(dir) {
    if (!fs.existsSync(path.join(root, dir))) return;
    for (const item of fs.readdirSync(path.join(root, dir), {withFileTypes: true, }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = `${dir}/${item.name}`;
      if (item.isDirectory()) scan(name);
      else if (item.isFile() && /\.(?:js|mjs|json)$/.test(item.name))
        files[name] = hash(path.join(root, name));
      else if (item.isSymbolicLink()) throw new Error(`Symlink in source release: ${name}`);
    }
  }
  for (const dir of MODULE_DIRS) scan(dir);
  return {
    schema: 1,
    version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
    files,
  };
}

/**
 * Updates source manifest for release manifest.
 *
 * @param {*} root Root element or directory.
 */
export function writeSourceManifest(root) {
  fs.writeFileSync(path.join(root, FILENAME), JSON.stringify(sourceManifest(root), null, 2) + '\n');
}

/**
 * Parses source manifest for release manifest.
 *
 * @param {*} root Root element or directory.
 * @return {*} Parsed JSON value.
 */
export function readSourceManifest(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, FILENAME), 'utf8'));
  if (manifest?.schema !== 1 || typeof manifest.version !== 'string' || !manifest.files || typeof manifest.files !== 'object' ||
    Array.isArray(manifest.files))
    throw new Error('Invalid WCM source manifest');
  for (const [name, value] of Object.entries(manifest.files)) {
    if (!MODULE_DIRS.some(dir => name.startsWith(dir + '/')) ||
      name.split('/').some(part => part === '..' || !part || part === '.') ||
      !/^[a-zA-Z0-9_./-]+$/.test(name) || !/^[a-f0-9]{64}$/.test(value))
      throw new Error(`Unsafe WCM manifest entry: ${name}`);
  }
  return manifest;
}

/**
 * Validates source manifest for release manifest.
 *
 * @param {*} root Root element or directory.
 * @return {*} Serialized JSON text.
 */
export function verifySourceManifest(root) {
  const expected = readSourceManifest(root);
  const actual = sourceManifest(root);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Source manifest differs from release files');
  return expected;
}
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const root = path.resolve(process.argv[3] || '.');
    if (process.argv[2] === 'create') writeSourceManifest(root);
    else if (process.argv[2] === 'verify') verifySourceManifest(root);
    else throw new Error('Usage: node scripts/release-manifest.js create|verify [root]');
    console.log('WCM source manifest OK');
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
