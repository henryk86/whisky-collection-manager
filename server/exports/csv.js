/** UTF-8 BOM + semicolons keep exported data readable in German spreadsheet programs. */
export function csv(rows) {
    const safeCell = value => {
        // A spreadsheet must not execute user-provided strings as formulas.
        // Actual numeric values (including negatives) remain unchanged.
        const raw = typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value ?? '');
        return '"' + raw.replace(/"/g, '""') + '"';
    };
    return '\uFEFF' + rows.map(row => row.map(safeCell).join(';')).join('\r\n') + '\r\n';
}
