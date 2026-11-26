/**
 * Dated, independent tasting records. No legacy observations are
 * auto-converted.
 */
import {normalizeFlavorProfile} from './flavor-profile.js';
import {normalizeWhiskyColor} from './whisky-colors.js';
import {emptyTastingNotes, normalizeTastingNotes, normalizeTastingRating}
  from './tasting.js';
export const VALID_TASTING_FIELDS = Object.freeze([
  'tastedOn',
  'title',
  'flavorProfile',
  'tastingNotes',
  'rating',
  'ratingComment',
  'whiskyColor',
]);
/**
 * Checks that a tasting date is a valid calendar day.
 *
 * @param {*} value Candidate YYYY-MM-DD string.
 * @return {boolean} True for an actual calendar day in the required format.
 */
export function validTastingDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Merges allowed tasting fields into defaults and validates every sensory and metadata field.
 *
 * @param {*} input Untrusted partial tasting fields; identity and timestamps are not accepted here.
 * @param {Partial<import('./types.js').Tasting>=} old Previous values retained on update.
 * @return {Omit<import('./types.js').Tasting, 'id'|'createdAt'|'updatedAt'> & Partial<Pick<import('./types.js').Tasting, 'id'|'createdAt'|'updatedAt'>>} Validated fields with any supplied previous identity metadata.
 * @throws {Error} If the date, title, notes, rating, profile or color is invalid.
 */
export function normalizeTastingRecord(input, old = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
    Object.keys(input).some(key => !VALID_TASTING_FIELDS.includes(key)))
    throw new Error('Ungültige Verkostungsdaten');
  const value = {
    tastedOn: null,
    title: '',
    flavorProfile: null,
    tastingNotes: emptyTastingNotes(),
    rating: null,
    ratingComment: '',
    whiskyColor: null,
    ...old,
    ...input,
  };
  if (!validTastingDate(value.tastedOn)) throw new Error('Ungültiges Verkostungsdatum');
  if (typeof value.title !== 'string' || value.title.length > 120) throw new Error('Ungültiger Verkostungstitel');
  value.title = value.title.trim();
  value.flavorProfile = normalizeFlavorProfile(value.flavorProfile);
  value.tastingNotes = normalizeTastingNotes(value.tastingNotes);
  value.rating = normalizeTastingRating(value.rating);
  if (typeof value.ratingComment !== 'string' || value.ratingComment.length > 10000)
    throw new Error('Ungültiger Bewertungskommentar');
  value.whiskyColor = normalizeWhiskyColor(value.whiskyColor);
  return value;
}

/**
 * Sorts tastings consistently for display and history navigation.
 *
 * @param {{tastings?: import('./types.js').Tasting[]}|null|undefined} bottling Owned bottling or other tasting container.
 * @return {import('./types.js').Tasting[]} New array, newest tasting date first with creation time and ID as tie breakers.
 */
export function sortedTastings(bottling) {
  return [...(bottling?.tastings || [])].sort((a, b) =>
    (b.tastedOn || '').localeCompare(a.tastedOn || '') || (b.createdAt || '').localeCompare(a.createdAt || '') ||
    b.id.localeCompare(a.id));
}

/**
 * Finds the most recently recorded tasting for a bottling.
 *
 * @param {{tastings?: import('./types.js').Tasting[]}|null|undefined} bottling Tasting container.
 * @return {?import('./types.js').Tasting} Most recent tasting, or null.
 */
export function latestTasting(bottling) {
  return sortedTastings(bottling)[0] || null;
}

/**
 * The newest record is the sole rating source. No persisted summary or legacy
 * fallback.
 *
 * @param {{tastings?: import('./types.js').Tasting[]}|null|undefined} bottling Tasting container.
 * @return {?number} Rating of the newest tasting, even when it is unrated.
 */
export function displayedTastingRating(bottling) {
  return latestTasting(bottling)?.rating ?? null;
}
