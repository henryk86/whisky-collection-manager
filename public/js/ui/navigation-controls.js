import {backNavigation} from './headers.js';
import {t} from '../i18n/index.js';

/**
 * Builds the localized secondary-page return action.
 * @return {*} Rendered back navigation.
 */
export function backToCollectionButton() {
  return backNavigation('goto-home', t('common.navigation.backToCollection'),
    '', 'page-action');
}
