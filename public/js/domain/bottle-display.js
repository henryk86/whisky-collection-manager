/** Presentation of bottle metadata. Separators exist only between present values. */
export function bottleMeta(bottle, formatDate = (date) => date) {
    return [
        bottle.purchaseDate ? `Kauf: ${formatDate(bottle.purchaseDate)}` : null,
        bottle.purchasePrice != null && bottle.purchasePrice !== '' ? `${bottle.purchasePrice} ${bottle.currency || 'EUR'}` : null,
    ].filter(Boolean).join(' · ');
}
