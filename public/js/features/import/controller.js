import { t } from '../../i18n/index.js';
import { escapeHtml, query, queryAll } from '../../ui/dom.js';
import { whiskyTypeLabels } from '../../domain/labels.js';
import { toast } from '../../ui/notifications.js';
import { request } from '../../api.js';
import { importChoice } from './choice-template.js';
import { matchImportedDistilleries } from './distillery-matching.js';
/** Source-independent import workflow. The provider validates and identifies its own records. */
export function createExternalImport({
    state, navigate, showModal, closeModal, action, createBottling, editBottling,
    validatePayload, findExistingBottling, sourceName, extraFieldLabels = {},
}) {
    if (typeof validatePayload !== 'function' || typeof findExistingBottling !== 'function' ||
        typeof sourceName !== 'string' || !sourceName.trim()) {
        throw new TypeError('An import source requires payload validation and duplicate matching');
    }
    const safeSourceName = escapeHtml(sourceName);
    const IMPORT_FIELD_LABELS = {
        whiskyType:t('forms.bottling.whiskyCategory'), brand:t('forms.bottling.brandOrProductLine'), name:t('imports.preview.name'),
        bottler:t('forms.bottling.bottler'),ageYears:t('imports.preview.ageYears'),
        distillationYear:t('forms.bottling.distillationYear'),bottlingYear:t('forms.bottling.bottlingYear'),
        distillationDate:t('forms.bottling.distillationDate'),bottlingDate:t('forms.bottling.bottlingDate'),
        abv:t('imports.preview.abv'),volumeMl:t('imports.preview.volumeMl'),
        caskNumber:t('forms.bottling.caskNumber'),caskType:t('forms.bottling.caskType'),
        limitedEditionCount:t('imports.preview.limitedEditionCount'),
        ...extraFieldLabels
    };
    let importDetails = null;
    let pendingExtensionImport = null;
    function importMessage(message) {
        const panel = query('#import-panel');
        if (panel) {
            const oldStatus = query('#import-status', panel);
            if (oldStatus) oldStatus.textContent = message;
            else panel.insertAdjacentHTML('beforeend', `<p class="hint" id="import-status">${escapeHtml(message)}</p>`);
        }
    }
    /** The editor has no import UI until an external payload is received. */
    function ensurePreviewPanel(form) {
        const previous = query('#import-panel', form);
        if (previous) return previous;
        const fields = query('.forms', form);
        if (!fields) return null;
        const panel = document.createElement('div');
        panel.id = 'import-panel';
        panel.className = 'form-field full import-area';
        panel.setAttribute('aria-live', 'polite');
        const category = form.elements.whiskyType?.closest?.('.form-field');
        if (category && category.parentElement === fields) fields.insertBefore(panel, category);
        else fields.prepend(panel);
        return panel;
    }
    function previewImport(data) {
        importDetails = validatePayload(data);
        const form = query('#bottling-form');
        if (!form) return;
        const panel = ensurePreviewPanel(form);
        if (!panel) {
            return;
        }
        const distilleries = matchImportedDistilleries(importDetails.distilleryName, state.collection.distilleries);
        const selectedDistilleries = new Set(queryAll('input[name=distilleryIds]:checked', form).map(input => input.value));
        const values = Object.entries(importDetails.fields).filter(([k, v]) => v !== null && v !== undefined && v !== '');
        const distilleryChoice = distilleries.map(distillery => importChoice({
            label: t("imports.fields.distillery"), value: distillery.name, distillery: true,
            distilleryId: distillery.id,
            checked: Boolean(distillery.id && !selectedDistilleries.has(distillery.id)),
            disabled: !distillery.id,
        })).join('');
        const fieldChoices = values.map(([key, value]) => {
            const old = form.elements[key]?.value;
            return importChoice({
                field: key, label: IMPORT_FIELD_LABELS[key] || key,
                value: key === 'whiskyType' ? (whiskyTypeLabels[value] || value) : value,
                currentValue: old, checked: !old,
            });
        }).join('');
        panel.innerHTML = `<div class="panel import-preview">
    <h3>${t("imports.preview.title",{id:escapeHtml(importDetails.referenceId)})}</h3>
    <p class="hint">${t("imports.import.sourceAndSaveInstructions")}</p>${importDetails.imageToken ? `<div class="import-photo"><button type="button" class="import-preview-photo-open" data-act="open-photo" title="${t("imports.images.enlarge")}" aria-label="${t("imports.images.openOverlay", {source: safeSourceName})}"><img src="/api/import-image/stage/${importDetails.imageToken}" alt="${t("imports.images.reference", {source: safeSourceName})}"></button>${form.dataset.id ? `<p class="hint">${t("imports.images.physicalBottleOnlyNotice")}</p>` : `<label><input id="import-image" type="checkbox" checked> ${t("imports.images.attachAsLocalFirstBottle")}</label>`}<small class="hint">${t("imports.images.referenceNotOwnership", {source: safeSourceName})}</small></div>` : ''}
    <div class="import-choice-list" role="group" aria-label="${t("imports.import.selectFields")}">
    ${distilleryChoice}${fieldChoices}
    </div>
    <div class="actions" style="margin-top:16px">
    <button type="button" class="btn primary" data-act="import-apply">${t("imports.import.applySelectedFields")}</button>
    </div>
    </div>`;
    }
    function importFromExtension() {
        const prefix = '#wcm-import=';
        if (!location.hash.startsWith(prefix)) {
            return;
        }
        const raw = location.hash.slice(prefix.length);
        history.replaceState(null, '', location.pathname + location.search);
        if (state.modal) {
            // Do not silently destroy an open editor and its unsaved input.
            pendingExtensionImport = raw;
            showModal(t("imports.import.ready"), `<p>${t("imports.import.unsavedDialogNotice", {source: safeSourceName})}</p>
    <div class="actions">
    <button class="btn" type="button" data-act="close-modal">${t("imports.import.keepCurrentInput")}</button>
    <button class="btn primary" type="button" data-act="import-continue">${t("imports.import.discardPreviousDialog")}</button>
    </div>`, false, true);
            return;
        }
        processExtensionImport(raw);
    }
    function confirmPendingImport() {
        if (pendingExtensionImport == null) return;
        const raw = pendingExtensionImport;
        pendingExtensionImport = null;
        closeModal(true);
        processExtensionImport(raw);
    }
    function processExtensionImport(raw) {
        try {
            if (raw.length > 12000) {
                throw Error(t('imports.errors.tooLarge'));
            }
            const data = validatePayload(JSON.parse(decodeURIComponent(raw)));
            const existing = findExistingBottling(state.collection, data);
            if (existing) {
                navigate('detail', existing.id, {
                    replace: true
                });
                showModal(t("imports.import.alreadyExists"), `<div class="panel">
    <p>${t("imports.import.existingBottlingPrefix", {source: safeSourceName})} <strong>${escapeHtml(existing.name)}</strong> ${t("imports.import.existingBottlingSuffix")}</p>
    <p class="hint">${t("imports.import.existingBottlingOptions")}</p>${data.imageToken ? `<div class="import-existing-photo"><p><strong>${t("imports.images.preparedLocally", {source: safeSourceName})}</strong> ${t("imports.images.addExistingOrNewNotice")}</p>${(existing.bottles || []).length ? `<label class="form-field">${t("imports.images.attachExistingBottle")}<select id="import-existing-photo-bottle">${existing.bottles.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.inventoryNumber || t("imports.bottles.noInventoryNumber"))} · ${b.volumeType === 'sample' ? t("imports.bottles.sample") : t("imports.bottles.standard")}</option>`).join('')}</select></label><button class="btn small" type="button" data-act="import-existing-photo">${t("imports.images.copyToSelectedBottle")}</button>` : ''}</div>` : ''}
    <div class="actions">
    <button class="btn primary" data-act="import-existing-bottle">${t("imports.bottles.addAnother")}</button>
    <button class="btn" data-act="import-existing-edit">${t("imports.import.reviewMasterData")}</button>
    <button class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
    </div>
    </div>`, true);
                importDetails = data;
            }
            else {
                navigate('home', null, {
                    replace: true
                });
                createBottling();
                previewImport(data);
            }
        }
        catch (err) {
            toast(t('imports.errors.importFailed', {error: err.message}), true);
        }
    }
    function applyImport() {
        const form = query('#bottling-form');
        if (!form || !importDetails) {
            return;
        }
        for (const checkbox of queryAll('[data-import-field]:checked', query('#import-panel'))) {
            const k = checkbox.dataset.importField;
            if (form.elements[k] && importDetails.fields[k] != null) {
                form.elements[k].value = importDetails.fields[k];
            }
        }
        const selectedIds = new Set(queryAll('[name=import-distillery]:checked', query('#import-panel')).map(input => input.value));
        for (const choice of queryAll('input[name=distilleryIds]', form)) {
            if (selectedIds.has(choice.value)) choice.checked = true;
        }
        importMessage(t('imports.import.selectedApplied'));
        toast(t("imports.import.dataApplied"));
    }
    function editExisting() {
        const incoming = importDetails;
        editBottling();
        previewImport(incoming);
    }
    function getPendingImageToken() {
        if (!importDetails?.imageToken) return null;
        const choice = query('#import-image');
        return choice && !choice.checked ? null : importDetails.imageToken;
    }
    function markImageAttached() {
        if (importDetails) importDetails.imageToken = null;
    }
    async function attachToExistingBottle() {
        const id = query('#import-existing-photo-bottle')?.value;
        const token = getPendingImageToken();
        if (!id || !token) return toast(t("imports.validation.selectBottle"), true);
        const found = state.collection.bottlings.some(b => (b.bottles || []).some(p => p.id === id));
        if (!found) return toast(t("features.errors.bottleNotFound"), true);
        const result = await action(async () => {
            await request(`/api/bottles/${encodeURIComponent(id)}/photos/from-stage`, {
                method: 'POST', body: JSON.stringify({ token })
            });
            return true;
        });
        if (result) {
            markImageAttached();
            closeModal();
            toast(t("imports.images.savedLocally", {source: sourceName}));
        }
    }
    return {
        previewImport, applyImport, importFromExtension, confirmPendingImport, editExisting,
        getPendingImageToken, markImageAttached, attachToExistingBottle
    };
}
