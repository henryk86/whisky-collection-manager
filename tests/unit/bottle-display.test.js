import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {bottleMeta} from '../../public/js/domain/bottle-display.js';
import {createSelectors} from '../../public/js/domain/selectors.js';
import {createBottleForm} from '../../public/js/features/forms/bottle.js';
import {createBottlingForm} from '../../public/js/features/forms/bottling.js';
import {collectionFixture} from '../helpers/fixtures.js';
/**
 * Derives the forms result from the supplied values.
 * @return {!Object} Structured result assembled from the input data.
 */
function forms() {
  const state = {collection: collectionFixture(), };
  const selectors = createSelectors(state);
  return {
    state, bottle: createBottleForm({
      state, selectors,
    }), bottling: createBottlingForm({
      state, selectors,
    }),
  };
}
test('bottle metadata puts separators only between actual values', () => {
  assert.equal(renderedText(bottleMeta({})), '');
  assert.equal(renderedText(bottleMeta({inventoryNumber: '000123', })), '');
  assert.equal(renderedText(bottleMeta({purchasePrice: 0, })), '0 EUR');
  assert.equal(renderedText(bottleMeta({
    purchaseDate: '2026-11-05', purchasePrice: 45,
  }, value => value)), 'Kauf: 2026-11-05 \u00b7 45 EUR');
});
test(
  'bottle form renders read-only parent information and exactly one inventory input',
  () => {
    const {state, bottle} = forms();
    const html = bottle(state.collection.bottlings[0].bottles[0], 'bottling-a');
    const context = renderedText(html).slice(renderedText(html).indexOf('<section'), renderedText(html).indexOf('</section>'));
    assert.match(renderedText(context), /Test Blend/);
    assert.match(renderedText(context), /Test Distillery/);
    assert.match(renderedText(context), /Example Bottler/);
    assert.match(renderedText(context), /schreibgesch\u00fctzt/);
    assert.doesNotMatch(renderedText(context), /<input|<select|<textarea/);
    assert.equal((renderedText(html).match(/name="inventoryNumber"/g) || []).length, 1);
    assert.match(renderedText(html), /Leerdatum<input\s+name="emptiedAt" type="date"/);
    assert.match(
      renderedText(bottle({...state.collection.bottlings[0].bottles[0], emptiedAt: '2026-11-20'}, 'bottling-a')),
      /name="emptiedAt" type="date"[^>]*value="2026-11-20"/
    );
    assert.doesNotMatch(renderedText(html), /labelCode|labelType|Etikettentyp|Etikettencode/);
  }
);
test('forms escape user data instead of treating it as HTML', () => {
  const {state, bottle, bottling} = forms();
  const owner = state.collection.bottlings[0];
  owner.name = '<img src=x onerror=alert(1)>';
  const html = renderedText(bottle({}, owner.id)) + renderedText(bottling(owner));
  assert.doesNotMatch(renderedText(html), /<img src=x/);
  assert.match(renderedText(html), /&lt;img src=x onerror=alert\(1\)&gt;/);
});
test('new bottling form has no extra label identifier or label type', () => {
  const {bottling} = forms();
  const html = bottling();
  assert.equal((renderedText(html).match(/name="firstInventoryNumber"/g) || []).length, 1);
  assert.doesNotMatch(renderedText(html), /labelCode|labelType|firstLabelCode|Etikettencode/);
});

test('sample type and size are editable only on physical bottles', () => {
  const {state, bottle, bottling} = forms();
  const sample = {
    id: 'sample-x', volumeType: 'sample', volumeMl: 30,
    status: 'closed',
  };
  const bottleHtml = bottle(sample, 'bottling-a');
  const bottlingHtml = bottling(state.collection.bottlings[0]);
  assert.match(renderedText(bottleHtml), /name="volumeType"/);
  assert.match(renderedText(bottleHtml), /name="volumeMl"/);
  assert.match(renderedText(bottleHtml), /<option value="sample" selected/);
  assert.doesNotMatch(renderedText(bottlingHtml), /name="volumeType"/);
  assert.match(renderedText(bottlingHtml), /Nennfüllmenge der Abfüllung/);
  assert.match(renderedText(bottlingHtml), /name="volumeMl"/);
  const first = bottling();
  assert.match(renderedText(first), /name="firstVolumeType"/);
  assert.match(renderedText(first), /name="firstVolumeMl"/);
});
