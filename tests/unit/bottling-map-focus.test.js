import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bottlingDistilleryIds, matchingBottlingSites } from '../../public/js/domain/bottling-map-focus.js';
import { parseRoute, routeUrl } from '../../public/js/navigation/routes.js';

const located = [{ id: 'ardbeg', location: { lat: 55.64, lon: -6.10 } }, { id: 'lagavulin', location: { lat: 55.63, lon: -6.12 } }];
const missing = [{ id: 'other', location: null }];

test('detail-map focus resolves every contributing distillery and includes missing locations without creating a fake midpoint', () => {
    const bottling = { id: 'blend-1', distilleryIds: ['lagavulin', 'other', 'ardbeg', 'ardbeg', 'unlisted'] };
    assert.deepEqual(bottlingDistilleryIds(bottling), ['lagavulin', 'other', 'ardbeg', 'unlisted']);
    assert.deepEqual(matchingBottlingSites(bottling, located, missing).map(s => s.id), ['ardbeg', 'lagavulin', 'other']);
    assert.deepEqual(bottlingDistilleryIds({ distilleryId: 'ardbeg' }), ['ardbeg']);
    assert.deepEqual(bottlingDistilleryIds({ distilleryIds: [] }), []);
});

test('map deep-link preserves focused bottling on reload and rejects bad IDs', () => {
    const url = routeUrl('map', 'blend-1');
    assert.equal(url, '/?view=map&focusBottling=blend-1');
    assert.deepEqual(parseRoute(new URL(url, 'http://localhost').search), { page: 'map', selected: 'blend-1' });
    assert.deepEqual(parseRoute('?view=map&focusBottling=%3Cscript%3E'), { page: 'map', selected: null });
    assert.equal(routeUrl('map'), '/?view=map');
    assert.equal(parseRoute('?bottling=blend-1').page, 'detail');
});

test('analytics links share one underline-free rest style and clear keyboard/hover affordances', () => {
    const css = fs.readFileSync('public/styles/analytics.css', 'utf8');
    assert.match(css, /\.analytics-link\s*\{[^}]*text-decoration:\s*none;/s);
    assert.match(css, /\.analytics-pie-item\.analytics-link\s*\{/);
    assert.match(css, /\.analytics-link:hover,\s*\.analytics-link:focus-visible/);
    assert.match(css, /\.analytics-link:focus-visible\s*\{[^}]*outline:/s);
});


test('analytics ranked distillery labels have a full-row hover target, including the final row', () => {
    const css = fs.readFileSync('public/styles/analytics.css', 'utf8');
    assert.match(css, /\.analytics-bar-row\s*\{[^}]*position:\s*relative/s);
    assert.match(css, /\.analytics-bar-row\s*>\s*button\.analytics-bar-label\.analytics-link::after\s*\{[^}]*inset:\s*0;[^}]*z-index:\s*1;/s);
    assert.match(css, /\.analytics-bar-row\s*>\s*button\.analytics-bar-label\.analytics-link:hover/s);
});
