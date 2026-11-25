/** @fileoverview Shared loader and renderer for external HTML fragments. */
import {RenderPlan} from './render-plan.js';

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
  const pattern = new RegExp(start.source + '([\\s\\S]*?)' + end.source, 'g');
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
 * Creates a renderer producing immutable template data, not HTML strings.
 * @param {!Map<string, string>} fragments Named template sources.
 * @return {function(string, Object=): !RenderPlan} Template plan factory.
 */
export function createPlanRenderer(fragments) {
  return (name, values = {}) => {
    if (!fragments.has(name)) throw new Error(`Unknown template: ${name}`);
    return new RenderPlan(fragments.get(name), values);
  };
}

/**
 * Reads an HTML resource via HTTP in the browser or from disk in Node tests.
 *
 * @param {!URL} url Resolved external template location.
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
 * Resolves a repository-relative template name against the shared root.
 * @param {string} name Path below public/templates, using forward slashes.
 * @return {!URL} Template URL for HTTP and local Node execution.
 * @throws {Error} If the name is not a relative HTML template path.
 */
export function resolveTemplateURL(name) {
  if (typeof name !== 'string' || !/^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.html$/.test(name)) {
    throw new Error(`Invalid template path: ${name}`);
  }
  return new URL(`../../templates/${name}`, import.meta.url);
}

/**
 * Loads each template resource once and returns its synchronous renderer.
 *
 * @param {string} name Path below public/templates.
 * @return {!Promise<Function>} Renderer for the loaded fragments.
 */
export async function loadTemplates(name) {
  const url = resolveTemplateURL(name);
  if (!cache.has(url.href)) {
    cache.set(url.href, readTemplateFile(url).then(parseTemplates).then(createPlanRenderer));
  }
  return cache.get(url.href);
}
