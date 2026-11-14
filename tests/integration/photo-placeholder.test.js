import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('custom SVG photo placeholder is used instead of the old glyph', () => {
    const asset = fs.readFileSync('public/assets/photo-placeholder.svg', 'utf8');
    assert.match(asset, /<svg/i);

    const home = fs.readFileSync('public/js/views/home.js', 'utf8');
    const detail = fs.readFileSync('public/js/views/detail.js', 'utf8');
    assert.match(home, /\/assets\/photo-placeholder\.svg/);
    assert.match(detail, /\/assets\/photo-placeholder\.svg/);
    assert.doesNotMatch(home, /'◈'/);
    assert.doesNotMatch(detail, /'◈'/);

    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    assert.match(css, /\.image-placeholder/);
}
);

test('overview placeholder stays inside its tile while real photos keep their full dimensions', () => {
    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    const style = css.match(/\.card-img \.image-placeholder \{([^}]+)\}/)?.[1];
    assert.ok(style, 'overview placeholder must have its own CSS rule');
    assert.match(style, /height:\s*calc\(100%\s*-\s*40px\)/);
    assert.match(style, /max-height:\s*225px/);
    assert.match(style, /max-width:\s*65%/);
    assert.match(style, /width:\s*auto/);
    assert.match(css, /\.card-img img \{[^}]*height:\s*100%/);
});

test('dark theme keeps the detail placeholder in the same visible bottle colors', () => {
    const css = fs.readFileSync('public/styles/themes.css', 'utf8');
    const style = css.match(/:root\[data-theme=\"dark\"\] \.card-img \.image-placeholder,\s*:root\[data-theme=\"dark\"\] \.hero-photo \.image-placeholder \{([^}]+)\}/)?.[1];
    assert.ok(style, 'dark theme must override placeholder blending for cards and detail hero');
    assert.match(style, /mix-blend-mode:\s*normal/);
    assert.match(style, /opacity:\s*\.9/);
});
