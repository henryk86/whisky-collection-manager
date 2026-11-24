import {backNavigation} from './headers.js';
import {t} from '../i18n/index.js';
/** Compatibility adapter: the secondary-page return now uses BackNavigation. */
export const backToCollectionButton = {
  toString: () => backNavigation(
    'goto-home',
    t('common.navigation.backToCollection'),
    '',
    'page-action'
  ),
};
