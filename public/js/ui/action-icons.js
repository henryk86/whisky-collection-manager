import {escapeHtml} from './dom.js';
/** Shared accessible action icons: the header and hero reuse the same SVGs. */
export const newBottlingIcon =
  '<svg class="new-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>';
/**
 * For translated add/create labels that previously carried a typed '+' glyph.
 */
export const addActionLabel = label =>
  `<span class="add-action-label">${newBottlingIcon}<span>${escapeHtml(String(label).replace(/^\+\s*/, ''))}</span></span>`;

export const inventoryScanIcon =
  '<svg class="scan-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/><path d="M8 9v6m3-6v6m3-6v6m3-6v6"/></svg>';

export const settingsIconPaths =
  '<path d="M10.5 2h3l.5 2.1c.8.2 1.5.5 2.2.9l1.9-1.2 2.1 2.1-1.2 1.9c.4.7.7 1.4.9 2.2l2.1.5v3l-2.1.5c-.2.8-.5 1.5-.9 2.2l1.2 1.9-2.1 2.1-1.9-1.2c-.7.4-1.4.7-2.2.9l-.5 2.1h-3l-.5-2.1c-.8-.2-1.5-.5-2.2-.9l-1.9 1.2-2.1-2.1 1.2-1.9c-.4-.7-.7-1.4-.9-2.2L2 13.5v-3l2.1-.5c.2-.8.5-1.5.9-2.2L3.8 5.9l2.1-2.1 1.9 1.2c.7-.4 1.4-.7 2.2-.9L10.5 2Z"/><circle cx="12" cy="12" r="3"/>';
export const settingsIcon =
  `<svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${settingsIconPaths}</svg>`;

/**
 * Device-independent theme symbols: exactly the same SVG on desktop and mobile.
 */
export const themeSunIcon =
  '<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
export const themeMoonIcon =
  '<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.985 12.486A9 9 0 0 1 11.514 3.015a9 9 0 1 0 9.47 9.47Z"/></svg>';

/**
 * Consistent edit/delete icons for bottlings, physical bottles and attachments.
 */
export const editIcon = '<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 5 4 4"/></svg>';

export const locationIcon =
  '<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 21s6-5.7 6-11a6 6 0 1 0-12 0c0 5.3 6 11 6 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>';

export const deleteIcon =
  '<svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14h10l1-14M10 10v7m4-7v7"/></svg>';

/** Furniture isolation is a separate action from selecting its shelves. */
export const eyeIcon = '<svg class="warehouse-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
export const eyeOffIcon =
  '<svg class="warehouse-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.8 7.2C3.3 8.5 2.5 10.2 2.5 12c0 0 3.5 6.5 9.5 6.5 2 0 3.9-.7 5.5-1.8M9.8 5.7c.7-.2 1.4-.2 2.2-.2 6 0 9.5 6.5 9.5 6.5a13.6 13.6 0 0 1-2.2 3.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3 21 21"/></svg>';

/**
 * Traditional malt-kiln pagoda roof for map locations without physical bottles.
 */
export const pagodaRoofIcon =
  '<svg class="map-pagoda-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 3h4l1 3h-6l1-3Z"/><path d="M12 6c-2.3 4-5 6.5-9 7 2.2 1.2 4 .5 5-.2h8c1 .7 2.8 1.4 5 .2-4-.5-6.7-3-9-7Z"/><path d="M7 14v6h10v-6M5 21h14"/></svg>';

/** Closed distilleries get a visibly distinct crossed-out kiln symbol. */
export const closedDistilleryIcon =
  '<svg class="map-pagoda-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 3h4l1 3h-6l1-3Z"/><path d="M12 6c-2.3 4-5 6.5-9 7 2.2 1.2 4 .5 5-.2h8c1 .7 2.8 1.4 5 .2-4-.5-6.7-3-9-7Z"/><path d="M7 14v6h10v-6M5 21h14"/><path d="M3 3l18 18" stroke-width="2.5"/></svg>';

/** Reusable vector controls: no font-dependent arrow or chevron glyphs. */
const uiSymbol = (path, extraClass = '') =>
  `<svg class="ui-symbol${extraClass ? ` ${extraClass}` :
    ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;

export const chevronDownIcon = (extraClass = '') =>
  uiSymbol('<path d="m6 9 6 6 6-6"/>', extraClass);
export const chevronRightIcon = uiSymbol('<path d="m9 6 6 6-6 6"/>');
export const chevronLeftIcon = uiSymbol('<path d="m15 6-6 6 6 6"/>');
export const chevronsLeftIcon =
  uiSymbol('<path d="m11 6-6 6 6 6m8-12-6 6 6 6"/>');
export const chevronsRightIcon =
  uiSymbol('<path d="m5 6 6 6-6 6m8-12 6 6-6 6"/>');
export const arrowLeftIcon = uiSymbol('<path d="m12 19-7-7 7-7M5 12h14"/>');
export const arrowRightIcon = uiSymbol('<path d="m12 5 7 7-7 7M19 12H5"/>');
export const arrowUpIcon = uiSymbol('<path d="m5 12 7-7 7 7M12 5v14"/>');
export const arrowDownIcon = uiSymbol('<path d="m5 12 7 7 7-7M12 19V5"/>');
export const arrowsUpDownIcon =
  uiSymbol('<path d="m8 8 4-4 4 4M12 4v16m-4-4 4 4 4-4"/>');
export const closeIcon = uiSymbol('<path d="M18 6 6 18M6 6l12 12"/>');
export const collectionTableIcon =
  uiSymbol('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M10 4v16"/>');
export const collectionCardsIcon =
  uiSymbol('<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>');
/**
 * Three tasting glasses make the planning action identifiable on both pages.
 */
export const helpCircleIcon =
  uiSymbol('<circle cx="12" cy="12" r="9"/><path d="M9.3 9a2.8 2.8 0 1 1 4.9 1.9c-.9.9-2.2 1.2-2.2 3.1M12 17h.01"/>');
export const flightPlanIcon =
  uiSymbol('<path d="M2 5h6L7 18H3L2 5Zm7-2h6l-1 15h-4L9 3Zm7 2h6l-1 13h-4L16 5Z"/><path d="M3 11h4m3-1h4m3 1h4"/>');
export const plusIcon = uiSymbol('<path d="M12 5v14M5 12h14"/>');
export const minusIcon = uiSymbol('<path d="M5 12h14"/>');
export const gripIcon = uiSymbol('<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>');
export const successIcon = uiSymbol('<path d="m4 12 5 5 11-11"/>');
export const warningIcon =
  uiSymbol('<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/>');
export const moreIcon = uiSymbol('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>');
export const sparkleIcon =
  uiSymbol('<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z"/>');
export const analysisOverviewIcon =
  uiSymbol('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M9 10v10"/>');
export const analysisInventoryIcon =
  uiSymbol('<path d="M4 7h16M5 7l1 13h12l1-13M7 4h10"/><path d="M9 11h6m-6 4h6"/>');
export const analysisOriginsIcon =
  uiSymbol('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a16 16 0 0 1 0 18M12 3a16 16 0 0 0 0 18"/>');
export const analysisProfileIcon =
  uiSymbol('<path d="m12 2 9 7-3.4 11H6.4L3 9l9-7Z"/><path d="m12 7 4 3-1.4 5h-5.2L8 10l4-3Z"/>');
export const analysisFinanceIcon =
  uiSymbol('<path d="M19 5a7 7 0 0 0-10 9m0 0a7 7 0 0 0 10 5M5 10h11M5 14h11"/>');
export const analysisTimelineIcon =
  uiSymbol('<path d="M3 20V4M3 20h18M7 16l4-5 4 2 5-7"/>');
export const analysisQualityIcon =
  uiSymbol('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>');
