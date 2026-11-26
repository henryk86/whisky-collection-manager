/**
 * Presentation of bottle metadata. Separators exist only between present
 * values.
 *
 * @param {!Object} bottle Physical bottle record being processed.
 * @param {Function=} formatDate Formats the purchase date for the metadata line; defaults to the original date.
 * @return {string} Available purchase date, purchase price and other physical-bottle metadata joined for display.
 */
export function bottleMeta(bottle, formatDate = (date) => date) {
  return [
    bottle.purchaseDate ? `Kauf: ${formatDate(bottle.purchaseDate)}` : null,
    bottle.purchasePrice != null && bottle.purchasePrice !== '' ?
      `${bottle.purchasePrice} ${bottle.currency || 'EUR'}` : null,
  ].filter(Boolean).join(' · ');
}
