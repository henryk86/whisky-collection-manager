import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../public/styles/analytics.css', import.meta.url), 'utf8');
const core = fs.readFileSync(new URL('../../public/styles/core.css', import.meta.url), 'utf8');

test('analytics and warehouse share the full main-content width without nested side gutters', () => {
    assert.match(css, /\.analytics-page\s*\{[^}]*width:\s*100%;[^}]*padding:\s*34px 0 10px;/,
        'desktop analytics and warehouse use the whole main container');
    assert.doesNotMatch(css, /\.analytics-page\s*\{[^}]*max-width:\s*1320px;/,
        'the inner analytics wrapper no longer limits wide desktop pages');
    assert.match(core, /main\s*\{[^}]*max-width:\s*1350px;[^}]*padding:\s*0 30px 20px;/,
        'analytics and warehouse inherit the same main container as collection, map and settings');
});

test('analytics: compact footer spacing without changing the shared app footer', () => {
    assert.match(css, /\.analytics-page\s*\{[^}]*padding:\s*34px 0 10px;/,
        'desktop analytics has a compact bottom padding');
    assert.match(css, /\.analytics-footnote\s*\{[^}]*margin:\s*20px 0 0;/,
        'the final analytics note must not add bottom margin');
    assert.match(css, /@media\(max-width:720px\)\s*\{\s*\.analytics-page\s*\{[^}]*padding:\s*22px 0 10px;/,
        'mobile analytics uses the same compact bottom spacing');
    assert.match(core, /\.site-footer\s*\{[^}]*margin:\s*10px auto 0;/,
        'the shared sticky footer keeps its existing margin');
});
