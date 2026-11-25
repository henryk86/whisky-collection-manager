/** Compare fresh captures and write a portable HTML review report. */
import {createHash} from 'node:crypto';
import {
  readFileSync, writeFileSync, mkdirSync, readdirSync,
  copyFileSync
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {comparePNG, decodePNG} from './visual-png.js';

/**
 * Load a complete capture set, rejecting missing or unexpected images.
 * @param {string} directory Capture output directory.
 * @return {!Object} Capture metadata and images indexed by ID.
 */
export function loadCaptures(directory) {
  const report = JSON.parse(readFileSync(path.join(directory, 'report.json')));
  if (report.failed !== 0 || !report.browser || !report.results?.length) {
    throw new Error('Capture failed or is empty');
  }
  const entries = new Map();
  for (const {id} of report.results) {
    if (!/^[a-z0-9-]+__\d+__(light|dark)$/.test(id) || entries.has(id)) {
      throw new Error(`Invalid or duplicate screenshot ID: ${id}`);
    }
    const image = readFileSync(path.join(directory, `${id}.png`));
    const geometry = JSON.parse(readFileSync(
      path.join(directory, `${id}.json`)));
    const decoded = decodePNG(image);
    if (decoded.width !== Number(id.split('__')[1]) ||
      decoded.height !== 1100 || !Number.isFinite(geometry.overflow)) {
      throw new Error(`Invalid capture dimensions or geometry: ${id}`);
    }
    entries.set(id, {image, geometry});
  }
  if (readdirSync(directory).filter(n => n.endsWith('.png')).length !==
    entries.size) throw new Error('Unexpected captures');
  return {report, entries};
}

/**
 * Serialize geometry independently of property insertion order.
 * @param {!Object} geometry Measured bounding rectangles and overflow.
 * @return {string} Stable geometry representation.
 */
function geometryJSON(geometry) {
  return JSON.stringify(Object.fromEntries(Object.entries(geometry)
    .sort(([a], [b]) => a.localeCompare(b))));
}

/**
 * Hash rendered pixels and measured geometry, not PNG compression metadata.
 * @param {?Object} entry Screenshot and geometry, or null if absent.
 * @return {string} Content fingerprint or absent marker.
 */
function fingerprint(entry) {
  if (!entry) return 'absent';
  const {width, height, channels, pixels} = decodePNG(entry.image);
  return createHash('sha256').update(`${width}:${height}:${channels}:`)
    .update(pixels).update(geometryJSON(entry.geometry)).digest('hex');
}

/**
 * Produce reviewable differences. Overflow is a hard failure, not approval.
 * @param {!Object} before Loaded base captures.
 * @param {!Object} after Loaded candidate captures.
 * @param {string} output Report directory.
 * @return {!Array<!Object>} Changed capture records.
 */
export function compareCaptures(before, after, output) {
  for (const key of ['browser', 'snapshotClock', 'timezone', 'locale']) {
    if (before.report[key] !== after.report[key]) {
      throw new Error(`Incompatible capture environment: ${key}`);
    }
  }
  mkdirSync(output, {recursive: true});
  const ids = [...new Set([...before.entries.keys(), ...after.entries.keys()])]
    .sort();
  const changes = [];
  for (const id of ids) {
    const a = before.entries.get(id);
    const b = after.entries.get(id);
    if (b && b.geometry.overflow > 1) {
      throw new Error(`${id}: horizontal overflow`);
    }
    const left = fingerprint(a);
    const right = fingerprint(b);
    if (left === right) continue;
    const difference = a && b ? comparePNG(a.image, b.image, 0) : null;
    const kind = !a ? 'new' : !b ? 'removed' : 'changed';
    const digest = createHash('sha256').update(`${id}:${left}:${right}`)
      .digest('hex');
    if (a) writeFileSync(path.join(output, `${id}-before.png`), a.image);
    if (b) writeFileSync(path.join(output, `${id}-after.png`), b.image);
    if (difference) writeFileSync(path.join(output, `${id}-diff.png`),
      difference.diff);
    const geometryChanged = Boolean(a && b &&
      geometryJSON(a.geometry) !== geometryJSON(b.geometry));
    if (geometryChanged) {
      writeFileSync(path.join(output, `${id}-geometry.json`),
        JSON.stringify({before: a.geometry, after: b.geometry}, null, 2));
    }
    changes.push({
      id, kind, digest, geometryChanged,
      percent: difference?.percent ?? null,
    });
  }
  return changes;
}

/**
 * Write the report, including individual before, after and diff images.
 * @param {!Array<!Object>} changes Changed capture records.
 * @param {string} output Report directory.
 */
function htmlReport(changes, output) {
  const rows = changes.map(({id, kind, percent, geometryChanged}) => {
    const images = ['before', 'after', 'diff'].map(label => {
      if ((kind === 'new' && label !== 'after') ||
        (kind === 'removed' && label !== 'before')) return '<div></div>';
      return `<div>${label}<br><a href="${id}-${label}.png">` +
        `<img src="${id}-${label}.png" loading="lazy"></a></div>`;
    }).join('');
    const geometry = geometryChanged ?
      `<p><a href="${id}-geometry.json">Geometry changed (JSON)</a></p>` : '';
    return `<section><h2>${id} (${kind}, ${percent ?? '-'}%)</h2>` +
      `${geometry}<article>${images}</article></section>`;
  }).join('');
  const style = 'body{font:16px sans-serif;margin:24px}article{display:grid;' +
    'grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}' +
    'img{width:100%;border:1px solid #aaa}section{margin-bottom:32px}';
  writeFileSync(path.join(output, 'index.html'), '<!doctype html>' +
    '<meta charset="utf-8"><title>Visual comparison</title>' +
    `<style>${style}</style><h1>${changes.length} visual changes</h1>${rows}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) ===
  fileURLToPath(import.meta.url)) {
  const [base, head, output] = process.argv.slice(2);
  const before = loadCaptures(base);
  const after = loadCaptures(head);
  const changes = compareCaptures(before, after, output);
  htmlReport(changes, output);
  copyFileSync(path.join(base, 'report.json'),
    path.join(output, 'base-report.json'));
  copyFileSync(path.join(head, 'report.json'),
    path.join(output, 'head-report.json'));
  writeFileSync(path.join(output, 'changes.json'), JSON.stringify({
    total: after.entries.size, changes,
  }));
  console.log(`${changes.length} visual changes`);
}
