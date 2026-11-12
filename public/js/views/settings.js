import { escapeHtml } from '../ui/dom.js';
import { availableLanguages, currentLanguage, t } from '../i18n/index.js';
import { renderBackupSection } from './backups.js';
import { backToCollectionButton } from '../ui/navigation-controls.js';
export function createSettingsView(state) {
    function settings() {
        return `<section class="section-head settings-heading">
    <div>
    <span class="eyebrow dark">${t("settings.page.eyebrow")}</span>
    <h2>${t("settings.page.title")}<span class="heading-period">.</span></h2>
    <p class="intro">${t("settings.privacy.localStorageAndMapNotice")}</p>
    </div>
    ${backToCollectionButton}
    </section>
    <div class="panel section"><h3>${t("settings.language.label")}</h3><label class="form-field" for="ui-language">${t("settings.language.choose")}<select id="ui-language" aria-label="${t("settings.language.label")}">${Object.entries(availableLanguages()).map(([code, name]) => `<option value="${escapeHtml(code)}" ${code === currentLanguage() ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label><p class="hint">${t("settings.language.addingLanguagesHint")}</p></div>
    <form id="collection-settings-form" class="panel section collection-settings">
    <h3>${t("settings.collection.title")}</h3>
    <label class="form-field" for="established-year">${t("settings.collection.foundingYearLabel")}
    <input type="number" inputmode="numeric" id="established-year" name="establishedYear" min="1600" max="${new Date().getFullYear()}" step="1" placeholder="z. B. 2018" value="${state.collection.settings?.establishedYear ?? ''}">
    </label>
    <p class="hint">${t("settings.collection.foundingYearDisplayHint")}</p>
    <button type="submit" class="btn primary">${t("settings.collection.saveFoundingYear")}</button>
    </form>
    ${renderBackupSection(state)}
    <div class="panel section">
      <h3>${t("settings.exports.additionalExports")}</h3>
      <p class="muted">${t("settings.exports.notFullBackupWarning")}</p>
      <div class="actions"><a class="btn" href="/api/export/json" download>${t("settings.exports.downloadJson")}</a><a class="btn" href="/api/export/csv" download>${t("settings.exports.downloadCsv")}</a></div>
      <details style="margin-top:15px"><summary>${t("settings.imports.legacyJsonImport")}</summary>
      <p class="warning">${t("settings.imports.jsonDoesNotIncludeAttachments")}</p>
      <input type="file" id="import-file" accept="application/json,.json" style="margin-top:10px">
      <button class="btn danger" data-act="import" style="margin-top:10px">${t("settings.imports.importJson")}</button></details>
    </div>
    <div class="panel section">
    <div class="distillery-management-head">
    <h3>${t("backups.summary.distilleriesLabel")}</h3>
    <button class="btn" type="button" data-act="add-distillery">${t("settings.distilleries.add")}</button>
    </div>
    <div class="distillery-tools">
    <input type="search" class="distillery-search" id="distillery-search" value="${escapeHtml(state.distillerySearch || '')}" placeholder="${t("settings.distilleries.searchPlaceholder")}" aria-label="${t("settings.distilleries.search")}" autocomplete="off">
    <span class="distillery-count" id="distillery-count" role="status" aria-live="polite">${state.collection.distilleries.filter(d => d.name.toLocaleLowerCase('de').includes((state.distillerySearch || '').trim().toLocaleLowerCase('de'))).length} von ${state.collection.distilleries.length}</span>
    </div>
    <div class="distillery-list" role="list" aria-label="${t("backups.summary.distilleriesLabel")}">${state.collection.distilleries.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map(distillery => `<div class="distillery-row" role="listitem" ${distillery.name.toLocaleLowerCase('de').includes((state.distillerySearch || '').trim().toLocaleLowerCase('de')) ? '' : 'hidden'}>
    <strong data-i18n-ignore>${escapeHtml(distillery.name)}</strong>
    <button type="button" class="btn small" data-act="rename-distillery" data-id="${escapeHtml(distillery.id)}" aria-label="${escapeHtml(distillery.name)} umbenennen">${t("common.actions.edit")}</button>
    </div>`).join('')}<p class="distillery-no-results" ${state.collection.distilleries.some(d => d.name.toLocaleLowerCase('de').includes((state.distillerySearch || '').trim().toLocaleLowerCase('de'))) ? 'hidden' : ''}>${t("settings.distilleries.noMatches")}</p></div>
    </div>`;
    }
    return settings;
}
