/** @fileoverview Shared loader and renderer for external HTML fragments. */
import {t} from '../i18n/index.js';
import {escapeHtml} from './dom.js';

const cache = new Map();

/**
 * Parses named HTML fragments using browser-normalized line endings.
 *
 * @param {string} source Contents of an HTML template file.
 * @return {!Map<string, string>} Fragments indexed by their unique names.
 */
export function parseTemplates(source) {
  source = source.replace(/\r\n?/g, '\n');
  const fragments = new Map();
  const start = /<!-- wcm-template:([\w-]+) -->\n/;
  const end = /\n<!-- \/wcm-template -->/;
  const pattern = new RegExp(
    start.source + '([\\s\\S]*?)' + end.source, 'g'
  );
  for (const [, name, markup] of source.matchAll(pattern)) {
    if (fragments.has(name)) throw new Error(`Duplicate template: ${name}`);
    fragments.set(name, markup);
  }
  if (!fragments.size || source.replace(pattern, '').trim()) {
    throw new Error('Invalid HTML template file');
  }
  return fragments;
}

/**
 * Creates a renderer for preloaded HTML with explicit text and markup slots.
 *
 * @param {!Map<string, string>} fragments Named HTML fragments.
 * @return {function(string, Object=): string} Synchronous renderer.
 */
export function createTemplateRenderer(fragments) {
  return (name, values = {}) => {
    if (!fragments.has(name)) throw new Error(`Unknown template: ${name}`);
    return fragments.get(name).replace(/\{\{(raw|text|t):([\w.]+)\}\}/g,
      (_, mode, key) => {
        if (mode === 't') return t(key);
        if (!Object.hasOwn(values, key)) {
          throw new Error(`Missing slot ${key} in template ${name}`);
        }
        return mode === 'text' ? escapeHtml(values[key]) : String(values[key]);
      });
  };
}

/**
 * Reads an HTML resource via HTTP in the browser or from disk in Node tests.
 *
 * @param {!URL} url External template location relative to its module.
 * @return {!Promise<string>} File contents.
 */
async function readTemplateFile(url) {
  if (url.protocol === 'file:') {
    const {readFile} = await import('node:fs/promises');
    return readFile(url, 'utf8');
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load template: ${url.pathname}`);
  return response.text();
}

/**
 * Loads each template resource once and returns its synchronous renderer.
 *
 * @param {!URL} url External HTML file to load.
 * @return {!Promise<Function>} Renderer for the loaded fragments.
 */
export async function loadTemplates(url) {
  if (!cache.has(url.href)) {
    cache.set(url.href, readTemplateFile(url).then(parseTemplates)
      .then(createTemplateRenderer));
  }
  return cache.get(url.href);
}
