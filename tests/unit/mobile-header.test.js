import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('mobile header keeps three quick actions and the menu at the far right', () => {
    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    const themeCss = fs.readFileSync('public/styles/themes.css', 'utf8');
    const shell = fs.readFileSync('public/js/ui/shell.js', 'utf8');
    assert.match(css, /grid-template-columns:\s*minmax\(0,1fr\) auto;/);
    assert.doesNotMatch(css, /\.top-actions\s*\{\s*width:\s*100%;/);
    assert.match(css, /\.brand h1 em\s*\{\s*display:\s*block;/);
    assert.match(themeCss, /@media\(max-width:960px\)/);
    for (const action of ['toggle-theme', 'scan', 'new', 'toggle-menu']) {
        assert.match(shell, new RegExp(`data-act="${action}"`));
    }
    assert.match(shell, /data-act="scan" aria-label="\$\{t\("collection.actions.scanInventory"\)\}"/);
    assert.match(shell, /data-act="new" aria-label="\$\{t\("collection.actions.newBottle"\)\}"/);
    assert.doesNotMatch(shell, /data-act="settings"/);
    const pages = fs.readFileSync('public/js/navigation/pages.js', 'utf8');
    assert.match(pages, /action: 'goto-settings-menu'/);
    assert.ok(shell.indexOf('data-act="new"') < shell.indexOf('data-act="toggle-menu"'), 'menu must be rightmost');
    assert.match(shell, /\$\{newBottlingIcon\}/);
    assert.match(shell, /\$\{inventoryScanIcon\}/);
    assert.match(shell, /\$\{MAIN_PAGES\.map/);
    assert.match(themeCss, /\.new-icon \{ display: block; width: 19px; height: 19px;/);
    assert.match(themeCss, /\.settings-icon \{ display: block; width: 19px; height: 19px;/);
});
