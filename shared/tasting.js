/** Bottle-independent sensory observations, stored on the bottling. */
export const NOTE_FIELDS = Object.freeze(['nose', 'palate', 'finish']);
/**
 * Creates an independent set of empty sensory-note fields.
 *
 * @return {{nose: string, palate: string, finish: string}} Empty note values.
 */
export const emptyTastingNotes = () => ({nose: '', palate: '', finish: ''});

/**
 * Validates and normalizes the three sensory note fields.
 *
 * @param {?Object} notes Raw note fields or null for an empty record.
 * @return {{nose: string, palate: string, finish: string}} Normalized notes.
 * @throws {Error} If unknown fields or invalid values are supplied.
 */
export function normalizeTastingNotes(notes) {
  if (notes == null) return emptyTastingNotes();
  if (!notes || typeof notes !== 'object' || Array.isArray(notes) ||
    Object.keys(notes).some(key => !NOTE_FIELDS.includes(key)) ||
    NOTE_FIELDS.some(key => notes[key] != null && typeof notes[key] !== 'string'))
    throw new Error('Ungültige Verkostungsnotizen');
  return {nose: notes.nose || '', palate: notes.palate || '', finish: notes.finish || ''};
}

/**
 * Checks whether at least one sensory note contains nonblank text.
 *
 * @param {?Object} notes Optional normalized note fields.
 * @return {boolean} Whether any note is present.
 */
export const hasTastingNotes = notes => NOTE_FIELDS.some(key => typeof notes?.[key] === 'string' && notes[key].trim());

/**
 * Validates a tasting score without rounding the stored value.
 *
 * @param {(number|string|null|undefined)} value Optional score.
 * @return {?number} Score between 0 and 100, or null when absent.
 * @throws {Error} If the score is not finite or is outside the range.
 */
export function normalizeTastingRating(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)
    throw new Error('Bewertung muss zwischen 0 und 100 liegen');
  return value;
}

/**
 * Parses a localized one-decimal tasting score into a number.
 *
 * @param {(string|number|null|undefined)} input User-entered score.
 * @return {?number} Valid score from 0 to 100, or null when blank.
 * @throws {Error} If the score format or range is invalid.
 */
export function parseTastingScore(input) {
  const value = String(input ?? '').trim();
  if (!value) return null;
  if (!/^(?:\d{1,3})(?:[.,]\d)?$/.test(value)) throw new Error('Ungültige Punktebewertung');
  const score = Number(value.replace(',', '.'));
  if (score < 0 || score > 100) throw new Error('Ungültige Punktebewertung');
  return score;
}
