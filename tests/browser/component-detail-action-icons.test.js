import {domElements, domText, domMatches, domIndex, domContains, domScope, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDetailView} from '../../public/js/views/detail.js';
import {createBottleForm} from '../../public/js/features/forms/bottle.js';
import {inventoryScanIcon, editIcon, deleteIcon} from '../../public/js/ui/action-icons.js';

/**
 * Selects the rendered action button for native DOM assertions.
 *
 * @param {*} html Captured render content to inspect.
 * @param {*} action Operation or action callback to invoke.
 * @return {*} Result computed from the supplied inputs.
 */
function button(html, action) {
  return domScope(html, `button[data-act="${action}"]`);
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
  async () => {
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
    assert.ok(await domContains(scan, inventoryScanIcon));
    await assertDom(scan, "span", {text: "Etikett scannen"});
    assert.equal((/▣/.test(await domText(scan)) || await domMatches(scan, "text")), false);
  }
);

test(
  'the bottling and individual-bottle buttons show edit and delete SVGs before labels',
  async () => {
    const html = detailMarkup();
    for (const action of ['edit-bottling', 'edit-bottle']) {
      assert.ok(await domContains(button(html, action), editIcon), action);
      await assertDom(button(html, action), "svg + span", {text: "Bearbeiten"});
    }
    for (const action of ['delete-bottling', 'delete-bottle', 'delete-file']) {
      assert.ok(await domContains(button(html, action), deleteIcon), action);
      await assertDom(button(html, action), "svg + span", {text: "Löschen"});
    }
    assert.ok((await domElements(button(html, 'delete-file'), '[aria-label="Datei Beleg.pdf löschen"]')).length > 0);
  }
);

test(
  'physical-bottle detail offers direct Umlagern while the Lagerort fact stays labelled',
  async () => {
    const html = detailMarkup();
    const relocation = button(html, 'warehouse-assign');
    await assertDom(relocation, "button[data-id=\"physical-a\"]");
    await assertDom(relocation, "button", {text: "Umlagern"});
    await assertDom(relocation, "button", {text: "Lagerort"}, true);
  }
);

test(
  'a bottle storage-location link identifies the exact physical bottle',
  async () => {
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
    assert.ok((await domElements(link, '[data-id="shelf-a"]')).length > 0);
    assert.ok((await domElements(link, '[data-bottle-id="physical-a"]')).length > 0);
    assert.match(await domText(link), /Whiskyzimmer \/ Vitrine \/ Fach 2/);
    assert.equal((await domElements(detailMarkup(), '[data-act="warehouse-focus"]')).length, 0, 'a bottle without a known location must not present a location link');
  }
);

test(
  'the redundant photo ownership note is absent from the detail page',
  async () => {
    assert.doesNotMatch(await domText(detailMarkup()), /Fotos gehören jeweils einer physischen Flasche/);
  }
);

test(
  'photo editor uses only the shared pencil icon, with an accessible tooltip like the cutout button',
  async () => {
    const html = detailMarkup({photos: [{id: 'photo-a', path: 'bottle.webp'}]});
    const edit = button(html, 'photo-editor-open');
    assert.equal((await domElements(html, '[data-act="cutout-open"]')).length, 0, 'no redundant second gallery button');
    assert.ok(await domContains(edit, editIcon), 'the existing pencil icon is reused');
    assert.ok((await domElements(edit, '[title="Flaschenbild bearbeiten"]')).length > 0);
    assert.ok((await domElements(edit, '[aria-label="Flaschenbild bearbeiten"]')).length > 0);
    assert.equal((new RegExp("Anpassen|Adjust").test(await domText(edit))), false);
  }
);

test(
  'physical bottle layout uses the first sorted photo as a large preview and preserves every gallery action',
  async () => {
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
    const card = domScope(html, "#bottle-physical-a");
    await assertDom(card, "[class=\"bottle-entry-main-photo\"][data-act=\"open-photo\"][data-bottle-photo-preview=\"physical-a\"]");
    assert.ok((await domElements(card, '[class="bottle-entry-visual"]')).length > 0);
    assert.ok((await domElements(card, '[class="bottle-entry-head"]')).length > 0);
    assert.ok((await domElements(card, '[class="bottle-entry-facts"]')).length > 0);
    await assertDom(html, ".bottle-entry-list > .bottle.bottle-entry", {}, false, 'bottle cards must not be wrapped in an additional panel');
    await assertDom(html, ".panel > .bottle.bottle-entry", {}, true, 'no nested panel around the physical-bottle card');
    await assertDom(card, "[class=\"bottle-entry-data-title\"]", {"text": new RegExp("Flaschendaten")});
    assert.ok((await domElements(card, '[class="bottle-entry-gallery"]')).length > 0);
    await assertDom(card, "h4", {"text": new RegExp("^Fotos \\(2\\)$")});
    assert.ok((await domElements(card, '[class="bottle-photo-add-actions"]')).length > 0);
    assert.ok((await domElements(card, '[class="bottle-documents"]')).length > 0);
    assert.ok(await domIndex(card, '.bottle-entry-visual') < await domIndex(card, '.bottle-entry-content'));
    assert.ok(await domIndex(card, '.bottle-entry-content') < await domIndex(card, '.bottle-entry-gallery'));
    assert.ok(await domIndex(card, '.bottle-entry-gallery') < await domIndex(card, '.bottle-documents'));
    assert.ok(await domIndex(card, '.bottle-entry-visual') < await domIndex(card, '[data-photo-list="physical-a"]'));
    assert.equal((await domElements(card, '[data-photo-list="physical-a"]')).length, 1);
    assert.equal((await domElements(card, '[data-photo-tile]')).length, 2);
    assert.equal((await domElements(card, '[data-act="photo-editor-open"]')).length, 2);
    assert.equal((await domElements(card, '[data-act="delete-photo"]')).length, 2);
    assert.equal((await domElements(card, '[data-photo-drag]')).length, 2);
    assert.equal((await domElements(card, '[data-act="move-photo"]')).length, 4);
    assert.equal((await domElements(card, '[data-bottle-photos="physical-a"]')).length, 2);
    assert.equal((await domElements(card, '[data-bottle-files="physical-a"]')).length, 1);
    await assertDom(card, ".bottle-main-source");
    await assertDom(card, ".bottle-main-cutout");
    assert.ok(
      await domIndex(card, '[src*="bottle-first.webp"]') < await domIndex(card, '[data-photo-list="physical-a"]'),
      'first sorted photo is in preview'
    );
  }
);

test(
  'without an image the physical bottle card expands and still offers uploads and documents',
  async () => {
    const html = detailMarkup();
    await assertDom(html, '.bottle-entry.without-photos');
    assert.equal((await domElements(html, '[class="bottle-entry-visual"]')).length, 0);
    assert.equal((await domElements(html, '[class="bottle-entry-main-photo"]')).length, 0);
    assert.ok((await domElements(html, '[class="bottle-entry-gallery"]')).length > 0);
    assert.ok((await domElements(html, '[class="bottle-photo-add-actions"]')).length > 0);
    await assertDom(html, "[class=\"bottle-entry-data-title\"]", {"text": new RegExp("Flaschendaten")});
    assert.ok((await domElements(html, '[data-bottle-photos="physical-a"]')).length > 0);
    assert.ok((await domElements(html, '[data-bottle-files="physical-a"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="edit-bottle"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="delete-bottle"]')).length > 0);
  }
);
