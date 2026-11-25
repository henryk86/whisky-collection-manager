import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDetailView} from '../../public/js/views/detail.js';

/**
 * Renders detail for detail heading.test.
 *
 * @param {*} distilleryIds Distillery ids used by this operation.
 * @param {*} bottler Bottler used by this operation.
 * @return {string} Resulting text.
 */
function renderDetail(distilleryIds, bottler) {
  const originalDocument = globalThis.document;
  globalThis.document = {
    /**
     * Derives the query selector all result from the supplied values.
     * @return {!Array<*>} Resulting entries in their output order.
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
         * Derives the bottles result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        bottles: () => [],
        /**
         * Derives the cover photo result from the supplied values.
         * @return {string} Resulting text.
         */
        coverPhoto: () => '',
        /**
         * Derives the distillery names result from the supplied values.
         * @return {string} Resulting text.
         */
        distilleryNames: () => 'Laphroaig',
      },
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} output Output resource or accumulated result.
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
    assert.match(
      renderedText(html),
      new RegExp('<div class="detail-heading-meta"><span cla' + 'ss="muted">Unvollständig<\\/span><\\/div>')
    );
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
    assert.match(renderedText(single), /class="actions ds-header-actions detail-head-actions"/);
    assert.match(
      renderedText(single),
      new RegExp(
        'data-act="bottling-map"[^>]*><svg class="a' + 'ction-icon"[\\s\\S]*?<span>Auf Landkarte a' +
        'nzeigen<\\/span><\\/button>'
      )
    );
    assert.match(renderedText(single), /<header class="section-head ds-page-header detail-page-head">/);
    const multiple = renderDetail(['distillery-laphroaig', 'distillery-ardbeg']);
    assert.match(
      renderedText(multiple),
      new RegExp(
        'data-act="bottling-map"[^>]*><svg class="a' + 'ction-icon"[\\s\\S]*?<span>Standorte auf L' +
        'andkarte<\\/span><\\/button>'
      )
    );
    assert.doesNotMatch(renderedText(renderDetail([])), /data-act="bottling-map"/);
  }
);
