import { queryAll } from '../../ui/dom.js';
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
    for (const key of ['ageYears', 'releaseYear', 'distillationYear', 'bottlingYear', 'abv', 'volumeMl', 'firstVolumeMl', 'limitedEditionCount', 'purchasePrice', 'rating']) {
        if (data[key] != null) {
            data[key] = Number(data[key]);
        }
    }
    return data;
}
