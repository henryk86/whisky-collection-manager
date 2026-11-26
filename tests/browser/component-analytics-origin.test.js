import {domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const sites = [
  {id: 'ard', name: 'Ardbeg', country: 'Schottland', region: 'Islay'},
  {id: 'lag', name: 'Lagavulin', country: 'Scotland', region: 'Islay'},
  {id: 'other', name: 'Other Site', country: 'Germany', region: 'Bayern'},
];

/**
 * Derives the entry result from the supplied values.
 *
 * @param {*} id Identifier of the affected record.
 * @param {*} distilleryIds Value used by this operation.
 * @param {*} bottler Value used by this operation.
 * @param {string=} country Value used by this operation.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const entry = (id, distilleryIds, bottler, country = '') => ({
  id, name: id, distilleryIds, bottler, country,
  bottles: [{
    id: id + '-b', status: 'closed', volumeType: 'standard',
    volumeMl: 700,
  }],
});

test(
  'bottling form omits origin explanations; help page explains distillery sourcing',
  async () => {
    const {createBottlingForm} = await import('../../public/js/features/forms/bottling.js');
    const state = {collection: {distilleries: sites}};
    const bottlingForm =
      createBottlingForm({
        state, selectors: {
          /**
           * Derives the distillery ids result from the supplied values.
           *
           * @param {*} b Second entry or operand in the calculation.
           * @return {*} Result computed from the supplied inputs.
           */
          distilleryIds: b =>
            b.distilleryIds || [],
        },
      });
    const html = bottlingForm(entry('test', ['ard'], 'Distillery Bottling'));
    await assertDom(html, "[name=\"country\"], [name=\"region\"]", {}, true);
    assert.doesNotMatch(await domText(html), /Herkunftsland und Whiskyregion werden anhand/);
    const {helpView} = await import('../../public/js/views/help.js');
    assert.match(await domText(helpView()), /Die Herkunft wird aus zugeordneten Destillerien abgeleitet/);
  }
);
