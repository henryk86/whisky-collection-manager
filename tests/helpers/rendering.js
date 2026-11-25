/** @fileoverview DOM-backed assertions and explicit capture ports for view tests. */
import {after} from 'node:test';
import {MessageChannel, receiveMessageOnPort, Worker} from 'node:worker_threads';
import {RenderPlan, SLOT, slotValue, scalarBinding} from '../../public/js/ui/render-plan.js';

import {escapeHtml} from '../../public/js/ui/dom.js';
import {attributeEntries, checkedTag, decodeEscaped} from '../../public/js/ui/bindings.js';

/**
 * Compacts structural whitespace for DOM-free markup assertions, preserving
 * quoted attributes, user data, and inline spacing.
 * @param {string} source Static template source.
 * @return {string} Canonical markup for the test adapter.
 */
function compactTemplate(source) {
  return source.replace(/<\/?(?:[^>"']|"[^"]*"|'[^']*')+>/g, tag =>
    tag.replace(/"[^"]*"|'[^']*'|\s+/g, part => /^\s/.test(part) ? ' ' : part))
    .replace(/>\n[ \t]*</g, '><');
}

/**
 * Serializes a render plan for diagnostic/test assertions. Shares binding
 * normalization and structural validation with native DOM materialization.
 * @param {*} value Render plan or scalar content.
 * @return {string} Escaped markup representation.
 */
function serializeMarkup(value) {
  if (!(value instanceof RenderPlan)) return escapeHtml(decodeEscaped(value));
  if (value.parts) return value.parts.map(serializeMarkup).join('');
  const source = compactTemplate(value.source);
  return source.replace(SLOT, (_, mode, key, offset) => {
    const binding = slotValue(value, mode, key);
    if (mode === 'tag') return checkedTag(binding);
    if (mode === 'attrs') {
      const attributes = attributeEntries(binding).map(([name, text, flag]) =>
        flag ? name : `${name}="${escapeHtml(text)}"`).join(' ');
      return attributes && (/\s/.test(source[offset - 1]) ? '' : ' ') + attributes;
    }
    if (mode === 'content' && binding instanceof RenderPlan) return serializeMarkup(binding);
    return escapeHtml(scalarBinding(value, mode, key));
  });
}

let worker;
const rendered = new WeakMap();

/**
 * Copies render data into a transportable record without performing rendering.
 * Localized slots are resolved using the test's active language catalog.
 * @param {*} value Render plan or scalar content.
 * @return {*} Structured-clone-compatible input to the browser renderer.
 */
function encode(value) {
  if (!(value instanceof RenderPlan)) return value;
  const values = Object.fromEntries(Object.entries(value.values).map(([key, item]) => [key, encode(item)]));
  const source = value.source.replace(SLOT, (whole, mode, key) => {
    if (mode !== 't') return whole;
    const slot = `translation.${key}`;
    values[slot] = slotValue(value, mode, key);
    return `{{text:${slot}}}`;
  });
  return {plan: true, source, values, parts: value.parts?.map(encode) || null};
}

/**
 * Sends a synchronous assertion request to the test's Chromium worker.
 * @param {!Object} request Render data or a close instruction.
 * @return {string} Browser-generated markup.
 */
function askBrowser(request) {
  worker ||= new Worker(new URL('./native-markup-worker.js', import.meta.url));
  const {port1, port2} = new MessageChannel();
  const signal = new Int32Array(new SharedArrayBuffer(4));
  try {
    worker.postMessage({...request, signal: signal.buffer, port: port2}, [port2]);
    if (Atomics.wait(signal, 0, 0, 60000) === 'timed-out') throw new Error('Chromium rendering assertion timed out');
    const result = receiveMessageOnPort(port1)?.message;
    if (!result || result.error) throw new Error(result?.error || 'Chromium renderer returned no result');
    return result.value;
  } finally {port1.close();}
}

after(async () => {
  if (worker) {
    try {askBrowser({close: true});} finally {await worker.terminate(); worker = null;}
  }
});

/**
 * Checks the historical markup assertion format against actual DOM materialization.
 * New renderer tests should assert native node properties directly.
 * @param {*} value Captured render plan or ordinary value.
 * @return {*} DOM-generated markup or the original value.
 */
export function renderedText(value) {
  if (!(value instanceof RenderPlan)) return value;
  const encoded = encode(value);
  const key = JSON.stringify(encoded);
  const cached = rendered.get(value);
  if (cached?.key === key) return cached.markup;
  // Historical assertions inspect attribute order and original SVG syntax.
  // Verify their representation against the actual native DOM first.
  const markup = serializeMarkup(value);
  askBrowser({value: encoded, expected: markup});
  rendered.set(value, {key, markup});
  return markup;
}

/**
 * Creates a static markup fixture owned by a component test.
 * @param {string} source Test-owned HTML.
 * @return {!RenderPlan} Fixture fragment.
 */
export function fixtureMarkup(source) {return new RenderPlan(source, {});}

/**
 * Captures a render plan at a controller's mount boundary in DOM-free tests.
 * @param {!Object} host Test host with a content capture property.
 * @param {*} value Render plan or scalar.
 */
export function captureContent(host, value) {host.innerHTML = value instanceof RenderPlan ? renderedText(value) : value;}

/**
 * Captures content appended by a controller, verifying its native rendering.
 * @param {!Object} host Test host with a content capture property.
 * @param {*} value Render plan or scalar.
 */
export function captureAppend(host, value) {host.innerHTML += renderedText(value);}
