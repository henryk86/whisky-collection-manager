import { t } from '../i18n/index.js';
import { backNavigation } from './back-navigation.js';
/** Compatibility adapter: the secondary-page return now uses BackNavigation. */
export const backToCollectionButton = {
    toString: () => backNavigation('goto-home', t('common.navigation.backToCollection'), '', 'page-action')
};
