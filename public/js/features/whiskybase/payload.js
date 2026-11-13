import { t } from '../../i18n/index.js';
import { normalizeImportPayload } from '../import/payload.js';

/** Validate only the provider identity and link; common fields use the generic importer. */
export function validateExtensionPayload(data) {
    const id = data?.fields?.whiskybaseId;
    if (!data || data.version !== 2 || data.source !== 'external' ||
        typeof id !== 'string' || !/^[0-9]{1,12}$/.test(id)) {
        throw Error(t('whiskybase.errors.invalidPayload'));
    }
    let validUrl = false;
    try {
        const url = new URL(data.fields.whiskybaseUrl || '');
        validUrl = url.protocol === 'https:' &&
            ['www.whiskybase.com', 'whiskybase.com'].includes(url.hostname) &&
            new RegExp('^/(?:[a-z]{2}/)?whiskies/whisky/' + id + '(?:/|$)', 'i').test(url.pathname);
    } catch { /* A missing or malformed URL is not a valid provider identity. */ }
    if (!validUrl) throw Error(t('errors.whiskybase.urlMismatch'));
    return normalizeImportPayload(data, {
        referenceId: 'WB' + id,
        extraFields: ['whiskybaseId', 'whiskybaseUrl'],
    });
}
