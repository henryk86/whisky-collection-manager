/** Embedded, non-inventory whisky details for one standalone tasting. */
export const TASTING_SUBJECT_FIELDS = Object.freeze(['name', 'distillery', 'bottler', 'ageYears', 'abv', 'releaseYear']);
export function normalizeTastingSubject(input, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
    Object.keys(input).some(key => !TASTING_SUBJECT_FIELDS.includes(key))) throw new Error('Ungültige Abfüllungsangaben der Verkostung');
  const value = {name: '', distillery: '', bottler: '', ageYears: null, abv: null, releaseYear: null, ...previous, ...input};
  for (const [key, length] of [['name', 180], ['distillery', 140], ['bottler', 140]]) {
    if (typeof value[key] !== 'string' || value[key].length > length || (key === 'name' && !value[key].trim()))
      throw new Error('Ungültiges Feld: ' + key);
    value[key] = value[key].trim();
  }
  for (const [key, min, max, integer] of [['ageYears', 0, 200, true], ['abv', 0, 100, false], ['releaseYear', 1800, 2200, true]]) {
    if (value[key] === null) continue;
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < min || value[key] > max || (integer && !Number.isInteger(value[key])))
      throw new Error('Ungültiges Feld: ' + key);
  }
  return value;
}
