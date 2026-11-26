import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTemplateStructure} from '../../scripts/html-template-structure.js';
import {formatTemplateFile} from '../../scripts/format-html-templates.js';

test('fragment validation rejects unbalanced elements and misplaced bindings', () => {
  assert.doesNotThrow(() => validateTemplateStructure('<div{{attrs:props}}><svg><path d="{{attr:path}}"/></svg>{{content:child}}<input></div>', 'example'));
  for (const markup of ['<div><p></div>', '<div>{{attr:wrong}}</div>', '<div title="{{attrs:wrong}}"></div>', '<div {{raw:wrong}}></div>', '<div {{content:wrong}}></div>']) {
    assert.throws(() => validateTemplateStructure(markup, 'example'), /example:/);
  }
});

test('formatter fixes structural indentation and preserves inline text and literal attributes', () => {
  const source = '<!-- wcm-template:example -->\n<div>\n          {{content:child}}\n      <span title="An &amp; B">Inline <strong>text</strong></span></div>\n<!-- /wcm-template -->\n';
  const formatted = formatTemplateFile(source);
  assert.equal(formatTemplateFile(formatted), formatted);
  assert.match(formatted, /\n  \{\{content:child\}\}\n  <span title="An &amp; B">Inline <strong>text<\/strong><\/span>\n<\/div>/);
});
