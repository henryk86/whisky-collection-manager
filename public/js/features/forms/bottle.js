import { t } from '../../i18n/index.js';
import { escapeHtml } from '../../ui/dom.js';
import { inventoryScanIcon } from '../../ui/action-icons.js';
import { textInput, selectInput, areaInput } from '../../ui/fields.js';
import { bottleStatusLabels, whiskyTypeName, photoAccept } from '../../domain/labels.js';
import { fileAccept } from '../files.js';
export function createBottleForm({ state, selectors }) {
    const { distilleryNames } = selectors;
    function bottleForm(bottle = {}, bottlingId) {
        const owner = state.collection.bottlings.find(entry => entry.id === bottlingId);
        if (!owner) {
            throw Error(t('features.errors.parentBottlingNotFound'));
        }
        const facts = [[t('analytics.filters.distillery'), distilleryNames(owner)], [t('forms.bottling.whiskyCategory'), whiskyTypeName(owner)], [t('forms.bottling.bottler'), owner.bottler], [t('forms.bottling.ageYears'), owner.ageYears == null ? '' : t('home.facts.years',{count:owner.ageYears})], [t('forms.bottling.abv'), owner.abv == null ? '' : `${owner.abv} % Vol.`], [t('forms.bottling.nominalVolume'), owner.volumeMl == null ? '' : `${owner.volumeMl} ml`]].filter(([, value]) => value && value !== 'Nicht angegeben');
        const context = `<section class="bottling-context" aria-label="${t("forms.bottle.linkedBottlingReadonly")}">
    <div class="bottling-context-heading">${t("forms.bottling.title")} <span class="muted">${t("forms.bottle.informationalOnly")}</span>
    </div>
    <strong class="bottling-context-name">${escapeHtml(owner.name)}</strong>
    <dl>${facts.map(([label, value]) => `<div>
    <dt>${escapeHtml(label)}</dt>
    <dd>${escapeHtml(value)}</dd>
    </div>`).join('')}</dl>
    </section>`;
        return `<form id="bottle-form" data-id="${escapeHtml(bottle.id || '')}" data-bottling-id="${escapeHtml(bottlingId)}">${context}<div class="forms">${textInput(t("forms.bottle.inventoryNumber"), 'inventoryNumber', bottle.inventoryNumber, {
            placeholder: t('forms.bottle.inventoryPlaceholder')
        })}<div class="form-field">
    <span>${t("forms.bottle.autoInventoryNumber")}</span>
    <button type="button" class="btn" data-act="suggest-bottle">${t("forms.bottle.suggestInventoryNumber")}</button>
    </div>${selectInput(t("forms.bottle.type"), 'volumeType', [['standard', t('forms.bottle.normalBottle')], ['sample', t('forms.bottle.sampleBottle')]], bottle.volumeType || 'standard')}${textInput(t("forms.bottle.size"), 'volumeMl', bottle.volumeMl, { type: 'number', placeholder: owner.volumeMl == null ? t("forms.bottle.sizeExample") : t("forms.bottle.ownerVolumePlaceholder",{volume:owner.volumeMl}) })}${selectInput(t("forms.bottle.statusLabel"), 'status', Object.keys(bottleStatusLabels).map(status=>[status,t(({closed:"home.status.closed",open:"analytics.inventory.openedStatus",empty:"home.status.empty"})[status])]), bottle.status || 'closed')}${textInput(t("forms.bottle.purchaseDate"), 'purchaseDate', bottle.purchaseDate, {
            type: 'date'
        })}${textInput(t("forms.bottle.purchasePrice"), 'purchasePrice', bottle.purchasePrice, {
            type: 'number', step: '0.01'
        })}${textInput(t("forms.bottle.currency"), 'currency', bottle.currency || 'EUR')}${textInput(t("forms.bottle.seller"), 'merchant', bottle.merchant)}${textInput(t("forms.bottle.openingDate"), 'openedAt', bottle.openedAt, {
            type: 'date'
        })}${textInput(t("forms.bottle.rating"), 'rating', bottle.rating, {
            type: 'number'
        })}${areaInput(t("forms.bottle.personalComment"), 'comment', bottle.comment)}${areaInput(t("forms.bottling.nose"), 'tastingNose', bottle.tastingNotes?.nose)}${areaInput(t("forms.bottling.palate"), 'tastingPalate', bottle.tastingNotes?.palate)}${areaInput(t("forms.bottling.finish"), 'tastingFinish', bottle.tastingNotes?.finish)}<label class="form-field full">${t("forms.bottle.additionalPhotos")}<input type="file" name="photos" accept="${photoAccept}" multiple>
    </label>
    <label class="form-field full">${t("forms.bottle.attachments")}
    <input type="file" name="documents" accept="${fileAccept}" multiple>
    <small class="hint">${t("forms.bottle.attachmentSizeLimit")}</small>
    </label>
    </div>
    <div class="actions" style="justify-content:flex-end;margin-top:23px">
    <button type="button" class="btn" data-act="scan-into-bottle">${inventoryScanIcon}<span>${t("forms.bottle.scanLabel")}</span></button>
    <button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
    <button class="btn primary" type="submit">${t("common.actions.save")}</button>
    </div>
    </form>`;
    }
    return bottleForm;
}
