import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { helpView } from '../../public/js/views/help.js';
import { createSettingsView } from '../../public/js/views/settings.js';

const read = name => fs.readFileSync(name, 'utf8');

test('main navigation pages share the same heading typography and content width', () => {
    const views = [
        ['Sammlung', read('public/js/views/home.js'), 'collection-heading'],
        ['Analyse', read('public/js/views/analytics.js'), 'analytics-page-heading'],
        ['Lager', read('public/js/views/warehouse.js'), 'warehouse-heading'],
        ['Landkarte', read('public/js/views/map.js'), 'map-heading'],
        ['Einstellungen', read('public/js/views/settings.js'), 'settings-heading'],
        ['Hilfe', read('public/js/views/help.js'), 'help-heading'],
    ];
    for (const [name, markup, className] of views) {
        assert.match(markup, new RegExp(`class="section-head ${className}"`), `${name} must use the shared heading`);
        assert.match(markup, /class="(?:intro|page-heading-copy)"/, `${name} must include descriptive heading content`);
    }
    const core = read('public/styles/core.css');
    const analytics = read('public/styles/analytics.css');
    assert.match(core, /\.section-head h2\s*\{[^}]*font-size:/);
    assert.doesNotMatch(analytics, /\.analytics-header h2\s*\{/);
    assert.match(core, /\.help-page\s*\{\s*width: 100%;\s*margin: 0;/);
    assert.match(core, /main\s*\{[^}]*max-width:\s*1350px;/);
    assert.match(analytics, /\.analytics-page\s*\{[^}]*padding:\s*0 0 10px;/);
    assert.match(read('public/styles/map.css'), /\.map-heading\s*\{ margin-top: 20px; \}/);
    assert.match(read('public/styles/settings.css'), /\.settings-heading\s*\{ margin-top: 20px; \}/);
});

test('help description is readable body text, not a full-size heading', () => {
    const markup = helpView();
    assert.ok(markup.indexOf('class="help-description muted"') > markup.indexOf('</header>'));
    const core = read('public/styles/core.css');
    assert.match(core, /\.help-description\s*\{[^}]*font-size:\s*14px;/);
    assert.doesNotMatch(core, /\.help-description\s*\{[^}]*font-size:\s*(?:30|36|40)px;/);
    assert.match(read('public/js/views/home.js'), /<section class="collection-hero">/,
        'only the collection retains its additional header image');
});

test('settings page has a translated, visible punchline', () => {
    const state = {collection:{settings:{},distilleries:[],bottlings:[]}};
    const html = createSettingsView(state)();
    assert.match(html, /class="section-head settings-heading"/);
    assert.match(html, /<p class="intro">Sprache, Destillerien, Exporte und Datensicherung verwalten\.<\/p>/);
    assert.equal(JSON.parse(read('public/locales/en.json'))['settings.page.intro'],
        'Manage language, distilleries, exports, and backups.');
});

test('collection KPI cards define the design for analytics and storage summaries', () => {
    const home = read('public/js/views/home.js');
    const analytics = read('public/js/views/analytics.js');
    const warehouse = read('public/js/views/warehouse.js');
    const core = read('public/styles/core.css');
    const analyticsCss = read('public/styles/analytics.css');
    const warehouseCss = read('public/styles/warehouse.css');
    assert.match(home, /class="panel stat"/);
    assert.match(analytics, /class="panel stat analytics-metric"/);
    assert.match(analytics, /class="stats analytics-metrics"/);
    assert.match(warehouse, /class="stats warehouse-stats"/);
    assert.match(warehouse, /class="panel stat"/);
    assert.match(core, /\.stat\s*\{[^}]*border-top:\s*3px solid var\(--gold\)/);
    assert.doesNotMatch(analyticsCss, /\.analytics-metric\s*\{[^}]*border-radius:/);
    assert.doesNotMatch(analyticsCss, /\.analytics-metric\s*\{[^}]*background:/);
    assert.doesNotMatch(warehouseCss, /\.warehouse-stats>div\s*\{/);
    assert.doesNotMatch(warehouseCss, /\.warehouse-stats strong\s*\{/);
    assert.match(analytics, /<p class="intro">\$\{safe\(t\("analytics\.summary\.highlights"\)\)\}<\/p>/);
});
