import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRoute, routeUrl } from '../../public/js/navigation/routes.js';
import { MAIN_PAGES } from '../../public/js/navigation/pages.js';
import { HELP_TOPICS, helpView, activateHelpTopic } from '../../public/js/views/help.js';

test('help route and drawer destination work on direct navigation and reload', () => {
    assert.deepEqual(parseRoute('?view=help'), {page:'help', selected:null});
    assert.equal(routeUrl('help'), '/?view=help');
    assert.ok(MAIN_PAGES.some(item => item.id === 'help' && item.action === 'goto-help' && item.url === '/?view=help'));
    const app = fs.readFileSync('public/app.js','utf8');
    assert.match(app, /state\.page === 'help'\) return shell\(helpView\(\)\)/);
    assert.match(fs.readFileSync('public/js/events.js','utf8'), /'goto-help': \(\) => navigate\('help'\)/);
});

test('help topics are translated in both languages and render in the shared sidebar', () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(de['navigation.help'], 'Hilfe');
    assert.equal(en['navigation.help'], 'Help');
    // Keep the headline short, with concrete guidance in the help body instead.
    assert.equal(de['help.intro'], 'Anleitungen und Antworten zum Whisky Collection Manager.');
    assert.equal(en['help.intro'], 'Guides and answers for Whisky Collection Manager.');
    assert.equal(de['help.description'], 'Auf dieser Hilfeseite erfährst du, wie du Abfüllungen erfasst, Flaschen einlagerst, die Landkarte nutzt, Fotos bearbeitest und Backups erstellst. Außerdem wird erklärt, wo deine Daten gespeichert werden.');
    assert.equal(en['help.description'], 'This help page explains how to add bottlings, store bottles, use the map, edit photos, and create backups. It also explains where your data is stored.');
    // Long help text belongs inside the first topic panel, not under the page heading.
    assert.match(helpView(), /class="analytics-page help-page"/);
    assert.match(helpView(), /class="section-workspace"/);
    assert.match(helpView(), /class="section-nav-desktop"/);
    assert.match(helpView(), /data-section-switch="help"/);
    assert.match(helpView(), /class="help-description muted"/);
    assert.ok(de['help.intro'].length < 75 && en['help.intro'].length < 75);
    assert.match(helpView(), /class="help-description muted"/);
    for (const topic of HELP_TOPICS) {
        for (const catalog of [de, en]) {
            assert.ok(catalog[`help.${topic.id}.title`]);
            for (let i = 1; i <= topic.items; i++) assert.ok(catalog[`help.${topic.id}.${i}`]);
        }
    }
    const html = helpView();
    for (const topic of HELP_TOPICS) {
        assert.match(html, new RegExp(`data-help-topic="${topic.id}"`));
        assert.match(html, new RegExp(`id="help-panel-${topic.id}"`));
        assert.match(html, new RegExp(`data-help-topic="${topic.id}"`));
    }
    assert.equal((html.match(/class="help-section"/g) || []).length, HELP_TOPICS.length);
    assert.equal((html.match(/class="help-section"[^>]+hidden/g) || []).length, HELP_TOPICS.length - 1);
    assert.doesNotMatch(html, /class="panel help-section"/, 'help articles must not render as cards');
    // Approved layout: the right-hand article alone gets a flat content panel,
    // while its section heading and the left navigation remain outside.
    assert.equal((html.match(/class="help-content-panel"/g) || []).length, HELP_TOPICS.length);
    assert.match(html, /class="analytics-section-title" id="help-title-basics">[^<]+<\/h2>\s*<div class="help-content-panel">/);
    const css = fs.readFileSync('public/styles/core.css','utf8');
    assert.match(css, /\.help-content-panel\s*\{[^}]*background:\s*var\(--paper\);[^}]*border:\s*1px solid var\(--line\);[^}]*border-radius:\s*var\(--surface-corner, 0\);/);
    assert.match(html, /data-help-topic="basics" aria-current="page"/);
    assert.match(html, /id="help-panel-basics"/);
    assert.match(html,/data-act="goto-home"/);
});

test('selecting help topics synchronizes sidebar, selector and visible panel without navigating', () => {
    const makeButton = topic => ({
        dataset: {helpTopic:topic.id}, attrs: {},
        classList: {active:topic.id === 'basics', toggle(name, active) { if (name === 'active') this.active = active; }},
        setAttribute(name,value) {this.attrs[name]=value;},
        removeAttribute(name) {delete this.attrs[name];},
    });
    const buttons = HELP_TOPICS.map(makeButton);
    const panels = HELP_TOPICS.map(topic => ({id:`help-panel-${topic.id}`,hidden:topic.id !== 'basics'}));
    const selector = {value:'basics'};
    const container = {
        querySelectorAll(query) {return query === '.help-section' ? panels : buttons;},
        querySelector(query) {return query === '[data-section-switch="help"]' ? selector : null;},
    };
    assert.equal(activateHelpTopic('storage',container),true);
    assert.deepEqual(buttons.filter(button => button.classList.active).map(button => button.dataset.helpTopic),['storage']);
    assert.equal(buttons.find(button => button.dataset.helpTopic === 'storage').attrs['aria-current'],'page');
    assert.equal(buttons.find(button => button.dataset.helpTopic === 'basics').attrs['aria-current'],undefined);
    assert.equal(selector.value,'storage');
    assert.deepEqual(panels.filter(panel => !panel.hidden).map(panel => panel.id),['help-panel-storage']);
    assert.equal(activateHelpTopic('not-a-topic',container),false);
    assert.equal(selector.value,'storage');
    const events = fs.readFileSync('public/js/events.js','utf8');
    assert.match(events, /'help-tab': button => activateHelpTopic/);
    assert.match(events, /dataset\.sectionSwitch === 'help'/);
});

test('routine screens do not repeat long help texts or implementation filenames', () => {
    const read = path => fs.readFileSync(path,'utf8');
    const wall = read('public/js/views/warehouse-room-wall.js');
    const warehouse = read('public/js/views/warehouse.js');
    const form = read('public/js/features/forms/bottling.js');
    const settings = read('public/js/views/settings.js');
    assert.doesNotMatch(wall,/warehouse\.wall\.instructions/);
    assert.doesNotMatch(warehouse,/threeDimensionalInstructions|twoDimensionalHint|dataFilePrefix|warehouse-plan-help/);
    assert.doesNotMatch(form,/blendComponentsHint|originDerivedHint/);
    assert.doesNotMatch(settings,/localStorageAndMapNotice|addingLanguagesHint/);
    assert.match(helpView(),/data\/collection\.json/);
    assert.match(helpView(),/data\/warehouse\.json/);
    // Confirmations and safety notices deliberately remain in context.
    assert.match(settings,/jsonDoesNotIncludeAttachments/);
});

test('distillery filter updates site data without recreating the map or changing its view', () => {
    const source = fs.readFileSync('public/js/views/map.js','utf8');
    assert.match(source, /showAllDistilleries = event\.target\.checked/);
    assert.match(source, /refreshData\(\);\s*\}\);\s*tileMap = createTileMap/);
    assert.doesNotMatch(source,/render\(\{ preserveView: false \}\)/);
    assert.match(source,/tileMap\.updateSites\(sites, selectedId, showAllDistilleries\)/);
    assert.match(source,/legend\.outerHTML = mapLegendHtml\(showAllDistilleries\)/);
});
