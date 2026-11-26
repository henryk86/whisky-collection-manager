/**
 * Imported data can list multiple distilleries in a single field.
 *
 * @param {*} raw Untrusted distillery name text; non-string inputs yield an empty list.
 * @return {!Array<*>} Trimmed nonempty distillery names parsed from the source text.
 */
export function splitDistilleryNames(raw) {
  if (typeof raw !== 'string') return [];
  const names = [];
  const seen = new Set();
  let buffer = '';
  let parentheses = 0;
  /**
   * Transforms the push name text with the required substitutions.
   */
  const pushName = () => {
    const name = buffer.normalize('NFKC').replace(/\s+/gu, ' ').trim();
    buffer = '';
    const key = name.toLocaleLowerCase('de');
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  };
  for (const char of raw) {
    if (char === '(') parentheses++;
    if (char === ')') parentheses = Math.max(0, parentheses - 1);
    if (parentheses === 0 && (char === ',' || char === ';' || char === '\n' || char === '\r')) {
      pushName();
    } else {
      buffer += char;
    }
  }
  pushName();
  return names;
}

/**
 * Return one choice per name; unmatched distilleries remain visible, not
 * silently discarded.
 *
 * @param {*} raw Imported distillery name text to split and match against the catalog.
 * @param {!Array<*>=} knownDistilleries Existing catalog entries with names and IDs for case-insensitive matching.
 * @return {!Array<!Object>} One choice per imported distillery name, retaining unmatched entries.
 */
export function matchImportedDistilleries(raw, knownDistilleries = []) {
  const known = new Map(knownDistilleries.map(distillery => [
    String(distillery.name).normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('de'),
    distillery.id,
  ]));
  return splitDistilleryNames(raw).map(name => ({
    name,
    id: known.get(name.toLocaleLowerCase('de')) || null,
  }));
}
