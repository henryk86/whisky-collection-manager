import {createExternalImport} from '../import/controller.js';
import {validateExtensionPayload} from './payload.js';
import {t} from '../../i18n/index.js';

/**
 * Whiskybase-specific adapter. All generic import workflow lives in
 * ../import/.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createWhiskybase({state, ...dependencies}) {
  return createExternalImport({
    state, ...dependencies,
    sourceName: 'Whiskybase',
    extraFieldLabels: {
      whiskybaseId: t('forms.bottling.whiskybaseId'),
      whiskybaseUrl: t('forms.bottling.whiskybaseUrl'),
    },
    validatePayload: validateExtensionPayload,
    /**
     * Selects existing bottling matching the input.
     *
     * @param {*} collection Collection data to process.
     * @param {*} incoming Value used by this operation.
     * @return {*} Result computed from the supplied inputs.
     */
    findExistingBottling: (collection, incoming) => collection.bottlings.find(bottling => bottling.whiskybaseId === incoming.fields.whiskybaseId),
  });
}
