/** Interpret free-text cask descriptions; keep the persisted text untouched. */
export const CASK_GROUPS =
  Object.freeze(['bourbon', 'sherry', 'wine', 'exotic']);
export const SHERRY_SUBTYPES =
  Object.freeze(['px', 'oloroso', 'fino', 'amontillado', 'paloCortado', 'manzanilla']);
export const CASK_MODES =
  Object.freeze(['auto', 'similar', 'variety', 'specific']);
export const AGE_MODES = Object.freeze(['auto', 'similar', 'variety', 'range']);

const rules = [
  ['sherry', 'px', /\b(?:px|p\.?\s*x\.?|pedro\s+ximenez)\b/gi],
  ['sherry', 'oloroso', /\boloross?o\b/gi],
  ['sherry', 'fino', /\bfino\b/gi],
  ['sherry', 'amontillado', /\bamontillado\b/gi],
  ['sherry', 'paloCortado', /\bpalo\s+cortado\b/gi],
  ['sherry', 'manzanilla', /\bmanzanilla\b/gi],
  ['sherry', null, /\bsherry\b/gi],
  ['bourbon', null, /\b(?:bourbon|american\s+white\s+oak)\b/gi],
  [
    'wine',
    null,
    /\b(?:port\s*(?:wine|wein|cask)|portwein|port|madeira|sauternes|bordeaux|burgundy|burgund|rioja|barolo|marsala|champagne|red\s+wine|white\s+wine|wine\s+cask|wine\s+barrel|weinfass|weinfasser|weinbarrique)\b/gi,
  ],
  [
    'exotic',
    null,
    /\b(?:rum|cognac|armagnac|brandy|tequila|mezcal|mizunara|virgin\s+oak|new\s+oak|bierfass|beer\s+cask|beer\s+barrel|ipa\s+cask|calvados|chestnut|kastanie|acacia|akazie)\b/gi,
  ],
];
/**
 * Transforms the normalize text with the required substitutions.
 *
 * @param {*} text Text to process.
 * @return {string} Resulting text.
 */
const normalize = text => String(text || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Calculates the add numeric value.
 *
 * @param {*} map Lookup mapping used by the operation.
 * @param {*} key Key used to select or group values.
 * @param {*} weight Value used by this operation.
 */
const add = (map, key, weight) => {map[key] = Math.max(map[key] || 0, weight);};

/**
 * A maturation receives weight 1, a recognized finish weight 0.5.
 *
 * @param {*} text Text to process.
 * @return {!Object} Structured result for the caller.
 */
export function classifyCask(text) {
  const input = normalize(text), groups = {}, subtypes = {};
  const finishes = [...input.matchAll(/\b(?:finish(?:ed|ing)?|nachreifung)\b/g)].map(match => match.index);
  for (const [group, subtype, pattern] of rules) {
    for (const match of input.matchAll(pattern)) {
      const start = match.index, end = start + match[0].length;
      const finish = finishes.some(idx => (idx >= end && idx - end <= 13) ||
        (start >= idx && start - idx <= 40));
      add(groups, group, finish ? 0.5 : 1);
      if (subtype) add(subtypes, subtype, finish ? 0.5 : 1);
    }
  }
  return {groups, subtypes};
}

/**
 * Calculates the jaccard numeric value.
 *
 * @param {*} a First entry or operand in the calculation.
 * @param {*} b Second entry or operand in the calculation.
 * @return {number} Calculated numeric value.
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
 * Distance 0..1 or null. Different known sherry subtypes contribute at most
 * 0.25.
 *
 * @param {*} a First value to compare.
 * @param {*} b Second value to compare.
 * @return {?number} Calculated numeric result.
 */
export function caskDistance(a, b) {
  const family = jaccard(a?.groups || {}, b?.groups || {});
  if (family === null) return null;
  if (!a.groups.sherry || !b.groups.sherry) return family;
  const subtype = jaccard(a.subtypes, b.subtypes);
  return subtype === null ? family : 0.75 * family + 0.25 * subtype;
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
export const ageDistance = (a, b) => a === null || b === null ? null :
  Math.min(Math.abs(a - b) / 15, 1);

/**
 * Groups a whisky age into the flight-planning age bands.
 *
 * @param {*} age Age in years, or a value to validate.
 * @return {?string} Resulting text.
 */
export const ageClass = age => age === null ? null : age <= 5 ? '0-5' :
  age <= 10 ? '6-10' : age <= 15 ? '11-15' : age <= 20 ? '16-20' : '21+';

/**
 * Checks whether the cask profile matches the selected filter.
 *
 * @param {*} profile Profile data used for the comparison.
 * @param {*} group Group or classification to match against.
 * @param {string=} subtype Optional specific cask subtype.
 * @return {boolean} Whether the condition is satisfied.
 */
export function caskMatches(profile, group, subtype = 'any') {
  return group !== 'any' && Boolean(profile?.groups?.[group]) &&
    (group !== 'sherry' || subtype === 'any' ||
      Boolean(profile.subtypes[subtype]));
}

/**
 * Checks whether a whisky age falls within the chosen bounds.
 *
 * @param {*} age Age in years, or a value to validate.
 * @param {*} min Minimum permitted value.
 * @param {*} max Maximum permitted value.
 * @return {boolean} Whether the condition is satisfied.
 */
export const ageMatches = (age, min, max) => age !== null && (min ===
  null || age >= min) && (max === null || age <= max);
