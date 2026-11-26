export const bottleStatusLabels = {
  closed: 'Geschlossen', open: 'Geöffnet', empty: 'Leer',
};
export const whiskyTypeLabels = {
  single_malt: 'Single Malt Scotch Whisky',
  single_grain: 'Single Grain Scotch Whisky',
  blended_malt: 'Blended Malt Scotch Whisky',
  blended_grain: 'Blended Grain Scotch Whisky',
  blended_scotch: 'Blended Scotch Whisky',
};
/**
 * Resolves the stored whisky category to its display label.
 *
 * @param {*} b Release with a whisky category.
 * @return {*} Category label or the missing-value label.
 */
export const whiskyTypeName = b => whiskyTypeLabels[b.whiskyType] || 'Nicht angegeben';
export const photoAccept = 'image/jpeg,image/png,image/webp,image/gif';
