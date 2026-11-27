import {bottlingName} from '../../../shared/bottling-name.js';
/**
 * Offline and deterministic proposals. The scores are heuristics, not claims
 * about taste.
 */
import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';
import {latestTasting, sortedTastings}
  from '../../../shared/tasting-records.js';
import {
  classifyCask, caskDistance, readAge, ageDistance, ageClass, caskMatches,
  ageMatches,
  CASK_GROUPS, CASK_MODES, AGE_MODES, CASK_PHASES, validCaskFilters,
  caskComparison, caskCoverage,
} from './flight-casks.js';
export {CASK_MODES, AGE_MODES} from './flight-casks.js';

export const FLIGHT_STYLES = Object.freeze(['balanced', 'similar', 'contrast', 'discover']);
export const FLIGHT_AVAILABILITY = Object.freeze(['open', 'all', 'samples']);
export const FLIGHT_FOCUSES = Object.freeze(['any', 'smoky', 'peaty', 'fruity', 'winey', 'woody']);
// Broad aroma families are deliberately derived only from assessed radar axes.
const FAMILIES = Object.freeze({
  smoke: ['smoky', 'peaty', 'medicinal'], fruit: ['fruity', 'floral'],
  malt: ['woody', 'cereal'], wine: ['winey'], other: ['feinty', 'sulphury'],
});
/**
 * Checks whether a sensory axis contains a finite assessed score from zero
 * through ten.
 *
 * @param {*} value Stored axis value, including missing or invalid data.
 * @return {boolean} True for a valid assessed score.
 */
const isRated = value => Number.isFinite(value) && value >= 0 && value <= 10;

/**
 * Provides deterministic candidate ordering by German bottling name, then
 * bottling and physical bottle IDs.
 *
 * @param {!Object} a First flight candidate.
 * @param {!Object} b Second flight candidate.
 * @return {number} Negative, zero or positive comparison result.
 */
const compareItems = (a, b) => bottlingName(a.bottling).localeCompare(bottlingName(b.bottling), 'de') || a.bottling.id.localeCompare(b.bottling.id) || a.bottle.id.localeCompare(b.bottle.id);

/**
 * Selects at most one available physical bottle per bottling and derives
 * tasting evidence from recorded profiles. Prefers open bottles and samples and
 * respects the optional collection scope.
 *
 * @param {!Object} collection Collection containing bottlings and their
 *     bottles.
 * @param {!Object=} options2 Availability mode and optional bottling ID
 *     whitelist.
 * @return {!Array<!Object>} Candidates with physical bottle, profile, age, cask
 *     and tasting history fields in deterministic order.
 */
export function flightCandidates(collection, {availability = 'open',
  bottlingIds = null} = {}) {
  const whitelist = Array.isArray(bottlingIds) ? new Set(bottlingIds) : null;
  return (collection.bottlings || []).flatMap(bottling => {
    if (whitelist && !whitelist.has(bottling.id)) return [];
    const bottles = (bottling.bottles || []).filter(b => b.status !== 'empty' && (availability !== 'open' || b.status === 'open') &&
      (availability !== 'samples' || b.volumeType === 'sample'));
    if (!bottles.length) return [];
    bottles.sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') ||
      Number(b.volumeType === 'sample') - Number(a.volumeType === 'sample') || a.id.localeCompare(b.id));
    const latest = latestTasting(bottling);
    const profile = sortedTastings(bottling).find(item => item.flavorProfile)?.flavorProfile || null;
    const assessed = FLAVOR_AXES.filter(axis => isRated(profile?.[axis]));
    const average = assessed.length ? assessed.reduce((sum, axis) => sum + profile[axis], 0) / assessed.length : 0;
    const families = Object.entries(FAMILIES).map(([key, axes]) => ({
      key,
      score: Math.max(0, ...axes.filter(axis => assessed.includes(axis)).map(axis => profile[axis])),
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
 * Measures mean absolute difference between jointly assessed sensory axes.
 * Requires at least two common axes to avoid unsupported comparisons.
 *
 * @param {!Object} a First candidate or recorded profile.
 * @param {!Object} b Second candidate or recorded profile.
 * @return {?number} Mean difference from zero to ten, or null without enough
 *     shared axes.
 */
function profileDistance(a, b) {
  const axes = FLAVOR_AXES.filter(axis => isRated(a.profile?.[axis]) && isRated(b.profile?.[axis]));
  // One shared dimension is not sufficient evidence for profile similarity.
  if (axes.length < 2) return null;
  return axes.reduce((sum, axis) => sum + Math.abs(a.profile[axis] - b.profile[axis]), 0) / axes.length;
}

/**
 * Estimates ordering intensity from ABV, assessed profile average, smokiness
 * and peatiness. Missing ABV falls back to 40 percent.
 *
 * @param {!Object} item Flight candidate with bottling and profile.
 * @return {number} Heuristic intensity used for ordering, not a sensory rating.
 */
function intensity(item) {
  return (Number(item.bottling.abv) || 40) / 12 + item.intensity + (Number(item.profile?.smoky) || 0) / 4 +
    (Number(item.profile?.peaty) || 0) / 4;
}

/**
 * Rewards untasted bottlings, missing profiles, open bottles and longer time
 * since the latest recorded tasting.
 *
 * @param {!Object} item Flight candidate with tasting history.
 * @param {number} today Reference time in milliseconds since the Unix epoch.
 * @return {number} Heuristic novelty contribution.
 */
function novelty(item, today) {
  const date = Date.parse(item.lastTasted);
  return (item.lastTasted ? 0 : 30) + (item.assessed.length ? 0 : 4) + (item.bottle.status === 'open' ? 3 : 0) +
    (item.lastTasted && Number.isFinite(date) ? Math.min(10, Math.max(0, (today - date) / 86400000 / 30)) : 0);
}

/**
 * Counts candidates that share at least one distillery with an earlier
 * candidate in the set.
 *
 * @param {!Array<!Object>} items Selected flight candidates.
 * @return {number} Count of candidates with a repeated distillery.
 */
function repeatedDistilleries(items) {
  const ids = new Set(); let repeated = 0;
  for (const item of items) {
    const own = item.bottling.distilleryIds || (item.bottling.distilleryId ? [item.bottling.distilleryId] : []);
    if (own.some(id => ids.has(id))) repeated++;
    for (const id of own) ids.add(id);
  }
  return repeated;
}

/**
 * Computes adjacent differences between sorted candidate intensity estimates.
 *
 * @param {!Array<!Object>} items Selected flight candidates.
 * @return {!Array<number>} Nonnegative gaps between consecutive intensities.
 */
function intensityGaps(items) {
  const levels = items.map(intensity).sort((a, b) => a - b);
  return levels.slice(1).map((level, i) => level - levels[i]);
}

/**
 * Penalizes abrupt intensity changes, especially decreasing intensity, and adds
 * known sensory, cask and age differences.
 *
 * @param {!Object} a Candidate tasted immediately before b.
 * @param {!Object} b Candidate tasted immediately after a.
 * @return {number} Nonnegative transition penalty.
 */
function transitionCost(a, b) {
  const jump = intensity(b) - intensity(a);
  const difference = profileDistance(a, b);
  // Prefer mild-to-intense, moderate steps and smooth neighboring aroma
  // profiles.
  return Math.abs(jump) * 0.35 + Math.max(0, jump - 3) * 1.8 + Math.max(0, -jump) * 2.8 + (difference ?? 0) * 0.55 +
    (caskDistance(a.cask, b.cask) ?? 0) * 0.65 +
    (a.age === null || b.age === null ? 0 : Math.min(Math.abs(a.age - b.age), 15) * 0.025);
}

/**
 * Finds the minimum-cost tasting order by evaluating permutations of up to six
 * candidates. Breaks equal scores deterministically by bottling IDs.
 *
 * @param {!Array<!Object>} items Selected flight candidates.
 * @return {!Array<!Object>} Candidates in recommended tasting order.
 * @throws {RangeError} If more than six candidates are supplied.
 */
export function orderFlightItems(items) {
  if (items.length > 6) throw new RangeError('Flight order supports at most six bottles');
  if (items.length < 2) return [...items];
  const ordered = [...items].sort(compareItems);
  const mildest = Math.min(...ordered.map(intensity));
  let best = null, bestCost = Infinity, bestTie = '';
  /**
   * Explores remaining tasting-order permutations and prunes paths that already
   * exceed the best known transition cost.
   *
   * @param {!Array<!Object>} path Candidates already ordered.
   * @param {!Array<!Object>} remaining Candidates not yet ordered.
   * @param {number} cost Accumulated transition penalty.
   */
  const search = (path, remaining, cost) => {
    if (cost > bestCost + 1e-8) return;
    if (!remaining.length) {
      const tie = path.map(item => item.bottling.id).join('|');
      if (cost < bestCost - 1e-8 || (Math.abs(cost - bestCost) < 1e-8 && tie < bestTie)) {
        best = [...path]; bestCost = cost; bestTie = tie;
      }
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const nextCost = cost + (path.length ? transitionCost(path.at(-1), item) : (intensity(item) - mildest) * 2);
      search([...path, item], [...remaining.slice(0, i), ...remaining.slice(i + 1)], nextCost);
    }
  };
  search([], ordered, 0);
  return best || ordered;
}

/**
 * Scores complete sets using the selected strategy, sensory evidence and
 * explicit preferences. Multiple starting points and swaps reduce dependence on
 * a single greedy seed.
 *
 * @param {!Array<!Object>} candidates Available, eligible flight candidates.
 * @param {number} count Requested number of distinct bottlings.
 * @param {!Object} options3 Strategy, scoring preferences and tasting history.
 * @return {!Array<!Object>} Highest-scoring set found by the bounded search.
 */
function selectFlight(
  candidates,
  count,
  {style, focus, preferUnfamiliar, today, history,
    caskMode, caskFilters, caskPhase, ageMode, ageMin, ageMax}
) {
  const distanceCache = new Map();
  /**
   * Caches symmetric sensory distances by sorted bottling IDs during set
   * scoring.
   *
   * @param {!Object} a First candidate.
   * @param {!Object} b Second candidate.
   * @return {?number} Profile distance or null when evidence is insufficient.
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
    for (const group of Object.keys(past.cask?.groups || {})) triedCasks.add(group);
    const bucket = ageClass(past.age);
    if (bucket) triedAges.add(bucket);
  }
  const caskCache = new Map(), ageCache = new Map();
  const groupFilters = Object.fromEntries(Object.keys(caskFilters).map(group => [group, {}]));
  const detailedFilters = Object.fromEntries(Object.entries(caskFilters).filter(([, dimensions]) => Object.keys(dimensions).length > 0 || caskPhase !== 'any'));
  const hasCaskFilter = Object.keys(groupFilters).length > 0 || caskPhase !== 'any';
  const hasCaskDetails = Object.keys(detailedFilters).length > 0;
  /**
   * Collects measured sensory, cask and age distances between two candidates,
   * caching the symmetric cask comparison.
   *
   * @param {!Object} a First candidate.
   * @param {!Object} b Second candidate.
   * @return {!Object} Known pairwise distances and subtype contribution.
   */
  const pairFacts = (a, b) => {
    const key = [a.bottling.id, b.bottling.id].sort().join('|');
    if (!caskCache.has(key)) caskCache.set(key, caskComparison(a.cask, b.cask));
    if (!ageCache.has(key)) ageCache.set(key, ageDistance(a.age, b.age));
    const comparison = caskCache.get(key);
    return {
      profile: dist(a, b), cask: comparison.distance,
      caskDetail: comparison.detail, age: ageCache.get(key),
    };
  };
  // The known parts of 65/25/10 are renormalized; unavailable values do not
  // masquerade as zero distance. Profile-data penalties stay independent.

  /**
   * Combines known pairwise distances using the selected preference direction
   * and the active cask and age modes.
   *
   * @param {!Object} facts Measured pairwise distance values, including nulls.
   * @param {number} defaultDirection Direction applied to sensory distance.
   * @return {number} Signed contribution to set scoring.
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
        caskMode === 'auto' || caskMode === 'specific' ? defaultDirection : caskMode === 'similar' ? -1 : 1,
      ],
      [
        facts.age,
        0.10,
        ageMode === 'auto' || ageMode === 'range' ? defaultDirection : ageMode === 'similar' ? -1 : 1,
      ],
    ].filter(([distance]) => distance !== null);
    const weight = measured.reduce((total, [, w]) => total + w, 0);
    return weight ? 10 * measured.reduce((total, [distance, w, sign]) => total + distance * w * sign, 0) / weight : 0;
  };

  /**
   * Collects known pairwise distances for the specified scoring dimension
   * across all distinct pairs in a candidate set.
   *
   * @param {!Array<!Object>} items Selected flight candidates.
   * @param {string} key Distance field from the pair facts record.
   * @return {!Array<number>} Measured distances, excluding missing evidence.
   */
  const pairSpread = (items, key) => {
    const values = [];
    for (let i = 0; i < items.length; i++)for (let j = i + 1; j < items.length; j++) {
      const metric = pairFacts(items[i], items[j])[key];
      if (metric !== null) values.push(metric);
    }
    return values;
  };

  /**
   * Rewards selected cask categories, matching subtype constraints and
   * requested age ranges using the configured phase semantics.
   *
   * @param {!Array<!Object>} items Selected flight candidates.
   * @return {number} Sum of explicit cask and age preference contributions.
   */
  const preferenceScore = items => {
    let result = 0;
    if (caskMode === 'specific' && hasCaskFilter) result += items.reduce(
      (sum, item) => sum + (caskMatches(item.cask, groupFilters, caskPhase) ? 9 : 0) +
        (hasCaskDetails && caskMatches(item.cask, detailedFilters, caskPhase) ? 4 : 0), 0);
    if (ageMode === 'range' && (ageMin !== null || ageMax !== null)) result += items.reduce((sum, item) => sum + (ageMatches(item.age, ageMin, ageMax) ? 3 : 0), 0);
    if (style !== 'similar' && style !== 'contrast') {
      if (caskMode === 'similar' || caskMode === 'variety') result += pairSpread(items, 'cask').reduce((sum, d) => sum + (caskMode === 'similar' ? -1 : 1) * d * 4, 0);
      if (ageMode === 'similar' || ageMode === 'variety') result += pairSpread(items, 'age').reduce((sum, d) => sum + (ageMode === 'similar' ? -1 : 1) * d * 2, 0);
    }
    return result;
  };
  const noveltyCache = new Map(candidates.map(item => [item, novelty(item, today)]));
  /**
   * Reads the precomputed novelty value for a candidate during set scoring.
   *
   * @param {!Object} item Candidate used as the cache key.
   * @return {number|undefined} Cached novelty score; undefined for an object outside the candidate set.
   */
  const noveltyScore = item => noveltyCache.get(item);
  const unfamiliarityCache = new Map();
  const caskNoveltyCache = new Map();

  /**
   * Finds the closest previously tasted comparable subtype, without treating
   * missing subtype information as novelty.
   * @param {!Object} item Current candidate.
   * @return {number} Bounded novelty contribution 0..0.25.
   */
  const caskNovelty = item => {
    if (!caskNoveltyCache.has(item)) {
      const distances = history.map(past => caskComparison(item.cask, past.cask).detail).filter(x => x !== null);
      caskNoveltyCache.set(item, distances.length ? Math.min(...distances) : 0);
    }
    return caskNoveltyCache.get(item);
  };

  /**
   * Measures the candidate's closest comparable sensory profile in prior
   * tastings, returning no novelty bonus without assessed axes or comparable
   * history.
   *
   * @param {!Object} item Candidate being compared to tasting history.
   * @return {number} Cached unfamiliarity contribution.
   */
  const unfamiliarity = item => {
    if (unfamiliarityCache.has(item)) return unfamiliarityCache.get(item);
    if (!item.assessed.length) return 0;
    const previous = history.filter(other => other.bottlingId !== item.bottling.id).map(other => profileDistance(item, other)).filter(x => x !== null);
    const result = previous.length ? Math.min(...previous) : 0;
    unfamiliarityCache.set(item, result);
    return result;
  };

  /**
   * Scores a complete candidate set according to strategy, sensory evidence,
   * tasting history, variety and explicit cask and age preferences.
   *
   * @param {!Array<!Object>} items Selected flight candidates.
   * @return {number} Set score; higher values are preferred.
   */
  const score = items => {
    const profiled = items.filter(item => item.assessed.length >= 2);
    let total = -2 * repeatedDistilleries(items);
    const gaps = intensityGaps(items);
    const largestGap = Math.max(0, ...gaps);
    const distances = [], pairs = []; let missingPairs = 0;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const facts = pairFacts(items[i], items[j]); pairs.push(facts);
      if (facts.profile === null) missingPairs++; else distances.push(facts.profile);
    }
    const avg = distances.length ? distances.reduce((sum, x) => sum + x, 0) / distances.length : 0;
    const families = new Set(profiled.map(item => item.family).filter(Boolean));
    const caskProfiles = items.map(item => item.cask);
    const ageClasses = new Set(items.map(item => ageClass(item.age)).filter(Boolean));
    const preferences = preferenceScore(items);
    if (style === 'balanced') return total + families.size * 13 + profiled.length * 4 + items.reduce((sum, item) => sum + noveltyScore(item) * 0.08, 0) -
      (distances.length ? Math.abs(avg - 3) * 1.2 : 4) - largestGap * 1.5 -
      missingPairs * 1.5 +
      (caskMode === 'auto' ? 4 * caskCoverage(caskProfiles) +
        4 * pairs.reduce((sum, facts) => sum + (facts.caskDetail ?? 0), 0) / Math.max(1, pairs.length) : 0) +
      (ageMode === 'auto' ? ageClasses.size * 2 : 0) + preferences;
    if (style === 'similar') return total + profiled.length * 8 + pairs.reduce((sum, facts) => sum + signedPairDistance(facts, -1) * 3.2, 0) -
      missingPairs * 14 + (focus === 'any' ? 0 : items.reduce((sum, item) => sum + (isRated(item.profile?.[focus]) ? item.profile[focus] * 1.9 : -12), 0)) + preferences;
    if (style === 'contrast') return total + profiled.length * 8 + pairs.reduce((sum, facts) => sum + signedPairDistance(facts, 1) * 2.5, 0) + families.size * 3 - missingPairs * 14 -
      Math.max(0, largestGap - 3) * 3 + preferences;
    const novelAges = new Set([...ageClasses].filter(age => !triedAges.has(age)));
    return total + items.reduce((sum, item) => sum + noveltyScore(item) + (preferUnfamiliar ? unfamiliarity(item) * 2 : 0), 0) + families.size * 2 +
      (caskMode === 'auto' ? 5 * caskCoverage(caskProfiles, triedCasks) +
        4 * items.reduce((sum, item) => sum + caskNovelty(item), 0) / Math.max(1, items.length) : 0) +
      (ageMode === 'auto' ? novelAges.size * 3 : 0) + preferences;
  };

  /**
   * Orders candidates by descending individual set score, with deterministic
   * identity ordering for ties.
   *
   * @param {!Object} a First candidate.
   * @param {!Object} b Second candidate.
   * @return {number} Comparison result for sorting candidates.
   */
  const rank = (a, b) => score([b]) - score([a]) || compareItems(a, b);
  // Include representatives of every aroma family even when their individual
  // rank is low.
  const ranked = [...candidates].sort(rank);
  const shortlist = new Set(ranked.slice(0, 48));
  for (const family of Object.keys(FAMILIES)) {
    for (const item of ranked.filter(item => item.family === family).slice(0, 8)) shortlist.add(item);
  }
  // Keep representatives of cask categories and age bands in the candidate
  // pool.
  for (const group of CASK_GROUPS) for (const item of ranked.filter(x => x.cask.groups[group]).slice(0, 6)) shortlist.add(item);
  for (const bucket of ['0-5', '6-10', '11-15', '16-20', '21+']) {
    for (const item of ranked.filter(x => ageClass(x.age) === bucket).slice(0, 4)) shortlist.add(item);
  }
  if (style === 'contrast' || style === 'balanced') {
    // Do not lose flavor extremes merely because alphabetical ties ranked them
    // late.
    for (const axis of FLAVOR_AXES) {
      const measured = candidates.filter(item => isRated(item.profile?.[axis]));
      measured.sort((a, b) => b.profile[axis] - a.profile[axis] || compareItems(a, b));
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
        const replacement = pool.filter(item => !chosen.includes(item)).sort((a, b) =>
          score([...chosen.slice(0, i), b, ...chosen.slice(i + 1)]) -
          score([...chosen.slice(0, i), a, ...chosen.slice(i + 1)]) ||
          compareItems(a, b))[0];
        if (replacement &&
          score([...chosen.slice(0, i), replacement, ...chosen.slice(i + 1)]) > previous + 1e-8) {
          chosen[i] = replacement; improved = true;
        }
      }
      if (!improved) break;
    }
    const value = score(chosen);
    const tie = chosen.map(item => item.bottling.id).sort().join('|');
    if (value > bestScore + 1e-8 || (Math.abs(value - bestScore) < 1e-8 && (!best || tie < bestTie))) {
      best = chosen; bestScore = value; bestTie = tie;
    }
  }
  return best || [];
}

/**
 * Checks whether a candidate satisfies the active cask and age criteria.
 * @param {!Object} item Candidate with classified cask and age.
 * @param {!Object} options Planner criteria, independently of strict mode.
 * @return {boolean} Whether all active criteria match.
 */
function matchesFlightCriteria(item, options) {
  const {caskMode, caskFilters, caskPhase, ageMode, ageMin, ageMax} = options;
  return (caskMode !== 'specific' || caskMatches(item.cask, caskFilters, caskPhase)) &&
    (ageMode !== 'range' || (ageMin === null && ageMax === null) || ageMatches(item.age, ageMin, ageMax));
}

/**
 * Explains candidate exclusions without changing availability or preferences.
 * Counts distinct bottlings with non-empty physical bottles, not bottles.
 * @param {!Object} collection Current collection.
 * @param {!Object} options The same criteria used to generate the proposal.
 * @param {!Array<!Object>} proposal Generated physical bottle references.
 * @return {{matching: number, available: number, proposed: number,
 *     excludedAvailability: number, excludedScope: number}} Candidate counts.
 */
export function flightCandidateDiagnostics(collection, options, proposal) {
  const {availability = 'open', bottlingIds = null} = options;
  const all = flightCandidates(collection, {availability: 'all'});
  const matching = all.filter(item => matchesFlightCriteria(item, options));
  const scope = Array.isArray(bottlingIds) ? new Set(bottlingIds) : null;
  const inScope = matching.filter(item => !scope || scope.has(item.bottling.id));
  const available = flightCandidates(collection, {availability, bottlingIds});
  const eligible = available.filter(item => matchesFlightCriteria(item, options));
  const ids = new Set(eligible.map(item => item.bottling.id));
  return {
    matching: eligible.length,
    available: available.length,
    proposed: proposal.filter(item => ids.has(item.bottlingId)).length,
    excludedAvailability: inScope.length - eligible.length,
    excludedScope: matching.length - inScope.length,
  };
}

/**
 * Generates an ordered flight with stable physical references and
 * evidence-based reasons. Hard filters restrict eligibility; soft preferences
 * contribute to scoring.
 *
 * @param {!Object} collection Collection containing bottlings and tasting
 *     history.
 * @param {!Object=} options2 Strategy, size (one to six), availability,
 *     collection scope, sensory focus, cask and age criteria, and reference
 *     time.
 * @return {!Array<!Object>} Ordered bottlingId, bottleId and reason records;
 *     empty if no candidates qualify.
 * @throws {Error} If a planning option is outside its supported range.
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
    caskFilters = {},
    caskPhase = 'any',
    ageMode = 'auto',
    ageMin = null,
    ageMax = null,
    strictMatches = false
  } = {}
) {
  if (!FLIGHT_STYLES.includes(style) || !FLIGHT_AVAILABILITY.includes(availability) || !FLIGHT_FOCUSES.includes(focus) || typeof preferUnfamiliar !== 'boolean' ||
    !CASK_MODES.includes(caskMode) || !validCaskFilters(caskFilters) ||
    !CASK_PHASES.includes(caskPhase) ||
    !AGE_MODES.includes(ageMode) ||
    typeof strictMatches !== 'boolean' ||
    (ageMin !== null && (!Number.isInteger(ageMin) || ageMin < 0 || ageMin > 200)) ||
    (ageMax !== null && (!Number.isInteger(ageMax) || ageMax < 0 || ageMax > 200)) ||
    (ageMin !== null && ageMax !== null && ageMin > ageMax) ||
    !Number.isFinite(today) || !Number.isInteger(count) || count < 1 ||
    count > 6)
    throw new Error('Invalid flight request');
  let candidates = flightCandidates(collection, {availability, bottlingIds});
  if (strictMatches) candidates = candidates.filter(item =>
    matchesFlightCriteria(item, {
      caskMode, caskFilters, caskPhase, ageMode,
      ageMin, ageMax,
    }));
  if (!candidates.length) return [];
  const history = style === 'discover' ? [
    ...(collection.bottlings || []).map(b => ({
      bottlingId: b.id,
      profile: sortedTastings(b).find(record => record.flavorProfile)?.flavorProfile || null,
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
    caskMode, caskFilters, caskPhase, ageMode, ageMin, ageMax,
  });
  return orderFlightItems(picked).map(item => ({
    bottlingId: item.bottling.id, bottleId: item.bottle.id,
    reason: !item.assessed.length ? 'noProfile' : style === 'discover' && !item.lastTasted ? 'untried'
      : style === 'contrast' ? 'contrast' : style === 'similar' ? 'similar' : 'intensity',
  }));
}
