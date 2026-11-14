import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHomeView } from '../../public/js/views/home.js';

const createBottlings = count => Array.from({ length: count }, (_, index) => ({
    id: `b-${index + 1}`,
    name: `Whisky ${String(index + 1).padStart(4, '0')}`,
    createdAt: '2026-11-06T00:00:00.000Z',
    bottles: [],
    distilleryIds: [],
}));

test('changing the viewport does not change page content or multiply the chosen page size', () => {
    const prior = {
        document: globalThis.document,
        location: globalThis.location,
        history: globalThis.history,
        innerWidth: globalThis.innerWidth,
    };
    let markup = '';
    const historyCalls = [];
    const dummy = { addEventListener: () => {}, focus: () => {}, setSelectionRange: () => {} };
    try {
        globalThis.document = {
            querySelector() { return dummy; },
            querySelectorAll() { return []; },
        };
        globalThis.location = { pathname: '/', search: '?page=18' };
        globalThis.history = {
            replaceState(...args) { historyCalls.push(args[2]); },
        };
        const state = {
            collection: { bottlings: createBottlings(450) },
            page: 'home', pageNumber: 18, pageSize: 24,
            search: '', status: 'all', completion: 'all', sort: 'name', view: 'cards',
        };
        const selectors = {
            allBottles: () => [],
            bottles: () => [],
            coverPhoto: () => '',
            distilleryNames: () => '',
        };
        const view = createHomeView({ state, selectors, shell(html) { markup = html; } });
        globalThis.innerWidth = 390;
        view();
        assert.equal(state.pageNumber, 18);
        assert.equal(markup.match(/<article\b/g).length, 24);
        assert.match(markup, /409–432 von 450 Abfüllungen/);
        const mobileHtml = markup;

        globalThis.innerWidth = 1366;
        view();
        assert.equal(state.pageNumber, 18);
        assert.equal(markup.match(/<article\b/g).length, 24);
        assert.equal(markup, mobileHtml);
        assert.deepEqual(historyCalls, []);
    } finally {
        for (const [key, value] of Object.entries(prior)) {
            if (value === undefined) delete globalThis[key];
            else globalThis[key] = value;
        }
    }
});

test('home hero preserves the established descriptive copy without hard-coded line breaks', () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(de['home.hero.description'], 'Von der besonderen Abfüllung bis zum letzten Dram. Entdecke, erfasse und verwalte deine Whisky-Sammlung.');
    assert.equal(en['home.hero.description'], 'From a special bottling to the last dram. Discover, document and manage your whisky collection.');
    for (const catalog of [de, en]) {
        assert.doesNotMatch(catalog['home.hero.description'], /\n|<br\s*\/?\s*>/i);
    }
    const source = fs.readFileSync('public/js/views/home.js', 'utf8');
    assert.match(source, /const heroCopy = escapeHtml\(t\('home.hero.description'\)\)/);
    assert.match(source, /<p class="hero-description">\$\{heroCopy\}<\/p>/);
    assert.doesNotMatch(source, /hero-description-sentence/);
    const styles = fs.readFileSync('public/styles/core.css', 'utf8');
    assert.match(styles, /\.collection-hero \.hero-description\s*\{[^}]*white-space:\s*nowrap;/s);
});
