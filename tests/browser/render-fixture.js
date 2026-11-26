/** @fileoverview Mounts test fixtures with the actual application DOM renderer. */
import {RenderPlan, SLOT, slotValue} from '../../public/js/ui/render-plan.js';

/**
 * Encodes plan instances for Playwright's structured data transport.
 * @param {*} value Render plan or scalar/attribute value.
 * @param {boolean=} localize Resolve translations using the calling test's locale.
 * @return {*} Transportable plan record or unchanged binding value.
 */
function encodePlan(value, localize = false) {
  if (!(value instanceof RenderPlan)) return value;
  const values = Object.fromEntries(Object.entries(value.values).map(([key, item]) => [key, encodePlan(item, localize)]));
  const source = localize ? value.source.replace(SLOT, (whole, mode, key) => {
    if (mode !== 't') return whole;
    const name = `translation.${key}`;
    values[name] = slotValue(value, mode, key);
    return `{{text:${name}}}`;
  }) : value.source;
  return {plan: true, source, values, parts: value.parts?.map(part => encodePlan(part, localize)) || null};
}

/**
 * Mounts a real render plan in an isolated fixture container using the browser's
 * production renderer and document context, without HTML string coercion.
 * @param {!Object} page Playwright page with the application loaded.
 * @param {import('../../public/js/ui/render-plan.js').RenderContent} plan Fixture content.
 * @param {!Object} options Container ID, tag, parent selector, styles and detached/localized fixture mode.
 * @return {!Promise<*>} Locator for the mounted container.
 */
export async function mountRenderFixture(page, plan, {id, tag = 'div', parent = 'main', style = '', detached = false, localize = false}) {
  await page.evaluate(async ({encoded, id, tag, parent, style, detached}) => {
    const {RenderPlan} = await import(new URL('/js/ui/render-plan.js', document.baseURI).href);
    const {replaceContent} = await import(new URL('/js/ui/dom-renderer.js', document.baseURI).href);
    /**
     * Rehydrates nested plan instances after crossing the Playwright boundary.
     * @param {*} value Encoded plan or ordinary binding value.
     * @return {*} Native render plan or unchanged value.
     */
    function restore(value) {
      if (!value || typeof value !== 'object' || value.plan !== true) return value;
      return new RenderPlan(value.source, Object.fromEntries(Object.entries(value.values).map(([key, item]) => [key, restore(item)])), value.parts?.map(restore) || null);
    }
    document.getElementById(id)?.remove();
    const root = tag === 'svg' ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.createElement(tag);
    root.id = id;
    root.style.cssText = style;
    replaceContent(root, restore(encoded));
    if (detached) {
      const holder = document.createElement('template');
      holder.id = id;
      root.removeAttribute('id');
      holder.content.append(root);
      document.body.append(holder);
    } else document.querySelector(parent).append(root);
  }, {encoded: encodePlan(plan, localize), id, tag, parent, style, detached});
  return page.locator(`#${id}`);
}
