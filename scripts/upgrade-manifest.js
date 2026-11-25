/** Inspect obsolete source modules before overwriting an old ZIP installation.
 * --prune only removes unchanged files listed in the OLD signed-by-content
 * manifest; it cannot touch arbitrary extra files, data or symlinks. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readSourceManifest, verifySourceManifest} from './release-manifest.js';
/**
 * Reads hash data from the local filesystem.
 *
 * @param {*} file File resource to read, write or inspect.
 * @return {*} Result computed from the supplied inputs.
 */
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Validates the safe path state and rejects invalid inputs.
 *
 * @param {*} root Root node or directory for the operation.
 * @param {*} filename File path or name to process.
 * @return {*} Computed value, or null when the input has no match.
 */
function safePath(root, filename) {
  let current = fs.realpathSync(root);
  for (const part of filename.split('/')) {
    current = path.join(current, part);
    try {
      const entry = fs.lstatSync(current);
      if (entry.isSymbolicLink()) return null;
    } catch (error) {if (error.code === 'ENOENT') return null; throw error;}
  }
  return fs.statSync(current).isFile() ? current : null;
}

/**
 * Compares current files with a prior release manifest for upgrades.
 *
 * @param {*} newRelease New release used by this operation.
 * @param {*} installation Installation used by this operation.
 * @param {boolean=} prune Prune used by this operation.
 * @return {!Object} Structured result for the caller.
 */
export function inspectManifestUpgrade(newRelease, installation,
  prune = false) {
  const newer = verifySourceManifest(newRelease);
  const earlier = readSourceManifest(installation);
  if (earlier.version === newer.version) throw new Error('Old and new manifests have the same version');
  const report = {removable: [], modified: [], missing: [], removed: []};
  for (const [name, oldHash] of Object.entries(earlier.files)) {
    if (Object.hasOwn(newer.files, name)) continue;
    const file = safePath(installation, name);
    if (!file) report.missing.push(name);
    else if (hash(file) !== oldHash) report.modified.push(name);
    else report.removable.push(name);
  }
  if (prune) for (const name of report.removable) {
    const file = safePath(installation, name);
    if (file && hash(file) === earlier.files[name]) {
      fs.unlinkSync(file);
      report.removed.push(name);
    }
  }
  return report;
}
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const [newRelease, installation, flag] = process.argv.slice(2);
  try {
    if (!newRelease || !installation || (flag && flag !== '--prune'))
      throw new Error('Usage: node scripts/upgrade-manifest.js <new-release-dir> <installed-dir> [--prune]');
    if (fs.realpathSync(newRelease) === fs.realpathSync(installation))
      throw new Error('Source and installation must differ');
    const report = inspectManifestUpgrade(newRelease, installation, flag === '--prune');
    console.log(JSON.stringify(report, null, 2));
    if (report.modified.length) console.warn('Locally edited source modules have been preserved.');
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
