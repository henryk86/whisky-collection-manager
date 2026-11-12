import { t } from '../../i18n/index.js';
/** Treat extension payloads as untrusted input; whitelist all accepted fields. */
export function validateExtensionPayload(data) {
    if (!data || data.version !== 2 || data.source !== 'external' || typeof data.fields !== 'object' || !data.fields || typeof data.fields.whiskybaseId !== 'string' || !/^[0-9]{1,12}$/.test(data.fields.whiskybaseId)) {
        throw Error(t('whiskybase.errors.invalidPayload'));
    }
    const url = new URL(data.fields.whiskybaseUrl || '');
    if (url.protocol !== 'https:' || !['www.whiskybase.com', 'whiskybase.com'].includes(url.hostname) || !new RegExp('^/(?:[a-z]{2}/)?whiskies/whisky/' + data.fields.whiskybaseId + '(?:/|$)', 'i').test(url.pathname)) {
        throw Error('Whiskybase-URL passt nicht zum Eintrag');
    }
    if (typeof data.fields.name !== 'string' || !data.fields.name.trim() || data.fields.name.length > 250) {
        throw Error('Whiskyname fehlt');
    }
    const allowed = ['name', 'whiskyType', 'brand', 'bottler', 'ageYears', 'abv', 'volumeMl', 'distillationYear', 'bottlingYear', 'distillationDate', 'bottlingDate', 'releaseYear', 'caskType', 'caskNumber', 'limitedEditionCount', 'region', 'country', 'whiskybaseId', 'whiskybaseUrl'];
    const fields = Object.fromEntries(Object.entries(data.fields).filter(([k, v]) => allowed.includes(k) && (v === null || typeof v === 'string' || typeof v === 'number')));
    const token = data.imageToken;
    if (token != null && (typeof token !== 'string' || !/^[a-f0-9-]{36}$/i.test(token))) {
        throw Error(t('whiskybase.errors.invalidImageToken'));
    }
    return {
        version: 2, source: 'external', whiskyId: 'WB' + fields.whiskybaseId,
        distilleryName: typeof data.distilleryName === 'string' ? data.distilleryName.slice(0, 1000) : null,
        imageToken: token || null, fields
    };
}
