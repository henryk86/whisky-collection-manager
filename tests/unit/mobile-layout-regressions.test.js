import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sectionWorkspace } from '../../public/js/ui/section-navigation.js';

const read = file => fs.readFileSync(file, 'utf8');

test('mobile bottling detail stacks the title above a two-column action grid', () => {
    const css = read('public/styles/core.css');
    assert.match(css, /@media\(max-width:740px\)[\s\S]*?\.detail-page-head\s*\{[^}]*flex-direction:\s*column;[^}]*align-items:\s*stretch;/);
    assert.match(css, /\.detail-head-actions\s*\{[^}]*display:\s*grid;[^}]*width:\s*100%;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(css, /\.detail-head-actions\s+\[data-act="bottling-map"\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/);
});

test('mobile overview toolbar gives all native filters and view toggle equal height', () => {
    const css = read('public/styles/core.css');
    assert.match(css, /\.toolbar input\[type="search"\],\s*\.toolbar select,\s*\.toolbar \[data-act="toggle-view"\]\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;[^}]*max-height:\s*44px;/);
});

test('analytics timeline uses full-width, vertically aligned native date controls', () => {
    const css = read('public/styles/analytics.css');
    const view = read('public/js/views/analytics.js');
    assert.match(view, /type="date" id="analytics-\$\{boundary\}-date"/);
    assert.doesNotMatch(view, /type="month"|data-analytics-part=/);
    assert.match(css, /\.analytics-date-control\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*width:\s*100%;[^}]*max-width:\s*100%;/s);
    assert.match(css, /\.analytics-date-control input\[type="date"\]\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*width:\s*100%;[^}]*min-width:\s*0;/s);
    assert.doesNotMatch(css, /max-width:\s*260px/);
});

test('responsive fields are width-constrained without shrinking checkboxes or desktop inputs', () => {
    const core = read('public/styles/core.css');
    const analytics = read('public/styles/analytics.css');
    const settings = read('public/styles/settings.css');
    assert.match(core, /\.form-field\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/s);
    assert.match(core, /\.form-field\s*>\s*:is\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="date"\]\),\s*select,\s*textarea\)\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/s);
    assert.match(core, /@media\(max-width:740px\)[\s\S]*?:where\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="hidden"\]\), select, textarea\)\s*\{[^}]*max-inline-size:\s*100%;/);
    assert.match(core, /\.toolbar select\s*\{[^}]*flex:\s*1 1 120px;[^}]*min-width:\s*min\(100%, 120px\);/);
    assert.match(analytics, /@media\(max-width:720px\)[\s\S]*?\.analytics-period\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/);
    assert.match(analytics, /\.analytics-date-control\s*\{[^}]*max-width:\s*100%;/);
    assert.match(settings, /\.backup-form-grid\s*\{[^}]*minmax\(min\(100%, 125px\), 1fr\)/);
});

test('analysis and help use a native mobile selector instead of horizontally scrolling tabs', () => {
    const html = sectionWorkspace({
        sections:[{id:'overview',label:'Übersicht'},{id:'quality',label:'Datenqualität'}],
        activeId:'quality',action:'analytics-section',itemAttribute:'data-section',
        label:'Analyse-Unterseiten',switchKind:'analytics',
    }, '<p>Inhalt</p>');
    assert.match(html, /class="section-nav-desktop"/);
    assert.match(html, /class="section-nav-mobile"/);
    assert.match(html, /data-section-switch="analytics"/);
    assert.match(html, /value="quality" selected/);
    assert.match(html, /data-section="quality" aria-current="page"/);
    const css = read('public/styles/analytics.css');
    assert.match(css, /@media \(max-width: 980px\)/);
    assert.match(css, /@media \(min-width: 981px\) and \(max-width: 1180px\)/);
    assert.match(css, /\.help-page \.section-nav-desktop \{ display: none; \}/);
    assert.match(css, /\.section-nav-desktop \{ display: none; \}/);
    assert.match(css, /\.section-nav-mobile \{ display: grid;/);
    assert.match(css, /\.section-nav-item\.active \{ border-left-color: var\(--gold\);/);
    assert.doesNotMatch(css, /\.section-nav-item\.active[^}]*border-radius:/);
});

test('date controls in bottling editor and analytics avoid iOS WebKit intrinsic width and alignment bugs', () => {
    const core = read('public/styles/core.css');
    const css = read('public/styles/analytics.css');
    const form = read('public/js/features/forms/bottling.js');
    assert.match(form, /'distillationDate', bottling\.distillationDate, \{[\s\S]*?type: 'date'/);
    assert.match(form, /'bottlingDate', bottling\.bottlingDate, \{[\s\S]*?type: 'date'/);
    assert.match(core, /input\[type="date"\]\s*\{[^}]*-webkit-appearance:\s*none;[^}]*appearance:\s*none;[^}]*display:\s*inline-flex;[^}]*box-sizing:\s*border-box;[^}]*width:\s*100%;[^}]*min-width:\s*0;/s);
    assert.match(core, /input\[type="date"\]::-webkit-date-and-time-value\s*\{[^}]*text-align:\s*left;[^}]*min-height:\s*1\.2em;/s);
    assert.match(core, /\.form-field > input\[type="date"\]\s*\{[^}]*display:\s*inline-flex;[^}]*height:\s*44px;[^}]*padding:\s*0 12px;[^}]*font-size:\s*16px;/s);
    assert.match(css, /@media\(max-width:720px\)\s*\{[\s\S]*?\.analytics-period\s*\{[^}]*max-width:\s*100%;/s);
    assert.doesNotMatch(css.match(/\.analytics-date-control\s*\{[^}]*\}/)?.[0] || '', /overflow:\s*hidden/);
});
