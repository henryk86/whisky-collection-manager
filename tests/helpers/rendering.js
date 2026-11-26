/** @fileoverview DOM-backed assertions and explicit capture ports for view tests. */
import {after} from 'node:test';
import {MessageChannel, receiveMessageOnPort, Worker} from 'node:worker_threads';
import {RenderPlan, SLOT, slotValue} from '../../public/js/ui/render-plan.js';

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
 * @return {string|Array<Object>} Browser-generated markup or queried element properties.
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
 * Returns native Chromium serialization for tests that inspect markup.
 * Prefer DOM element queries for structural assertions.
 * @param {*} value Captured render plan or ordinary value.
 * @return {*} DOM-generated markup or the original value.
 */
export function renderedText(value) {
  if (!(value instanceof RenderPlan)) return value;
  const encoded = encode(value);
  const key = JSON.stringify(encoded);
  const cached = rendered.get(value);
  if (cached?.key === key) return cached.markup;
  const markup = askBrowser({value: encoded});
  rendered.set(value, {key, markup});
  return markup;
}

/**
 * Reads matching elements from the production DOM in document order.
 * Strings are test-owned fixtures, not application markup inputs.
 * @param {RenderPlan|string} value Render plan or captured test markup.
 * @param {string} selector Native CSS selector.
 * @return {Array<{tag: string, text: string, attributes: Object<string, string>, value: (string|undefined), checked: (boolean|undefined), disabled: (boolean|undefined)}>} Matched elements and their DOM properties.
 */
export function domElements(value, selector) {
  return askBrowser({value: encode(value), selector, markup: typeof value === 'string'});
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
