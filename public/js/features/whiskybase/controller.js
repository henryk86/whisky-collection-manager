import { createExternalImport } from '../import/controller.js';
import { validateExtensionPayload } from './payload.js';
import { t } from '../../i18n/index.js';

/** Whiskybase-specific adapter. All generic import workflow lives in ../import/. */
export function createWhiskybase({ state, ...dependencies }) {
    return createExternalImport({
        state, ...dependencies,
        sourceName: 'Whiskybase',
        extraFieldLabels: { whiskybaseId: t('forms.bottling.whiskybaseId'), whiskybaseUrl: t('forms.bottling.whiskybaseUrl') },
        validatePayload: validateExtensionPayload,
        findExistingBottling: (collection, incoming) => collection.bottlings.find(
            bottling => bottling.whiskybaseId === incoming.fields.whiskybaseId
        ),
    });
}
