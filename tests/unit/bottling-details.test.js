import test from 'node:test';
import assert from 'node:assert/strict';
import { bottlingDetails } from '../../public/js/domain/bottling-details.js';

const distilleryNames = () => 'Bowmore, Port Ellen';
const byLabel = fields => Object.fromEntries(fields.map(([label, value, suffix = '']) => [label, `${value}${suffix ? ` ${suffix}` : ''}`]));

test('details exclude absent labels, placeholder values, and unknown composition', () => {
    const details = bottlingDetails({
        name: 'Big Peat', whiskyType: null, brand: '', ageYears: null,
        abv: undefined, distilleryIds: [], compositionComplete: false,
        caskType: ' ', region: '–', bottlingDate: null, bottlingYear: null,
        description: null,
    }, distilleryNames);
    assert.deepEqual(details, []);
});

test('details include only supplied fields with units and the exact dates', () => {
    const fields = bottlingDetails({
        whiskyType: 'blended_malt', brand: 'Big Peat', distilleryIds: ['bowmore', 'port-ellen'],
        compositionComplete: true, ageYears: 5, abv: 60.2, volumeMl: 700,
        distillationDate: '2008-03-20', distillationYear: 2008,
        bottlingDate: '2013-06-20', bottlingYear: 2013,
        caskNumber: '126/2008', limitedEditionCount: 276,
    }, distilleryNames);
    const rows = byLabel(fields);
    assert.equal(rows['Whisky-Kategorie'], 'Blended Malt Scotch Whisky');
    assert.equal(rows['Beteiligte Destillerien'], 'Bowmore, Port Ellen');
    assert.equal(rows['Zusammensetzung vollständig'], 'Ja');
    assert.equal(rows['Destilliert am'], '20.03.2008');
    assert.equal(rows['Abgefüllt am'], '20.06.2013');
    assert.equal(rows['Alkoholgehalt'], '60.2 % Vol.');
    assert.equal(rows['Alter'], '5 Jahre');
    assert.equal(rows['Fassnummer'], '126/2008');
    assert.equal(rows['Limitierte Auflage'], '276');
    assert.ok(!Object.hasOwn(rows, 'Fasstyp'));
});

test('year-only dates and entered numeric zero are treated as provided values', () => {
    const fields = byLabel(bottlingDetails({
        distilleryIds: [], ageYears: 0, distillationYear: 2005,
        bottlingDate: '', bottlingYear: 2010,
    }, distilleryNames));
    assert.equal(fields['Alter'], '0 Jahre');
    assert.equal(fields['Destilliert am'], '2005');
    assert.equal(fields['Abgefüllt am'], '2010');
});
