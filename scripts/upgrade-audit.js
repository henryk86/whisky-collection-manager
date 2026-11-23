#!/usr/bin/env node
/** Compare two unpacked source releases against an existing installation.
 * Never remove user data, modified source files, directories or symlinks.
 * Deletion of unchanged, obsolete tracked code requires explicit --prune.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Restrict cleanup to actual application modules. Data, media, deployment,
// config, vendor assets and third-party files are never candidates.
export const SOURCE_ROOTS = ['public/js', 'server', 'shared', 'worker'];
const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function containedFile(root, relative) {
  const full = path.resolve(root, relative);
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error(`Unsafe path: ${relative}`);
  return full;
}
function sourceFiles(directory) {
  const found = new Set();
  function walk(folder, prefix) {
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, {withFileTypes: true})) {
      const relative = `${prefix}/${entry.name}`;
      const full = containedFile(directory, relative);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(full, relative);
      else if (entry.isFile()) found.add(relative);
    }
  }
  for (const root of SOURCE_ROOTS) walk(containedFile(directory, root), root);
  return found;
}
function safeInstalledFile(root, relative) {
  let next = path.resolve(root);
  for (const part of relative.split('/')) {
    next = path.join(next, part);
    try {
      if (fs.lstatSync(next).isSymbolicLink()) return null;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
  return fs.statSync(next).isFile() ? next : null;
}
export function auditUpgrade(previousRoot, nextRoot, installedRoot) {
  const previous = sourceFiles(previousRoot);
  const next = sourceFiles(nextRoot);
  const removable = [];
  const changed = [];
  const absent = [];
  for (const relative of [...previous].filter(file => !next.has(file)).sort()) {
    const installed = safeInstalledFile(installedRoot, relative);
    if (!installed) {absent.push(relative); continue;}
    const old = safeInstalledFile(previousRoot, relative);
    // If a user modified or replaced the old file, never delete it.
    if (!old || hashFile(old) !== hashFile(installed)) changed.push(relative);
    else removable.push(relative);
  }
  return {removable, changed, absent};
}
export function pruneObsolete(previousRoot, nextRoot, installedRoot) {
  const report = auditUpgrade(previousRoot, nextRoot, installedRoot);
  // Recheck each file against the old release immediately before deleting it.
  for (const relative of report.removable) {
    const old = safeInstalledFile(previousRoot, relative);
    const installed = safeInstalledFile(installedRoot, relative);
    if (old && installed && hashFile(old) === hashFile(installed)) fs.unlinkSync(installed);
  }
  return report;
}
const isCLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCLI) {
  const [previousRoot, nextRoot, installedRoot, flag] = process.argv.slice(2);
  if (!previousRoot || !nextRoot || !installedRoot || (flag && flag !== '--prune')) {
    console.error('Usage: node scripts/upgrade-audit.js <previous-release-dir> <new-release-dir> <installation-dir> [--prune]');
    process.exitCode = 2;
  } else {
    try {
      for (const dir of [previousRoot, nextRoot, installedRoot]) {
        if (!fs.statSync(dir).isDirectory()) throw new Error(`Not a directory: ${dir}`);
      }
      const roots = [previousRoot, nextRoot, installedRoot].map(dir => fs.realpathSync(dir));
      if (new Set(roots).size !== 3) throw new Error('Old release, new release and installation must be separate directories.');
      for (const dir of [previousRoot, nextRoot]) {
        if (!fs.existsSync(path.join(dir, 'package.json')) || !fs.existsSync(path.join(dir, 'public/js'))) {
          throw new Error(`Not an unpacked WCM release: ${dir}`);
        }
      }
      const report = flag === '--prune'
        ? pruneObsolete(previousRoot, nextRoot, installedRoot)
        : auditUpgrade(previousRoot, nextRoot, installedRoot);
      console.log(JSON.stringify({...report, deleted: flag === '--prune' ? report.removable.length : 0}, null, 2));
      if (report.changed.length) console.warn('Modified or symlinked files were left untouched. Review them manually.');
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
