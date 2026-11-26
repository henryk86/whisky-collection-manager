import {domElements, domText, domScope, assertDom, domMatches} from './component-dom.js';
import {composeMarkup} from '../../public/js/ui/render-plan.js';
import test from 'node:test';
import assert from 'node:assert/strict';
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

test(
  'bottle form renders read-only parent information and exactly one inventory input',
  async () => {
    const {state, bottle} = forms();
    const html = bottle(state.collection.bottlings[0].bottles[0], 'bottling-a');
    const context = domScope(html, 'section');
    assert.match(await domText(context), /Test Blend/);
    assert.match(await domText(context), /Test Distillery/);
    assert.match(await domText(context), /Example Bottler/);
    await assertDom(context, 'section', {'aria-label': /schreibgesch\u00fctzt/});
    await assertDom(context, "input,select,textarea", {}, true);
    assert.equal((await domElements(html, '[name="inventoryNumber"]')).length, 1);
    await assertDom(html, "label:has(input[name=\"emptiedAt\"][type=\"date\"])", {text: /Leerdatum/});
    assert.ok((await domElements(bottle({...state.collection.bottlings[0].bottles[0], emptiedAt: '2026-11-20'}, 'bottling-a'), '[name="emptiedAt"][type="date"][value="2026-11-20"]')).length > 0);
    await assertDom(html, '[name="labelCode"], [name="labelType"]', {}, true);
    assert.doesNotMatch(await domText(html), /Etikettentyp|Etikettencode/);
  }
);

test('forms escape user data instead of treating it as HTML', async () => {
  const {state, bottle, bottling} = forms();
  const owner = state.collection.bottlings[0];
  owner.name = '<img src=x onerror=alert(1)>';
  const html = composeMarkup(bottle({}, owner.id), bottling(owner));
  await assertDom(html, "img[src=\"x\"]", {}, true);
  assert.match(await domText(html), new RegExp("<img src=x onerror=alert\\(1\\)>"));
});

test('new bottling form has no extra label identifier or label type', async () => {
  const {bottling} = forms();
  const html = bottling();
  assert.equal((await domElements(html, '[name="firstInventoryNumber"]')).length, 1);
  assert.equal((await domMatches(html, "[name=\"labelCode\"], [name=\"labelType\"], [name=\"firstLabelCode\"]") || new RegExp("Etikettencode").test(await domText(html))), false);
});

test('sample type and size are editable only on physical bottles', async () => {
  const {state, bottle, bottling} = forms();
  const sample = {
    id: 'sample-x', volumeType: 'sample', volumeMl: 30,
    status: 'closed',
  };
  const bottleHtml = bottle(sample, 'bottling-a');
  const bottlingHtml = bottling(state.collection.bottlings[0]);
  assert.ok((await domElements(bottleHtml, '[name="volumeType"]')).length > 0);
  assert.ok((await domElements(bottleHtml, '[name="volumeMl"]')).length > 0);
  assert.ok((await domElements(bottleHtml, 'option[value="sample"][selected]')).length > 0);
  assert.equal((await domElements(bottlingHtml, '[name="volumeType"]')).length, 0);
  assert.match(await domText(bottlingHtml), /Nennfüllmenge der Abfüllung/);
  assert.ok((await domElements(bottlingHtml, '[name="volumeMl"]')).length > 0);
  const first = bottling();
  assert.ok((await domElements(first, '[name="firstVolumeType"]')).length > 0);
  assert.ok((await domElements(first, '[name="firstVolumeMl"]')).length > 0);
});
