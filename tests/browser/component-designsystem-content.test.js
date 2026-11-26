import {domElements, domText, domMatches, domEqual, assertDom} from './component-dom.js';
import {fixtureMarkup} from '../helpers/capture-rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {panel, detailField, detailGrid, emptyState, divider, actionToolbar, documentList, documentItem} from '../../public/js/ui/content.js';

test(
  'M4: panel variants reuse the existing surface without wrapping it in a second border',
  async () => {
    assert.ok(await domEqual(panel({content: fixtureMarkup('<p>Info</p>')}), fixtureMarkup('<div class="panel" data-ds-panel="standard"><p>Info</p></div>')));
    assert.ok(await domEqual(panel({tag: 'section', variant: 'analytics', content: fixtureMarkup('<p>C</p>')}), fixtureMarkup('<section class="analytics-panel" data-ds-panel="analytics"><p>C</p></section>')));
    await assertDom(panel({content: 'one'}), ".panel .panel", {}, true);
    assert.throws(() => panel({variant: 'unknown'}), RangeError);
  }
);

test(
  'M4: definition, fact and saved-note fields preserve semantics, values and XSS safety',
  async () => {
    const definition = detailField({label: 'Kaufpreis', value: '49,90 €'});
    await assertDom(definition, "dt:has(+ dd)", {text: "Kaufpreis", nextText: "49,90 €"});
    assert.ok((await domElements(definition, '[data-ds-detail-field="definition"]')).length > 0);
    assert.equal((await domElements(definition, 'dt')).length, 1);
    const facts = detailGrid(definition, {columns: 3, tag: 'dl', className: 'bottle-entry-facts'});
    await assertDom(facts, "dl.bottle-entry-facts[data-ds-detail-grid=\"3\"]");
    assert.ok((await domElements(detailGrid(definition, {columns: 2}), '[data-ds-detail-grid="2"]')).length > 0);
    const note = detailField({
      label: 'Nase',
      value: 'Smoke <script>alert(1)</script> & fruit',
      variant: 'note',
      labelClass: 'tasting-readonly-label',
    });
    assert.match(await domText(note), new RegExp("Smoke <script>alert\\(1\\)<\\/script> & fruit"));
    assert.equal((await domElements(note, 'script')).length, 0);
    await assertDom(detailField({
      label: 'Land',
      value: fixtureMarkup('<strong>Schottland</strong>'),
      valueHtml: true,
      variant: 'fact',
    }), "strong", {"text": new RegExp("^Schottland$")});
    assert.throws(() => detailGrid('', {columns: 4}), RangeError);
  }
);

test(
  'M4: empty states distinguish collection onboarding from absent optional content',
  async () => {
    const quiet = emptyState({description: 'Noch keine Notizen'});
    assert.ok((await domElements(quiet, '[class="hint"][data-ds-empty-state="subtle"]')).length > 0);
    assert.equal((await domMatches(quiet, "[class=\"panel\"]")) || (await domMatches(quiet, ".border")), false);
    const inline = emptyState({description: 'Keine Daten', variant: 'inline'});
    assert.ok((await domElements(inline, '[class="analytics-empty"][data-ds-empty-state="inline"]')).length > 0);
    const collection = emptyState({
      title: 'Leere Sammlung',
      description: 'Ersten Whisky anlegen',
      variant: 'collection',
      actions: fixtureMarkup('<button data-act="new">Neu</button>'),
    });
    assert.equal((await domElements(collection, 'div.empty-state[data-ds-empty-state="collection"]')).length, 1);
    assert.ok((await domElements(collection, '[data-act="new"]')).length > 0);
    assert.throws(() => emptyState({variant: 'highlighted'}), RangeError);
  }
);

test(
  'M4: divider and action toolbar have explicit axes and preserve action delegation',
  async () => {
    assert.equal((await domElements(divider(), 'hr.divider[data-ds-divider="horizontal"]')).length, 1);
    assert.ok((await domElements(divider({orientation: 'vertical'}), '[data-ds-divider="vertical"][aria-hidden="true"]')).length > 0);
    const toolbar = actionToolbar(fixtureMarkup('<button data-act="edit-bottle">Edit</button>'));
    assert.equal((await domElements(toolbar, '.actions[data-ds-action-toolbar="inline"] > button[data-act="edit-bottle"]'))[0].text, 'Edit');
    assert.ok((await domElements(actionToolbar('X', {variant: 'filters'}), '[class="toolbar"][data-ds-action-toolbar="filters"]')).length > 0);
    assert.throws(() => actionToolbar('', {variant: 'erase'}), RangeError);
  }
);

test(
  'M4: documents remain one semantic list with original item and action markup',
  async () => {
    const item = documentItem(fixtureMarkup('<button data-act="preview-file">Datei</button><a download>Download</a>'));
    const list = documentList([item]);
    assert.equal((await domElements(list, 'ul')).length, 1);
    assert.equal((await domElements(list, 'li')).length, 1);
    assert.ok((await domElements(list, '[class="document-list"][data-ds-document-list]')).length > 0);
    assert.ok((await domElements(list, '[data-act="preview-file"]')).length > 0);
    await assertDom(list, "a[download]");
  }
);
