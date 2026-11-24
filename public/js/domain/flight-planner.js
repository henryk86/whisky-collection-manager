/**
 * Offline and deterministic proposals. The scores are heuristics, not claims
 * about taste.
 */
import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';
import {latestTasting, sortedTastings} from '../../../shared/tasting-records.js';
import {
  classifyCask, caskDistance, readAge, ageDistance, ageClass, caskMatches, ageMatches,
  CASK_GROUPS, SHERRY_SUBTYPES, CASK_MODES, AGE_MODES
} from './flight-casks.js';
export {CASK_GROUPS, SHERRY_SUBTYPES, CASK_MODES, AGE_MODES} from './flight-casks.js';

export const FLIGHT_STYLES =
  Object.freeze(['balanced', 'similar', 'contrast', 'discover']);
export const FLIGHT_AVAILABILITY = Object.freeze(['open', 'all', 'samples']);
export const FLIGHT_FOCUSES =
  Object.freeze(['any', 'smoky', 'peaty', 'fruity', 'winey', 'woody']);
// Broad aroma families are deliberately derived only from assessed radar axes.
const FAMILIES = Object.freeze({
  smoke: ['smoky', 'peaty', 'medicinal'], fruit: ['fruity', 'floral'],
  malt: ['woody', 'cereal'], wine: ['winey'], other: ['feinty', 'sulphury'],
});
/**
 * Checks whether rated applies.
 *
 * @param {*} value Value to process.
 * @return {boolean} Whether the operation matched or succeeded.
 */
const isRated = value => Number.isFinite(value) && value >= 0 && value <= 10;

/**
 * Orders or compares items values.
 *
 * @param {*} a First entry or operand in the calculation.
 * @param {*} b Second entry or operand in the calculation.
 * @return {*} Result computed from the supplied inputs.
 */
const compareItems = (a, b) => a.bottling.name.localeCompare(b.bottling
  .name, 'de') ||
  a.bottling.id.localeCompare(b.bottling.id) || a.bottle.id
    .localeCompare(b.bottle.id);

/**
 * Selects candidate whiskies and their tasting context for a flight.
 *
 * @param {!Object} collection Collection data being processed.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {*} Array of values selected for the caller.
 */
export function flightCandidates(collection, {availability = 'open', bottlingIds = null} = {}) {
  const whitelist = Array.isArray(bottlingIds) ? new Set(bottlingIds) : null;
  return (collection.bottlings || []).flatMap(bottling => {
    if (whitelist && !whitelist.has(bottling.id)) return [];
    const bottles = (bottling.bottles || []).filter(b => b.status !== 'empty' &&
      (availability !== 'open' || b.status === 'open') &&
      (availability !== 'samples' || b.volumeType === 'sample'));
    if (!bottles.length) return [];
    bottles.sort((a, b) => Number(b.status === 'open') - Number(a.status ===
      'open') ||
      Number(b.volumeType === 'sample') - Number(a.volumeType ===
        'sample') || a.id.localeCompare(b.id));
    const latest = latestTasting(bottling);
    const profile = sortedTastings(bottling).find(item =>
      item.flavorProfile)?.flavorProfile || null;
    const assessed = FLAVOR_AXES.filter(axis => isRated(profile?.[axis]));
    const average = assessed.length ? assessed.reduce((sum, axis) => sum +
      profile[axis], 0) / assessed.length : 0;
    const families = Object.entries(FAMILIES).map(([key, axes]) => ({
      key,
      score: Math.max(
        0,
        ...axes.filter(axis => assessed.includes(axis)).map(axis =>
          profile[axis])
      ),
    }));
    families.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    return [{
      bottling, bottle: bottles[0], profile, assessed, intensity: average,
      cask: classifyCask(bottling.caskType), age: readAge(bottling.ageYears),
      family: families[0].score >= 2 ? families[0].key : null,
      lastTasted: latest?.tastedOn || '', rating: latest?.rating ?? null,
    }];
  }).sort(compareItems);
}

/**
 * Filters records according to the profile distance selection rules.
 *
 * @param {*} a First entry or operand in the calculation.
 * @param {*} b Second entry or operand in the calculation.
 * @return {number} Calculated numeric value.
 */
function profileDistance(a, b) {
  const axes = FLAVOR_AXES.filter(axis => isRated(a.profile?.[axis]) &&
    isRated(b.profile?.[axis]));
  // One shared dimension is not sufficient evidence for profile similarity.
  if (axes.length < 2) return null;
  return axes.reduce(
    (sum, axis) => sum + Math.abs(a.profile[axis] - b.profile[axis]),
    0
  ) / axes.length;
}

/**
 * Derives the intensity result from the supplied values.
 *
 * @param {*} item Current item under consideration.
 * @return {*} Result computed from the supplied inputs.
 */
function intensity(item) {
  return (Number(item.bottling.abv) || 40) / 12 + item.intensity +
    (Number(item.profile?.smoky) || 0) / 4 +
    (Number(item.profile?.peaty) || 0) / 4;
}

/**
 * Calculates the novelty numeric value.
 *
 * @param {*} item Current item under consideration.
 * @param {*} today Value used by this operation.
 * @return {number} Calculated numeric value.
 */
function novelty(item, today) {
  const date = Date.parse(item.lastTasted);
  return (item.lastTasted ? 0 : 30) + (item.assessed.length ? 0 : 4) +
    (item.bottle.status === 'open' ? 3 : 0) +
    (item.lastTasted && Number.isFinite(date) ?
      Math.min(10, Math.max(0, (today - date) / 86400000 / 30)) : 0);
}

/**
 * Derives the repeated distilleries result from the supplied values.
 *
 * @param {*} items Entries to process.
 * @return {number} Calculated numeric value.
 */
function repeatedDistilleries(items) {
  const ids = new Set(); let repeated = 0;
  for (const item of items) {
    const own = item.bottling.distilleryIds || (item.bottling.distilleryId ?
      [item.bottling.distilleryId] : []);
    if (own.some(id => ids.has(id))) repeated++;
    for (const id of own) ids.add(id);
  }
  return repeated;
}

/**
 * Orders the intensity gaps records using the configured comparison.
 *
 * @param {*} items Entries to process.
 * @return {*} Entries ordered by the comparison rule.
 */
function intensityGaps(items) {
  const levels = items.map(intensity).sort((a, b) => a - b);
  return levels.slice(1).map((level, i) => level - levels[i]);
}

/**
 * Calculates the transition cost numeric value.
 *
 * @param {*} a First entry or operand in the calculation.
 * @param {*} b Second entry or operand in the calculation.
 * @return {number} Calculated numeric value.
 */
function transitionCost(a, b) {
  const jump = intensity(b) - intensity(a);
  const difference = profileDistance(a, b);
  // Prefer mild-to-intense, moderate steps and smooth neighboring aroma
  // profiles.
  return Math.abs(jump) * 0.35 + Math.max(0, jump - 3) * 1.8 +
    Math.max(0, -jump) * 2.8 + (difference ?? 0) * 0.55 +
    (caskDistance(a.cask, b.cask) ?? 0) * 0.65 +
    (a.age === null || b.age === null ? 0 : Math.min(Math.abs(a.age -
      b.age), 15) * 0.025);
}

/**
 * Exact sequence search for at most six selected bottles (<=720 permutations).
 *
 * @param {!Array<*>} items Items used by this operation.
 * @return {!Array<*>} Resulting list of values.
 */
export function orderFlightItems(items) {
  if (items.length > 6) throw new RangeError('Flight order supports at most six bottles');
  if (items.length < 2) return [...items];
  const ordered = [...items].sort(compareItems);
  const mildest = Math.min(...ordered.map(intensity));
  let best = null, bestCost = Infinity, bestTie = '';
  /**
   * Transforms the entries used by search.
   *
   * @param {*} path Path to the target resource.
   * @param {*} remaining Value used by this operation.
   * @param {*} cost Value used by this operation.
   */
  const search = (path, remaining, cost) => {
    if (cost > bestCost + 1e-8) return;
    if (!remaining.length) {
      const tie = path.map(item => item.bottling.id).join('|');
      if (cost < bestCost - 1e-8 || (Math.abs(cost - bestCost) < 1e-8 &&
        tie < bestTie)) {
        best = [...path]; bestCost = cost; bestTie = tie;
      }
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const nextCost = cost + (path.length ? transitionCost(path.at(-1), item) :
        (intensity(item) - mildest) * 2);
      search(
        [...path, item],
        [...remaining.slice(0, i), ...remaining.slice(i + 1)],
        nextCost
      );
    }
  };
  search([], ordered, 0);
  return best || ordered;
}

/**
 * Score whole sets; multiple starting points and swaps avoid a single greedy
 * seed.
 *
 * @param {*} candidates Candidates used by this operation.
 * @param {number} count Number of items to process.
 * @param {!Object} options3 Destructured options for this operation.
 * @return {!Array<*>} Resulting list of values.
 */
function selectFlight(
  candidates,
  count,
  {style, focus, preferUnfamiliar, today, history,
    caskMode, caskGroup, caskSubtype, ageMode, ageMin, ageMax}
) {
  const distanceCache = new Map();
  /**
   * Orders the dist records using the configured comparison.
   *
   * @param {*} a First entry or operand in the calculation.
   * @param {*} b Second entry or operand in the calculation.
   * @return {*} Entries ordered by the comparison rule.
   */
  const dist = (a, b) => {
    const key = [a.bottling.id, b.bottling.id].sort().join('|');
    if (!distanceCache.has(key)) distanceCache.set(key, profileDistance(a, b));
    return distanceCache.get(key);
  };
  // History includes non-available bottles, but only those with actual
  // tastings.
  const triedCasks = new Set(), triedAges = new Set();
  for (const past of history) {
    for (const group of Object.keys(past.cask?.groups ||
      {})) triedCasks.add(group);
    const bucket = ageClass(past.age);
    if (bucket) triedAges.add(bucket);
  }
  const caskCache = new Map(), ageCache = new Map();
  /**
   * Orders the pair facts records using the configured comparison.
   *
   * @param {*} a First entry or operand in the calculation.
   * @param {*} b Second entry or operand in the calculation.
   * @return {!Object} Structured result assembled from the input data.
   */
  const pairFacts = (a, b) => {
    const key = [a.bottling.id, b.bottling.id].sort().join('|');
    if (!caskCache.has(key)) caskCache.set(key, caskDistance(a.cask, b.cask));
    if (!ageCache.has(key)) ageCache.set(key, ageDistance(a.age, b.age));
    return {profile: dist(a, b), cask: caskCache.get(key), age: ageCache.get(key)};
  };
  // The known parts of 65/25/10 are renormalized; unavailable values do not
  // masquerade as zero distance. Profile-data penalties stay independent.

  /**
   * Filters records according to the signed pair distance selection rules.
   *
   * @param {*} facts Value used by this operation.
   * @param {*} defaultDirection Value used by this operation.
   * @return {number} Calculated numeric value.
   */
  const signedPairDistance = (facts, defaultDirection) => {
    const measured = [
      [
        facts.profile === null ? null : facts.profile / 10,
        0.65,
        defaultDirection,
      ],
      [
        facts.cask,
        0.25,
        caskMode === 'auto' || caskMode === 'specific' ? defaultDirection :
          caskMode === 'similar' ? -1 : 1,
      ],
      [
        facts.age,
        0.10,
        ageMode === 'auto' || ageMode === 'range' ? defaultDirection :
          ageMode === 'similar' ? -1 : 1,
      ],
    ].filter(([distance]) => distance !== null);
    const weight = measured.reduce((total, [, w]) => total + w, 0);
    return weight ? 10 * measured.reduce(
      (total, [distance, w, sign]) => total + distance * w * sign,
      0
    ) / weight : 0;
  };

  /**
   * Derives the pair spread result from the supplied values.
   *
   * @param {*} items Entries to process.
   * @param {*} key Key used to select or group values.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  const pairSpread = (items, key) => {
    const values = [];
    for (let i = 0; i < items.length; i++)for (let j = i + 1; j <
      items.length; j++) {
      const metric = pairFacts(items[i], items[j])[key];
      if (metric !== null) values.push(metric);
    }
    return values;
  };

  /**
   * Aggregates input values for the preference score calculation.
   *
   * @param {*} items Entries to process.
   * @return {number} Calculated numeric value.
   */
  const preferenceScore = items => {
    let result = 0;
    if (caskMode === 'specific' && caskGroup !== 'any') result += items.reduce(
      (sum, item) =>
        sum + (caskMatches(item.cask, caskGroup, 'any') ? 9 : 0) +
        (caskGroup === 'sherry' && caskSubtype !== 'any' &&
          caskMatches(item.cask, caskGroup, caskSubtype) ? 4 : 0),
      0
    );
    if (ageMode === 'range' && (ageMin !== null || ageMax !==
      null)) result += items.reduce(
        (sum, item) =>
          sum + (ageMatches(item.age, ageMin, ageMax) ? 3 : 0),
        0
      );
    if (style !== 'similar' && style !== 'contrast') {
      if (caskMode === 'similar' || caskMode === 'variety') result +=
        pairSpread(items, 'cask')
          .reduce((sum, d) => sum + (caskMode === 'similar' ? -1 : 1) * d * 4,
            0
          );
      if (ageMode === 'similar' || ageMode === 'variety') result +=
        pairSpread(items, 'age')
          .reduce((sum, d) => sum + (ageMode === 'similar' ? -1 : 1) * d * 2,
            0
          );
    }
    return result;
  };
  const noveltyCache = new Map(candidates.map(item =>
    [item, novelty(item, today)]));
  /**
   * Derives the novelty score result from the supplied values.
   *
   * @param {*} item Current item under consideration.
   * @return {*} Result computed from the supplied inputs.
   */
  const noveltyScore = item => noveltyCache.get(item);
  const unfamiliarityCache = new Map();
  /**
   * Selects and transforms the unfamiliarity records.
   *
   * @param {*} item Current item under consideration.
   * @return {*} Entries that meet the selection criteria.
   */
  const unfamiliarity = item => {
    if (unfamiliarityCache.has(item)) return unfamiliarityCache.get(item);
    if (!item.assessed.length) return 0;
    const previous = history.filter(other => other.bottlingId !==
      item.bottling.id)
      .map(other => profileDistance(item, other)).filter(x => x !== null);
    const result = previous.length ? Math.min(...previous) : 0;
    unfamiliarityCache.set(item, result);
    return result;
  };

  /**
   * Selects and transforms the score records.
   *
   * @param {*} items Entries to process.
   * @return {*} Entries that meet the selection criteria.
   */
  const score = items => {
    const profiled = items.filter(item => item.assessed.length >= 2);
    let total = -2 * repeatedDistilleries(items);
    const gaps = intensityGaps(items);
    const largestGap = Math.max(0, ...gaps);
    const distances = [], pairs = []; let missingPairs = 0;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j <
      items.length; j++) {
      const facts = pairFacts(items[i], items[j]); pairs.push(facts);
      if (facts.profile ===
        null) missingPairs++; else distances.push(facts.profile);
    }
    const avg = distances.length ? distances.reduce((sum, x) => sum +
      x, 0) / distances.length : 0;
    const families = new Set(profiled.map(item => item.family).filter(Boolean));
    const caskGroups = new Set(items.flatMap(item => Object.keys(item.cask
      .groups)));
    const ageClasses = new Set(items.map(item => ageClass(item.age))
      .filter(Boolean));
    const preferences = preferenceScore(items);
    if (style === 'balanced') return total + families.size * 13 +
      profiled.length * 4 +
      items.reduce((sum, item) => sum + noveltyScore(item) * 0.08, 0) -
      (distances.length ? Math.abs(avg - 3) * 1.2 : 4) - largestGap * 1.5 -
      missingPairs * 1.5 +
      (caskMode === 'auto' ? caskGroups.size * 4 : 0) +
      (ageMode === 'auto' ? ageClasses.size * 2 : 0) + preferences;
    if (style === 'similar') return total + profiled.length * 8 +
      pairs.reduce(
        (sum, facts) => sum + signedPairDistance(facts, -1) * 3.2,
        0
      ) -
      missingPairs * 14 + (focus === 'any' ? 0 : items.reduce(
        (sum, item) => sum +
          (isRated(item.profile?.[focus]) ? item.profile[focus] * 1.9 : -12),
        0
      )) + preferences;
    if (style === 'contrast') return total + profiled.length * 8 +
      pairs.reduce(
        (sum, facts) => sum + signedPairDistance(facts, 1) * 2.5,
        0
      ) + families.size * 3 - missingPairs * 14 -
      Math.max(0, largestGap - 3) * 3 + preferences;
    const novelCasks = new Set([...caskGroups].filter(group =>
      !triedCasks.has(group)));
    const novelAges = new Set([...ageClasses].filter(age =>
      !triedAges.has(age)));
    return total + items.reduce((sum, item) => sum + noveltyScore(item) +
      (preferUnfamiliar ? unfamiliarity(item) * 2 : 0), 0) + families.size * 2 +
      (caskMode === 'auto' ? novelCasks.size * 5 : 0) +
      (ageMode === 'auto' ? novelAges.size * 3 : 0) + preferences;
  };

  /**
   * Derives the rank result from the supplied values.
   *
   * @param {*} a First entry or operand in the calculation.
   * @param {*} b Second entry or operand in the calculation.
   * @return {*} Result computed from the supplied inputs.
   */
  const rank = (a, b) => score([b]) - score([a]) || compareItems(a, b);
  // Include representatives of every aroma family even when their individual
  // rank is low.
  const ranked = [...candidates].sort(rank);
  const shortlist = new Set(ranked.slice(0, 48));
  for (const family of Object.keys(FAMILIES)) {
    for (const item of ranked.filter(item => item.family === family)
      .slice(0, 8)) shortlist.add(item);
  }
  // Keep representatives of cask categories and age bands in the candidate
  // pool.
  for (const group of CASK_GROUPS) for (const item of ranked.filter(x =>
    x.cask.groups[group]).slice(0, 6)) shortlist.add(item);
  for (const bucket of ['0-5', '6-10', '11-15', '16-20', '21+']) {
    for (const item of ranked.filter(x => ageClass(x.age) === bucket)
      .slice(0, 4)) shortlist.add(item);
  }
  if (style === 'contrast' || style === 'balanced') {
    // Do not lose flavor extremes merely because alphabetical ties ranked them
    // late.
    for (const axis of FLAVOR_AXES) {
      const measured = candidates.filter(item => isRated(item.profile?.[axis]));
      measured.sort((a, b) => b.profile[axis] - a.profile[axis] ||
        compareItems(a, b));
      for (const item of measured.slice(0, 3)) shortlist.add(item);
      for (const item of measured.slice(-3)) shortlist.add(item);
    }
  }
  const pool = [...shortlist].sort(rank);
  const seeds = pool.slice(0, 6);
  for (const family of Object.keys(FAMILIES)) {
    const first = pool.find(item => item.family === family);
    if (first && !seeds.includes(first)) seeds.push(first);
  }
  for (const group of CASK_GROUPS) {
    const first = pool.find(item => item.cask.groups[group]);
    if (first && !seeds.includes(first)) seeds.push(first);
  }
  let best = null, bestScore = -Infinity, bestTie = '';
  for (const seed of seeds) {
    let chosen = [seed];
    while (chosen.length < count) {
      const next = pool.filter(item => !chosen.includes(item)).sort((a, b) =>
        score([...chosen, b]) - score([...chosen, a]) || compareItems(a, b))[0];
      if (!next) break;
      chosen.push(next);
    }
    // One-for-one improvements optimize the completed set, not just additions.
    for (let pass = 0; pass < 2; pass++) {
      let improved = false;
      for (let i = 0; i < chosen.length; i++) {
        const previous = score(chosen);
        const replacement = pool.filter(item => !chosen.includes(item))
          .sort((a, b) =>
            score([...chosen.slice(0, i), b, ...chosen.slice(i + 1)]) -
            score([...chosen.slice(0, i), a, ...chosen.slice(i + 1)]) ||
            compareItems(a, b))[0];
        if (replacement &&
          score([...chosen.slice(0, i), replacement, ...chosen.slice(i +
            1)]) > previous + 1e-8) {
          chosen[i] = replacement; improved = true;
        }
      }
      if (!improved) break;
    }
    const value = score(chosen);
    const tie = chosen.map(item => item.bottling.id).sort().join('|');
    if (value > bestScore + 1e-8 || (Math.abs(value - bestScore) < 1e-8 &&
      (!best || tie < bestTie))) {
      best = chosen; bestScore = value; bestTie = tie;
    }
  }
  return best || [];
}

/**
 * Stable physical references and evidence-based reasons; never infer
 * unrecorded flavors.
 *
 * @param {!Object} collection Collection data being processed.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {!Array<!Object>} Resulting list of values.
 */
export function suggestFlight(
  collection,
  {
    style = 'balanced',
    count = 5,
    availability = 'open',
    bottlingIds = null,
    focus = 'any',
    preferUnfamiliar = true,
    today = Date.now(),
    caskMode = 'auto',
    caskGroup = 'any',
    caskSubtype = 'any',
    ageMode = 'auto',
    ageMin = null,
    ageMax = null,
    strictMatches = false
  } = {}
) {
  if (!FLIGHT_STYLES.includes(style) ||
    !FLIGHT_AVAILABILITY.includes(availability) ||
    !FLIGHT_FOCUSES.includes(focus) || typeof preferUnfamiliar !== 'boolean' ||
    !CASK_MODES.includes(caskMode) || !['any', ...CASK_GROUPS]
      .includes(caskGroup) ||
    !['any', ...SHERRY_SUBTYPES].includes(caskSubtype) ||
    !AGE_MODES.includes(ageMode) ||
    typeof strictMatches !== 'boolean' ||
    (ageMin !== null && (!Number.isInteger(ageMin) || ageMin < 0 || ageMin >
      200)) ||
    (ageMax !== null && (!Number.isInteger(ageMax) || ageMax < 0 || ageMax >
      200)) ||
    (ageMin !== null && ageMax !== null && ageMin > ageMax) ||
    !Number.isFinite(today) || !Number.isInteger(count) || count < 1 ||
    count > 6)
    throw new Error('Invalid flight request');
  let candidates = flightCandidates(collection, {availability, bottlingIds});
  if (strictMatches) candidates = candidates.filter(item =>
    (caskMode !== 'specific' || caskGroup === 'any' ||
      caskMatches(item.cask, caskGroup, caskSubtype)) &&
    (ageMode !== 'range' || (ageMin === null && ageMax === null) ||
      ageMatches(item.age, ageMin, ageMax)));
  if (!candidates.length) return [];
  const history = style === 'discover' ? [
    ...(collection.bottlings || []).map(b => ({
      bottlingId: b.id,
      profile: sortedTastings(b).find(record =>
        record.flavorProfile)?.flavorProfile || null,
      age: readAge(b.ageYears),
      cask: classifyCask(b.caskType),
      tasted: Boolean(b.tastings?.length),
    })),
    ...(collection.externalTastings || []).map(record => ({
      bottlingId: null,
      profile: record.flavorProfile || null,
      age: readAge(record.bottling?.ageYears),
      cask: classifyCask(record.bottling?.caskType),
      tasted: true,
    })),
  ].filter(item => item.tasted) : [];
  const picked = selectFlight(candidates, Math.min(count, candidates.length), {
    style, focus, preferUnfamiliar, today, history,
    caskMode, caskGroup, caskSubtype, ageMode, ageMin, ageMax,
  });
  return orderFlightItems(picked).map(item => ({
    bottlingId: item.bottling.id, bottleId: item.bottle.id,
    reason: !item.assessed.length ? 'noProfile' : style === 'discover' &&
      !item.lastTasted ? 'untried'
      : style === 'contrast' ? 'contrast' : style === 'similar' ?
        'similar' : 'intensity',
  }));
}
