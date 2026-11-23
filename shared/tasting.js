/** Bottle-independent sensory observations, stored on the bottling. */
export const NOTE_FIELDS = Object.freeze(['nose', 'palate', 'finish']);
export const emptyTastingNotes = () => ({nose: '', palate: '', finish: ''});
export function normalizeTastingNotes(notes) {
  if (notes == null) return emptyTastingNotes();
  if (!notes || typeof notes !== 'object' || Array.isArray(notes) ||
    Object.keys(notes).some(key => !NOTE_FIELDS.includes(key)) ||
    NOTE_FIELDS.some(key => notes[key] != null && typeof notes[key] !== 'string'))
    throw new Error('Ungültige Verkostungsnotizen');
  return Object.fromEntries(NOTE_FIELDS.map(key => [key, notes[key] || '']));
}
export const hasTastingNotes = notes => NOTE_FIELDS.some(key => typeof notes?.[key] === 'string' && notes[key].trim());
export function normalizeTastingRating(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)
    throw new Error('Bewertung muss zwischen 0 und 100 liegen');
  return value;
}

/** Read one-decimal-point tasting scores in both UI languages without rounding stored values. */
export function parseTastingScore(input) {
  const value = String(input ?? '').trim();
  if (!value) return null;
  if (!/^(?:\d{1,3})(?:[.,]\d)?$/.test(value)) throw new Error('Ungültige Punktebewertung');
  const score = Number(value.replace(',', '.'));
  if (score < 0 || score > 100) throw new Error('Ungültige Punktebewertung');
  return score;
}
