import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSettingsView } from '../../public/js/views/settings.js';

test('distillery management is bounded, searchable and keeps names escaped', () => {
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
    const style = fs.readFileSync('public/styles/settings.css', 'utf8');
    assert.match(style, /max-height:\s*min\(360px, 48vh\)/);
    assert.match(style, /overflow-y:\s*auto/);
    assert.match(fs.readFileSync('public/style.css', 'utf8'), /settings\.css/);
});

test('distillery editor separates the status and coordinate labels from the preceding input fields', () => {
    const css = fs.readFileSync('public/styles/settings.css', 'utf8');
    assert.match(css, /#distillery-form > \.form-field \+ \.form-field,\s*#distillery-form > \.map-coordinates-fields\s*\{[^}]*margin-top:\s*16px;/s);
    const controller = fs.readFileSync('public/js/features/settings-controller.js', 'utf8');
    assert.match(controller, /<form id="distillery-form"/);
    assert.match(controller, /<label class="form-field" for="distillery-status"/);
    assert.match(controller, /<div class="map-coordinates-fields">/);
});

test('legacy JSON import is hidden in a collapsed disclosure until the user opens it', () => {
    const state = { backupUnlocked: false, backupDashboard: null,
        collection: { distilleries: [] }, distillerySearch: '' };
    const view = createSettingsView(state)();
    assert.match(view, /<section class="section-head settings-heading">/);
    assert.match(view, /<span class="eyebrow dark">DEINE SAMMLUNG VERWALTEN<\/span>/);
    assert.match(view, /<h2>Einstellungen & Datensicherung<span class="heading-period">\.<\/span><\/h2>/);
    assert.match(view, /<p class="intro">Die Sammlung wird lokal gespeichert/);
    assert.match(view, /data-act="goto-home"/);
    const english = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(english['settings.page.eyebrow'], 'MANAGE YOUR COLLECTION');
    const disclosure = view.match(/<details([^>]*)>([\s\S]*?)<\/details>/);
    assert.ok(disclosure, 'JSON import should be inside a details disclosure');
    assert.doesNotMatch(disclosure[1], /\bopen\b/, 'legacy import should start collapsed');
    assert.match(disclosure[2], /<summary>Alte JSON-Datei ohne Bilder importieren/);
    assert.match(disclosure[2], /<input type="file" id="import-file"/);
});

test('no browser prompt, confirm or alert is used for app actions', () => {
    for (const file of ['public/js/features/settings-controller.js', 'public/js/events.js']) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /\b(?:window\.)?(?:prompt|confirm|alert)\s*\(/, file);
    }
    const controller = fs.readFileSync('public/js/features/settings-controller.js', 'utf8');
    assert.match(controller, /id="distillery-form"/);
    assert.match(controller, /data-act="confirm-import"/);
});

test('real bottle photos have sufficient space below before the card divider in all breakpoints', () => {
    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    assert.match(css, /\.card-img:after\s*\{[^}]*bottom|\.card-img:after\s*\{[^}]*inset:\s*auto 18px 13px/s);
    assert.match(css, /\.card-img img\s*\{[^}]*padding:\s*13px 18px 27px/s);
    assert.match(css, /@media[^{}]*\{[\s\S]*?\.card-img img\s*\{\s*padding:\s*10px 10px 27px;/);
});
