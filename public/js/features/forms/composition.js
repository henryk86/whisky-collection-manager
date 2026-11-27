import {queryAll} from '../../ui/dom.js';

/** @type {!WeakSet<!HTMLFormElement>} Forms whose current completeness was inferred. */
const inferred = new WeakSet();
/** @type {!WeakSet<!HTMLFormElement>} Forms with an explicit completeness choice during this edit. */
const manuallySelected = new WeakSet();

/**
 * Preserves an explicit completeness choice for the lifetime of the current editor.
 * @param {!HTMLFormElement} form Bottling editor whose completeness control was changed by the user.
 */
export function preserveManualComposition(form) {
  inferred.delete(form);
  manuallySelected.add(form);
}

/**
 * Infers completeness for single malt or single grain with exactly one selected distillery.
 * Reverts only a previously inferred value when its prerequisites cease to hold. Saved values
 * and explicit choices are not reset. Import callers may restrict inference to a matched source.
 *
 * @param {!HTMLFormElement} form Bottling editor containing the classification controls.
 * @param {?string=} expectedDistilleryId Matched import source, null to disallow new inference, or undefined for manual classification changes.
 */
export function suggestSingleDistilleryComposition(form, expectedDistilleryId) {
  const whiskyType = /** @type {?HTMLSelectElement} */ (form.elements.namedItem('whiskyType'));
  const compositionComplete = /** @type {?HTMLSelectElement} */ (form.elements.namedItem('compositionComplete'));
  if (!compositionComplete || manuallySelected.has(form)) return;
  const assigned = /** @type {!Array<HTMLInputElement>} */ (queryAll('input[name=distilleryIds]:checked', form));
  const eligible = ['single_malt', 'single_grain'].includes(whiskyType?.value) && assigned.length === 1 && Boolean(assigned[0].value);
  if (!eligible) {
    if (inferred.delete(form)) compositionComplete.value = 'false';
    return;
  }
  if ((expectedDistilleryId === undefined || assigned[0].value === expectedDistilleryId) &&
    compositionComplete.value === 'false') {
    compositionComplete.value = 'true';
    inferred.add(form);
  }
}
