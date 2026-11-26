import {renderedText, domElements} from '../helpers/rendering.js';
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
  () => {
    const html = renderDetail(['distillery-laphroaig']);
    assert.match(renderedText(html), /<span class="card-kicker">Laphroaig<\/span>/);
    assert.match(
      renderedText(html),
      new RegExp(
        '<span class="detail-heading-separator" ari' + 'a-hidden="true">·<\\/span><span class="mut' +
        'ed">Unvollständig<\\/span>'
      )
    );
  }
);

test(
  'bottling title is unchanged by shared decorative page heading punctuation',
  () => {
    const html = renderDetail(['distillery-laphroaig']);
    assert.match(renderedText(html), /<h2>Laphroaig WILLEM 14-year-old<\/h2>/);
    assert.doesNotMatch(renderedText(html), /<h2>Laphroaig WILLEM 14-year-old<span class="heading-period"/);
  }
);

test(
  'detail headline without distillery shows status only, no separator',
  () => {
    const html = renderDetail([]);
    assert.equal(domElements(html, '.detail-heading-meta > span.muted')[0].text.trim(), 'Unvollständig');
    assert.doesNotMatch(renderedText(html), /detail-heading-separator/);
  }
);

test('detail heading uses the bottler when no distillery is supplied', () => {
  const html = renderDetail([], 'Signatory Vintage');
  assert.match(renderedText(html), /<span class="card-kicker">Signatory Vintage<\/span>/);
  assert.match(renderedText(html), /<span class="detail-heading-separator" aria-hidden="true">·<\/span>/);
  assert.match(renderedText(html), /<span class="muted">Unvollständig<\/span>/);
  assert.match(renderedText(html), /data-ds-detail-field="fact"><span>Abfüller<\/span>/);
});

test(
  'detail offers a right-aligned map link with location icon for one or several assigned distilleries, but not for an unassigned bottling',
  () => {
    const single = renderDetail(['distillery-laphroaig']);
    assert.ok(domElements(single, '[class="actions ds-header-actions detail-head-actions"]').length > 0);
    assert.match(
      renderedText(single),
      new RegExp(
        'data-act="bottling-map"[^>]*><svg class="a' + 'ction-icon"[\\s\\S]*?<span>Auf Landkarte a' +
        'nzeigen<\\/span><\\/button>'
      )
    );
    assert.ok(domElements(single, 'header[class="section-head ds-page-header detail-page-head"]').length > 0);
    const multiple = renderDetail(['distillery-laphroaig', 'distillery-ardbeg']);
    assert.match(
      renderedText(multiple),
      new RegExp(
        'data-act="bottling-map"[^>]*><svg class="a' + 'ction-icon"[\\s\\S]*?<span>Standorte auf L' +
        'andkarte<\\/span><\\/button>'
      )
    );
    assert.equal(domElements(renderDetail([]), '[data-act="bottling-map"]').length, 0);
  }
);
