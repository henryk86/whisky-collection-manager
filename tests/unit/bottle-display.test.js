import test from 'node:test';
import assert from 'node:assert/strict';
import { bottleMeta } from '../../public/js/domain/bottle-display.js';
import { createSelectors } from '../../public/js/domain/selectors.js';
import { createBottleForm } from '../../public/js/features/forms/bottle.js';
import { createBottlingForm } from '../../public/js/features/forms/bottling.js';
import { collectionFixture } from '../helpers/fixtures.js';
function forms() {
    const state = {
        collection: collectionFixture()
    };
    const selectors = createSelectors(state);
    return {
        state, bottle: createBottleForm({
            state, selectors
        }), bottling: createBottlingForm({
            state, selectors
        })
    };
}
test('bottle metadata puts separators only between actual values', () => {
    assert.equal(bottleMeta({}), '');
    assert.equal(bottleMeta({
        inventoryNumber: '000123'
    }), '');
    assert.equal(bottleMeta({
        purchasePrice: 0
    }), '0 EUR');
    assert.equal(bottleMeta({
        purchaseDate: '2026-11-05', purchasePrice: 45
    }, value => value), 'Kauf: 2026-11-05 \u00b7 45 EUR');
});
test('bottle form renders read-only parent information and exactly one inventory input', () => {
    const { state, bottle } = forms();
    const html = bottle(state.collection.bottlings[0].bottles[0], 'bottling-a');
    const context = html.slice(html.indexOf('<section'), html.indexOf('</section>'));
    assert.match(context, /Test Blend/);
    assert.match(context, /Test Distillery/);
    assert.match(context, /Example Bottler/);
    assert.match(context, /schreibgesch\u00fctzt/);
    assert.doesNotMatch(context, /<input|<select|<textarea/);
    assert.equal((html.match(/name="inventoryNumber"/g) || []).length, 1);
    assert.doesNotMatch(html, /labelCode|labelType|Etikettentyp|Etikettencode/);
});
test('forms escape user data instead of treating it as HTML', () => {
    const { state, bottle, bottling } = forms();
    const owner = state.collection.bottlings[0];
    owner.name = '<img src=x onerror=alert(1)>';
    const html = bottle({}, owner.id) + bottling(owner);
    assert.doesNotMatch(html, /<img src=x/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
test('new bottling form has no extra label identifier or label type', () => {
    const { bottling } = forms();
    const html = bottling();
    assert.equal((html.match(/name="firstInventoryNumber"/g) || []).length, 1);
    assert.doesNotMatch(html, /labelCode|labelType|firstLabelCode|Etikettencode/);
});

test('sample type and size are editable only on physical bottles', () => {
    const { state, bottle, bottling } = forms();
    const sample = { id: 'sample-x', volumeType: 'sample', volumeMl: 30, status: 'closed' };
    const bottleHtml = bottle(sample, 'bottling-a');
    const bottlingHtml = bottling(state.collection.bottlings[0]);
    assert.match(bottleHtml, /name="volumeType"/);
    assert.match(bottleHtml, /name="volumeMl"/);
    assert.match(bottleHtml, /<option value="sample" selected/);
    assert.doesNotMatch(bottlingHtml, /name="volumeType"/);
    assert.match(bottlingHtml, /Nennfüllmenge der Abfüllung/);
    assert.match(bottlingHtml, /name="volumeMl"/);
    const first = bottling();
    assert.match(first, /name="firstVolumeType"/);
    assert.match(first, /name="firstVolumeMl"/);
});
