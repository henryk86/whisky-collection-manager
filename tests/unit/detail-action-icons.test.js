import {renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDetailView} from '../../public/js/views/detail.js';
import {createBottleForm} from '../../public/js/features/forms/bottle.js';
import {inventoryScanIcon, editIcon, deleteIcon}
  from '../../public/js/ui/action-icons.js';

/**
 * Tests input text against the button pattern.
 *
 * @param {*} html HTML markup to render or inspect.
 * @param {*} action Operation or action callback to invoke.
 * @return {*} Result computed from the supplied inputs.
 */
function button(html, action) {
  const found = renderedText(html).match(new RegExp(String.raw`<button\b[^>]*data-act="${action}"[^>]*>[\s\S]*?<\/button>`));
  assert.ok(found, `${action} button is missing`);
  return found[0];
}

/**
 * Validates the detail markup state and rejects invalid inputs.
 *
 * @param {!Object=} options Options controlling the operation.
 * @return {import('../../public/js/ui/render-plan.js').RenderContent} Captured detail view plan used to inspect action icons.
 */
function detailMarkup({photos = [], warehouse = null} = {}) {
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
    createDetailView({
      state: {
        selected: 'bottling-a',
        warehouse,
        collection: {
          bottlings: [{
            id: 'bottling-a', name: 'Example Whisky',
            bottles: [],
          }],
        },
      },
      selectors: {
        /**
         * Derives the bottles result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        bottles: () => [{
          id: 'physical-a', inventoryNumber: '001', status: 'closed',
          photos, files: [{id: 'file-a', name: 'Beleg.pdf', size: 1234}],
        }],
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
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
       */
      shell: markup => {html = markup;},
      /**
       * Reports the navigate error condition.
       */
      navigate: () => {throw Error('Unexpected navigation');},
      /**
       * Derives the action result from the supplied values.
       *
       * @param {*} fn Function called during this operation.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      action: async fn => fn(),
    })();
    return html;
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

test(
  'the physical-bottle edit dialog uses the same scanner SVG as the header',
  () => {
    const owner = {id: 'bottling-a', name: 'Example Whisky'};
    const form = createBottleForm({
      state: {collection: {bottlings: [owner]}},
      selectors: {
        /**
         * Omits distillery labels for this test.
         * @return {string} Empty label; no distillery name is supplied by this fixture.
         */
        distilleryNames: () => '',
      },
    })({id: 'physical-a'}, owner.id);
    const scan = button(form, 'scan-into-bottle');
    assert.ok(renderedText(scan).includes(renderedText(inventoryScanIcon)));
    assert.ok(renderedText(scan).includes('<span>Etikett scannen</span>'));
    assert.doesNotMatch(renderedText(scan), /▣|<text/);
  }
);

test(
  'the bottling and individual-bottle buttons show edit and delete SVGs before labels',
  () => {
    const html = detailMarkup();
    for (const action of ['edit-bottling', 'edit-bottle']) {
      assert.ok(renderedText(button(html, action)).includes(`${renderedText(editIcon)}<span>Bearbeiten</span>`), action);
    }
    for (const action of ['delete-bottling', 'delete-bottle', 'delete-file']) {
      assert.ok(renderedText(button(html, action)).includes(`${renderedText(deleteIcon)}<span>Löschen</span>`), action);
    }
    assert.ok(domElements(button(html, 'delete-file'), '[aria-label="Datei Beleg.pdf löschen"]').length > 0);
  }
);

test(
  'physical-bottle detail offers direct Umlagern while the Lagerort fact stays labelled',
  () => {
    const html = detailMarkup();
    const relocation = button(html, 'warehouse-assign');
    assert.ok(renderedText(relocation).includes('data-id="physical-a"'));
    assert.ok(renderedText(relocation).endsWith('>Umlagern</button>'));
    assert.ok(!renderedText(relocation).includes('>Lagerort</button>'));
  }
);

test(
  'a bottle storage-location link identifies the exact physical bottle',
  () => {
    const warehouse = {
      rooms: [{
        id: 'room-a', name: 'Whiskyzimmer', furniture: [{
          id: 'furniture-a',
          name: 'Vitrine',
          shelves: [{id: 'shelf-a', name: 'Fach 2'}],
        }],
      }], assignments: {'physical-a': 'shelf-a'},
    };
    const link = button(detailMarkup({warehouse}), 'warehouse-focus');
    assert.ok(domElements(link, '[data-id="shelf-a"]').length > 0);
    assert.ok(domElements(link, '[data-bottle-id="physical-a"]').length > 0);
    assert.match(renderedText(link), /Whiskyzimmer \/ Vitrine \/ Fach 2/);
    assert.equal(domElements(detailMarkup(), '[data-act="warehouse-focus"]').length, 0, 'a bottle without a known location must not present a location link');
  }
);

test(
  'the redundant photo ownership note is absent from the detail page',
  () => {
    assert.doesNotMatch(renderedText(detailMarkup()), /Fotos gehören jeweils einer physischen Flasche/);
  }
);

test(
  'photo editor uses only the shared pencil icon, with an accessible tooltip like the cutout button',
  () => {
    const html = detailMarkup({photos: [{id: 'photo-a', path: 'bottle.webp'}]});
    const edit = button(html, 'photo-editor-open');
    assert.equal(domElements(html, '[data-act="cutout-open"]').length, 0, 'no redundant second gallery button');
    assert.ok(renderedText(edit).includes(renderedText(editIcon)), 'the existing pencil icon is reused');
    assert.ok(domElements(edit, '[title="Flaschenbild bearbeiten"]').length > 0);
    assert.ok(domElements(edit, '[aria-label="Flaschenbild bearbeiten"]').length > 0);
    assert.doesNotMatch(renderedText(edit), /Anpassen|Adjust/);
  }
);

test(
  'physical bottle layout uses the first sorted photo as a large preview and preserves every gallery action',
  () => {
    const html = detailMarkup({
      photos: [
        {
          id: 'second-first',
          path: 'bottle-first.webp',
          source: 'whiskybase',
          cutout: {path: 'cutout-first.webp'},
        },
        {id: 'original-second', path: 'bottle-second.webp'},
      ],
    });
    const card = renderedText(html).slice(renderedText(html).indexOf('id="bottle-physical-a"'));
    assert.match(
      renderedText(card),
      new RegExp(
        'class="bottle-entry-main-photo" data-act="' + 'open-photo" data-bottle-photo-preview="phy' + 'sical-a"'
      )
    );
    assert.ok(domElements(card, '[class="bottle-entry-visual"]').length > 0);
    assert.ok(domElements(card, '[class="bottle-entry-head"]').length > 0);
    assert.ok(domElements(card, '[class="bottle-entry-facts"]').length > 0);
    assert.match(
      renderedText(html),
      /class="bottle-entry-list"><div class="bottle bottle-entry/,
      'bottle cards must not be wrapped in an additional panel'
    );
    assert.doesNotMatch(renderedText(html), /class="panel"><div class="bottle bottle-entry/,
      'no nested panel around the physical-bottle card');
    assert.match(renderedText(card), /class="bottle-entry-data-title">Flaschendaten/);
    assert.ok(domElements(card, '[class="bottle-entry-gallery"]').length > 0);
    assert.match(renderedText(card), /<h4>Fotos \(2\)<\/h4>/);
    assert.ok(domElements(card, '[class="bottle-photo-add-actions"]').length > 0);
    assert.ok(domElements(card, '[class="bottle-documents"]').length > 0);
    assert.ok(renderedText(card).indexOf('bottle-entry-visual') < renderedText(card).indexOf('bottle-entry-content'));
    assert.ok(renderedText(card).indexOf('bottle-entry-content') < renderedText(card).indexOf('bottle-entry-gallery'));
    assert.ok(renderedText(card).indexOf('bottle-entry-gallery') < renderedText(card).indexOf('bottle-documents'));
    assert.ok(renderedText(card).indexOf('bottle-entry-visual') < renderedText(card).indexOf('data-photo-list="physical-a"'));
    assert.equal(domElements(card, '[data-photo-list="physical-a"]').length, 1);
    assert.equal(domElements(card, '[data-photo-tile]').length, 2);
    assert.equal(domElements(card, '[data-act="photo-editor-open"]').length, 2);
    assert.equal(domElements(card, '[data-act="delete-photo"]').length, 2);
    assert.equal(domElements(card, '[data-photo-drag]').length, 2);
    assert.equal(domElements(card, '[data-act="move-photo"]').length, 4);
    assert.equal(domElements(card, '[data-bottle-photos="physical-a"]').length, 2);
    assert.equal(domElements(card, '[data-bottle-files="physical-a"]').length, 1);
    assert.match(renderedText(card), /bottle-main-source/);
    assert.match(renderedText(card), /bottle-main-cutout/);
    assert.ok(
      renderedText(card).indexOf('bottle-first.webp') < renderedText(card).indexOf('data-photo-list="physical-a"'),
      'first sorted photo is in preview'
    );
  }
);

test(
  'without an image the physical bottle card expands and still offers uploads and documents',
  () => {
    const html = detailMarkup();
    assert.match(renderedText(html), /bottle-entry without-photos/);
    assert.equal(domElements(html, '[class="bottle-entry-visual"]').length, 0);
    assert.equal(domElements(html, '[class="bottle-entry-main-photo"]').length, 0);
    assert.ok(domElements(html, '[class="bottle-entry-gallery"]').length > 0);
    assert.ok(domElements(html, '[class="bottle-photo-add-actions"]').length > 0);
    assert.match(renderedText(html), /class="bottle-entry-data-title">Flaschendaten/);
    assert.ok(domElements(html, '[data-bottle-photos="physical-a"]').length > 0);
    assert.ok(domElements(html, '[data-bottle-files="physical-a"]').length > 0);
    assert.ok(domElements(html, '[data-act="edit-bottle"]').length > 0);
    assert.ok(domElements(html, '[data-act="delete-bottle"]').length > 0);
  }
);
