/** @fileoverview Discovery of HTML resources and enforcement of their location. */
import {readdirSync} from 'node:fs';
import {join, sep} from 'node:path';

/**
 * Lists HTML resources in a directory tree.
 * @param {string} directory Directory to scan recursively.
 * @return {!Array<string>} HTML paths using forward slashes on all platforms.
 */
function htmlFiles(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = join(directory, entry.name).split(sep).join('/');
    if (entry.isDirectory()) {
      if (entry.name.toLowerCase() === 'templates' && file !== 'public/templates' && !file.startsWith('public/templates/')) {
        throw new Error(`${file}: Template directories belong in public/templates/`);
      }
      return htmlFiles(file);
    }
    return /\.html$/i.test(entry.name) ? [file] : [];
  });
}

/**
 * Returns all application templates and rejects misplaced HTML resources.
 * @return {!Array<string>} Paths within the central template tree.
 * @throws {Error} If application HTML is outside the allowed directories.
 */
export function listTemplateFiles() {
  const templates = htmlFiles('public').filter(file => file !== 'public/index.html').sort();
  for (const file of templates) {
    if (!file.startsWith('public/templates/')) {
      throw new Error(`${file}: HTML templates belong in public/templates/`);
    }
  }
  return templates;
}
