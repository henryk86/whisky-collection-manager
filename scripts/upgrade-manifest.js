/** Inspect obsolete source modules before overwriting an old ZIP installation.
 * --prune only removes unchanged files listed in the OLD signed-by-content
 * manifest; it cannot touch arbitrary extra files, data or symlinks. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readSourceManifest, verifySourceManifest} from './release-manifest.js';
/**
 * Computes the upgrade manifest's file checksum.
 * @param {string} file File path.
 * @return {string} Hexadecimal SHA-256 digest.
 */
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Resolves a manifest file beneath its root without traversing symbolic links.
 *
 * @param {*} root Root node or directory for the operation.
 * @param {*} filename File path or name to process.
 * @return {*} Resolved manifest file path, or null if missing or unsafe.
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
 * @param {string} newRelease Directory containing the verified new release manifest.
 * @param {string} installation Existing installation containing the previous manifest.
 * @param {boolean=} prune Whether to remove obsolete files whose content still matches the previous manifest.
 * @return {!Object} Upgrade report comparing the installation against the supplied manifests.
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
