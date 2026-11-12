import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bottlingOriginLabel } from '../../public/js/domain/bottling-origin.js';
import { createHomeView } from '../../public/js/views/home.js';
import { createSettingsView } from '../../public/js/views/settings.js';

function renderHome(establishedYear, bottlings = [], physicalBottles = [], view = 'cards') {
    const former = { document: globalThis.document, location: globalThis.location, history: globalThis.history };
    let html;
    try {
        const field = { addEventListener() {} };
        globalThis.document = { querySelector: () => field, querySelectorAll: () => [] };
        globalThis.location = { pathname: '/', search: '' };
        globalThis.history = { replaceState() { throw new Error('No history change expected'); } };
        const state = {
            collection: { bottlings, settings: { establishedYear } },
            pageNumber: 1, pageSize: 24, search: '', status: 'all', completion: 'all', sort: 'name', view
        };
        const selectors = {
            allBottles: () => physicalBottles, bottles: bottleId => bottlings.find(b => b.id === bottleId)?.bottles || [],
            coverPhoto: () => '', distilleryNames: () => 'Talisker'
        };
        createHomeView({ state, selectors, shell: content => { html = content; } })();
        return html;
    } finally {
        for (const [name, value] of Object.entries(former)) {
            if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
        }
    }
}

test('home shows the saved founding year and never assumes 2026', () => {
    assert.match(renderHome(1997), /COLLECTION · EST\. 1997/);
    const unset = renderHome(null);
    assert.match(unset, /class="hero-footnote">COLLECTION<\/span>/);
    assert.doesNotMatch(unset, /EST\. 2026/);
});

test('dashboard has four stats; opened and closed are independent bottle counts', () => {
    const physicalBottles = [
        { status: 'closed' }, { status: 'closed' }, { status: 'open' }, { status: 'empty' }
    ];
    const html = renderHome(null, [{ id: 'one', name: 'One', distilleryIds: [], bottles: [], createdAt: '2026-01-01' }], physicalBottles);
    const stats = html.slice(html.indexOf('<div class="stats">'), html.indexOf('<div class="toolbar">'));
    assert.equal((stats.match(/class="panel stat"/g) || []).length, 4);
    assert.match(stats, /<span>Geöffnet<\/span>\s*<strong>1<\/strong>/);
    assert.match(stats, /<span>Geschlossen<\/span>\s*<strong>2<\/strong>/);
    assert.ok(stats.indexOf('<span>Geschlossen</span>') < stats.indexOf('<span>Geöffnet</span>'), 'Geschlossen must be shown before Geöffnet');
    assert.match(stats, /<span>Bestand gesamt<\/span>\s*<strong>4<\/strong>/);
    assert.doesNotMatch(stats, /Unvollständig|Ungeöffnet \/ geöffnet/);
});

test('overview shows bottler only when distillery is missing, in cards and table', () => {
    const b = { id: 'one', name: 'Independent', distilleryIds: [], bottler: 'Signatory Vintage', bottles: [], createdAt: '2026-01-01' };
    assert.equal(bottlingOriginLabel(b, () => 'wrong distillery'), 'Signatory Vintage');
    assert.equal(bottlingOriginLabel({ ...b, distilleryIds: ['d1'] }, () => 'Talisker'), 'Talisker');
    assert.equal(bottlingOriginLabel({ ...b, bottler: '  ' }, () => 'wrong'), '');
    assert.match(renderHome(null, [b]), /class="card-kicker">Signatory Vintage/);
    const table = renderHome(null, [b], [], 'table');
    assert.match(table, /<th>Destillerie \/ Abfüller<\/th>/);
    assert.match(table, /<td>Signatory Vintage<\/td>/);
    assert.match(renderHome(null, [{ ...b, bottler: '<script>alert(1)</script>' }]), /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('settings exposes a persistent founding-year form next to existing backup controls', () => {
    const html = createSettingsView({
        collection: { settings: { establishedYear: 1989 }, distilleries: [] },
        backupDashboard: null
    })();
    assert.match(html, /id="collection-settings-form"/);
    assert.match(html, /name="establishedYear"[^>]*value="1989"/);
    assert.match(html, /Gründungsjahr speichern/);
    assert.match(html, /Datensicherung/);
});

test('mobile theme switch is not hidden, and the footer is close to pagination', () => {
    const core = fs.readFileSync('public/styles/core.css', 'utf8');
    const shell = fs.readFileSync('public/js/ui/shell.js', 'utf8');
    assert.doesNotMatch(core, /\.top-actions \.header-btn:first-child\s*\{\s*display:\s*none/);
    assert.match(shell, /class="btn header-btn theme-toggle"/);
    assert.doesNotMatch(shell, /data-act="settings"/);
    const pages = fs.readFileSync('public/js/navigation/pages.js', 'utf8');
    assert.match(pages, /action: 'goto-settings-menu'/);
    const icons = fs.readFileSync('public/js/ui/action-icons.js', 'utf8');
    assert.match(icons, /class="settings-icon"[^>]*aria-hidden="true"/);
    assert.match(core, /#app\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
    assert.match(core, /main\s*\{[^}]*flex:\s*1 0 auto;/s);
    assert.match(core, /\.collection-hero\s*\{[^}]*padding:\s*35px 25px 82px;/s);
});

test('overview omits empty age, alcohol and year instead of showing placeholder units', () => {
    const blank = { id: 'no-meta', name: 'Ohne Angaben', createdAt: '2026-01-01', distilleryIds: [], ageYears: null, abv: undefined, releaseYear: null };
    const card = renderHome(null, [blank]);
    assert.match(card, /<h3(?: data-i18n-ignore)?>Ohne Angaben<\/h3>/);
    assert.doesNotMatch(card, /class="card-facts muted"/);
    assert.doesNotMatch(card, /– Jahre|– %|NaN|<div class="card-kicker"><\/div>/);
    const table = renderHome(null, [blank], [], 'table');
    assert.match(table, /<strong>Ohne Angaben<\/strong>[\s\S]*?<td><\/td>\s*<td><\/td>\s*<td><\/td>/);
    assert.doesNotMatch(table, /– %|– Jahre/);

    const withAbv = { ...blank, abv: 46.5 };
    const abvCard = renderHome(null, [withAbv]);
    assert.match(abvCard, /class="card-facts muted">46.5 % Vol\.<\/div>/);
    assert.doesNotMatch(abvCard, /Jahre| · 46/);
    const withZero = renderHome(null, [{ ...blank, ageYears: 0, abv: 0 }]);
    assert.match(withZero, /class="card-facts muted">0 Jahre · 0 % Vol\.<\/div>/);
});

test('collection card titles use natural heights while cards stretch only within each grid row', () => {
    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    assert.match(css, /\.grid\s*\{[^}]*align-items:\s*stretch;/s);
    assert.doesNotMatch(css, /\.grid\s*\{[^}]*grid-auto-rows:\s*1fr/s);
    assert.match(css, /\.card-body h3\s*\{[^}]*min-height:\s*0;[^}]*margin:\s*0 0 5px;/s);
    assert.doesNotMatch(css, /\.card-body h3\s*\{[^}]*min-height:\s*53px;/s);
    assert.match(css, /\.card-facts\s*\{[^}]*margin:\s*0 0 9px;/s);
});

test('the home hero stays dark in both themes while the photo viewer remains theme-specific', () => {
    const core = fs.readFileSync('public/styles/core.css', 'utf8');
    const themes = fs.readFileSync('public/styles/themes.css', 'utf8');
    const heroBase = core.match(/\.collection-hero\s*\{([^}]+)\}/)?.[1];
    const heroOverlay = core.match(/\.hero-overlay\s*\{([^}]+)\}/)?.[1];
    assert.ok(heroBase && heroOverlay);
    assert.match(heroBase, /background:\s*linear-gradient\(115deg,#0a2440/);
    assert.match(heroBase, /color:\s*#fff;/);
    assert.match(core, /\.hero-media img\s*\{[^}]*brightness\(\.66\)/s);
    assert.match(heroOverlay, /rgba\(7,20,33,\.84\)/);
    assert.doesNotMatch(heroOverlay, /rgba\(250,248,243/);
    assert.match(themes, /:root\[data-theme="dark"\] \.hero-overlay\s*\{[^}]*rgba\(7,20,33,\.84\)/s);
    assert.match(core, /\.overlay:has\(\.photo-lightbox\)\s*\{[^}]*rgba\(246,243,237/s);
    assert.match(themes, /:root\[data-theme="dark"\] \.photo-lightbox-stage\s*\{[^}]*#1a2e40/s);
    assert.match(themes, /\.settings-icon \{ display: block;/);
});
