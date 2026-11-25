import {availableLanguages, currentLanguage, t} from '../../i18n/index.js';

/**
 * Prepares settings presentation data without rendering or mutating state.
 * @param {!Object} state Current settings and permissions.
 * @return {!Object} Prepared presentation data.
 */
export function createSettingsViewModel(state) {
  const tabs = [
    ...['general', 'backups', 'transfer', 'distilleries'],
    ...(state.auth?.canManageUsers ? ['users'] : []),
  ].map(id => ({
    id,
    label: id === 'users' ? t('auth.users') : t(`settings.navigation.${id}`),
  }));
  const active = tabs.some(item => item.id === state.settingsSection) ?
    state.settingsSection : 'general';
  const languages = Object.entries(availableLanguages()).map(([code, name]) =>
    ({code, name, selected: code === currentLanguage()}));
  const distillerySearch = state.distillerySearch || '';
  const query = distillerySearch.trim().toLocaleLowerCase('de');
  const distilleries = state.collection.distilleries.slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map(d => ({
      ...d, visible: d.name.toLocaleLowerCase('de')
        .includes(query),
    }));
  const matchCount = distilleries.filter(d => d.visible).length;
  return {
    tabs, active, languages, distillerySearch, distilleries, matchCount,
    establishedYear: state.collection.settings?.establishedYear ?? '',
  };
}
