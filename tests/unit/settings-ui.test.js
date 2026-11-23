import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSettingsView } from '../../public/js/views/settings.js';

test('distillery management is fully scrollable as a page, searchable and keeps names escaped', () => {
    const state = {
        distillerySearch: 'Port',
        collection: { distilleries: [
            { id: 'a', name: 'Ardbeg' }, { id: 'b', name: 'Port Ellen' },
            { id: 'c', name: 'A <script>alert(1)</script>' }
        ] }
    };
    const view = createSettingsView(state)();
    assert.match(view, /id="distillery-search"/);
    assert.match(view, /1 von 3/);
    assert.match(view, /Port Ellen/);
    assert.match(view, /data-act="rename-distillery"/);
    assert.match(view, /class="distillery-list"/);
    assert.doesNotMatch(view, /<script>/);
    assert.match(view, /A &lt;script&gt;/);
    assert.match(view, /role="list"/);
    assert.doesNotMatch(view, /class="distillery-management-head"|<h3>Destillerien<\/h3>/);
    assert.equal((view.match(/<h2 class="analytics-section-title">Destillerien<\/h2>/g) || []).length, 1);
});

test('legacy JSON import is hidden in a collapsed disclosure until the user opens it', () => {
    const state = { backupUnlocked: false, backupDashboard: null,
        collection: { distilleries: [] }, distillerySearch: '' };
    const view = createSettingsView(state)();
    assert.match(view, /<header class="section-head ds-page-header settings-heading">/);
    assert.match(view, /<span class="eyebrow dark">DEINE SAMMLUNG VERWALTEN<\/span>/);
    assert.match(view, /<h2>Einstellungen &amp; Datensicherung<span class="heading-period" aria-hidden="true">\.<\/span><\/h2>/);
    assert.doesNotMatch(view, /<p class="intro">Die Sammlung wird lokal gespeichert/);
    assert.match(view, /data-act="goto-home"/);
    const english = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(english['settings.page.eyebrow'], 'MANAGE YOUR COLLECTION');
    assert.match(view, /data-settings-panel="transfer" hidden/, 'import/export is not shown in General settings');
    assert.match(view, /data-settings-section="transfer"/, 'import/export is reachable from the sidebar');
    const disclosure = view.match(/<details([^>]*)>([\s\S]*?)<\/details>/);
    assert.ok(disclosure, 'JSON import should be inside a details disclosure');
    assert.doesNotMatch(disclosure[1], /\bopen\b/, 'legacy import should start collapsed');
    assert.match(disclosure[2], /<summary>Alte JSON-Datei ohne Bilder importieren/);
    assert.match(disclosure[2], /<input type="file" id="import-file"/);
});
