import {createExternalImport} from '../import/controller.js';
import {validateExtensionPayload} from './payload.js';
import {t} from '../../i18n/index.js';

/**
 * Whiskybase-specific adapter. All generic import workflow lives in
 * ../import/.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Provider-specific external-import operations for Whiskybase.
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
     * @param {*} incoming Imported Whiskybase metadata used to find a matching existing bottling.
     * @return {*} Existing bottling with the imported Whiskybase identifier, or undefined.
     */
    findExistingBottling: (collection, incoming) => collection.bottlings.find(bottling => bottling.whiskybaseId === incoming.fields.whiskybaseId),
  });
}
