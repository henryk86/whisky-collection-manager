import {fixtureMarkup, renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  panel, detailField, detailGrid, emptyState, divider, actionToolbar,
  documentList, documentItem
} from '../../public/js/ui/content.js';

test(
  'M4: panel variants reuse the existing surface without wrapping it in a second border',
  () => {
    assert.equal(renderedText(panel({content: fixtureMarkup('<p>Info</p>')})), '<div class="panel" data-ds-panel="standard"><p>Info</p></div>');
    assert.equal(
      renderedText(panel({tag: 'section', variant: 'analytics', content: fixtureMarkup('<p>C</p>')})),
      '<section class="analytics-panel" data-ds-panel="analytics"><p>C</p></section>'
    );
    assert.doesNotMatch(renderedText(panel({content: 'one'})), /class="panel"[\s\S]*class="panel"/);
    assert.throws(() => panel({variant: 'unknown'}), RangeError);
  }
);

test(
  'M4: definition, fact and saved-note fields preserve semantics, values and XSS safety',
  () => {
    const definition = detailField({label: 'Kaufpreis', value: '49,90 €'});
    assert.match(renderedText(definition), /<dt>Kaufpreis<\/dt><dd>49,90 €<\/dd>/);
    assert.ok(domElements(definition, '[data-ds-detail-field="definition"]').length > 0);
    assert.equal(domElements(definition, 'dt').length, 1);
    const facts = detailGrid(definition, {columns: 3, tag: 'dl', className: 'bottle-entry-facts'});
    assert.match(renderedText(facts), /^<dl class="bottle-entry-facts" data-ds-detail-grid="3">/);
    assert.ok(domElements(detailGrid(definition, {columns: 2}), '[data-ds-detail-grid="2"]').length > 0);
    const note = detailField({
      label: 'Nase',
      value: 'Smoke <script>alert(1)</script> & fruit',
      variant: 'note',
      labelClass: 'tasting-readonly-label',
    });
    assert.match(renderedText(note), /Smoke &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; fruit/);
    assert.equal(domElements(note, 'script').length, 0);
    assert.match(
      renderedText(detailField({
        label: 'Land',
        value: fixtureMarkup('<strong>Schottland</strong>'),
        valueHtml: true,
        variant: 'fact',
      })),
      /<strong>Schottland<\/strong>/
    );
    assert.throws(() => detailGrid('', {columns: 4}), RangeError);
  }
);

test(
  'M4: empty states distinguish collection onboarding from absent optional content',
  () => {
    const quiet = emptyState({description: 'Noch keine Notizen'});
    assert.ok(domElements(quiet, '[class="hint"][data-ds-empty-state="subtle"]').length > 0);
    assert.doesNotMatch(renderedText(quiet), /class="panel"|border/);
    const inline = emptyState({description: 'Keine Daten', variant: 'inline'});
    assert.ok(domElements(inline, '[class="analytics-empty"][data-ds-empty-state="inline"]').length > 0);
    const collection = emptyState({
      title: 'Leere Sammlung',
      description: 'Ersten Whisky anlegen',
      variant: 'collection',
      actions: fixtureMarkup('<button data-act="new">Neu</button>'),
    });
    assert.equal(domElements(collection, 'div.empty-state[data-ds-empty-state="collection"]').length, 1);
    assert.ok(domElements(collection, '[data-act="new"]').length > 0);
    assert.throws(() => emptyState({variant: 'highlighted'}), RangeError);
  }
);

test(
  'M4: divider and action toolbar have explicit axes and preserve action delegation',
  () => {
    assert.equal(domElements(divider(), 'hr.divider[data-ds-divider="horizontal"]').length, 1);
    assert.ok(domElements(divider({orientation: 'vertical'}), '[data-ds-divider="vertical"][aria-hidden="true"]').length > 0);
    const toolbar = actionToolbar(fixtureMarkup('<button data-act="edit-bottle">Edit</button>'));
    assert.equal(domElements(toolbar, '.actions[data-ds-action-toolbar="inline"] > button[data-act="edit-bottle"]')[0].text, 'Edit');
    assert.ok(domElements(actionToolbar('X', {variant: 'filters'}), '[class="toolbar"][data-ds-action-toolbar="filters"]').length > 0);
    assert.throws(() => actionToolbar('', {variant: 'erase'}), RangeError);
  }
);

test(
  'M4: documents remain one semantic list with original item and action markup',
  () => {
    const item = documentItem(fixtureMarkup('<button data-act="preview-file">Datei</button><a download>Download</a>'));
    const list = documentList([item]);
    assert.equal(domElements(list, 'ul').length, 1);
    assert.equal(domElements(list, 'li').length, 1);
    assert.ok(domElements(list, '[class="document-list"][data-ds-document-list]').length > 0);
    assert.ok(domElements(list, '[data-act="preview-file"]').length > 0);
    assert.match(renderedText(list), /download/);
  }
);
