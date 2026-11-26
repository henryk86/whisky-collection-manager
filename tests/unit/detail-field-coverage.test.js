import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDetailView} from '../../public/js/views/detail.js';
import {bottlingDetails} from '../../public/js/domain/bottling-details.js';

/**
 * Renders the detail field coverage.test state.
 *
 * @param {!Object=} options Optional configuration for the operation.
 * @return {import('../../public/js/ui/render-plan.js').RenderContent} Captured detail view plan used to inspect metadata fields.
 */
function render({bottlingFields = {}, bottleFields = {}} = {}) {
  const previousDocument = globalThis.document;
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
      id: 'bottling-1', name: 'Testabfüllung', completionStatus: 'complete',
      distilleryIds: [], ...bottlingFields,
    };
    const bottle = {
      id: 'physical-1', inventoryNumber: '000043', volumeType: 'standard',
      status: 'open', photos: [], files: [], ...bottleFields,
    };
    createDetailView({
      state: {
        selected: bottling.id,
        collection: {bottlings: [bottling], distilleries: []},
      },
      selectors: {
        /**
         * Derives the bottles result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        bottles: () => [bottle],
        /**
         * Simulates a bottling without a cover photo.
         * @return {string} Empty path to exercise the no-photo state.
         */
        coverPhoto: () => '',
        /**
         * Omits distillery labels for this test.
         * @return {string} Empty label; no distillery name is supplied by this fixture.
         */
        distilleryNames: () => '',
      },
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
       */
      shell: value => {html = value;},
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
    })();
    return html;
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

test(
  'bottling detail displays persisted editable metadata including Whiskybase ID',
  () => {
    const html = render({
      bottlingFields: {
        whiskyType: 'single_malt',
        brand: 'Marke',
        bottler: 'Abfüller X',
        ageYears: 12,
        abv: 46,
        volumeMl: 700,
        releaseYear: 2011,
        distillationYear: 1999,
        bottlingYear: 2011,
        caskType: 'Bourbon',
        caskNumber: '77',
        limitedEditionCount: 200,
        whiskybaseId: 'WB-12345',
        whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/12345',
        description: 'Anmerkung zur Abfüllung',
      },
    });
    for (const value of [
      'Testabfüllung',
      'Marke',
      'Abfüller X',
      '12',
      '46',
      '700',
      '2011',
      '1999',
      'Bourbon',
      '77',
      '200',
      'WB-12345',
      'Anmerkung zur Abfüllung',
    ]) {
      assert.ok(renderedText(html).includes(renderedText(value)), `Bottling value ${value} must be shown`);
    }
    assert.match(renderedText(html), /Whiskybase-ID/);
    assert.match(renderedText(html), /Whiskybase-Eintrag öffnen/);
  }
);

test(
  'bottle detail shows opening date, personal comment, type and all other stored bottle facts',
  () => {
    const html = render({
      bottleFields: {
        volumeType: 'sample',
        volumeMl: 50,
        purchaseDate: '2025-02-12',
        openedAt: '2026-10-18',
        emptiedAt: '2026-11-20',
        purchasePrice: 9.95,
        currency: 'GBP',
        merchant: 'Händler Z',
        comment: 'Meine Notiz\nZweite Zeile <script>alert(1)</script>',
      },
    });
    assert.match(renderedText(html), /Öffnungsdatum<\/dt><dd>18\.10\.2026<\/dd>/);
    assert.match(renderedText(html), /Leerdatum<\/dt><dd>20\.11\.2026<\/dd>/);
    assert.match(renderedText(html), /Persönlicher Kommentar<\/dt>/);
    assert.match(renderedText(html), /Meine Notiz\nZweite Zeile &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(renderedText(html), /<script>alert\(1\)<\/script>/);
    assert.match(renderedText(html), /Flaschentyp<\/dt><dd>Sample \/ Probeflasche<\/dd>/);
    assert.match(renderedText(html), /Kauf<\/dt><dd>12\.2\.2025<\/dd>|Kauf<\/dt><dd>12\.02\.2025<\/dd>/);
    assert.match(renderedText(html), /Preis<\/dt><dd>9\.95 GBP<\/dd>/);
    assert.match(renderedText(html), /Händler<\/dt><dd>Händler Z<\/dd>/);
    assert.match(renderedText(html), /Füllmenge<\/dt><dd>50 ml<\/dd>/);
    assert.match(renderedText(html), /#000043/);
    assert.match(renderedText(html), /Geöffnet/);
  }
);

test(
  'empty optional bottle fields are omitted; standard bottle type is still explicit',
  () => {
    const html = render({
      bottleFields: {
        openedAt: '', comment: '  ',
        purchasePrice: null,
      },
    });
    assert.doesNotMatch(renderedText(html), /Öffnungsdatum<\/dt>/);
    assert.doesNotMatch(renderedText(html), /Leerdatum<\/dt>/);
    assert.doesNotMatch(renderedText(html), /Persönlicher Kommentar<\/dt>/);
    assert.match(renderedText(html), /Flaschentyp<\/dt><dd>Normale Flasche<\/dd>/);
    assert.doesNotMatch(renderedText(html), /Preis<\/dt>/);
    assert.equal(bottlingDetails({whiskybaseId: '   ', distilleryIds: []}, () => '', []).length, 0);
  }
);
