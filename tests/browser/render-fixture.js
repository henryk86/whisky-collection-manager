/** @fileoverview Mounts test fixtures with the actual application DOM renderer. */
import {RenderPlan} from '../../public/js/ui/render-plan.js';

/**
 * Encodes plan instances for Playwright's structured data transport.
 * @param {*} value Render plan or scalar/attribute value.
 * @return {*} Transportable plan record or unchanged binding value.
 */
function encodePlan(value) {
  if (!(value instanceof RenderPlan)) return value;
  return {
    plan: true,
    source: value.source,
    values: Object.fromEntries(Object.entries(value.values).map(([key, item]) => [key, encodePlan(item)])),
    parts: value.parts?.map(encodePlan) || null,
  };
}

/**
 * Mounts a real render plan in an isolated fixture container using the browser's
 * production renderer and document context, without HTML string coercion.
 * @param {!Object} page Playwright page with the application loaded.
 * @param {!RenderPlan} plan Fixture content.
 * @param {!Object} options Container ID, tag, parent selector and styles.
 * @return {!Promise<*>} Locator for the mounted container.
 */
export async function mountRenderFixture(page, plan, {id, tag = 'div', parent = 'main', style = ''}) {
  if (!(plan instanceof RenderPlan)) throw new TypeError('Fixture requires a RenderPlan');
  await page.evaluate(async ({encoded, id, tag, parent, style}) => {
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
    const root = document.createElement(tag);
    root.id = id;
    root.style.cssText = style;
    replaceContent(root, restore(encoded));
    document.querySelector(parent).append(root);
  }, {encoded: encodePlan(plan), id, tag, parent, style});
  return page.locator(`#${id}`);
}
