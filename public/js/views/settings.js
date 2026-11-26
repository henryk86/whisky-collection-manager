import {createSettingsViewModel} from './models/settings.js';
import {composeMarkup} from '../ui/render-plan.js';
import {actionButton} from '../ui/buttons.js';
import {headingTitle, pageHeader} from '../ui/headers.js';
import {addActionLabel} from '../ui/action-icons.js';
import {t} from '../i18n/index.js';
import {renderBackupSection} from './backups.js';
import {backToCollectionButton} from '../ui/navigation-controls.js';
import {sectionWorkspace} from '../ui/section-navigation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('settings/settings.html');

/**
 * Creates settings view for settings.
 *
 * @param {!Object} state Current application state.
 * @param {!Object=} auth Authentication state and actions used to render the security settings.
 * @return {!Object} Structured result for the caller.
 */
export function createSettingsView(state, auth = {
  /**
   * Omits the user-management section from this settings view.
   * @return {string} Empty section; this view does not render a user-management section.
   */
  usersSection: () => '',
}) {
  /**
   * Prepares settings workspace with navigation and active panel.
   * @return {!import('../ui/render-plan.js').RenderPlan} Settings workspace with navigation and active panel.
   */
  function settings() {
    const {tabs, active, languages, distillerySearch, distilleries,
      matchCount, establishedYear} = createSettingsViewModel(state);
    /**
     * Prepares settings section with visibility derived from the selected tab.
     *
     * @param {*} id Identifier of the affected record.
     * @param {*} content Content to render, store or examine.
     * @return {!import('../ui/render-plan.js').RenderPlan} Settings section with visibility derived from the selected tab.
     */
    const panel = (id, content) =>
      renderTemplate('settingsSection', {
        id: id,
        hiddenAttributes: id === active ? {} : {"hidden": true},
        headingTitle: headingTitle({
          title: t(`settings.navigation.${id}`),
          level: 2,
          className: 'analytics-section-title',
        }),
        content: content,
      });
    const general = renderTemplate('panel', {
      headingTitle: headingTitle({title: t('settings.language.label'), }),
      entries: composeMarkup(languages.map(({code, name, selected}) =>
        renderTemplate('generalOption', {
          code, selectedAttributes: selected ? {"selected": true} : {}, name,
        }))),
      collectionHeading: headingTitle({title: t('settings.collection.title')}),
      fullYear: new Date().getFullYear(),
      establishedYear,
    });
    const backups = renderBackupSection(state);
    const transfer = renderTemplate('panel2', {
      headingTitle: headingTitle({title: t('settings.exports.additionalExports'), }),
      importButton: actionButton({
        label: t("settings.imports.importJson"),
        action: 'import',
        variant: 'destructive',
      }),
    });
    const distilleryPanel = renderTemplate('distillerySearch', {
      distillerySearch,
      length: matchCount,
      distilleryCount: distilleries.length,
      addDistilleryButton: actionButton({
        trustedContent: addActionLabel(t("settings.distilleries.add")),
        action: 'add-distillery',
      }),
      sort: composeMarkup(distilleries.map(distillery =>
        renderTemplate('distilleryRow', {
          hiddenAttributes: distillery.visible ? {} : {"hidden": true},
          name: distillery.name, id: distillery.id, ariaLabel: distillery.name,
        }))),
      hiddenAttributes: matchCount ? {"hidden": true} : {},

    });
    const workspace = sectionWorkspace(
      {
        sections: tabs, activeId: active,
        action: 'settings-section', itemAttribute: 'data-settings-section',
        label: t('settings.navigation.label'), switchKind: 'settings',
      },
      composeMarkup(
        panel('general', general),
        panel('backups', backups),
        panel('transfer', transfer),
        panel('distilleries', distilleryPanel),
        (state.auth?.canManageUsers ?
          renderTemplate('settingsSection2', {
            usersAttributes: active === 'users' ? {} : {"hidden": true},
            headingTitle: headingTitle({
              title: t('auth.users'),
              level: 2,
              className: 'analytics-section-title',
            }),
            usersSection: auth.usersSection(),
          }) : '')
      )
    );
    return renderTemplate('analyticsPage', {
      pageHeader: pageHeader({
        title: t('settings.page.title'),
        eyebrow: t('settings.page.eyebrow'),
        intro: t('settings.page.intro'),
        className: 'settings-heading',
        actions: backToCollectionButton(),
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
 * @param {*} container Settings workspace containing section navigation and panels.
 * @return {boolean} Whether the condition is satisfied.
 */
export function activateSettingsSection(id, container) {
  if (!['general', 'backups', 'transfer', 'distilleries', 'users'].includes(id) || !container ||
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
