/** Shared accessible action icons: the header and hero reuse the same SVGs. */
export const newBottlingIcon = '<svg class="new-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>';

export const inventoryScanIcon = '<svg class="scan-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/><path d="M8 9v6m3-6v6m3-6v6m3-6v6"/></svg>';

export const settingsIconPaths = '<path d="M10.5 2h3l.5 2.1c.8.2 1.5.5 2.2.9l1.9-1.2 2.1 2.1-1.2 1.9c.4.7.7 1.4.9 2.2l2.1.5v3l-2.1.5c-.2.8-.5 1.5-.9 2.2l1.2 1.9-2.1 2.1-1.9-1.2c-.7.4-1.4.7-2.2.9l-.5 2.1h-3l-.5-2.1c-.8-.2-1.5-.5-2.2-.9l-1.9 1.2-2.1-2.1 1.2-1.9c-.4-.7-.7-1.4-.9-2.2L2 13.5v-3l2.1-.5c.2-.8.5-1.5.9-2.2L3.8 5.9l2.1-2.1 1.9 1.2c.7-.4 1.4-.7 2.2-.9L10.5 2Z"/><circle cx="12" cy="12" r="3"/>';
export const settingsIcon = `<svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${settingsIconPaths}</svg>`;

/** Device-independent theme symbols: exactly the same SVG on desktop and mobile. */
export const themeSunIcon = '<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
export const themeMoonIcon = '<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.985 12.486A9 9 0 0 1 11.514 3.015a9 9 0 1 0 9.47 9.47Z"/></svg>';

/** Consistent edit/delete icons for bottlings, physical bottles and attachments. */
export const editIcon = '<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 5 4 4"/></svg>';

export const locationIcon = '<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>';

export const deleteIcon = '<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14h10l1-14M10 10v7m4-7v7"/></svg>';

/** Furniture isolation is a separate action from selecting its shelves. */
export const eyeIcon = '<svg class="warehouse-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
export const eyeOffIcon = '<svg class="warehouse-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.8 7.2C3.3 8.5 2.5 10.2 2.5 12c0 0 3.5 6.5 9.5 6.5 2 0 3.9-.7 5.5-1.8M9.8 5.7c.7-.2 1.4-.2 2.2-.2 6 0 9.5 6.5 9.5 6.5a13.6 13.6 0 0 1-2.2 3.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3 21 21"/></svg>';

/** Traditional malt-kiln pagoda roof for map locations without physical bottles. */
export const pagodaRoofIcon = '<svg class="map-pagoda-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 3h4l1 3h-6l1-3Z"/><path d="M12 6c-2.3 4-5 6.5-9 7 2.2 1.2 4 .5 5-.2h8c1 .7 2.8 1.4 5 .2-4-.5-6.7-3-9-7Z"/><path d="M7 14v6h10v-6M5 21h14"/></svg>';

/** Closed distilleries get a visibly distinct crossed-out kiln symbol. */
export const closedDistilleryIcon = '<svg class="map-pagoda-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 3h4l1 3h-6l1-3Z"/><path d="M12 6c-2.3 4-5 6.5-9 7 2.2 1.2 4 .5 5-.2h8c1 .7 2.8 1.4 5 .2-4-.5-6.7-3-9-7Z"/><path d="M7 14v6h10v-6M5 21h14"/><path d="M3 3l18 18" stroke-width="2.5"/></svg>';
