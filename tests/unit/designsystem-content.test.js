import test from 'node:test';
import assert from 'node:assert/strict';
import {panel, detailField, detailGrid, emptyState, divider, actionToolbar, documentList, documentItem} from '../../public/js/ui/content.js';

test(
  'M4: panel variants reuse the existing surface without wrapping it in a second border',
  () => {
    assert.equal(
      panel({content: '<p>Info</p>'}),
      '<div class="panel" data-ds-panel="standard"><p>Info</p></div>'
    );
    assert.equal(
      panel({tag: 'section', variant: 'analytics', content: '<p>C</p>'}),
      '<section class="analytics-panel" data-ds-panel="analytics"><p>C</p></section>'
    );
    assert.doesNotMatch(
      panel({content: 'one'}),
      /class="panel"[\s\S]*class="panel"/
    );
    assert.throws(() => panel({variant: 'unknown'}), RangeError);
  }
);

test(
  'M4: definition, fact and saved-note fields preserve semantics, values and XSS safety',
  () => {
    const definition = detailField({label: 'Kaufpreis', value: '49,90 €'});
    assert.match(definition, /<dt>Kaufpreis<\/dt><dd>49,90 €<\/dd>/);
    assert.match(definition, /data-ds-detail-field="definition"/);
    assert.equal((definition.match(/<dt>/g) || []).length, 1);
    const facts = detailGrid(
      definition,
      {columns: 3, tag: 'dl', className: 'bottle-entry-facts'}
    );
    assert.match(
      facts,
      /^<dl class="bottle-entry-facts" data-ds-detail-grid="3">/
    );
    assert.match(
      detailGrid(definition, {columns: 2}),
      /data-ds-detail-grid="2"/
    );
    const note = detailField({
      label: 'Nase',
      value: 'Smoke <script>alert(1)</script> & fruit',
      variant: 'note',
      labelClass: 'tasting-readonly-label',
    });
    assert.match(
      note,
      /Smoke &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; fruit/
    );
    assert.doesNotMatch(note, /<script>/);
    assert.match(
      detailField({
        label: 'Land',
        value: '<strong>Schottland</strong>',
        valueHtml: true,
        variant: 'fact',
      }),
      /<strong>Schottland<\/strong>/
    );
    assert.throws(() => detailGrid('', {columns: 4}), RangeError);
  }
);

test(
  'M4: empty states distinguish collection onboarding from absent optional content',
  () => {
    const quiet = emptyState({description: 'Noch keine Notizen'});
    assert.match(quiet, /class="hint" data-ds-empty-state="subtle"/);
    assert.doesNotMatch(quiet, /class="panel"|border/);
    const inline = emptyState({description: 'Keine Daten', variant: 'inline'});
    assert.match(
      inline,
      /class="analytics-empty" data-ds-empty-state="inline"/
    );
    const collection = emptyState({
      title: 'Leere Sammlung',
      description: 'Ersten Whisky anlegen',
      variant: 'collection',
      actions: '<button data-act="new">Neu</button>',
    });
    assert.match(
      collection,
      /^<div class="empty-state" data-ds-empty-state="collection">/
    );
    assert.match(collection, /data-act="new"/);
    assert.throws(() => emptyState({variant: 'highlighted'}), RangeError);
  }
);

test(
  'M4: divider and action toolbar have explicit axes and preserve action delegation',
  () => {
    assert.equal(
      divider(),
      '<hr class="divider" data-ds-divider="horizontal">'
    );
    assert.match(
      divider({orientation: 'vertical'}),
      /data-ds-divider="vertical" aria-hidden="true"/
    );
    assert.match(
      actionToolbar('<button data-act="edit-bottle">Edit</button>'),
      /class="actions" data-ds-action-toolbar="inline"><button data-act="edit-bottle">Edit<\/button>/
    );
    assert.match(
      actionToolbar('X', {variant: 'filters'}),
      /class="toolbar" data-ds-action-toolbar="filters"/
    );
    assert.throws(() => actionToolbar('', {variant: 'erase'}), RangeError);
  }
);

test(
  'M4: documents remain one semantic list with original item and action markup',
  () => {
    const item = documentItem('<button data-act="preview-file">Datei</button><a download>Download</a>');
    const list = documentList([item]);
    assert.equal((list.match(/<ul/g) || []).length, 1);
    assert.equal((list.match(/<li>/g) || []).length, 1);
    assert.match(list, /class="document-list" data-ds-document-list/);
    assert.match(list, /data-act="preview-file"/);
    assert.match(list, /download/);
  }
);
