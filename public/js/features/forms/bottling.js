import { t } from '../../i18n/index.js';
import { escapeHtml } from '../../ui/dom.js';
import { textInput, selectInput, areaInput } from '../../ui/fields.js';
import { bottleStatusLabels, whiskyTypeLabels, photoAccept } from '../../domain/labels.js';
import { fileAccept } from '../files.js';
export function createBottlingForm({ state, selectors }) {
    const { distilleryIds } = selectors;
    function distilleryPicker(bottling) {
        const selected = new Set(distilleryIds(bottling));
        const options = state.collection.distilleries.slice().sort((a, z) => a.name.localeCompare(z.name, 'de'));
        return `<div class="form-field full">
    <span>${t("forms.bottling.participatingDistilleries")}</span>
    <input type="search" class="distillery-filter" placeholder="${t("forms.bottling.searchDistilleries")}" aria-label="${t("forms.bottling.filterDistilleries")}">
    <div class="distillery-options">${options.map(distillery => `<label class="distillery-option">
    <input type="checkbox" name="distilleryIds" value="${escapeHtml(distillery.id)}" ${selected.has(distillery.id) ? 'checked' : ''}>
    <span>${escapeHtml(distillery.name)}${distillery.status === 'closed' ? ` · ${t('home.status.closed').toLowerCase()}` : ''}</span>
    </label>`).join('')}</div>
    <small class="hint">${t("forms.bottling.blendComponentsHint")}</small>
    </div>`;
    }
    function bottlingForm(bottling = {}) {
        return `<form id="bottling-form" data-id="${escapeHtml(bottling.id || '')}">
    <div class="forms">${textInput(t("forms.bottling.whiskyNameRequired"), 'name', bottling.name, {
            required: true, full: true, placeholder: t('forms.bottling.exampleName')
        })}${selectInput(t("forms.bottling.whiskyCategory"), 'whiskyType', [['', t('forms.bottling.notProvided')], ...Object.entries(whiskyTypeLabels)], bottling.whiskyType)}${textInput(t("forms.bottling.brandOrProductLine"), 'brand', bottling.brand, {
            placeholder: t('forms.bottling.exampleBrand')
        })}${distilleryPicker(bottling)}<p class="hint">${t("forms.bottling.originDerivedHint")}</p>${selectInput(t("forms.bottling.blendCompositionComplete"), 'compositionComplete', [['false', t('forms.bottling.compositionUnknown')], ['true', t('forms.bottling.compositionKnown')]], String(bottling.compositionComplete === true))}<div class="form-field">${t("forms.bottling.newDistillery")}<button type="button" class="btn" data-act="add-distillery">${t("forms.common.createButton")}</button>
    </div>${textInput(t("forms.bottling.bottler"), 'bottler', bottling.bottler)}${textInput(t("forms.bottling.ageYears"), 'ageYears', bottling.ageYears, {
            type: 'number'
        })}${textInput(t("forms.bottling.abv"), 'abv', bottling.abv, {
            type: 'number', step: '0.01'
        })}${textInput(t("forms.bottling.nominalVolume"), 'volumeMl', bottling.volumeMl, {
            type: 'number'
        })}${textInput(t("forms.bottling.releaseYear"), 'releaseYear', bottling.releaseYear, {
            type: 'number'
        })}${textInput(t("forms.bottling.distillationDate"), 'distillationDate', bottling.distillationDate, {
            type: 'date'
        })}${textInput(t("forms.bottling.distillationYear"), 'distillationYear', bottling.distillationYear, {
            type: 'number'
        })}${textInput(t("forms.bottling.bottlingDate"), 'bottlingDate', bottling.bottlingDate, {
            type: 'date'
        })}${textInput(t("forms.bottling.bottlingYear"), 'bottlingYear', bottling.bottlingYear, {
            type: 'number'
        })}${textInput(t("forms.bottling.caskType"), 'caskType', bottling.caskType)}${textInput(t("forms.bottling.caskNumber"), 'caskNumber', bottling.caskNumber)}${textInput(t("forms.bottling.limitedBottleCount"), 'limitedEditionCount', bottling.limitedEditionCount, {
            type: 'number'
        })}${textInput(t("forms.bottling.whiskybaseUrl"), 'whiskybaseUrl', bottling.whiskybaseUrl, {
            type: 'url', full: true
        })}${textInput(t("forms.bottling.whiskybaseId"), 'whiskybaseId', bottling.whiskybaseId)}${selectInput(t("forms.bottle.editStatus"), 'completionStatus', [['incomplete', t('detail.status.incomplete')], ['complete', t('detail.status.complete')]], bottling.completionStatus || 'incomplete')}${areaInput(t("forms.bottling.comment"), 'description', bottling.description)}</div>${bottling.id ? '' : `<hr class="divider">
    <h3>${t("forms.bottle.firstBottle")}</h3>
    <div class="forms">${textInput(t("forms.bottle.inventoryNumberOptional"), 'firstInventoryNumber', '', {
            placeholder: t('forms.bottle.inventoryPlaceholderShort')
        })}<div class="form-field">
    <span>${t("forms.bottle.autoInventoryNumber")}</span>
    <button type="button" class="btn" data-act="suggest-first">${t("forms.bottle.suggestInventoryNumber")}</button>
    </div>${selectInput(t("forms.bottle.initialType"), 'firstVolumeType', [['standard', t('forms.bottle.normalBottle')], ['sample', t('forms.bottle.sampleBottle')]], 'standard')}${textInput(t("forms.bottle.initialSize"), 'firstVolumeMl', '', { type: 'number' })}${selectInput(t("forms.bottle.status"), 'firstStatus', Object.keys(bottleStatusLabels).map(status=>[status,t(({closed:"home.status.closed",open:"analytics.inventory.openedStatus",empty:"home.status.empty"})[status])]), 'closed')}<label class="form-field full">${t("forms.bottle.initialPhotos")}<input name="firstPhotos" type="file" accept="${photoAccept}" multiple>
    </label>
    <label class="form-field full">${t("forms.bottle.initialAttachments")}
    <input name="firstFiles" type="file" accept="${fileAccept}" multiple>
    <small class="hint">${t("forms.bottle.attachmentTypesAndLimit")}</small>
    </label>
    </div>
    <p class="hint">${t("forms.bottle.addToExistingBottlingHint")}</p>`}<div class="actions" style="justify-content:flex-end;margin-top:23px">
    <button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
    <button class="btn primary" type="submit">${t("common.actions.save")}</button>
    </div>
    </form>`;
    }
    return bottlingForm;
}
