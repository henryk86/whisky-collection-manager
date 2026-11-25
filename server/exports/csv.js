/**
 * UTF-8 BOM + semicolons keep exported data readable in German spreadsheet
 * programs.
 *
 * @param {!Array<*>} rows Rows being processed.
 * @return {string} Resulting text.
 */
export function csv(rows) {
  /**
   * Tests input text against the safe cell pattern.
   *
   * @param {*} value Value to process.
   * @return {string} Resulting text.
   */
  const safeCell = value => {
    // A spreadsheet must not execute user-provided strings as formulas.
    // Actual numeric values (including negatives) remain unchanged.
    const raw = typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value ?? '');
    return '"' + raw.replace(/"/g, '""') + '"';
  };
  return '\uFEFF' + rows.map(row => row.map(safeCell).join(';')).join('\r\n') + '\r\n';
}
