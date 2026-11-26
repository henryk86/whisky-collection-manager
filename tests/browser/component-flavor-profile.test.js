import {fixtureMarkup} from '../helpers/capture-rendering.js';
import {domElements, domText, domMatches, domIndex} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {FLAVOR_AXES, LEGACY_FLAVOR_AXES, NEW_FLAVOR_AXES, normalizeFlavorProfile} from '../../shared/flavor-profile.js';
import {flavorChart, flavorPolygon} from '../../public/js/ui/flavor-profile.js';

const profile = Object.fromEntries(FLAVOR_AXES.map((key, i) => [key, i]));

test(
  'flavor chart has ten axes and sliders and does not misrepresent missing profile as zero',
  async () => {
    const editor = flavorChart(profile, {editable: true});
    assert.equal((await domElements(editor, '[data-flavor-range]')).length, 10);
    assert.equal((await domElements(editor, '[data-flavor-point]')).length, 10);
    assert.ok((await domElements(editor, '[data-flavor-set="1"]')).length > 0);
    assert.ok((await domElements(flavorChart(null, {editable: true}), '[data-flavor-set=""]')).length > 0);
    assert.equal((flavorPolygon(profile).match(/ /g) || []).length, 9);
    assert.match(await domText(flavorChart(null)), /Noch kein Geschmacksprofil/);
  }
);

test('optional color column is emitted before the ten-axis radar chart', async () => {
  const html = flavorChart(
    profile,
    {
      editable: true,
      colorSection: fixtureMarkup('<div class="tasting-color-column" data-test="palette"></div>'),
    }
  );
  assert.ok((await domElements(html, '[class="flavor-editor is-editable has-color"]')).length > 0);
  assert.ok(await domIndex(html, '[data-test="palette"]') < await domIndex(html, '.flavor-chart'));
  assert.ok(await domIndex(html, '.flavor-chart') < await domIndex(html, '.flavor-sliders'));
  assert.equal((await domElements(html, '[data-flavor-range]')).length, 10);
});

test(
  'older eight-axis tasting remains valid without fabricating ratings for new aromas',
  async () => {
    const older = Object.fromEntries(LEGACY_FLAVOR_AXES.map((key, i) => [key, i]));
    const normalized = normalizeFlavorProfile(older);
    for (const axis of LEGACY_FLAVOR_AXES) assert.equal(normalized[axis], older[axis]);
    for (const axis of NEW_FLAVOR_AXES) assert.equal(normalized[axis], null);
    assert.deepEqual(normalizeFlavorProfile(normalized), normalized, 'normalized old record can be saved again');
    const readOnly = flavorChart(normalized);
    for (const name of ['Rauchig', 'Medizinisch']) assert.match(await domText(readOnly), new RegExp(name));
    assert.equal((await domElements(readOnly, 'strong')).filter(node => node.text === "–").length, 2);
    assert.equal((await domElements(readOnly, '[visibility="hidden"]')).length, 2);
    const editor = flavorChart(normalized, {editable: true});
    assert.equal((await domElements(editor, '[data-flavor-unset="1"]')).length, 2);
    assert.equal(flavorPolygon(normalized).trim().split(/\s+/).length, 8, 'unassessed axes are not plotted as zero');
  }
);

test(
  'obsolete eleven-axis payload is accepted but fiery is not part of the new ten-axis profile',
  async () => {
    const eleven = {...profile, fiery: 7};
    assert.deepEqual(normalizeFlavorProfile(eleven), profile);
    assert.deepEqual(normalizeFlavorProfile({...eleven, fiery: null}), profile);
    assert.throws(() => normalizeFlavorProfile({...eleven, fiery: '7'}));
    assert.equal(FLAVOR_AXES.length, 10);
    assert.equal((await domText(flavorChart(normalizeFlavorProfile(eleven)))).includes('Brennend'), false);
  }
);

test(
  'compact tasting radar uses the original ten-axis graphic without duplicating sliders',
  async () => {
    const preview = flavorChart(profile, {compact: true});
    assert.ok((await domElements(preview, '[class="flavor-editor is-preview"]')).length > 0);
    assert.ok((await domElements(preview, 'svg[class="flavor-chart"]')).length > 0);
    assert.equal((await domElements(preview, '[class="flavor-axis-text"]')).length, 10);
    assert.equal((await domMatches(preview, ".flavor-sliders, .flavor-scale, [data-flavor-range]")), false);
    assert.equal((await domElements(flavorChart(profile), '.flavor-sliders')).length, 1);
    /**
     * Formats y for presentation.
     *
     * @param {*} html Captured render content to inspect.
     * @return {number} Calculated numeric value.
     */
    const labelY = async html => Number((await domElements(html, 'text.flavor-axis-text')).find(node => node.text === 'Holzig').attributes.y);
    // Only the detail preview tightens axis labels; the full tasting radar is
    // unchanged.
    assert.ok(await labelY(preview) > await labelY(flavorChart(profile)));
    assert.ok(await labelY(preview) < 64, 'the compact top label is close to the radar ring');
  }
);
