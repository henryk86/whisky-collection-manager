import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createShell } from '../../public/js/ui/shell.js';
import { createHomeView } from '../../public/js/views/home.js';
import { newBottlingIcon, inventoryScanIcon, settingsIcon, settingsIconPaths } from '../../public/js/ui/action-icons.js';

function renderShell() {
    const root = { innerHTML: '' };
    createShell({root, state: { version: '0.6.50', modal: null }, applyTheme() {}, renderModal() {}})('<section></section>');
    return root.innerHTML;
}
function renderHome() {
    const previous = {document: globalThis.document, location: globalThis.location, history: globalThis.history};
    let html = '';
    try {
        globalThis.document = { querySelector: () => ({addEventListener() {}}), querySelectorAll: () => [] };
        globalThis.location = {pathname: '/', search: ''};
        globalThis.history = {replaceState() {}};
        const state = {collection: {bottlings: [], settings: {}}, pageNumber: 1, pageSize: 24, search: '', status: 'all', completion: 'all', sort: 'name', view: 'cards'};
        const selectors = { allBottles: () => [], bottles: () => [], coverPhoto: () => '', distilleryNames: () => '' };
        createHomeView({state, selectors, shell: content => {html = content;}})();
        return html;
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
        }
    }
}
function button(html, action) {
    const re = new RegExp(String.raw`<button\b[^>]*data-act="${action}"[^>]*>[\s\S]*?</button>`);
    const match = html.match(re);
    assert.ok(match, `Button ${action} missing`);
    return match[0];
}

test('header and overview use identical SVG symbols and labels for matching actions', () => {
    const header = renderShell();
    const home = renderHome();
    for (const [action, label, icon] of [
        ['new', 'Neue Flasche', newBottlingIcon],
        ['scan', 'Inventar scannen', inventoryScanIcon],
    ]) {
        for (const view of [header, home]) {
            const html = button(view, action);
            assert.ok(html.includes(icon), `${action}: both views must reuse the same SVG`);
            assert.ok(html.includes(`<span>${label}</span>`), `${action}: consistent visible label`);
            assert.ok(html.includes(`aria-label="${label}"`), `${action}: consistent accessible name`);
        }
    }
    assert.doesNotMatch(header, />Flasche erfassen<|>Scannen</);
    assert.doesNotMatch(home, />\+ Neue Flasche|>▣ Inventar scannen/);
});

test('settings are accessible through the side menu with the shared, correct gear icon', () => {
    const shell = renderShell();
    assert.doesNotMatch(shell, /<button[^>]+data-act="settings"/, 'no duplicate settings action in the header');
    assert.match(shell, /<a[^>]+data-act="goto-settings-menu"[^>]*>/);
    assert.match(shell, /<a[^>]+data-act="goto-settings-menu"[^>]*>[\s\S]*?Einstellungen\s*<\/a>/);
    assert.ok(shell.includes(settingsIconPaths), 'sidebar uses exactly the shared gear drawing');
    const actions = [...shell.matchAll(/<button[^>]+data-act="([^"]+)"[^>]*>/g)].map(match => match[1]);
    assert.deepEqual(actions.slice(0, 4), ['toggle-theme', 'scan', 'new', 'toggle-menu']);
});

test('settings icon is a clean, symmetrical gear outline without stray paths', () => {
    assert.match(settingsIcon, /<path d="M10\.5 2h3/);
    assert.match(settingsIcon, /<circle cx="12" cy="12" r="3"\/>/);
    assert.doesNotMatch(settingsIcon, /H21|M21|<text|<polygon/);
    assert.equal((settingsIcon.match(/<svg/g) || []).length, 1);
    assert.equal((settingsIcon.match(/<\/svg>/g) || []).length, 1);
});

test('the new-bottle action opens the corresponding creation dialog', () => {
    const editor = requireEditorSource();
    assert.match(editor, /showModal\(t\("[^"]+"\), bottlingChoiceDialog\(state.collection\), true\)/);
    assert.match(editor, /showModal\(t\("collection.actions.newBottling"\), bottlingForm\(\), true\)/);
});

function requireEditorSource() {
    return fs.readFileSync('public/js/features/editor-controller.js', 'utf8');
}
