/**
 * Language-independent whisky flavour profile; positions are fixed clockwise.
 */
export const LEGACY_FLAVOR_AXES = Object.freeze([
  'woody',
  'cereal',
  'peaty',
  'fruity',
  'floral',
  'winey',
  'feinty',
  'sulphury',
]);
export const NEW_FLAVOR_AXES = Object.freeze(['smoky', 'medicinal']);
export const FLAVOR_AXES = Object.freeze([
  'woody',
  'smoky',
  'cereal',
  'peaty',
  'fruity',
  'floral',
  'medicinal',
  'winey',
  'feinty',
  'sulphury',
]);

/**
 * Normalizes flavor profile for flavor profile.
 *
 * @param {*} value Input value to process.
 * @return {?Object} Computed value, or null when the input has no match.
 */
export function normalizeFlavorProfile(value) {
  if (value === null) return null;
  const keys = value && typeof value === 'object' && !Array.isArray(value) ?
    Object.keys(value) : [];
  // A short-lived eleven-axis version also stored `fiery`. Read such records
  // without
  // breaking older backups, but do not offer or persist this overlapping
  // category.
  const hasFormerFiery = Object.hasOwn(value ?? {}, 'fiery');
  const validShape = keys.length === LEGACY_FLAVOR_AXES.length ||
    keys.length === FLAVOR_AXES.length || (keys.length ===
      FLAVOR_AXES.length + 1 && hasFormerFiery);
  if (!validShape || !LEGACY_FLAVOR_AXES.every(axis =>
    Object.hasOwn(value, axis)) ||
    keys.some(key => !FLAVOR_AXES.includes(key) && key !== 'fiery') ||
    (hasFormerFiery && value.fiery !== null &&
      !(typeof value.fiery === 'number' && Number.isInteger(value.fiery) &&
        value.fiery >= 0 && value.fiery <= 10))) {
    throw new Error('Geschmacksprofil muss acht bisherige oder alle zehn Achsen enthalten');
  }
  const result = {};
  for (const axis of FLAVOR_AXES) {
    // An existing eight-axis tasting did not assess these two aromas.
    // Never interpret "not assessed" as an explicit score of zero.
    const score = Object.hasOwn(value, axis) ? value[axis] : null;
    if (score === null && NEW_FLAVOR_AXES.includes(axis)) {
      result[axis] = null;
    } else if (typeof score === 'number' && Number.isInteger(score) &&
      score >= 0 && score <= 10) {
      result[axis] = score;
    } else {
      throw new Error('Geschmacksprofil: Werte müssen ganze Zahlen von 0 bis 10 sein');
    }
  }
  return result;
}
