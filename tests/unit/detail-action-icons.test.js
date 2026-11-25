import {renderedText} from '../helpers/rendering.js';
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
 * @return {string} Resulting text.
 */
function detailMarkup({photos = [], warehouse = null} = {}) {
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
         * Derives the cover photo result from the supplied values.
         * @return {string} Resulting text.
         */
        coverPhoto: () => '',
        /**
         * Derives the distillery names result from the supplied values.
         * @return {string} Resulting text.
         */
        distilleryNames: () => '',
      },
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} markup HTML markup for the selected content.
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
         * Derives the distillery names result from the supplied values.
         * @return {string} Resulting text.
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
    assert.match(renderedText(button(html, 'delete-file')), /aria-label="Datei Beleg\.pdf löschen"/);
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
    assert.match(renderedText(link), /data-id="shelf-a"/);
    assert.match(renderedText(link), /data-bottle-id="physical-a"/);
    assert.match(renderedText(link), /Whiskyzimmer \/ Vitrine \/ Fach 2/);
    assert.doesNotMatch(renderedText(detailMarkup()), /data-act="warehouse-focus"/,
      'a bottle without a known location must not present a location link');
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
    assert.doesNotMatch(renderedText(html), /data-act="cutout-open"/, 'no redundant second gallery button');
    assert.ok(renderedText(edit).includes(renderedText(editIcon)), 'the existing pencil icon is reused');
    assert.match(renderedText(edit), /title="Flaschenbild bearbeiten"/);
    assert.match(renderedText(edit), /aria-label="Flaschenbild bearbeiten"/);
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
    assert.match(renderedText(card), /class="bottle-entry-visual"/);
    assert.match(renderedText(card), /class="bottle-entry-head"/);
    assert.match(renderedText(card), /class="bottle-entry-facts"/);
    assert.match(
      renderedText(html),
      /class="bottle-entry-list"><div class="bottle bottle-entry/,
      'bottle cards must not be wrapped in an additional panel'
    );
    assert.doesNotMatch(renderedText(html), /class="panel"><div class="bottle bottle-entry/,
      'no nested panel around the physical-bottle card');
    assert.match(renderedText(card), /class="bottle-entry-data-title">Flaschendaten/);
    assert.match(renderedText(card), /class="bottle-entry-gallery"/);
    assert.match(renderedText(card), /<h4>Fotos \(2\)<\/h4>/);
    assert.match(renderedText(card), /class="bottle-photo-add-actions"/);
    assert.match(renderedText(card), /class="bottle-documents"/);
    assert.ok(renderedText(card).indexOf('bottle-entry-visual') < renderedText(card).indexOf('bottle-entry-content'));
    assert.ok(renderedText(card).indexOf('bottle-entry-content') < renderedText(card).indexOf('bottle-entry-gallery'));
    assert.ok(renderedText(card).indexOf('bottle-entry-gallery') < renderedText(card).indexOf('bottle-documents'));
    assert.ok(renderedText(card).indexOf('bottle-entry-visual') < renderedText(card).indexOf('data-photo-list="physical-a"'));
    assert.equal((renderedText(card).match(/data-photo-list="physical-a"/g) || []).length, 1);
    assert.equal((renderedText(card).match(/data-photo-tile/g) || []).length, 2);
    assert.equal((renderedText(card).match(/data-act="photo-editor-open"/g) || []).length, 2);
    assert.equal((renderedText(card).match(/data-act="delete-photo"/g) || []).length, 2);
    assert.equal((renderedText(card).match(/data-photo-drag/g) || []).length, 2);
    assert.equal((renderedText(card).match(/data-act="move-photo"/g) || []).length, 4);
    assert.equal((renderedText(card).match(/data-bottle-photos="physical-a"/g) || []).length, 2);
    assert.equal((renderedText(card).match(/data-bottle-files="physical-a"/g) || []).length, 1);
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
    assert.doesNotMatch(renderedText(html), /class="bottle-entry-visual"/);
    assert.doesNotMatch(renderedText(html), /class="bottle-entry-main-photo"/);
    assert.match(renderedText(html), /class="bottle-entry-gallery"/);
    assert.match(renderedText(html), /class="bottle-photo-add-actions"/);
    assert.match(renderedText(html), /class="bottle-entry-data-title">Flaschendaten/);
    assert.match(renderedText(html), /data-bottle-photos="physical-a"/);
    assert.match(renderedText(html), /data-bottle-files="physical-a"/);
    assert.match(renderedText(html), /data-act="edit-bottle"/);
    assert.match(renderedText(html), /data-act="delete-bottle"/);
  }
);
