import test from 'node:test';
import assert from 'node:assert/strict';
import {bottlingOrigins, countryLabel} from '../../public/js/domain/distillery-origin.js';
import {analyzeCollection, analyticsFilterOptions, filterAnalyticsCollection} from '../../public/js/domain/analytics.js';
import {bottlingDetails} from '../../public/js/domain/bottling-details.js';

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
  bottles: [{id: id + '-b', status: 'closed', volumeType: 'standard', volumeMl: 700}],
});

test(
  'country is sourced from destilleries, not inconsistent bottling fields',
  () => {
    const b = entry('single', ['ard'], 'Distillery Bottling', 'USA');
    assert.deepEqual(
      bottlingOrigins(b, sites),
      {countries: ['Schottland'], regions: ['Islay']}
    );
    assert.equal(countryLabel('UK'), 'Vereinigtes Königreich'); // UK cannot mean Scotland by itself
    const detail = Object.fromEntries(bottlingDetails(b, () =>
      'Ardbeg', sites).map(([k, v]) => [k, v]));
    assert.equal(detail.Land, 'Schottland');
    assert.equal(detail.Region, 'Islay');
  }
);

test(
  'a blend has unique origin countries and regions, even with two distilleries on Islay',
  () => {
    const b = entry(
      'blend',
      ['ard', 'lag', 'other'],
      'Independent Bottler',
      'France'
    );
    assert.deepEqual(
      bottlingOrigins(b, sites),
      {countries: ['Schottland', 'Deutschland'], regions: ['Islay', 'Bayern']}
    );
    const c = {distilleries: sites, bottlings: [b]};
    const analysis = analyzeCollection(c);
    assert.equal(
      analysis.provenance.byCountry.reduce((sum, row) => sum + row.count, 0),
      2
    );
    assert.equal(
      analysis.provenance.byRegion.reduce((sum, row) => sum + row.count, 0),
      2
    );
    assert.deepEqual(
      analyticsFilterOptions(c).countries,
      ['Deutschland', 'Schottland']
    );
    assert.equal(
      filterAnalyticsCollection(c, {country: 'Schottland'}).bottles.length,
      1
    );
    assert.equal(
      filterAnalyticsCollection(c, {country: 'Deutschland'}).bottles.length,
      1
    );
    assert.equal(
      filterAnalyticsCollection(c, {country: 'USA'}).bottles.length,
      0
    );
  }
);

test(
  'Distillery Bottling counts as original bottling (case and whitespace insensitive)',
  () => {
    const c = {
      distilleries: sites, bottlings: [
        entry('original', ['ard'], '  DISTILLERY   BOTTLING '),
        entry('named', ['lag'], 'Lagavulin'),
        entry('independent', ['ard'], 'Signatory Vintage'),
        entry('unknown', ['ard'], ''),
      ],
    };
    const result = analyzeCollection(c).provenance.byBottler;
    assert.equal(result.find(row => row.name === 'Originalabfüllung').count, 2);
    assert.equal(
      result.find(row => row.name === 'Andere / nicht eindeutig').count,
      1
    );
    assert.equal(result.find(row => row.name === 'Nicht angegeben').count, 1);
  }
);

test(
  'bottling form omits origin explanations; help page explains distillery sourcing',
  async () => {
    const {createBottlingForm} =
      await import('../../public/js/features/forms/bottling.js');
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
    assert.doesNotMatch(html, /name="(?:country|region)"/);
    assert.doesNotMatch(html, /Herkunftsland und Whiskyregion werden anhand/);
    const {helpView} = await import('../../public/js/views/help.js');
    assert.match(
      helpView(),
      /Die Herkunft wird aus zugeordneten Destillerien abgeleitet/
    );
  }
);
