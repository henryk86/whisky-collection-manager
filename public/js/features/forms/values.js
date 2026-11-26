import {queryAll} from '../../ui/dom.js';
/**
 * Reads and normalizes current form-control values for saving.
 *
 * @param {HTMLFormElement} form Editor form whose controls are converted to an API payload.
 * @return {!Object} Structured result for the caller.
 */
export function formValues(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof File) {
      delete data[k];
      continue;
    }
    if (v === '') {
      data[k] = null;
    }
  }
  if (form.id === 'bottling-form') {
    data.distilleryIds = queryAll('input[name=distilleryIds]:checked', form).map(x => x.value);
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
