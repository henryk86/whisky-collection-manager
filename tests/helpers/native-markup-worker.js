/** @fileoverview Test-only Chromium materialization for synchronous assertions. */
import {parentPort} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const origin = 'http://wcm-render.test';
let browser;
let page;

/**
 * Starts an isolated browser and serves only the checked-out renderer modules.
 * @return {!Promise<!Object>} Browser page with the production renderer loaded.
 */
async function openRenderer() {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    headless: true,
    args: process.env.CI || process.env.WHISKY_BROWSER_DOM_ONLY === 'true' ? ['--no-sandbox'] : [],
  });
  page = await browser.newPage();
  await page.route(`${origin}/**`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (!/^\/(?:js\/|locales\/)[\w./-]+$/.test(pathname) || pathname.includes('..')) return route.abort();
    try {
      const body = await readFile(new URL(`../../public${pathname}`, import.meta.url));
      await route.fulfill({body, headers: {'Access-Control-Allow-Origin': '*'}, contentType: pathname.endsWith('.json') ? 'application/json' : 'text/javascript'});
    } catch {await route.abort();}
  });
  await page.evaluate(async base => {
    const {RenderPlan} = await import(`${base}/js/ui/render-plan.js`);
    const {materialize} = await import(`${base}/js/ui/dom-renderer.js`);
    // Transport preserves the shape of render plans; it does not render HTML.
    /**
     * Restores the immutable plan instances from structured-cloned data.
     * @param {*} value Encoded plan or scalar value.
     * @return {*} Rehydrated render plan or scalar.
     */
    function restore(value) {
      if (!value || typeof value !== 'object' || !value.plan) return value;
      return new RenderPlan(value.source, Object.fromEntries(Object.entries(value.values).map(([key, item]) => [key, restore(item)])), value.parts?.map(restore) || null);
    }
    globalThis.renderForAssertion = ({encoded, selector, markup}) => {
      const template = document.createElement('template');
      // Most fragments are children of HTML elements; standalone table/SVG
      // fragments use the same context they have when mounted by the app.
      const plan = restore(encoded);
      const source = markup ? encoded : plan.source || plan.parts?.find(part => part?.source)?.source || '';
      const firstTag = source.trim().match(/^<([\w-]+)/)?.[1];
      const contextTag = {tr: 'tbody', td: 'tr', th: 'tr', tbody: 'table', thead: 'table', option: 'select', optgroup: 'select'}[firstTag];
      const svgTags = new Set(['path', 'g', 'circle', 'line', 'polygon', 'polyline', 'rect', 'text', 'defs', 'clipPath']);
      const context = svgTags.has(firstTag) ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : contextTag ? document.createElement(contextTag) : null;
      if (markup) {
        const host = context || template;
        host.innerHTML = encoded;
        if (context) template.content.append(...context.childNodes);
      } else template.content.append(materialize(plan, document, context));
      if (selector !== undefined) return [...template.content.querySelectorAll(selector)].map(node => ({
        tag: node.localName,
        text: node.textContent,
        attributes: Object.fromEntries([...node.attributes].map(attr => [attr.name, attr.value])),
        value: node.value,
        checked: node.checked,
        disabled: node.disabled,
      }));
      return template.innerHTML;
    };
  }, origin);
  return page;
}

parentPort.on('message', async ({port, signal, value, selector, markup, close}) => {
  const status = new Int32Array(signal);
  try {
    if (close) {await browser?.close(); port.postMessage({value: ''});}
    else {
      const renderer = page || await openRenderer();
      port.postMessage({value: await renderer.evaluate(input => globalThis.renderForAssertion(input), {encoded: value, selector, markup})});
    }
  } catch (error) {port.postMessage({error: error.message});}
  finally {Atomics.store(status, 0, 1); Atomics.notify(status, 0); port.close();}
});
