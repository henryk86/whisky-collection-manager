import { t } from '../i18n/index.js';
/** Shared return action for secondary pages. */
export const backToCollectionButton = {
    toString: () => `<button type="button" class="btn" data-act="goto-home">${t('common.navigation.backToCollection')}</button>`
};
