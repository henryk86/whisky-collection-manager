export const bottleStatusLabels = {
    closed: 'Geschlossen', open: 'Geöffnet', empty: 'Leer'
};
export const whiskyTypeLabels = {
    single_malt: 'Single Malt Scotch Whisky', single_grain: 'Single Grain Scotch Whisky', blended_malt: 'Blended Malt Scotch Whisky', blended_grain: 'Blended Grain Scotch Whisky', blended_scotch: 'Blended Scotch Whisky'
};
export const whiskyTypeName = b => whiskyTypeLabels[b.whiskyType] || 'Nicht angegeben';
export const photoAccept = 'image/jpeg,image/png,image/webp,image/gif';
