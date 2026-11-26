import assert from 'node:assert/strict';
import test from 'node:test';
import {formatCss, tokenizeCss} from '../../scripts/format-css.js';

test(
  'CSS formatter uses two spaces, one declaration per line and rule spacing',
  () => {
    const source = '@media(max-width:700px){.a,.b{color:red;display:flex}' + '.c{gap:2px}}';
    assert.equal(formatCss(source), [
      '@media (max-width:700px) {',
      '  .a,',
      '  .b {',
      '    color: red;',
      '    display: flex;',
      '  }',
      '',
      '  .c {',
      '    gap: 2px;',
      '  }',
      '}',
      '',
    ].join('\n'));
  }
);

test(
  'CSS formatter leaves strings, URLs, functions and custom values intact',
  () => {
    const source = [
      '/* Keep literal punctuation. */',
      '.a:is(.x,.y), .b[data-x="a,b;c"] {',
      '  content:"};{"; --demo: url("data:image/svg+xml,<svg>;</svg>");',
      '  color: rgb(1, 2, 3);',
      '}',
    ].join('\n');
    const result = formatCss(source);
    assert.match(result, /content: "};{";/);
    assert.match(result, /--demo: url\("data:image\/svg\+xml,<svg>;<\/svg>"\);/);
    assert.match(result, /\.a:is\(\.x,\.y\),\n\.b\[data-x="a,b;c"\] \{/);
    assert.equal(formatCss(result), result);
  }
);

test(
  'CSS formatter preserves at-rule and duplicate declaration order',
  () => {
    const source = '@import url("one.css"); @import url("two.css"); ' + '.a{color:red;color:blue}';
    const formatted = formatCss(source);
    assert.ok(formatted.indexOf('one.css') < formatted.indexOf('two.css'));
    assert.ok(formatted.indexOf('color: red;') < formatted.indexOf('color: blue;'));
    assert.equal(formatCss(formatted), formatted);
  }
);

test('CSS tokenizer rejects unterminated strings and unbalanced blocks', () => {
  assert.throws(() => tokenizeCss('.a{content: "unfinished;}'), /Unclosed/);
  assert.throws(() => formatCss('.a { color: red;'), /Unclosed/);
  assert.throws(() => formatCss('.a { color: red; }}'), /Unexpected/);
});
