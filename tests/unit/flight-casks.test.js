import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCask, caskDistance, readAge, ageDistance, ageClass, caskMatches,
  CASK_GROUPS, CASK_DIMENSIONS, caskCoverage, validCaskFilters,
} from '../../public/js/domain/flight-casks.js';
import {suggestFlight, flightCandidates, orderFlightItems} from '../../public/js/domain/flight-planner.js';

const profile = {
  woody: 0,
  smoky: 0,
  cereal: 0,
  peaty: 0,
  fruity: 0,
  floral: 0,
  medicinal: 0,
  winey: 0,
  feinty: 0,
  sulphury: 0,
};
/**
 * Derives the bottle result from the supplied values.
 *
 * @param {*} id Identifier of the affected record.
 * @param {*} caskType Value used by this operation.
 * @param {*} ageYears Value used by this operation.
 * @param {string=} tastedOn Value used by this operation.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const bottle = (id, caskType, ageYears, tastedOn = '2026-11-01') => ({
  id, name: id, caskType, ageYears, abv: 46,
  distilleryIds: [id], bottles: [{id: `p-${id}`, status: 'open'}],
  tastings: tastedOn ? [{id: `t-${id}`, tastedOn, flavorProfile: {...profile}}] : [],
});
const sample = {
  bottlings: [
    bottle('bourbonA', 'Ex-Bourbon', 10),
    bottle('bourbonB', 'Bourbon Hogshead', 11),
    bottle('bourbonC', 'Bourbon', 12),
    bottle('pxA', 'Pedro Ximénez', 30),
    bottle('pxB', 'PX Sherry', 28),
    bottle('sherry', 'Oloroso Sherry Butt', 20),
    bottle('wine', 'Sauternes', 16),
    bottle('rum', 'Rum Finish', 6),
  ],
};
/**
 * Transforms the entries used by plan.
 *
 * @param {*} collection Collection data to process.
 * @param {*} options Options controlling the operation.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const plan = (collection, options) => suggestFlight(
  collection,
  {count: 3, style: 'similar', today: Date.parse('2026-11-23'), ...options}
)
  .map(item => item.bottlingId);

test(
  'cask descriptions retain categories, features and independent phases',
  () => {
    const mixed = classifyCask('Ex-Bourbon matured, Oloroso Sherry Finish');
    assert.deepEqual(mixed.groups, {bourbon: 1, sherry: 0.5});
    assert.deepEqual(mixed.profiles[1], {
      group: 'sherry', phase: 'finish',
      weight: 0.5, features: {style: ['oloroso']},
    });
    assert.deepEqual(classifyCask('Pedro Ximénez PX').profiles[0].features,
      {style: ['px']});
    assert.ok(caskMatches(classifyCask('Olorosso'),
      {sherry: {style: ['oloroso']}}));
    assert.deepEqual(classifyCask('Sauternes and Port wine').groups,
      {wine: 1, port: 1});
    assert.deepEqual(classifyCask('Mizunara Rum Finish').groups, {rum: 0.5});
    assert.deepEqual(
      classifyCask('refill oak cask'),
      {groups: {}, profiles: []}
    );
    assert.deepEqual(classifyCask(''), {groups: {}, profiles: []});
  }
);

test('all declared cask groups and dimensions have recognized examples', () => {
  const examples = {
    bourbon: {input: 'Bourbon Whiskey Cask'},
    sherry: {
      input: 'Sherry Cask', style: {
        px: 'P.X.',
        oloroso: 'Oloroso',
        fino: 'Fino',
        amontillado: 'Amontillado',
        paloCortado: 'Palo Cortado',
        manzanilla: 'Manzanilla',
        cream: 'Cream Sherry',
        medium: 'Medium Sherry',
        moscatel: 'Moscatel Sherry',
      },
    },
    port: {
      input: 'Port Wine', style: {
        ruby: 'Ruby Port', tawny: 'Tawny Port Wine', whitePort: 'White Port',
        rosePort: 'Rosé Port', vintagePort: 'Vintage Port',
        lbv: 'Late Bottled Vintage Port', colheita: 'Colheita Port',
      },
    },
    madeira: {
      input: 'Madeira Cask', style: {
        sercial: 'Sercial Madeira', verdelho: 'Verdelho Madeira',
        bual: 'Boal Madeira', malvasia: 'Malmsey Madeira',
      },
    },
    wine: {
      input: 'Wine Cask', color: {
        redWine: 'Red Wine', whiteWine: 'Weißwein', roseWine: 'Roséwein',
      }, style: {sweetWine: 'Süßwein', sparklingWine: 'Schaumwein'},
      designation: {
        bordeaux: 'Bordeaux', burgundy: 'Burgund', rioja: 'Rioja',
        amarone: 'Amarone', barolo: 'Barolo', sauternes: 'Sauternes',
        tokajiAszu: 'Tokaji Aszú', iceWine: 'Ice Wine', champagne: 'Champagne',
      }, grape: {chardonnay: 'Chardonnay', riesling: 'Riesling'},
    },
    fortifiedWine: {
      input: 'Fortified wine', style: {
        marsala: 'Marsala Wine', malaga: 'Málaga', banyuls: 'Banyuls',
        rivesaltes: 'Rivesaltes',
      },
    },
    rum: {input: 'Jamaican Rum'},
    otherWhisky: {
      input: 'Whisky Cask', style: {
        scotch: 'Scotch Whisky', irishWhiskey: 'Irish Whiskey',
        rye: 'Rye Whiskey', tennessee: 'Tennessee Whiskey',
      },
    },
    brandy: {
      input: 'Brandy Cask',
      style: {cognac: 'Cognac', armagnac: 'Armagnac'},
    },
    otherSpirit: {
      input: 'Calvados', style: {
        calvados: 'Calvados', tequila: 'Tequila', mezcal: 'Mezcal', gin: 'Gin',
      },
    },
    beer: {
      input: 'Beer Cask', style: {
        stout: 'Stout', porter: 'Porter',
        ipa: 'IPA Cask', ale: 'Ale',
      },
    },
    virginOak: {input: 'Virgin Oak'}, other: {input: 'Cider'},
    unknown: {input: 'Oak Cask'},
  };
  assert.deepEqual(new Set(Object.keys(examples)), new Set(CASK_GROUPS));
  for (const [group, {input, ...dimensions}] of Object.entries(examples)) {
    const result = classifyCask(input);
    assert.ok(caskMatches(result, {[group]: {}}), input);
    assert.deepEqual(
      Object.keys(result.groups),
      group === 'unknown' ? [] : [group]
    );
    assert.deepEqual(
      Object.keys(dimensions),
      Object.keys(CASK_DIMENSIONS[group])
    );
    for (const [dimension, values] of Object.entries(dimensions)) {
      assert.deepEqual(Object.keys(values), CASK_DIMENSIONS[group][dimension]);
      for (const [value, text] of Object.entries(values)) {
        const classified = classifyCask(text);
        assert.deepEqual(Object.keys(classified.groups), [group], text);
        assert.ok(
          caskMatches(classified, {[group]: {[dimension]: [value]}}),
          text
        );
      }
    }
  }
});

test('cask matching uses OR between groups and values, AND per cask', () => {
  const selection = {
    port: {style: ['tawny', 'whitePort']},
    wine: {color: ['whiteWine'], style: ['sweetWine']},
  };
  for (const text of [
    'Colheita Port', 'White Port', 'Sauternes', 'Tokaji Aszú',
  ])
    assert.ok(caskMatches(classifyCask(text), selection), text);
  for (const text of ['Ruby Port', 'Port Cask', 'Bordeaux', 'Wine Cask',
    'White wine cask and sweet wine cask', 'Red wine, sweet wine', 'Rum'])
    assert.equal(caskMatches(classifyCask(text), selection), false, text);
  assert.ok(caskMatches(
    classifyCask('Bordeaux'),
    {wine: {designation: ['bordeaux']}}
  ));
  assert.equal(
    caskMatches(classifyCask('Bordeaux'), {wine: {color: ['redWine']}}),
    false
  );
  assert.ok(caskMatches(classifyCask('Madeira Cask'), {madeira: {}}));
  assert.equal(
    caskMatches(classifyCask('Madeira Cask'), {madeira: {style: ['bual']}}),
    false
  );
  assert.equal(
    caskMatches(classifyCask('Sherry Wine Cask'), {wine: {}}),
    false
  );
  assert.equal(caskMatches(classifyCask('Tawny Port Wine'), {wine: {}}), false);
  assert.equal(
    caskMatches(
      classifyCask('ginning airport supporter'),
      {otherSpirit: {}, port: {}, beer: {}}
    ),
    false
  );
  assert.ok(caskMatches(classifyCask('American white oak'), {unknown: {}}));
  assert.equal(
    caskMatches(
      classifyCask('American white oak'),
      {bourbon: {}, virginOak: {}, other: {}}
    ),
    false
  );
  assert.ok(caskMatches(classifyCask('anything'), {}));
  assert.equal(validCaskFilters({rum: {style: ['tawny']}}), false);
  assert.equal(validCaskFilters({wine: {color: ['sauternes']}}), false);
  assert.equal(validCaskFilters({wine: {color: []}}), false);
  assert.equal(validCaskFilters({wine: {constructor: ['x']}}), false);
  assert.equal(validCaskFilters(selection), true);
});

test('specific maturation and finish must belong to the matching cask', () => {
  const mixed = classifyCask('Bourbon matured, Oloroso Finish');
  assert.ok(caskMatches(mixed, {bourbon: {}}, 'maturation'));
  assert.ok(caskMatches(mixed, {sherry: {style: ['oloroso']}}, 'finish'));
  assert.equal(caskMatches(mixed, {sherry: {}}, 'maturation'), false);
  assert.equal(caskMatches(mixed, {bourbon: {}}, 'finish'), false);
  const withoutPunctuation = classifyCask('Bourbon cask finished in PX');
  assert.deepEqual(withoutPunctuation.groups, {bourbon: 1, sherry: 0.5});
  assert.equal(
    caskMatches(withoutPunctuation, {bourbon: {}}, 'maturation'),
    true
  );
  const sameGroup = classifyCask('Oloroso maturation / PX finish');
  assert.equal(
    caskMatches(sameGroup, {sherry: {style: ['oloroso']}}, 'finish'),
    false
  );
  assert.ok(caskMatches(sameGroup, {sherry: {style: ['px']}}, 'finish'));
  const numbered = classifyCask('21 Oloroso Sherry Butts');
  assert.equal(numbered.profiles[0].phase, 'unknown');
  assert.ok(caskMatches(numbered, {sherry: {}}, 'maturation'));
  assert.ok(caskMatches(numbered,
    {sherry: {style: ['oloroso']}}, 'maturation'));
  assert.equal(caskMatches(numbered, {sherry: {}}, 'finish'), false);
  assert.ok(caskMatches(classifyCask('Rum Cask'), {rum: {}}, 'maturation'));
  const unspecified = classifyCask('Sherry Cask');
  assert.equal(unspecified.profiles[0].phase, 'unknown');
  assert.ok(caskMatches(unspecified, {sherry: {}}, 'maturation'));
  assert.equal(caskMatches(unspecified, {sherry: {}}, 'finish'), false);
  assert.equal(caskMatches(unspecified, {port: {}}, 'maturation'), false);
  assert.equal(caskMatches(unspecified,
    {sherry: {style: ['px']}}, 'maturation'), false);
  assert.ok(caskMatches(classifyCask('Sauternes Finish'), {}, 'finish'));
});

test(
  'cask coverage and subtype distance are bounded and do not count unknowns',
  () => {
    const multi = classifyCask('Bourbon and Sherry and Port and Rum');
    assert.equal(caskCoverage([multi]), 1);
    assert.equal(caskCoverage([classifyCask('Rum Finish')]), 0.5);
    assert.equal(caskCoverage([classifyCask('Unknown')]), 0);
    assert.equal(
      caskCoverage([classifyCask('Sauternes'), classifyCask('White Wine')]),
      1
    );
    assert.equal(caskCoverage([multi], new Set(['bourbon'])), 0.75);
    assert.equal(
      caskDistance(classifyCask('Ruby Port'), classifyCask('Tawny Port')),
      0.25
    );
    assert.ok(caskDistance(classifyCask('Colheita Port'),
      classifyCask('Tawny Port')) < 0.25);
    assert.equal(
      caskDistance(
        classifyCask('Bual Madeira'),
        classifyCask('Sercial Madeira')
      ),
      0.25
    );
    assert.equal(
      caskDistance(classifyCask('Sauternes'), classifyCask('White Wine')),
      0
    );
    assert.equal(
      caskDistance(classifyCask('Bual Madeira'), classifyCask('Rum')),
      1
    );
  }
);

test(
  'sherry subtype differences are smaller than Bourbon versus Sherry; unknowns are not a fake zero',
  () => {
    assert.equal(
      caskDistance(classifyCask('PX'), classifyCask('Oloroso')),
      0.25
    );
    assert.equal(caskDistance(classifyCask('PX'), classifyCask('PX')), 0);
    assert.equal(
      caskDistance(classifyCask('Bourbon'), classifyCask('Sherry')),
      1
    );
    assert.equal(caskDistance(classifyCask(''), classifyCask('Bourbon')), null);
    assert.ok(caskDistance(
      classifyCask('Bourbon / Oloroso Finish'),
      classifyCask('Bourbon')
    ) < 1);
  }
);
test(
  'age normalization supports missing values, zero and 15-year saturation',
  () => {
    assert.equal(readAge(''), null);
    assert.equal(readAge(null), null);
    assert.equal(readAge('11'), 11);
    assert.equal(readAge(0), 0);
    assert.equal(ageDistance(10, 16), 0.4);
    assert.equal(ageDistance(10, 40), 1);
    assert.equal(ageDistance(null, 10), null);
    assert.equal(ageClass(null), null);
    assert.equal(ageClass(18), '16-20');
  }
);
test(
  'similar defaults to comparable cask/age groups and explicit preferences affect selection',
  () => {
    assert.deepEqual(plan(sample, {}), ['bourbonA', 'bourbonB', 'bourbonC']);
    assert.deepEqual(
      new Set(plan(
        sample,
        {caskMode: 'specific', caskFilters: {sherry: {style: ['px']}}}
      )),
      new Set(['pxA', 'pxB', 'sherry'])
    );
    assert.deepEqual(
      new Set(plan(
        sample,
        {
          caskMode: 'specific',
          caskFilters: {sherry: {style: ['px']}},
          strictMatches: true,
        }
      )),
      new Set(['pxA', 'pxB'])
    );
    assert.deepEqual(
      new Set(plan(
        sample,
        {ageMode: 'range', ageMin: 27, ageMax: 31, strictMatches: true}
      )),
      new Set(['pxA', 'pxB'])
    );
    assert.deepEqual(
      new Set(plan(sample, {caskMode: 'variety', ageMode: 'variety'})),
      new Set(['pxA', 'wine', 'rum'])
    );
    assert.ok(caskMatches(classifyCask('Pedro Ximenez'),
      {sherry: {style: ['px']}}));
  }
);
test(
  'unavailable or unknown cask and age facts are neutral unless strict constraints are active',
  () => {
    const source = {bottlings: [bottle('unknown', 'oak finish', null), bottle('bourbon', 'bourbon', 10)]};
    assert.equal(plan(source, {count: 2}).length, 2);
    assert.deepEqual(
      plan(
        source,
        {
          count: 2,
          caskMode: 'specific',
          caskFilters: {sherry: {}},
          strictMatches: true,
        }
      ),
      []
    );
    assert.deepEqual(
      plan(
        source,
        {count: 2, ageMode: 'range', ageMin: 12, strictMatches: true}
      ),
      []
    );
    assert.deepEqual(
      flightCandidates(source).find(item => item.bottling.id === 'unknown').age,
      null
    );
    assert.throws(() => plan(source, {caskMode: 'broken'}));
    assert.throws(() => plan(source, {ageMode: 'range', ageMin: 19, ageMax: 12}));
  }
);
test(
  'balanced includes known cask families and discover can prefer families not yet tasted',
  () => {
    const balanced = plan(sample, {style: 'balanced', count: 4});
    const categories = balanced.map(id =>
      Object.keys(classifyCask(sample.bottlings.find(b => b.id === id)
        .caskType).groups)[0]);
    assert.equal(new Set(categories).size, 4);
    const collection = {
      bottlings: [
        bottle('tastedBourbon', 'Bourbon', 11),
        bottle('newBourbon', 'Bourbon', 12, ''),
        bottle('newRum', 'Rum', 12, ''),
      ],
    };
    const selected = plan(
      collection,
      {style: 'discover', count: 1, preferUnfamiliar: false}
    );
    assert.deepEqual(selected, ['newRum']);
  }
);
test(
  'order penalizes avoidable abrupt cask switches when other indicators tie',
  () => {
    const data = {
      bottlings: [
        bottle('bourbon1', 'Bourbon', 12),
        bottle('sherry1', 'PX', 12),
        bottle('bourbon2', 'Bourbon', 12),
        bottle('sherry2', 'PX', 12),
      ],
    };
    const order = orderFlightItems(flightCandidates(data)).map(item =>
      item.bottling.caskType.includes('Bourbon') ? 'bourbon' : 'sherry');
    assert.equal(order.filter((x, i) => i > 0 && x !== order[i - 1]).length, 1);
  }
);


test(
  'strict flight selection combines multiple families, details and phase',
  () => {
    const data = {
      bottlings: [
        bottle('sauternes', 'Sauternes Finish', 12),
        bottle('white', 'White Wine Finish', 12),
        bottle('port', 'Colheita Port Finish', 12),
        bottle('ruby', 'Ruby Port Finish', 12),
        bottle('matured', 'Tawny Port maturation', 12),
        bottle('rum', 'Rum Finish', 12),
      ],
    };
    const criteria = {
      caskMode: 'specific', caskPhase: 'finish',
      caskFilters: {
        wine: {color: ['whiteWine'], style: ['sweetWine']},
        port: {style: ['tawny']},
      }, count: 6, strictMatches: true,
    };
    assert.deepEqual(
      new Set(plan(data, criteria)),
      new Set(['sauternes', 'port'])
    );
    assert.equal(plan(data, {...criteria, strictMatches: false}).length, 6);
    assert.deepEqual(new Set(plan(data, {...criteria, caskFilters: {rum: {}}})),
      new Set(['rum']));
    assert.throws(() => plan(data,
      {...criteria, caskFilters: {rum: {style: ['px']}}}));
    assert.throws(() => plan(data, {...criteria, caskPhase: 'bogus'}));
  }
);

test(
  'balanced automatic strategy prefers different known subtypes in a tie',
  () => {
    const data = {
      bottlings: [bottle('a1', 'Ruby Port', 12),
      bottle('a2', 'Ruby Port', 12), bottle('b', 'Tawny Port', 12)],
    };
    const selected = plan(data, {count: 2, style: 'balanced'});
    assert.ok(selected.includes('b'));
    assert.equal(selected.length, 2);
  }
);

test(
  'ambiguous names and German compound spellings are handled cautiously',
  () => {
    assert.deepEqual(classifyCask('Colheita Madeira').groups, {madeira: 1});
    assert.deepEqual(classifyCask('Non-fortified wine').groups, {wine: 1});
    assert.ok(caskMatches(classifyCask('Port Colheita'),
      {port: {style: ['tawny']}}));
    assert.ok(caskMatches(classifyCask('Weißweinfässer'),
      {wine: {color: ['whiteWine']}}));
    assert.ok(caskMatches(classifyCask('Rumfass'), {rum: {}}));
    assert.ok(caskMatches(classifyCask('Verdelho Madeira'),
      {madeira: {style: ['verdelho']}}));
    assert.equal(
      caskMatches(classifyCask('Verdelho Wine'), {madeira: {}}),
      false
    );
  }
);

test('soft cask preferences reward only the requested maturation phase', () => {
  const data = {
    bottlings: [
      bottle('old', 'Oloroso maturation', 12, '2026-04-01'),
      bottle('finish', 'Oloroso Finish', 12),
    ],
  };
  const criteria = {
    style: 'discover', count: 1, caskMode: 'specific',
    caskFilters: {sherry: {}}, preferUnfamiliar: false,
    strictMatches: false,
  };
  assert.deepEqual(plan(data, {...criteria, caskPhase: 'finish'}), ['finish']);
  assert.deepEqual(plan(data, {...criteria, caskPhase: 'maturation'}), ['old']);
  assert.deepEqual(plan(data, {...criteria, caskPhase: 'any'}), ['old']);
});

test('leading maturation phase extends across coordinated casks only', () => {
  for (const [text, expected] of [
    ['Matured in Bourbon and Sherry Casks',
      [['bourbon', 'maturation', 1], ['sherry', 'maturation', 1]]],
    ['Finished in Port and Madeira Casks',
      [['port', 'finish', 0.5], ['madeira', 'finish', 0.5]]],
    ['Matured in Bourbon, Sherry and Port Casks',
      [['bourbon', 'maturation', 1], ['sherry', 'maturation', 1],
      ['port', 'maturation', 1]]],
    ['Matured in Bourbon and Sherry then finished in Port and Madeira',
      [['bourbon', 'maturation', 1], ['sherry', 'maturation', 1],
      ['port', 'finish', 0.5], ['madeira', 'finish', 0.5]]],
    ['Matured in Bourbon and Sherry then Rum',
      [['bourbon', 'maturation', 1], ['sherry', 'maturation', 1],
      ['rum', 'unknown', 1]]],
    ['Bourbon matured and Sherry',
      [['bourbon', 'maturation', 1], ['sherry', 'unknown', 1]]],
  ]) {
    const result = classifyCask(text);
    assert.deepEqual(result.profiles.map(p => [p.group, p.phase, p.weight]),
      expected, text);
  }
});

test('trailing whisky product names do not create additional casks', () => {
  for (const [text, expected] of [
    ['Rum Cask Finished Whisky', {rum: 0.5}],
    ['Port Cask Finished Whisky', {port: 0.5}],
    ['Bourbon Matured Whisky', {bourbon: 1}],
    ['Whisky Cask', {otherWhisky: 1}],
    ['Rum and Whisky Casks', {rum: 1, otherWhisky: 1}],
    ['Rum Cask and Rye Whiskey Cask', {rum: 1, otherWhisky: 1}],
  ]) assert.deepEqual(classifyCask(text).groups, expected, text);
});

test('adjacent wine modifiers combine on the same cask', () => {
  const selection = {wine: {color: ['redWine'], style: ['sweetWine']}};
  for (const text of ['Sweet Red Wine Cask', 'Red Sweet Wine Cask',
    'Dessert Red Wine Cask']) {
    const result = classifyCask(text);
    assert.deepEqual(result.groups, {wine: 1}, text);
    assert.equal(result.profiles.length, 1, text);
    assert.ok(caskMatches(result, selection), text);
  }
  assert.ok(caskMatches(classifyCask('Sparkling White Wine'),
    {wine: {color: ['whiteWine'], style: ['sparklingWine']}}));
  assert.equal(caskMatches(classifyCask('Red Wine and Sweet Wine'),
    selection), false);
  assert.equal(caskMatches(classifyCask('Tawny Port Wine'), selection), false);
});

test('maturation includes unspecified casks but excludes finishes', () => {
  const data = {bottlings: [
    bottle('plain', 'Sherry Cask', 12),
    bottle('numbered', '21 Oloroso Sherry Butts', 12),
    bottle('aged', 'Sherry maturation', 12),
    bottle('finish', 'Sherry Finish', 12),
    bottle('other', 'Bourbon Cask', 12),
  ]};
  const criteria = {caskMode: 'specific', caskPhase: 'maturation',
    caskFilters: {sherry: {}}, count: 4, strictMatches: true};
  assert.deepEqual(new Set(plan(data, criteria)),
    new Set(['plain', 'numbered', 'aged']));
  assert.deepEqual(plan(data, {...criteria,
    caskFilters: {sherry: {style: ['oloroso']}}}), ['numbered']);
  assert.deepEqual(new Set(plan(data, {...criteria, count: 3,
    strictMatches: false})), new Set(['plain', 'numbered', 'aged']));
  assert.deepEqual(plan(data, {...criteria, caskPhase: 'finish'}), ['finish']);
});
