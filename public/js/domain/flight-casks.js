/**
 * Matches a wine modifier independently of other adjacent wine modifiers.
 * @param {string} modifier English adjective alternatives.
 * @param {!RegExp} compound Equivalent German compound or standalone term.
 * @return {!RegExp} Non-overlapping feature matcher.
 */
function wineModifier(modifier, compound) {
  const adjectives = 'red|white|rose|sweet|dessert|sparkling';
  return new RegExp(`\\b(?:(?:${modifier})(?=\\s+(?:(?:${adjectives})` + `\\s+)*wine\\b)|${compound.source})\\b`, 'g');
}

/**
 * Declarative vocabulary for interpreting free-text cask descriptions.
 * Dimensions are scoped to one identified cask; stored text is never changed.
 * The first matching definition owns overlapping generic text (e.g. Port Wine).
 */
const DEFINITIONS = {
  bourbon: {pattern: /\bbourbon(?:\s+whisk(?:e)?y|fass(?:er)?)?\b/g},
  sherry: {
    pattern: /\bsherry(?:\s+wine|fass(?:er)?)?\b/g,
    dimensions: {
      style: {
        px: {pattern: /\b(?:px|p\.?\s*x\.?|pedro\s+ximenez)\b/g},
        oloroso: {pattern: /\boloross?o\b/g},
        fino: {pattern: /\bfino\b/g},
        amontillado: {pattern: /\bamontillado\b/g},
        paloCortado: {pattern: /\bpalo\s+cortado\b/g},
        manzanilla: {pattern: /\bmanzanilla\b/g},
        cream: {pattern: /\b(?:cream\s+sherry|sherry\s+cream)\b/g},
        medium: {pattern: /\b(?:medium\s+sherry|sherry\s+medium)\b/g},
        moscatel: {pattern: /\b(?:moscatel\s+sherry|sherry\s+moscatel)\b/g},
      },
    },
  },
  port: {
    pattern: /\b(?:port(?:\s+wine)?|portwein(?:fass(?:er)?)?)\b/g,
    dimensions: {
      style: {
        ruby: {pattern: /\bruby(?:\s+port(?:wein)?)?\b/g},
        tawny: {pattern: /\btawny(?:\s+port(?:wein)?)?\b/g},
        whitePort: {pattern: /\b(?:white\s+port(?:wein)?|weisser\s+portwein)\b/g, },
        rosePort: {pattern: /\b(?:rose\s+port(?:wein)?|pink\s+port)\b/g},
        vintagePort: {
          pattern: /\bvintage\s+port(?:wein)?\b/g,
          implies: {style: ['ruby']},
        },
        lbv: {
          pattern: /\b(?:lbv|late\s+bottled\s+vintage)(?:\s+port)?\b/g,
          implies: {style: ['ruby']},
        },
        colheita: {
          pattern: /\bcolheita\b/g, context: /\bport(?:wein)?\b/,
          implies: {style: ['tawny']},
        },
      },
    },
  },
  madeira: {
    pattern: /\bmadeira(?:\s+wine|fass(?:er)?)?\b/g,
    dimensions: {
      style: {
        sercial: {pattern: /\bsercial\b/g},
        verdelho: {
          pattern: /\bverdelho\b/g, context: /\bmadeira(?:fass(?:er)?)?\b/,
        },
        bual: {pattern: /\b(?:bual|boal)\b/g},
        malvasia: {
          pattern: /\b(?:malmsey|malvasia)\b/g,
          context: /\b(?:madeira(?:fass(?:er)?)?|malmsey)\b/,
        },
      },
    },
  },
  wine: {
    pattern: /\b(?:wine|wein(?:fass(?:er)?|barrique)?)\b/g,
    dimensions: {
      color: {
        redWine: {pattern: wineModifier('red', /rotwein(?:fass(?:er)?|barrique)?/), },
        whiteWine: {pattern: wineModifier('white', /weisswein(?:fass(?:er)?|barrique)?/), },
        roseWine: {pattern: wineModifier('rose', /rosewein(?:fass(?:er)?|barrique)?/), },
      },
      style: {
        sweetWine: {pattern: wineModifier('sweet|dessert', /susswein(?:fass(?:er)?)?/), },
        sparklingWine: {pattern: wineModifier('sparkling', /schaumwein(?:fass(?:er)?)?|sekt/), },
      },
      designation: {
        bordeaux: {pattern: /\bbordeaux\b/g},
        burgundy: {pattern: /\b(?:burgundy|burgund)\b/g},
        rioja: {pattern: /\brioja\b/g},
        amarone: {
          pattern: /\bamarone\b/g, implies: {color: ['redWine']},
        },
        barolo: {pattern: /\bbarolo\b/g, implies: {color: ['redWine']}},
        sauternes: {
          pattern: /\bsauternes\b/g,
          implies: {color: ['whiteWine'], style: ['sweetWine']},
        },
        tokajiAszu: {
          pattern: /\btokaj(?:i)?\s+aszu\b/g,
          implies: {color: ['whiteWine'], style: ['sweetWine']},
        },
        iceWine: {
          pattern: /\b(?:ice\s*wine|eiswein)\b/g,
          implies: {style: ['sweetWine']},
        },
        champagne: {
          pattern: /\bchampagne\b/g, implies: {style: ['sparklingWine']},
        },
      },
      grape: {
        chardonnay: {pattern: /\bchardonnay\b/g},
        riesling: {pattern: /\briesling\b/g},
      },
    },
  },
  fortifiedWine: {
    pattern: new RegExp([/(?<!non[- ])\bfortified\s+wine\b/, /\b(?:aufgespritzter|verstarkter)\s+wein\b/,].map(pattern => pattern.source).join('|'), 'g'),
    dimensions: {
      style: {
        marsala: {pattern: /\bmarsala(?:\s+wine)?\b/g},
        malaga: {pattern: /\bmalaga(?:\s+wine)?\b/g},
        banyuls: {pattern: /\bbanyuls(?:\s+wine)?\b/g},
        rivesaltes: {pattern: /\brivesaltes(?:\s+wine)?\b/g},
      },
    },
  },
  rum: {pattern: /\b(?:rum|rhum|ron)(?:fass(?:er)?)?\b/g},
  otherWhisky: {
    pattern: /\b(?:whisky|whiskey|whiskies|whiskeys)\b/g,
    dimensions: {
      style: {
        scotch: {pattern: /\bscotch(?:\s+whisky)?\b/g},
        irishWhiskey: {pattern: /\birish\s+whisk(?:e)?y\b/g},
        rye: {pattern: /\brye(?:\s+whisk(?:e)?y)?\b/g},
        tennessee: {pattern: /\btennessee\s+whisk(?:e)?y\b/g},
      },
    },
  },
  brandy: {
    pattern: /\bbrandy\b/g,
    dimensions: {
      style: {
        cognac: {pattern: /\bcognac\b/g},
        armagnac: {pattern: /\barmagnac\b/g},
      },
    },
  },
  otherSpirit: {
    dimensions: {
      style: {
        calvados: {pattern: /\bcalvados\b/g},
        tequila: {pattern: /\btequila\b/g},
        mezcal: {pattern: /\bmezcal\b/g},
        gin: {pattern: /\bgin\b/g},
      },
    },
  },
  beer: {
    pattern: /\b(?:beer|bier)(?:fass(?:er)?)?\b/g,
    dimensions: {
      style: {
        stout: {pattern: /\bstout\b/g},
        porter: {pattern: /\bporter\b/g},
        ipa: {pattern: /\b(?:ipa|india\s+pale\s+ale)\b/g},
        ale: {pattern: /\bale\b/g},
      },
    },
  },
  virginOak: {pattern: /\b(?:(?:virgin|new|unused) oak|(?:neue|unbelegte) eiche)\b/g, },
  other: {pattern: /\b(?:cider|sake|mead|met|apfelwein|obstwein)\b/g},
  unknown: {},
};

export const CASK_GROUPS = Object.freeze(Object.keys(DEFINITIONS));
export const CASK_DIMENSIONS = Object.freeze(Object.fromEntries(
  Object.entries(DEFINITIONS).map(([group, definition]) => [group,
    Object.freeze(Object.fromEntries(Object.entries(definition.dimensions || {}).map(([dimension, values]) =>
      [dimension, Object.freeze(Object.keys(values))])))])
));
export const CASK_PHASES = Object.freeze(['any', 'maturation', 'finish']);
export const CASK_MODES = Object.freeze(['auto', 'similar', 'variety', 'specific']);
export const AGE_MODES = Object.freeze(['auto', 'similar', 'variety', 'range']);

/**
 * Normalizes accents and casing without modifying the source data.
 * @param {*} text Free-text cask description.
 * @return {string} Searchable description.
 */
const normalize = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/\s+/g, ' ').toLowerCase();

/**
 * Retains the strongest known weight instead of counting duplicate mentions.
 * @param {!Object<string, number>} map Accumulated weights.
 * @param {string} key Feature identifier.
 * @param {number} weight Relevance of the cask phase.
 */
const add = (map, key, weight) => {map[key] = Math.max(map[key] || 0, weight);};

/**
 * Finds matches, prioritizing explicit styles over overlapping generic words.
 * @param {string} clause One segment of the description.
 * @return {!Array<!Object>} Recognized mentions with their positions.
 */
function mentions(clause) {
  const result = [];
  for (const [group, definition] of Object.entries(DEFINITIONS)) {
    const dimensions = Object.entries(definition.dimensions || {});
    for (const [dimension, values] of dimensions) {
      for (const [value, rule] of Object.entries(values)) {
        if (rule.context && !rule.context.test(clause)) continue;
        for (const match of clause.matchAll(rule.pattern)) result.push({
          group, dimension, value, implies: rule.implies,
          start: match.index, end: match.index + match[0].length,
        });
      }
    }
    if (definition.pattern) {
      for (const match of clause.matchAll(definition.pattern)) result.push({
        group, start: match.index, end: match.index + match[0].length,
      });
    }
  }
  result.sort((a, b) => Number(Boolean(b.value)) - Number(Boolean(a.value)) || (b.end - b.start) - (a.end - a.start));
  const selected = [];
  for (const item of result) {
    if (selected.some(other => item.start < other.end && item.end > other.start))
      continue;
    selected.push(item);
  }
  // A trailing product noun after a maturation verb is not a cask.
  // Generic beverage words immediately following a specific family are not
  // separate casks, even when their own match does not overlap.
  return selected.filter(item => item.value || !selected.some(other =>
    item.group === 'otherWhisky' && other.end <= item.start &&
    /\b(?:finish(?:ed|ing)?|matured|aged)\s*$/.test(clause.slice(other.end, item.start)) &&
    /^\s*$/.test(clause.slice(item.end)))).filter(item =>
      item.value || !selected.some(other =>
        other.group !== item.group && other.end <= item.start && /^\s*$/.test(clause.slice(other.end, item.start)) &&
        (item.group === 'wine' || item.group === 'otherWhisky' || item.group === 'brandy'))).sort((a, b) => a.start - b.start);
}

/**
 * Separates adjacent recognized casks even if punctuation is missing.
 * A new family or an intervening vessel noun marks a separate cask.
 * @param {string} clause One part of a cask description.
 * @return {!Array<!Object>} Segments with their own phase and mentions.
 */
function caskSegments(clause) {
  const found = mentions(clause), segments = [];
  let start = 0, current = [];
  for (const item of found) {
    const previous = current.at(-1);
    if (previous && (item.group !== previous.group ||
      /\b(?:casks?|barrels?|butts?|hogsheads?|barriques?|fass|fasser)\b/.test(clause.slice(previous.end, item.start)))) {
      segments.push({
        text: clause.slice(start, item.start), items: current, start,
      });
      current = [];
      start = item.start;
    }
    current.push(item);
  }
  if (current.length) {
    segments.push({text: clause.slice(start), items: current, start});
  }
  return segments;
}

/**
 * Classifies independently described casks, retaining known phase and features.
 * Unqualified casks have weight 1 but an unknown phase, not assumed full
 * ageing.
 * @param {*} text Free-text cask description.
 * @return {{groups: !Object, profiles: !Array<!Object>}} Classification.
 */
export function classifyCask(text) {
  /** @type {Object<string, number>} */
  const groups = {};
  const profiles = [];
  const separator = new RegExp('(' + [
    /[,;/+&]/,
    /\b(?:and|und|then|danach|anschliessend|followed by|with|mit)\b/,
    /(?=\b(?:finish(?:ed|ing)?|nachgereift|nachreifung) (?:in|im|auf)\b)/,
  ].map(pattern => pattern.source).join('|') + ')');
  const clauses = normalize(text).split(separator);
  const finish = /\b(?:finish(?:ed|ing)?|nachreifung|nachgereift)\b/;
  const maturation = /\b(?:matur(?:ed|ation)|aged|(?:voll|haupt)?reifung|gereift)\b/;
  // Only a leading phase can govern subsequent coordinated casks. A
  // sequential or otherwise ambiguous separator ends that scope.
  let sharedPhase = 'unknown';
  for (let i = 0; i < clauses.length; i += 2) {
    const clause = clauses[i];
    if (i && !/^(?:,|&|and|und)$/.test(clauses[i - 1])) {
      sharedPhase = 'unknown';
    }
    for (const segment of caskSegments(clause)) {
      const explicit = finish.test(segment.text) ? 'finish' : maturation.test(segment.text) ? 'maturation' : 'unknown';
      const prefix = clause.slice(segment.start, segment.items[0].start);
      if (explicit !== 'unknown') {
        sharedPhase = finish.test(prefix) || maturation.test(prefix) ? explicit : 'unknown';
      }
      const phase = explicit === 'unknown' ? sharedPhase : explicit;
      const weight = phase === 'finish' ? 0.5 : 1;
      const group = segment.items[0].group, features = {};
      for (const item of segment.items) {
        if (!item.value) continue;
        (features[item.dimension] ||= new Set()).add(item.value);
        for (const [dimension, values] of Object.entries(item.implies || {})) {
          for (const value of values) (features[dimension] ||= new Set()).add(value);
        }
      }
      add(groups, group, weight);
      profiles.push({
        group, phase, weight, features: Object.fromEntries(Object.entries(features).map(([key, values]) => [key, [...values]])),
      });
    }
  }
  return {groups, profiles};
}

/**
 * Computes weighted Jaccard distance for two known feature sets.
 * @param {!Object<string, number>} a First set.
 * @param {!Object<string, number>} b Second set.
 * @return {?number} Distance, or null when either set is unknown.
 */
function jaccard(a, b) {
  if (!Object.keys(a).length || !Object.keys(b).length) return null;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let intersection = 0, union = 0;
  for (const key of keys) {
    intersection += Math.min(a[key] || 0, b[key] || 0);
    union += Math.max(a[key] || 0, b[key] || 0);
  }
  return union ? 1 - intersection / union : null;
}

/**
 * Collects known features for a group and dimension, counting each only once.
 * @param {!Object} profile Classified cask description.
 * @param {string} group Beverage family.
 * @param {string} dimension Feature dimension.
 * @return {!Object<string, number>} Weighted feature set.
 */
function featureWeights(profile, group, dimension) {
  /** @type {Object<string, number>} */
  const weights = {};
  for (const entry of profile.profiles) {
    if (entry.group !== group) continue;
    for (const value of entry.features[dimension] || [])
      add(weights, value, entry.weight);
  }
  return weights;
}

/**
 * Main categories dominate; comparable subtype dimensions refine the remaining
 * distance by at most 25%. Unknown dimensions do not create artificial variety.
 * @param {!Object} a First classification.
 * @param {!Object} b Second classification.
 * @return {{distance: ?number, detail: ?number}} Combined distance and the
 *     bounded subtype contribution (null without comparable details).
 */
export function caskComparison(a, b) {
  const family = jaccard(a?.groups || {}, b?.groups || {});
  if (family === null || family === 1) return {distance: family, detail: null};
  const details = [];
  for (const group of Object.keys(a.groups)) {
    if (!b.groups[group]) continue;
    for (const dimension of Object.keys(CASK_DIMENSIONS[group] || {})) {
      const distance = jaccard(featureWeights(a, group, dimension), featureWeights(b, group, dimension));
      if (distance !== null) details.push(distance);
    }
  }
  const detail = details.length ? (1 - family) * 0.25 * details.reduce((sum, value) => sum + value, 0) / details.length : null;
  return {distance: family + (detail ?? 0), detail};
}

/**
 * Measures the combined cask distance for selection and ordering.
 * @param {!Object} a First classification.
 * @param {!Object} b Second classification.
 * @return {?number} Distance 0..1 or null when unknown.
 */
export function caskDistance(a, b) {
  return caskComparison(a, b).distance;
}

/**
 * Computes bounded category coverage. Each bottle contributes at most one
 * unit spread across known casks, and each category is capped at one unit.
 * @param {!Array<!Object>} profiles Classified bottlings.
 * @param {!Set<string>=} excluded Categories already known from history.
 * @return {number} Weighted coverage, at most the number of bottlings.
 */
export function caskCoverage(profiles, excluded = new Set()) {
  const coverage = {};
  for (const profile of profiles) {
    const weights = Object.entries(profile.groups);
    const total = Math.max(1, weights.reduce((sum, [, weight]) => sum + weight, 0));
    for (const [group, weight] of weights) {
      if (excluded.has(group)) continue;
      coverage[group] = Math.min(1, (coverage[group] || 0) + weight / total);
    }
  }
  return Object.values(coverage).reduce((sum, weight) => sum + weight, 0);
}

/**
 * Validates the category-scoped filter, including dimension and value IDs.
 * @param {*} filters Selected categories and their feature constraints.
 * @return {boolean} Whether the selection is valid.
 */
export function validCaskFilters(filters) {
  return filters !== null && typeof filters === 'object' && !Array.isArray(filters) && Object.entries(filters).every(([group, dimensions]) =>
    CASK_GROUPS.includes(group) && dimensions !== null && typeof dimensions === 'object' && !Array.isArray(dimensions) &&
    Object.entries(dimensions).every(([dimension, values]) =>
      Array.isArray(values) && values.length > 0 && values.every(value =>
        Object.hasOwn(CASK_DIMENSIONS[group], dimension) && CASK_DIMENSIONS[group][dimension].includes(value))));
}

/**
 * Categories and values within a dimension are OR; different dimensions and
 * phase must match the very same cask entry. Unspecified phases qualify
 * for maturation but never for finish. Unknown is not a known family.
 * @param {!Object} profile Classified cask description.
 * @param {!Object} filters Selected categories and feature constraints.
 * @param {string=} phase Optional maturation phase preference.
 * @return {boolean} Whether the selected constraints match.
 */
export function caskMatches(profile, filters, phase = 'any') {
  const groups = Object.keys(filters);
  if (!groups.length && phase === 'any') return true;
  if (groups.includes('unknown') && phase === 'any' && !Object.keys(profile.groups).length) return true;
  return profile.profiles.some(entry =>
    (!groups.length || Object.hasOwn(filters, entry.group)) &&
    (phase === 'any' || entry.phase === phase || (phase === 'maturation' && entry.phase === 'unknown')) &&
    Object.entries(filters[entry.group] || {}).every(([dimension, values]) =>
      values.some(value => entry.features[dimension]?.includes(value))));
}

/**
 * Parses age for flight casks.
 *
 * @param {*} value Input value to process.
 * @return {?number} Calculated numeric result.
 */
export function readAge(value) {
  if (value === null || value === undefined || value === '') return null;
  const age = Number(value);
  return Number.isFinite(age) && age >= 0 && age <= 200 ? age : null;
}

/**
 * Measures the difference between two stated whisky ages.
 *
 * @param {*} a First value to compare.
 * @param {*} b Second value to compare.
 * @return {?number} Calculated numeric result.
 */
export const ageDistance = (a, b) => a === null || b === null ? null : Math.min(Math.abs(a - b) / 15, 1);

/**
 * Groups a whisky age into the flight-planning age bands.
 *
 * @param {*} age Age in years, or a value to validate.
 * @return {?string} Age-band identifier from 0–5 through 21+, or null for unknown age.
 */
export const ageClass = age => age === null ? null : age <= 5 ? '0-5' : age <= 10 ? '6-10' : age <= 15 ? '11-15' : age <= 20 ? '16-20' : '21+';

/**
 * Checks whether a whisky age falls within the chosen bounds.
 *
 * @param {*} age Age in years, or a value to validate.
 * @param {*} min Minimum permitted value.
 * @param {*} max Maximum permitted value.
 * @return {boolean} Whether the condition is satisfied.
 */
export const ageMatches = (age, min, max) => age !== null && (min === null || age >= min) && (max === null || age <= max);
