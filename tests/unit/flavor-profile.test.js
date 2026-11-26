import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBottling} from '../../server/domain/normalization.js';
import {normalizeTastingRecord} from '../../shared/tasting-records.js';
import {FLAVOR_AXES, NEW_FLAVOR_AXES, normalizeFlavorProfile} from '../../shared/flavor-profile.js';
import german from '../../public/locales/de.json' with {type: 'json'};
import english from '../../public/locales/en.json' with {type: 'json'};

const profile = Object.fromEntries(FLAVOR_AXES.map((key, i) => [key, i]));

test('flavor profile is owned by a dated tasting, not by the bottling', () => {
  const value = normalizeTastingRecord({
    tastedOn: '2026-11-15', flavorProfile: profile,
  });
  assert.deepEqual(value.flavorProfile, profile);
  assert.deepEqual(normalizeTastingRecord({rating: 88}, value).flavorProfile, profile);
  assert.equal(normalizeTastingRecord({flavorProfile: null}, value).flavorProfile, null);
  assert.throws(() => normalizeBottling({
    name: 'Sample', flavorProfile: profile,
  }));
});

test(
  'flavor values require the legacy eight or all ten axes; new axes may be unassessed only in older tastings',
  () => {
    for (const invalid of [
      {woody: 5},
      {...profile, woody: 11},
      {...profile, peaty: -1},
      {...profile, fruity: '3'},
      {...profile, winey: 2.5},
      {...profile, unexpected: 3},
      {...profile, smoky: null, medicinal: null, woody: null},
      {...profile, smoky: null, medicinal: undefined},
      [],
    ]) {
      assert.throws(() => normalizeFlavorProfile(invalid));
      assert.throws(() =>
        normalizeTastingRecord({
          tastedOn: '2026-11-15', flavorProfile: invalid,
        }));
    }
    assert.deepEqual(
      normalizeFlavorProfile(Object.fromEntries(FLAVOR_AXES.map(key => [key, 10]))),
      Object.fromEntries(FLAVOR_AXES.map(key => [key, 10]))
    );
  }
);

test(
  'German and English axis names are localized, with German Alkoholisch for English Feinty',
  () => {
    assert.equal(german['flavor.axis.feinty'], 'Alkoholisch');
    assert.equal(english['flavor.axis.feinty'], 'Feinty');
    for (const axis of FLAVOR_AXES) {
      assert.ok(german[`flavor.axis.${axis}`]);
      assert.ok(english[`flavor.axis.${axis}`]);
    }
  }
);

test(
  'both newly added flavor dimensions accept real zero but not missing legacy scores',
  () => {
    const complete = {...profile};
    for (const axis of NEW_FLAVOR_AXES) complete[axis] = 0;
    assert.deepEqual(normalizeFlavorProfile(complete), complete);
    for (const axis of NEW_FLAVOR_AXES) complete[axis] = null;
    assert.deepEqual(normalizeFlavorProfile(complete), complete);
    assert.throws(() => normalizeFlavorProfile({...complete, cereal: null}));
    assert.throws(() => normalizeFlavorProfile({
      ...complete,
      fruity: undefined,
    }));
  }
);
