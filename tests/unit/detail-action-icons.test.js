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
  const found = html.match(new RegExp(String.raw`<button\b[^>]*data-act="${action}"[^>]*>[\s\S]*?<\/button>`));
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
    assert.ok(scan.includes(inventoryScanIcon));
    assert.ok(scan.includes('<span>Etikett scannen</span>'));
    assert.doesNotMatch(scan, /▣|<text/);
  }
);

test(
  'the bottling and individual-bottle buttons show edit and delete SVGs before labels',
  () => {
    const html = detailMarkup();
    for (const action of ['edit-bottling', 'edit-bottle']) {
      assert.ok(button(html, action).includes(`${editIcon}<span>Bearbeiten</span>`), action);
    }
    for (const action of ['delete-bottling', 'delete-bottle', 'delete-file']) {
      assert.ok(button(html, action).includes(`${deleteIcon}<span>Löschen</span>`), action);
    }
    assert.match(button(html, 'delete-file'), /aria-label="Datei Beleg\.pdf löschen"/);
  }
);

test(
  'physical-bottle detail offers direct Umlagern while the Lagerort fact stays labelled',
  () => {
    const html = detailMarkup();
    const relocation = button(html, 'warehouse-assign');
    assert.ok(relocation.includes('data-id="physical-a"'));
    assert.ok(relocation.endsWith('>Umlagern</button>'));
    assert.ok(!relocation.includes('>Lagerort</button>'));
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
    assert.match(link, /data-id="shelf-a"/);
    assert.match(link, /data-bottle-id="physical-a"/);
    assert.match(link, /Whiskyzimmer \/ Vitrine \/ Fach 2/);
    assert.doesNotMatch(detailMarkup(), /data-act="warehouse-focus"/,
      'a bottle without a known location must not present a location link');
  }
);

test(
  'the redundant photo ownership note is absent from the detail page',
  () => {
    assert.doesNotMatch(detailMarkup(), /Fotos gehören jeweils einer physischen Flasche/);
  }
);

test(
  'photo editor uses only the shared pencil icon, with an accessible tooltip like the cutout button',
  () => {
    const html = detailMarkup({photos: [{id: 'photo-a', path: 'bottle.webp'}]});
    const edit = button(html, 'photo-editor-open');
    assert.doesNotMatch(html, /data-act="cutout-open"/, 'no redundant second gallery button');
    assert.ok(edit.includes(editIcon), 'the existing pencil icon is reused');
    assert.match(edit, /title="Flaschenbild bearbeiten"/);
    assert.match(edit, /aria-label="Flaschenbild bearbeiten"/);
    assert.doesNotMatch(edit, /Anpassen|Adjust/);
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
    const card = html.slice(html.indexOf('id="bottle-physical-a"'));
    assert.match(
      card,
      new RegExp(
        'class="bottle-entry-main-photo" data-act="' + 'open-photo" data-bottle-photo-preview="phy' + 'sical-a"'
      )
    );
    assert.match(card, /class="bottle-entry-visual"/);
    assert.match(card, /class="bottle-entry-head"/);
    assert.match(card, /class="bottle-entry-facts"/);
    assert.match(
      html,
      /class="bottle-entry-list"><div class="bottle bottle-entry/,
      'bottle cards must not be wrapped in an additional panel'
    );
    assert.doesNotMatch(html, /class="panel"><div class="bottle bottle-entry/,
      'no nested panel around the physical-bottle card');
    assert.match(card, /class="bottle-entry-data-title">Flaschendaten/);
    assert.match(card, /class="bottle-entry-gallery"/);
    assert.match(card, /<h4>Fotos \(2\)<\/h4>/);
    assert.match(card, /class="bottle-photo-add-actions"/);
    assert.match(card, /class="bottle-documents"/);
    assert.ok(card.indexOf('bottle-entry-visual') < card.indexOf('bottle-entry-content'));
    assert.ok(card.indexOf('bottle-entry-content') < card.indexOf('bottle-entry-gallery'));
    assert.ok(card.indexOf('bottle-entry-gallery') < card.indexOf('bottle-documents'));
    assert.ok(card.indexOf('bottle-entry-visual') < card.indexOf('data-photo-list="physical-a"'));
    assert.equal((card.match(/data-photo-list="physical-a"/g) || []).length, 1);
    assert.equal((card.match(/data-photo-tile/g) || []).length, 2);
    assert.equal((card.match(/data-act="photo-editor-open"/g) || []).length, 2);
    assert.equal((card.match(/data-act="delete-photo"/g) || []).length, 2);
    assert.equal((card.match(/data-photo-drag/g) || []).length, 2);
    assert.equal((card.match(/data-act="move-photo"/g) || []).length, 4);
    assert.equal((card.match(/data-bottle-photos="physical-a"/g) || []).length, 2);
    assert.equal((card.match(/data-bottle-files="physical-a"/g) || []).length, 1);
    assert.match(card, /bottle-main-source/);
    assert.match(card, /bottle-main-cutout/);
    assert.ok(
      card.indexOf('bottle-first.webp') < card.indexOf('data-photo-list="physical-a"'),
      'first sorted photo is in preview'
    );
  }
);

test(
  'without an image the physical bottle card expands and still offers uploads and documents',
  () => {
    const html = detailMarkup();
    assert.match(html, /bottle-entry without-photos/);
    assert.doesNotMatch(html, /class="bottle-entry-visual"/);
    assert.doesNotMatch(html, /class="bottle-entry-main-photo"/);
    assert.match(html, /class="bottle-entry-gallery"/);
    assert.match(html, /class="bottle-photo-add-actions"/);
    assert.match(html, /class="bottle-entry-data-title">Flaschendaten/);
    assert.match(html, /data-bottle-photos="physical-a"/);
    assert.match(html, /data-bottle-files="physical-a"/);
    assert.match(html, /data-act="edit-bottle"/);
    assert.match(html, /data-act="delete-bottle"/);
  }
);
