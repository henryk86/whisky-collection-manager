/** @fileoverview Asynchronous native DOM assertions for isolated UI components. */
import {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {mountRenderFixture} from './render-fixture.js';
import {RenderPlan} from '../../public/js/ui/render-plan.js';

const origin = 'http://wcm-render.test';
let browser;
let page;

/**
 * Opens a document for component fixtures, serving the checked-out browser modules.
 * @return {!Promise<!Object>} Playwright page with the production renderer available.
 */
async function componentPage() {
  if (page) return page;
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    headless: true,
    args: process.env.CI || process.env.WHISKY_BROWSER_DOM_ONLY === 'true' ? ['--no-sandbox'] : [],
  });
  page = await browser.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || !/^\/(?:js\/|locales\/)[\w./-]+$/.test(url.pathname) || url.pathname.includes('..')) return route.abort();
    try {
      const body = await readFile(new URL(`../../public${url.pathname}`, import.meta.url));
      await route.fulfill({body, headers: {'Access-Control-Allow-Origin': '*'}, contentType: url.pathname.endsWith('.json') ? 'application/json' : 'text/javascript'});
    } catch {await route.abort();}
  });
  await page.setContent(`<head><base href="${origin}/"></head><body></body>`);
  return page;
}

after(async () => {await browser?.close();});

/**
 * Describes a subtree to inspect with a native CSS selector.
 * @param {*} value Render content or an already scoped fixture.
 * @param {string} selector Selector for the subtree root.
 * @param {string=} heading Match the text of a direct heading in the subtree.
 * @return {!Object} Fixture scope; it contains data, not serialized HTML.
 */
export function domScope(value, selector, heading) {return {value, selector, heading};}

/**
 * Determines the parent context for standalone table, option and SVG fragments.
 * @param {*} value Fixture content.
 * @return {string} Host element name appropriate for the template's children.
 */
function contextTag(value) {
  const source = value instanceof RenderPlan ? value.source || value.parts?.find(part => part instanceof RenderPlan && part.source)?.source || '' : '';
  const first = source.trim().match(/^<([\w-]+)/)?.[1];
  if (['path', 'g', 'circle', 'line', 'polygon', 'polyline', 'rect', 'text', 'defs', 'clipPath'].includes(first)) return 'svg';
  return {tr: 'tbody', td: 'tr', th: 'tr', tbody: 'table', thead: 'table', option: 'select', optgroup: 'select'}[first] || 'div';
}

/**
 * Mounts the fixture with the production renderer in an inert browser template.
 * @param {*} value Render content or scoped fixture.
 * @param {string} id Unique fixture ID for the current assertion.
 * @return {!Promise<!Array<!Object>>} CSS scopes to select inside the mounted fixture.
 */
async function mount(value, id) {
  const scopes = [];
  while (value && typeof value === 'object' && Object.hasOwn(value, 'selector') && Object.hasOwn(value, 'value')) {
    scopes.unshift({selector: value.selector, heading: value.heading});
    value = value.value;
  }
  const active = await componentPage();
  await mountRenderFixture(active, value, {id, tag: contextTag(value), detached: true, localize: true});
  return scopes;
}

/**
 * Inspects native element properties in document order. No HTML serialization
 * or selector emulation is involved.
 * @param {*} value Render content or scoped fixture.
 * @param {string} selector CSS selector to query within the fixture.
 * @return {!Promise<!Array<!Object>>} Element properties, including their order and parent text.
 */
export async function domElements(value, selector) {
  const scopes = await mount(value, 'component-fixture');
  return page.evaluate(({scopes, selector}) => {
    let root = document.getElementById('component-fixture').content.firstElementChild;
    for (const scope of scopes) {
      root = [...root.querySelectorAll(scope.selector)].find(node => !scope.heading || node.querySelector(':scope > h3')?.textContent === scope.heading);
      if (!root) throw new Error(`Missing fixture scope: ${scope.selector}`);
    }
    const all = [...(scopes.length ? [root] : []), ...root.querySelectorAll('*')];
    const matches = all.filter(node => node.matches(selector));
    return matches.map(node => ({
      tag: node.localName, text: node.textContent,
      attributes: Object.fromEntries([...node.attributes].map(attr => [attr.name, attr.value])),
      value: node.value, checked: node.checked, disabled: node.disabled,
      order: all.indexOf(node), parentText: node.parentElement?.textContent,
      namespace: node.namespaceURI,
      previousText: node.previousElementSibling?.textContent,
      nextText: node.nextElementSibling?.textContent,
      followingText: node.nextSibling?.textContent,
      directText: [...node.childNodes].filter(child => child.nodeType === 3).map(child => child.textContent).join(''),
    }));
  }, {scopes, selector});
}

/**
 * Reads the actual DOM text rather than the spelling of its HTML representation.
 * @param {*} value Render content or scoped fixture.
 * @return {!Promise<string>} Text content of the fixture.
 */
export async function domText(value) {
  const scopes = await mount(value, 'component-fixture');
  return page.evaluate(scopes => {
    let root = document.getElementById('component-fixture').content.firstElementChild;
    for (const scope of scopes) {
      root = [...root.querySelectorAll(scope.selector)].find(node => !scope.heading || node.querySelector(':scope > h3')?.textContent === scope.heading);
      if (!root) throw new Error(`Missing fixture scope: ${scope.selector}`);
    }
    return root.textContent;
  }, scopes);
}

/**
 * Checks that the selected elements occur in the specified document order.
 * @param {*} value Render content or scoped fixture.
 * @param {...string} selectors Selectors for required elements, in order.
 * @return {!Promise<void>} Rejects if an element is missing or out of order.
 */
export async function assertDomOrder(value, ...selectors) {
  const nodes = await domElements(value, selectors.join(', '));
  const scopes = await mount(value, 'component-fixture');
  const positions = await page.evaluate(({scopes, selectors}) => {
    let root = document.getElementById('component-fixture').content.firstElementChild;
    for (const scope of scopes) root = [...root.querySelectorAll(scope.selector)].find(node => !scope.heading || node.querySelector(':scope > h3')?.textContent === scope.heading);
    const elements = [...(scopes.length ? [root] : []), ...root.querySelectorAll('*')];
    return selectors.map(selector => elements.findIndex(node => node.matches(selector)));
  }, {scopes, selectors});
  assert.ok(nodes.length >= selectors.length && positions.every((position, i) => position >= 0 && (!i || position > positions[i - 1])), `Expected DOM order: ${selectors.join(' before ')}`);
}

/**
 * Compares actual DOM trees, including namespaces, attributes, text and child order.
 * @param {*} actual Render content or scoped fixture.
 * @param {*} expected Expected fixture content.
 * @return {!Promise<boolean>} Whether the native trees are equal.
 */
export async function domEqual(actual, expected) {
  const a = await mount(actual, 'component-actual');
  const b = await mount(expected, 'component-expected');
  return page.evaluate(({a, b}) => {
    const roots = [['component-actual', a], ['component-expected', b]].map(([id, scopes]) => {
      let root = document.getElementById(id).content.firstElementChild;
      for (const scope of scopes) root = [...root.querySelectorAll(scope.selector)].find(node => !scope.heading || node.querySelector(':scope > h3')?.textContent === scope.heading);
      if (!root) throw new Error('Missing comparison scope');
      return scopes.length ? [root] : [...root.childNodes];
    });
    return roots[0].length === roots[1].length && roots[0].every((node, i) => node.isEqualNode(roots[1][i]));
  }, {a, b});
}

/**
 * Finds an equal native subtree or consecutive sequence of children.
 * @param {*} actual Render content or scoped fixture.
 * @param {*} expected Expected render fragment.
 * @return {!Promise<boolean>} Whether the actual DOM contains the expected fragment.
 */
export async function domContains(actual, expected) {
  const a = await mount(actual, 'component-actual');
  const b = await mount(expected, 'component-expected');
  return page.evaluate(({a, b}) => {
    const roots = [['component-actual', a], ['component-expected', b]].map(([id, scopes]) => {
      let root = document.getElementById(id).content.firstElementChild;
      for (const scope of scopes) root = [...root.querySelectorAll(scope.selector)].find(node => !scope.heading || node.querySelector(':scope > h3')?.textContent === scope.heading);
      if (!root) throw new Error('Missing comparison scope');
      return root;
    });
    const target = b.length ? [roots[1]] : [...roots[1].childNodes];
    if (target.length === 1 && roots[0].isEqualNode(target[0])) return true;
    return [roots[0], ...roots[0].querySelectorAll('*')].some(parent => {
      const children = [...parent.childNodes];
      return children.some((node, i) => target.every((expected, j) => children[i + j]?.isEqualNode(expected)));
    });
  }, {a, b});
}

/**
 * Matches explicit DOM properties after querying the production-rendered fixture.
 * @param {*} value Render content or scoped fixture.
 * @param {string} selector Native CSS selector for candidate elements.
 * @param {!Object=} properties Expected text, adjacent text or attribute values; regular expressions apply only to individual DOM values.
 * @return {!Promise<boolean>} Whether a candidate satisfies every requested property.
 */
export async function domMatches(value, selector, properties = {}) {
  return (await domElements(value, selector)).some(node => Object.entries(properties).every(([name, expected]) => {
    const actual = Object.hasOwn(node, name) ? node[name] : node.attributes[name];
    return expected instanceof RegExp ? typeof actual === 'string' && expected.test(actual) : actual === expected;
  }));
}

/**
 * Asserts that a native DOM element matches the required properties.
 * @param {*} value Render content or scoped fixture.
 * @param {string} selector Native CSS selector.
 * @param {!Object=} properties Expected DOM properties or attribute values.
 * @param {boolean=} absent Require that no matching element exists.
 * @param {string=} message Additional description of the tested contract.
 * @return {!Promise<void>} Rejects if the requested DOM condition is not satisfied.
 */
export async function assertDom(value, selector, properties = {}, absent = false, message = '') {
  assert.equal(await domMatches(value, selector, properties), !absent, message || `${absent ? 'Unexpected' : 'Missing'} element ${selector} with ${Object.keys(properties).join(', ')}`);
}

/**
 * Returns the position of a required element in the native tree.
 * @param {*} value Render content or scoped fixture.
 * @param {string} selector Native CSS selector.
 * @param {!Object=} properties Expected element properties.
 * @return {!Promise<number>} Position of the matching element in document order.
 */
export async function domIndex(value, selector, properties = {}) {
  const node = (await domElements(value, selector)).find(node => Object.entries(properties).every(([key, expected]) => (Object.hasOwn(node, key) ? node[key] : node.attributes[key]) === expected));
  assert.ok(node, `Missing element for order assertion: ${selector}`);
  return node.order;
}

/**
 * Returns the position of required literal text in the native fixture.
 * @param {*} value Render content or scoped fixture.
 * @param {string} text Text to locate.
 * @return {!Promise<number>} Character position in the DOM text content.
 */
export async function domTextIndex(value, text) {
  const position = (await domText(value)).indexOf(text);
  assert.ok(position >= 0, `Missing text for order assertion: ${text}`);
  return position;
}
