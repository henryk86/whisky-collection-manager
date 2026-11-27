import {queryAll} from '../../ui/dom.js';

/**
 * Suggests a complete composition for a single malt or single grain with exactly one selected
 * distillery. Other selections leave the existing editable value unchanged.
 *
 * @param {!HTMLFormElement} form Bottling editor containing the classification controls.
 * @param {string=} expectedDistilleryId If supplied, the selected distillery must also match this import source.
 */
export function suggestSingleDistilleryComposition(form, expectedDistilleryId) {
  const whiskyType = /** @type {?HTMLSelectElement} */ (form.elements.namedItem('whiskyType'));
  const compositionComplete = /** @type {?HTMLSelectElement} */ (form.elements.namedItem('compositionComplete'));
  if (!compositionComplete || !['single_malt', 'single_grain'].includes(whiskyType?.value)) return;
  const assigned = /** @type {!Array<HTMLInputElement>} */ (queryAll('input[name=distilleryIds]:checked', form));
  if (assigned.length === 1 && assigned[0].value &&
    (expectedDistilleryId === undefined || assigned[0].value === expectedDistilleryId)) {
    compositionComplete.value = 'true';
  }
}
