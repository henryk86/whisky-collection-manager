import {actionButton} from '../ui/buttons.js';
import {headingTitle, pageHeader} from '../ui/headers.js';
import {addActionLabel} from '../ui/action-icons.js';
import {escapeHtml} from '../ui/dom.js';
import {availableLanguages, currentLanguage, t} from '../i18n/index.js';
import {renderBackupSection} from './backups.js';
import {backToCollectionButton} from '../ui/navigation-controls.js';
import {sectionWorkspace} from '../ui/section-navigation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates(
  new URL('./templates/settings.html', import.meta.url));

/**
 * Creates settings view for settings.
 *
 * @param {!Object} state Current application state.
 * @param {!Object=} auth Auth used by this operation.
 * @return {!Object} Structured result for the caller.
 */
export function createSettingsView(state, auth = {
  /**
   * Derives the users section result from the supplied values.
   * @return {string} Resulting text.
   */
  usersSection: () => '',
}) {
  /**
   * Selects and transforms the settings records.
   * @return {string} Resulting text.
   */
  function settings() {
    const tabs = [
      ...['general', 'backups', 'transfer', 'distilleries'],
      ...(state.auth?.canManageUsers ? ['users'] : []),
    ].map(id => ({
      id,
      label: id === 'users' ? t('auth.users') : t(`settings.navigation.${id}`),
    }));
    const active = tabs.some(item => item.id === state.settingsSection) ?
      state.settingsSection : 'general';
    /**
     * Builds the localized panel text for the current language.
     *
     * @param {*} id Identifier of the affected record.
     * @param {*} content Content to render, store or examine.
     * @return {string} Resulting text.
     */
    const panel = (id, content) =>
      renderTemplate('settingsSection', {
        id: id,
        id2: id ===
          active ? '' : ' hidden',
        headingTitle: headingTitle({
          title: t(`settings.navigation.${id}`),
          level: 2,
          className: 'analytics-section-title',
        }),
        content: content,
      });
    const general = renderTemplate('panel', {
      headingTitle: headingTitle({
        title:
          t('settings.language.label'),
      }
      ),
      entries: Object.entries(availableLanguages(
      )).map(([code, name]) => renderTemplate('generalOption', {
        code: code,
        selected: code === currentLanguage() ? 'selected' :
          '',
        name: name,
      })).join(
        ''),
      headingTitle2: headingTitle({title: t('settings.collection.title')}),
      fullYear: new Date().getFullYear(),
      establishedYear: state.collection
        .settings?.establishedYear ?? '',
    });
    const backups = renderBackupSection(state);
    const transfer = renderTemplate('panel2', {
      headingTitle: headingTitle({
        title: t('settings.exports.additionalExports'),
      }),
      importButton: actionButton({
        label: t("settings.imports.importJson"),
        action: 'import',
        variant: 'destructive',
      }),
    });
    const distilleries = renderTemplate('distillerySearch', {
      distillerySearch: state.distillerySearch || '',
      length: state.collection.distilleries.filter(d => d.name
        .toLocaleLowerCase('de').includes((state.distillerySearch || '')
          .trim().toLocaleLowerCase('de'))).length,
      length2: state.collection
        .distilleries.length,
      addDistilleryButton: actionButton({
        trustedContent: addActionLabel(t("settings.distilleries.add")),
        action: 'add-distillery',
      }),
      sort: state.collection
        .distilleries
        .slice().sort((a, b) => a.name.localeCompare(b.name,
          'de')).map(distillery =>
            renderTemplate('distilleryRow', {
              includes: distillery.name
                .toLocaleLowerCase('de').includes((state.distillerySearch ||
                  '').trim().toLocaleLowerCase('de')) ? '' : 'hidden',
              name: distillery.name,
              id: distillery.id,
              name2: distillery.name,
            })).join(''),
      hidden: state.collection
        .distilleries.some(d => d.name.toLocaleLowerCase('de')
          .includes((state.distillerySearch || '').trim()
            .toLocaleLowerCase('de'))) ? 'hidden' :
        '',
    });
    const workspace = sectionWorkspace(
      {
        sections: tabs, activeId: active,
        action: 'settings-section', itemAttribute: 'data-settings-section',
        label: t('settings.navigation.label'), switchKind: 'settings',
      },
      panel('general', general) + panel('backups', backups) +
      panel('transfer', transfer) + panel('distilleries', distilleries) +
      (state.auth?.canManageUsers ?
        renderTemplate('settingsSection2', {
          active: active
            === 'users' ? '' : ' hidden',
          headingTitle: headingTitle({
            title: t('auth.users'),
            level: 2,
            className: 'analytics-section-title',
          }),
          usersSection: auth.usersSection(
          ),
        }) : '')
    );
    return renderTemplate('analyticsPage', {
      pageHeader: pageHeader({
        title: t('settings.page.title'),
        eyebrow: t('settings.page.eyebrow'),
        intro: t('settings.page.intro'),
        className: 'settings-heading',
        actions: String(backToCollectionButton),
      }),
      workspace: workspace,
    });
  }
  return settings;
}

/**
 * Show a settings area without replacing forms or losing unsaved field values.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} container Container used by this operation.
 * @return {boolean} Whether the condition is satisfied.
 */
export function activateSettingsSection(id, container) {
  if (!['general', 'backups', 'transfer', 'distilleries', 'users']
    .includes(id) || !container ||
    !container.querySelector(`[data-settings-panel="${id}"]`)) return false;
  for (const button of container.querySelectorAll('[data-settings-section]')) {
    const active = button.dataset.settingsSection === id;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  const select = container.querySelector('[data-section-switch="settings"]');
  if (select) select.value = id;
  for (const panel of container.querySelectorAll('[data-settings-panel]'))
    panel.hidden = panel.dataset.settingsPanel !== id;
  return true;
}
