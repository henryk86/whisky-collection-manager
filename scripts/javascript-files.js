/**
 * @fileoverview Shared source discovery for JavaScript style checks.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Source trees that contain checked JavaScript modules. */
export const JAVASCRIPT_ROOTS = [
  'public', 'server', 'shared', 'scripts', 'tests', 'worker', 'docker',
  'extension',
];

const ignored = new Set(['node_modules', '.git', 'vendor',
  'test-artifacts']);

/**
 * Lists checked JavaScript sources in stable path order.
 *
 * @param {string=} directory Repository root.
 * @param {!Array<string>=} roots Source directories to inspect.
 * @return {!Array<string>} Source paths relative to the repository root.
 */
export function listJavaScriptFiles(directory = process.cwd(),
  roots = JAVASCRIPT_ROOTS) {
  /**
   * Collects first-party JavaScript paths without descending into generated or vendor directories.
   * @param {string} relative Repository-relative path to inspect.
   * @return {string[]} Discovered repository-relative paths.
   */
  function walk(relative) {
    const absolute = path.join(directory, relative);
    if (!fs.existsSync(absolute)) return [];
    return fs.readdirSync(absolute, {withFileTypes: true}).flatMap(entry => {
      if (ignored.has(entry.name)) return [];
      const filename = path.join(relative, entry.name);
      if (entry.isDirectory()) return walk(filename);
      return entry.isFile() && filename.endsWith('.js') ? [filename] : [];
    });
  }
  return roots.flatMap(walk).sort();
}
