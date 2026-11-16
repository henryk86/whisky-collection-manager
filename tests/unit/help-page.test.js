import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRoute, routeUrl } from '../../public/js/navigation/routes.js';
import { MAIN_PAGES } from '../../public/js/navigation/pages.js';
import { HELP_TOPICS, helpView, activateHelpTopic } from '../../public/js/views/help.js';
import {mapLegendHtml} from '../../public/js/views/map.js';

test('help route and drawer destination work on direct navigation and reload', () => {
    assert.deepEqual(parseRoute('?view=help'), {page:'help', selected:null});
    assert.equal(routeUrl('help'), '/?view=help');
    assert.ok(MAIN_PAGES.some(item => item.id === 'help' && item.action === 'goto-help' && item.url === '/?view=help'));
});

test('help topics are translated in both languages and render in the shared sidebar', () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(de['navigation.help'], 'Hilfe');
    assert.equal(en['navigation.help'], 'Help');
    // Keep the headline short, with concrete guidance in the help body instead.
    assert.equal(de['help.intro'], 'Anleitungen und Antworten zum Whisky Collection Manager.');
    assert.equal(en['help.intro'], 'Guides and answers for Whisky Collection Manager.');
    assert.equal(de['help.description'], 'Hier findest du Anleitungen zu Abfüllungen, Verkostungsnotizen, Tasting-Flights, Lager, Landkarte, Fotos, Analysen, Backups und Datenspeicherung.');
    assert.equal(en['help.description'], 'Find guides for bottlings, tasting notes, tasting flights, storage, maps, photos, analytics, backups and data storage.');
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
    assert.match(html, /data-help-topic="basics" aria-current="page"/);
    assert.match(html, /id="help-panel-basics"/);
    assert.match(html,/data-act="goto-home"/);
});

test('help covers current tasting notes and flights in both languages without old bottling editing advice', () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    const ids = HELP_TOPICS.map(topic => topic.id);
    assert.equal(ids.indexOf('tastings'), ids.indexOf('bottlings') + 1);
    assert.equal(ids.indexOf('flights'), ids.indexOf('tastings') + 1);
    for (const catalog of [de, en]) {
        const tasting = Array.from({length:8}, (_,i) => catalog[`help.tastings.${i+1}`]).join(' ');
        const flight = Array.from({length:5}, (_,i) => catalog[`help.flights.${i+1}`]).join(' ');
        assert.match(tasting, /100/);
        assert.match(tasting, /20/);
        assert.match(flight, /[Dd]rag|Ziehgriff/);
        assert.match(flight, /[Oo]ne flight|einem Flight/);
        assert.match(flight, /[Dd]elet|Löschen/);
        assert.doesNotMatch(catalog['help.bottlings.6'], /directly in the second|direkt im zweiten/);
    }
    const html=helpView('tastings');
    assert.match(html, /id="help-panel-tastings"/);
    assert.match(html, /data-help-topic="tastings" aria-current="page"/);
    assert.match(helpView('flights'), /data-help-topic="flights" aria-current="page"/);
    assert.match(html, /Glencairn/);
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
});

test('technical storage paths belong in help documentation rather than a routine screen', () => {
    const help = helpView();
    assert.match(help, /data\/collection\.json/);
    assert.match(help, /data\/warehouse\.json/);
});

test('map legend shows empty catalog sites only when the all-distilleries filter is active', () => {
    const omitted = mapLegendHtml(false);
    const included = mapLegendHtml(true);
    assert.doesNotMatch(omitted, /map-legend-empty/);
    assert.match(included, /map-legend-empty/);
    assert.match(included, /map-pagoda-legend/);
});
