import { t } from '../../i18n/index.js';
import { escapeHtml, query, queryAll } from '../../ui/dom.js';
import { whiskyTypeLabels } from '../../domain/labels.js';
import { toast } from '../../ui/notifications.js';
import { request } from '../../api.js';
import { validateExtensionPayload } from './payload.js';
import { importChoice } from './choice-template.js';
import { matchImportedDistilleries } from './distillery-matching.js';
/** Manual, per-page import from the existing browser extension. No network scraping. */
export function createWhiskybase({ state, navigate, showModal, closeModal, action, createBottling, editBottling }) {
    const WB_LABELS = {
        whiskyType:t('forms.bottling.whiskyCategory'), brand:t('forms.bottling.brandOrProductLine'), name:t('whiskybase.preview.name'),
        bottler:t('forms.bottling.bottler'),ageYears:t('whiskybase.preview.ageYears'),
        distillationYear:t('forms.bottling.distillationYear'),bottlingYear:t('forms.bottling.bottlingYear'),
        distillationDate:t('forms.bottling.distillationDate'),bottlingDate:t('forms.bottling.bottlingDate'),
        abv:t('whiskybase.preview.abv'),volumeMl:t('whiskybase.preview.volumeMl'),
        caskNumber:t('forms.bottling.caskNumber'),caskType:t('forms.bottling.caskType'),
        limitedEditionCount:t('whiskybase.preview.limitedEditionCount'),
        whiskybaseId:t('forms.bottling.whiskybaseId'),whiskybaseUrl:t('forms.bottling.whiskybaseUrl')
    };
    let wbDetails = null;
    let pendingExtensionImport = null;
    function wbMessage(message) {
        const panel = query('#wb-panel');
        if (panel) {
            const oldStatus = query('#wb-status', panel);
            if (oldStatus) oldStatus.textContent = message;
            else panel.insertAdjacentHTML('beforeend', `<p class="hint" id="wb-status">${escapeHtml(message)}</p>`);
        }
    }
    /** The editor has no import UI until an external payload is received. */
    function ensurePreviewPanel(form) {
        const previous = query('#wb-panel', form);
        if (previous) return previous;
        const fields = query('.forms', form);
        if (!fields) return null;
        const panel = document.createElement('div');
        panel.id = 'wb-panel';
        panel.className = 'form-field full wb-area';
        panel.setAttribute('aria-live', 'polite');
        const category = form.elements.whiskyType?.closest?.('.form-field');
        if (category && category.parentElement === fields) fields.insertBefore(panel, category);
        else fields.prepend(panel);
        return panel;
    }
    function wbPreview(data) {
        wbDetails = validateExtensionPayload(data);
        const form = query('#bottling-form');
        if (!form) return;
        const panel = ensurePreviewPanel(form);
        if (!panel) {
            return;
        }
        const distilleries = matchImportedDistilleries(wbDetails.distilleryName, state.collection.distilleries);
        const selectedDistilleries = new Set(queryAll('input[name=distilleryIds]:checked', form).map(input => input.value));
        const values = Object.entries(wbDetails.fields).filter(([k, v]) => v !== null && v !== undefined && v !== '');
        const distilleryChoice = distilleries.map(distillery => importChoice({
            label: t("whiskybase.fields.distillery"), value: distillery.name, distillery: true,
            distilleryId: distillery.id,
            checked: Boolean(distillery.id && !selectedDistilleries.has(distillery.id)),
            disabled: !distillery.id,
        })).join('');
        const fieldChoices = values.map(([key, value]) => {
            const old = form.elements[key]?.value;
            return importChoice({
                field: key, label: WB_LABELS[key] || key,
                value: key === 'whiskyType' ? (whiskyTypeLabels[value] || value) : value,
                currentValue: old, checked: !old,
            });
        }).join('');
        panel.innerHTML = `<div class="panel wb-preview">
    <h3>${t("whiskybase.import.preview",{id:escapeHtml(wbDetails.whiskyId)})}</h3>
    <p class="hint">${t("whiskybase.import.sourceAndSaveInstructions")}</p>${wbDetails.imageToken ? `<div class="wb-import-photo"><button type="button" class="wb-preview-photo-open" data-act="open-photo" title="${t("whiskybase.images.enlarge")}" aria-label="${t("whiskybase.images.openOverlay")}"><img src="/api/import-image/stage/${wbDetails.imageToken}" alt="${t("whiskybase.images.reference")}"></button>${form.dataset.id ? `<p class="hint">${t("whiskybase.images.physicalBottleOnlyNotice")}</p>` : `<label><input id="wb-import-image" type="checkbox" checked> ${t("whiskybase.images.attachAsLocalFirstBottle")}</label>`}<small class="hint">${t("whiskybase.images.referenceNotOwnership")}</small></div>` : ''}
    <div class="wb-choice-list" role="group" aria-label="${t("whiskybase.import.selectFields")}">
    ${distilleryChoice}${fieldChoices}
    </div>
    <div class="actions" style="margin-top:16px">
    <button type="button" class="btn primary" data-act="wb-apply">${t("whiskybase.import.applySelectedFields")}</button>
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
            showModal(t("whiskybase.import.ready"), `<p>${t("whiskybase.import.unsavedDialogNotice")}</p>
    <div class="actions">
    <button class="btn" type="button" data-act="close-modal">${t("whiskybase.import.keepCurrentInput")}</button>
    <button class="btn primary" type="button" data-act="wb-import-continue">${t("whiskybase.import.discardPreviousDialog")}</button>
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
                throw Error(t('whiskybase.errors.tooLarge'));
            }
            const data = validateExtensionPayload(JSON.parse(decodeURIComponent(raw)));
            const existing = state.collection.bottlings.find(b => b.whiskybaseId === data.fields.whiskybaseId);
            if (existing) {
                navigate('detail', existing.id, {
                    replace: true
                });
                showModal(t("whiskybase.import.alreadyExists"), `<div class="panel">
    <p>${t("whiskybase.import.existingBottlingPrefix")} <strong>${escapeHtml(existing.name)}</strong> ${t("whiskybase.import.existingBottlingSuffix")}</p>
    <p class="hint">${t("whiskybase.import.existingBottlingOptions")}</p>${data.imageToken ? `<div class="wb-existing-photo"><p><strong>${t("whiskybase.images.preparedLocally")}</strong> ${t("whiskybase.images.addExistingOrNewNotice")}</p>${(existing.bottles || []).length ? `<label class="form-field">${t("whiskybase.images.attachExistingBottle")}<select id="wb-existing-photo-bottle">${existing.bottles.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.inventoryNumber || t("whiskybase.bottles.noInventoryNumber"))} · ${b.volumeType === 'sample' ? t("whiskybase.bottles.sample") : t("whiskybase.bottles.standard")}</option>`).join('')}</select></label><button class="btn small" type="button" data-act="wb-existing-photo">${t("whiskybase.images.copyToSelectedBottle")}</button>` : ''}</div>` : ''}
    <div class="actions">
    <button class="btn primary" data-act="wb-existing-bottle">${t("whiskybase.bottles.addAnother")}</button>
    <button class="btn" data-act="wb-existing-edit">${t("whiskybase.import.reviewMasterData")}</button>
    <button class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
    </div>
    </div>`, true);
                wbDetails = data;
            }
            else {
                navigate('home', null, {
                    replace: true
                });
                createBottling();
                wbPreview(data);
            }
        }
        catch (err) {
            toast('Externer Import fehlgeschlagen: ' + err.message, true);
        }
    }
    function wbApply() {
        const form = query('#bottling-form');
        if (!form || !wbDetails) {
            return;
        }
        for (const checkbox of queryAll('[data-wb-field]:checked', query('#wb-panel'))) {
            const k = checkbox.dataset.wbField;
            if (form.elements[k] && wbDetails.fields[k] != null) {
                form.elements[k].value = wbDetails.fields[k];
            }
        }
        const selectedIds = new Set(queryAll('[name=wb-distillery]:checked', query('#wb-panel')).map(input => input.value));
        for (const choice of queryAll('input[name=distilleryIds]', form)) {
            if (selectedIds.has(choice.value)) choice.checked = true;
        }
        wbMessage(t('whiskybase.import.selectedApplied'));
        toast(t("whiskybase.import.dataApplied"));
    }
    function editExisting() {
        const incoming = wbDetails;
        editBottling();
        wbPreview(incoming);
    }
    function getPendingImageToken() {
        if (!wbDetails?.imageToken) return null;
        const choice = query('#wb-import-image');
        return choice && !choice.checked ? null : wbDetails.imageToken;
    }
    function markImageAttached() {
        if (wbDetails) wbDetails.imageToken = null;
    }
    async function attachToExistingBottle() {
        const id = query('#wb-existing-photo-bottle')?.value;
        const token = getPendingImageToken();
        if (!id || !token) return toast(t("whiskybase.validation.selectBottle"), true);
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
            toast(t("whiskybase.images.savedLocally"));
        }
    }
    return {
        wbPreview, wbApply, importFromExtension, confirmPendingImport, editExisting,
        getPendingImageToken, markImageAttached, attachToExistingBottle
    };
}
