import { t } from '../../i18n/index.js';

/** Source-independent bottling fields eligible for explicit review and import. */
const COMMON_IMPORT_FIELDS = Object.freeze([
    'name', 'whiskyType', 'brand', 'bottler', 'ageYears', 'abv', 'volumeMl',
    'distillationYear', 'bottlingYear', 'distillationDate', 'bottlingDate',
    'releaseYear', 'caskType', 'caskNumber', 'limitedEditionCount', 'region', 'country',
]);

/** Normalize an untrusted extension payload after the source has checked its own identity. */
export function normalizeImportPayload(data, { referenceId, extraFields = [] } = {}) {
    if (!data || data.version !== 2 || data.source !== 'external' ||
        !data.fields || typeof data.fields !== 'object' || Array.isArray(data.fields)) {
        throw Error(t('imports.errors.invalidPayload'));
    }
    if (typeof data.fields.name !== 'string' || !data.fields.name.trim() || data.fields.name.length > 250) {
        throw Error(t('imports.errors.missingName'));
    }
    if (typeof referenceId !== 'string' || !referenceId.trim()) {
        throw Error(t('imports.errors.invalidPayload'));
    }
    const allowed = new Set([...COMMON_IMPORT_FIELDS, ...extraFields]);
    const fields = Object.fromEntries(Object.entries(data.fields).filter(([key, value]) =>
        allowed.has(key) && (value === null || typeof value === 'string' || typeof value === 'number')));
    const token = data.imageToken;
    if (token != null && (typeof token !== 'string' || !/^[a-f0-9-]{36}$/i.test(token))) {
        throw Error(t('imports.errors.invalidImageToken'));
    }
    return {
        version: 2, source: 'external', referenceId,
        distilleryName: typeof data.distilleryName === 'string' ? data.distilleryName.slice(0, 1000) : null,
        imageToken: token || null, fields,
    };
}
