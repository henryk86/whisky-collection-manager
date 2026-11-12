import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { themeMoonIcon, themeSunIcon } from '../../public/js/ui/action-icons.js';
import { createThemeController } from '../../public/js/theme/controller.js';
import { createShell } from '../../public/js/ui/shell.js';

test('theme toggle uses shared, device-independent SVGs rather than platform-specific characters', () => {
    for (const icon of [themeMoonIcon, themeSunIcon]) {
        assert.match(icon, /^<svg class="theme-icon" /);
        assert.match(icon, /viewBox="0 0 24 24"/);
        assert.match(icon, /stroke="currentColor"/);
        assert.match(icon, /aria-hidden="true"/);
        assert.equal((icon.match(/<svg/g) || []).length, 1);
        assert.equal((icon.match(/<\/svg>/g) || []).length, 1);
    }
    assert.notEqual(themeMoonIcon, themeSunIcon);
    const root = { innerHTML: '' };
    createShell({ root, state: { version: '0.8.5', modal: null }, applyTheme() {}, renderModal() {} })('');
    assert.ok(root.innerHTML.includes(`data-act="toggle-theme"`));
    assert.ok(root.innerHTML.includes(themeMoonIcon));
});

test('theme controller changes only the shared SVG, preserving button labels on every device', () => {
    const original = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
    const saved = new Map([['whisky-theme', 'light']]);
    const attributes = {};
    const button = { innerHTML: '', title: '', setAttribute: (key, value) => { attributes[key] = value; } };
    const root = { dataset: {}, style: {} };
    try {
        globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
        globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
        globalThis.document = { documentElement: root, querySelector: () => button };
        const theme = createThemeController();
        assert.equal(button.innerHTML, themeMoonIcon);
        assert.equal(button.title, 'Dark Mode aktivieren');
        assert.equal(attributes['aria-pressed'], 'false');
        theme.toggleTheme();
        assert.equal(button.innerHTML, themeSunIcon);
        assert.equal(button.title, 'Light Mode aktivieren');
        assert.equal(attributes['aria-pressed'], 'true');
        assert.equal(saved.get('whisky-theme'), 'dark');
        theme.toggleTheme();
        assert.equal(button.innerHTML, themeMoonIcon);
        assert.equal(root.dataset.theme, 'light');
    } finally {
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
        }
    }
});

test('mobile logo spacing stays positive after the last loaded stylesheet', () => {
    const css = fs.readFileSync('public/styles/map.css', 'utf8');
    const themes = fs.readFileSync('public/styles/themes.css', 'utf8');
    assert.match(css, /@media \(max-width: 450px\)[^\n]*\.brand \{ gap: 10px; \}/);
    assert.match(css, /@media \(max-width: 380px\)[^\n]*\.brand \{ gap: 8px; \}/);
    assert.doesNotMatch(css, /\.brand \{ gap: 0; \}/);
    assert.match(themes, /\.theme-icon \{ display: block; width: 19px; height: 19px;/);
});
