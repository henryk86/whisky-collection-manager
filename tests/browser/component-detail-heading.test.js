import {domElements, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDetailView} from '../../public/js/views/detail.js';

/**
 * Renders detail for detail heading.test.
 *
 * @param {*} distilleryIds Distillery ids used by this operation.
 * @param {*} bottler Bottler used by this operation.
 * @return {import('../../public/js/ui/render-plan.js').RenderContent} Captured detail view plan used to inspect the heading.
 */
function renderDetail(distilleryIds, bottler) {
  const originalDocument = globalThis.document;
  globalThis.document = {
    /**
     * Simulates an element query with no matches.
     * @return {Array<never>} Empty match list; the simulated root has no matching elements.
     */
    querySelectorAll: () => [],
  };
  try {
    let html = '';
    const bottling = {
      id: 'b1', name: 'Laphroaig WILLEM 14-year-old',
      distilleryIds, completionStatus: 'incomplete',
      whiskyType: 'single_malt', bottler,
    };
    const detail = createDetailView({
      state: {selected: 'b1', collection: {bottlings: [bottling]}},
      selectors: {
        /**
         * Provides an empty physical-bottle list.
         * @return {Array<never>} No physical bottles for the requested bottling.
         */
        bottles: () => [],
        /**
         * Simulates a bottling without a cover photo.
         * @return {string} Empty path to exercise the no-photo state.
         */
        coverPhoto: () => '',
        /**
         * Supplies the fixed distillery label used by this fixture.
         * @return {string} Fixture label 'Laphroaig'.
         */
        distilleryNames: () => 'Laphroaig',
      },
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} output Page content passed by the view.
       */
      shell: output => {html = output;},
      /**
       * Reports the navigate error condition.
       */
      navigate: () => {throw new Error('Unexpected navigation');},
      /**
       * Derives the action result from the supplied values.
       *
       * @param {function(...*): *} handler Handler called for the event.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      action: async handler => handler(),
    });
    detail();
    return html;
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

test(
  'detail headline uses the overview card kicker for distillery, and a muted separate status',
  async () => {
    const html = renderDetail(['distillery-laphroaig']);
    await assertDom(html, "span[class=\"card-kicker\"]", {"text": new RegExp("^Laphroaig$")});
    await assertDom(html, ".detail-heading-separator[aria-hidden=\"true\"]:has(+ .muted)", {text: "·", nextText: "Unvollständig"});
  }
);

test(
  'bottling title is unchanged by shared decorative page heading punctuation',
  async () => {
    const html = renderDetail(['distillery-laphroaig']);
    await assertDom(html, "h2", {"text": new RegExp("^Laphroaig WILLEM 14-year-old$")});
    await assertDom(html, "h2:has(.heading-period)", {directText: "Laphroaig WILLEM 14-year-old"}, true);
  }
);

test(
  'detail headline without distillery shows status only, no separator',
  async () => {
    const html = renderDetail([]);
    assert.equal((await domElements(html, '.detail-heading-meta > span.muted'))[0].text.trim(), 'Unvollständig');
    await assertDom(html, ".detail-heading-separator", {}, true);
  }
);

test('detail heading uses the bottler when no distillery is supplied', async () => {
  const html = renderDetail([], 'Signatory Vintage');
  await assertDom(html, "span[class=\"card-kicker\"]", {"text": new RegExp("^Signatory Vintage$")});
  await assertDom(html, "span[class=\"detail-heading-separator\"][aria-hidden=\"true\"]", {"text": new RegExp("^·$")});
  await assertDom(html, "span[class=\"muted\"]", {"text": new RegExp("^Unvollständig$")});
  await assertDom(html, "[data-ds-detail-field=\"fact\"] > span", {"text": new RegExp("^Abfüller$")});
});

test(
  'detail offers a right-aligned map link with location icon for one or several assigned distilleries, but not for an unassigned bottling',
  async () => {
    const single = renderDetail(['distillery-laphroaig']);
    assert.ok((await domElements(single, '[class="actions ds-header-actions detail-head-actions"]')).length > 0);
    await assertDom(single, "button[data-act=\"bottling-map\"]:has(> svg.action-icon) > span", {text: "Auf Landkarte anzeigen"});
    assert.ok((await domElements(single, 'header[class="section-head ds-page-header detail-page-head"]')).length > 0);
    const multiple = renderDetail(['distillery-laphroaig', 'distillery-ardbeg']);
    await assertDom(multiple, "button[data-act=\"bottling-map\"]:has(> svg.action-icon) > span", {text: "Standorte auf Landkarte"});
    assert.equal((await domElements(renderDetail([]), '[data-act="bottling-map"]')).length, 0);
  }
);
