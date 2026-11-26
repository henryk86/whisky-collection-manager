import {queryAll} from '../../ui/dom.js';
/**
 * Reads and normalizes current form-control values for saving.
 *
 * @param {HTMLFormElement} form Editor form whose controls are converted to an API payload.
 * @return {Record<string, string|number|boolean|string[]|null>} Normalized editor values; files are excluded.
 */
export function formValues(form) {
  const entries = Object.entries(Object.fromEntries(new FormData(form).entries()));
  /** @type {Record<string, string|number|boolean|string[]|null>} */
  const data = Object.fromEntries(entries.flatMap(([key, value]) =>
    value instanceof File ? [] : [[key, value === '' ? null : value]]));
  if (form.id === 'bottling-form') {
    data.distilleryIds = queryAll('input[name=distilleryIds]:checked', form).map((/** @type {HTMLInputElement} */ x) => x.value);
    data.compositionComplete = data.compositionComplete === 'true';
  }
  for (const key of [
    'ageYears',
    'releaseYear',
    'distillationYear',
    'bottlingYear',
    'abv',
    'volumeMl',
    'firstVolumeMl',
    'limitedEditionCount',
    'purchasePrice',
    'rating',
  ]) {
    if (data[key] != null) {
      data[key] = Number(data[key]);
    }
  }
  return data;
}
