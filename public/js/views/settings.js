import { addActionLabel } from '../ui/action-icons.js';
import { escapeHtml } from '../ui/dom.js';
import { availableLanguages, currentLanguage, t } from '../i18n/index.js';
import { renderBackupSection } from './backups.js';
import { backToCollectionButton } from '../ui/navigation-controls.js';
import { sectionWorkspace } from '../ui/section-navigation.js';
export function createSettingsView(state, auth = {usersSection: () => ''}) {
    function settings() {
        const tabs = [...['general','backups','transfer','distilleries'], ...(state.auth?.canManageUsers ? ['users'] : [])].map(id => ({id,label:id === 'users' ? t('auth.users') : t(`settings.navigation.${id}`)}));
        const active = tabs.some(item => item.id === state.settingsSection) ? state.settingsSection : 'general';
        const panel = (id, content) => `<section class="settings-section" data-settings-panel="${id}"${id === active ? '' : ' hidden'}><h2 class="analytics-section-title">${t(`settings.navigation.${id}`)}</h2>${content}</section>`;
        const general = `    <div class="panel section"><h3>${t("settings.language.label")}</h3><label class="form-field" for="ui-language">${t("settings.language.choose")}<select id="ui-language" aria-label="${t("settings.language.label")}">${Object.entries(availableLanguages()).map(([code, name]) => `<option value="${escapeHtml(code)}" ${code === currentLanguage() ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label></div>
    <form id="collection-settings-form" class="panel section collection-settings">
    <h3>${t("settings.collection.title")}</h3>
    <label class="form-field" for="established-year">${t("settings.collection.foundingYearLabel")}
    <input type="number" inputmode="numeric" id="established-year" name="establishedYear" min="1600" max="${new Date().getFullYear()}" step="1" placeholder="z. B. 2018" value="${state.collection.settings?.establishedYear ?? ''}">
    </label>
    <button type="submit" class="btn primary">${t("settings.collection.saveFoundingYear")}</button>
    </form>
`;
        const backups = renderBackupSection(state);
        const transfer = `    <div class="panel section">
      <h3>${t("settings.exports.additionalExports")}</h3>
      <p class="muted">${t("settings.exports.notFullBackupWarning")}</p>
      <div class="actions"><a class="btn" href="/api/export/json" download>${t("settings.exports.downloadJson")}</a><a class="btn" href="/api/export/csv" download>${t("settings.exports.downloadCsv")}</a></div>
      <details style="margin-top:15px"><summary>${t("settings.imports.legacyJsonImport")}</summary>
      <p class="warning">${t("settings.imports.jsonDoesNotIncludeAttachments")}</p>
      <input type="file" id="import-file" accept="application/json,.json" style="margin-top:10px">
      <button class="btn danger" data-act="import" style="margin-top:10px">${t("settings.imports.importJson")}</button></details>
    </div>
`;
        const distilleries = `    <div class="panel section">
    <div class="distillery-tools">
    <input type="search" class="distillery-search" id="distillery-search" value="${escapeHtml(state.distillerySearch || '')}" placeholder="${t("settings.distilleries.searchPlaceholder")}" aria-label="${t("settings.distilleries.search")}" autocomplete="off">
    <span class="distillery-count" id="distillery-count" role="status" aria-live="polite">${state.collection.distilleries.filter(d => d.name.toLocaleLowerCase('de').includes((state.distillerySearch || '').trim().toLocaleLowerCase('de'))).length} von ${state.collection.distilleries.length}</span>
    <button class="btn" type="button" data-act="add-distillery">${addActionLabel(t("settings.distilleries.add"))}</button>
    </div>
    <div class="distillery-list" role="list" aria-label="${t("backups.summary.distilleriesLabel")}">${state.collection.distilleries.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map(distillery => `<div class="distillery-row" role="listitem" ${distillery.name.toLocaleLowerCase('de').includes((state.distillerySearch || '').trim().toLocaleLowerCase('de')) ? '' : 'hidden'}>
    <strong data-i18n-ignore>${escapeHtml(distillery.name)}</strong>
    <button type="button" class="btn small" data-act="rename-distillery" data-id="${escapeHtml(distillery.id)}" aria-label="${escapeHtml(distillery.name)} umbenennen">${t("common.actions.edit")}</button>
    </div>`).join('')}<p class="distillery-no-results" ${state.collection.distilleries.some(d => d.name.toLocaleLowerCase('de').includes((state.distillerySearch || '').trim().toLocaleLowerCase('de'))) ? 'hidden' : ''}>${t("settings.distilleries.noMatches")}</p></div>
    </div>`;
        const workspace = sectionWorkspace({sections:tabs,activeId:active,
            action:'settings-section',itemAttribute:'data-settings-section',
            label:t('settings.navigation.label'),switchKind:'settings',
        }, panel('general',general)+panel('backups',backups)+panel('transfer',transfer)+panel('distilleries',distilleries)+(state.auth?.canManageUsers ? `<section class="settings-section" data-settings-panel="users"${active === 'users' ? '' : ' hidden'}><h2 class="analytics-section-title">${t('auth.users')}</h2><div id="auth-users-content">${auth.usersSection()}</div></section>` : ''));
        return `<div class="analytics-page settings-page"><header class="section-head settings-heading">
    <div class="page-heading-copy">
    <span class="eyebrow dark">${t("settings.page.eyebrow")}</span>
    <h2>${t("settings.page.title")}<span class="heading-period">.</span></h2>
    <p class="intro">${t("settings.page.intro")}</p>
    </div>
    ${backToCollectionButton}
    </header>${workspace}</div>`;
    }
    return settings;
}

/** Show a settings area without replacing forms or losing unsaved field values. */
export function activateSettingsSection(id, container) {
    if (!['general','backups','transfer','distilleries','users'].includes(id) || !container || !container.querySelector(`[data-settings-panel="${id}"]`)) return false;
    for (const button of container.querySelectorAll('[data-settings-section]')) {
        const active = button.dataset.settingsSection === id;
        button.classList.toggle('active',active);
        if (active) button.setAttribute('aria-current','page');
        else button.removeAttribute('aria-current');
    }
    const select = container.querySelector('[data-section-switch="settings"]');
    if (select) select.value = id;
    for (const panel of container.querySelectorAll('[data-settings-panel]')) panel.hidden = panel.dataset.settingsPanel !== id;
    return true;
}
