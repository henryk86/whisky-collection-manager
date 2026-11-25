/**
 * Read and validate a calendar date without timezone conversions.
 *
 * @param {*} value Input value to process.
 * @return {string} Resulting text.
 */
export function readAnalyticsDate(value) {
  if (typeof value !== 'string' || !/^(\d{4})-(\d{2})-(\d{2})$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1600 || year > 2300 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : '';
}
