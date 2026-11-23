import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCask, caskDistance, readAge, ageDistance, ageClass, caskMatches} from '../../public/js/domain/flight-casks.js';
import {suggestFlight, flightCandidates, orderFlightItems} from '../../public/js/domain/flight-planner.js';

const profile = {woody: 0, smoky: 0, cereal: 0, peaty: 0, fruity: 0, floral: 0, medicinal: 0, winey: 0, feinty: 0, sulphury: 0};
const bottle = (id, caskType, ageYears, tastedOn = '2026-11-01') => ({
  id, name: id, caskType, ageYears, abv: 46,
  distilleryIds: [id], bottles: [{id: `p-${id}`, status: 'open'}],
  tastings: tastedOn ? [{id: `t-${id}`, tastedOn, flavorProfile: {...profile}}] : []
});
const sample = {
  bottlings: [
    bottle('bourbonA', 'Ex-Bourbon', 10), bottle('bourbonB', 'Bourbon Hogshead', 11), bottle('bourbonC', 'Bourbon', 12),
    bottle('pxA', 'Pedro Ximénez', 30), bottle('pxB', 'PX Sherry', 28), bottle('sherry', 'Oloroso Sherry Butt', 20),
    bottle('wine', 'Sauternes', 16), bottle('rum', 'Rum Finish', 6)
  ]
};
const plan = (collection, options) => suggestFlight(collection, {count: 3, style: 'similar', today: Date.parse('2026-11-23'), ...options})
  .map(item => item.bottlingId);

test('cask descriptions recognize Bourbon, Sherry subtypes, Wine and explicitly named exotic casks', () => {
  const mixed = classifyCask('Ex-Bourbon matured, Oloroso Sherry Finish');
  assert.equal(mixed.groups.bourbon, 1);
  assert.equal(mixed.groups.sherry, 0.5);
  assert.equal(mixed.subtypes.oloroso, 0.5);
  assert.equal(classifyCask('Pedro Ximénez PX').subtypes.px, 1);
  assert.equal(classifyCask('Olorosso').subtypes.oloroso, 1);
  for (const sherry of ['Fino', 'Amontillado', 'Palo Cortado', 'Manzanilla'])
    assert.deepEqual(Object.keys(classifyCask(sherry).groups), ['sherry']);
  assert.deepEqual(Object.keys(classifyCask('Sauternes Port wine').groups), ['wine']);
  assert.deepEqual(Object.keys(classifyCask('Mizunara Rum Finish').groups), ['exotic']);
  assert.deepEqual(classifyCask('refill oak cask'), {groups: {}, subtypes: {}});
  assert.deepEqual(classifyCask(''), {groups: {}, subtypes: {}});
});
test('sherry subtype differences are smaller than Bourbon versus Sherry; unknowns are not a fake zero', () => {
  assert.equal(caskDistance(classifyCask('PX'), classifyCask('Oloroso')), 0.25);
  assert.equal(caskDistance(classifyCask('PX'), classifyCask('PX')), 0);
  assert.equal(caskDistance(classifyCask('Bourbon'), classifyCask('Sherry')), 1);
  assert.equal(caskDistance(classifyCask(''), classifyCask('Bourbon')), null);
  assert.ok(caskDistance(classifyCask('Bourbon / Oloroso Finish'), classifyCask('Bourbon')) < 1);
});
test('age normalization supports missing values, zero and 15-year saturation', () => {
  assert.equal(readAge(''), null);
  assert.equal(readAge(null), null);
  assert.equal(readAge('11'), 11);
  assert.equal(readAge(0), 0);
  assert.equal(ageDistance(10, 16), 0.4);
  assert.equal(ageDistance(10, 40), 1);
  assert.equal(ageDistance(null, 10), null);
  assert.equal(ageClass(null), null);
  assert.equal(ageClass(18), '16-20');
});
test('similar defaults to comparable cask/age groups and explicit preferences affect selection', () => {
  assert.deepEqual(plan(sample, {}), ['bourbonA', 'bourbonB', 'bourbonC']);
  assert.deepEqual(new Set(plan(sample, {caskMode: 'specific', caskGroup: 'sherry', caskSubtype: 'px'})), new Set(['pxA', 'pxB', 'sherry']));
  assert.deepEqual(new Set(plan(sample, {caskMode: 'specific', caskGroup: 'sherry', caskSubtype: 'px', strictMatches: true})), new Set(['pxA', 'pxB']));
  assert.deepEqual(new Set(plan(sample, {ageMode: 'range', ageMin: 27, ageMax: 31, strictMatches: true})), new Set(['pxA', 'pxB']));
  assert.deepEqual(new Set(plan(sample, {caskMode: 'variety', ageMode: 'variety'})), new Set(['pxA', 'wine', 'rum']));
  assert.ok(caskMatches(classifyCask('Pedro Ximenez'), 'sherry', 'px'));
});
test('unavailable or unknown cask and age facts are neutral unless strict constraints are active', () => {
  const source = {bottlings: [bottle('unknown', 'oak finish', null), bottle('bourbon', 'bourbon', 10)]};
  assert.equal(plan(source, {count: 2}).length, 2);
  assert.deepEqual(plan(source, {count: 2, caskMode: 'specific', caskGroup: 'sherry', strictMatches: true}), []);
  assert.deepEqual(plan(source, {count: 2, ageMode: 'range', ageMin: 12, strictMatches: true}), []);
  assert.deepEqual(flightCandidates(source).find(item => item.bottling.id === 'unknown').age, null);
  assert.throws(() => plan(source, {caskMode: 'broken'}));
  assert.throws(() => plan(source, {ageMode: 'range', ageMin: 19, ageMax: 12}));
});
test('balanced includes known cask families and discover can prefer families not yet tasted', () => {
  const balanced = plan(sample, {style: 'balanced', count: 4});
  const categories = balanced.map(id => Object.keys(classifyCask(sample.bottlings.find(b => b.id === id).caskType).groups)[0]);
  assert.equal(new Set(categories).size, 4);
  const collection = {
    bottlings: [
      bottle('tastedBourbon', 'Bourbon', 11),
      bottle('newBourbon', 'Bourbon', 12, ''),
      bottle('newRum', 'Rum', 12, '')
    ]
  };
  const selected = plan(collection, {style: 'discover', count: 1, preferUnfamiliar: false});
  assert.deepEqual(selected, ['newRum']);
});
test('order penalizes avoidable abrupt cask switches when other indicators tie', () => {
  const data = {
    bottlings: [bottle('bourbon1', 'Bourbon', 12), bottle('sherry1', 'PX', 12),
    bottle('bourbon2', 'Bourbon', 12), bottle('sherry2', 'PX', 12)]
  };
  const order = orderFlightItems(flightCandidates(data)).map(item => item.bottling.caskType.includes('Bourbon') ? 'bourbon' : 'sherry');
  assert.equal(order.filter((x, i) => i > 0 && x !== order[i - 1]).length, 1);
});
