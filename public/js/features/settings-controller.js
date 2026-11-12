import { t } from '../i18n/index.js';
import { locationFor } from '../domain/distillery-map.js';
import { escapeHtml, query } from '../ui/dom.js';
import { request } from '../api.js';
import { toast } from '../ui/notifications.js';
/** Settings workflows use app dialogs instead of blocking browser prompt/confirm. */
export function createSettingsController({ state, action, navigate, closeModal, showModal }) {
    function promptDistillery(id = null) {
        const current = id ? state.collection.distilleries.find(entry => entry.id === id) : null;
        if (id && !current) return toast(t("features.errors.distilleryNotFound"), true);
        const nested = Boolean(query('#bottling-form') && state.modal);
        const coordinates = current ? locationFor(current) : null;
        showModal(id ? t("features.distilleries.edit") : t("forms.bottling.newDistillery"), `<form id="distillery-form" data-id="${escapeHtml(id || '')}">
    <label class="form-field" for="distillery-name">${t("features.distilleries.nameLabel")}
    <input id="distillery-name" name="name" type="text" value="${escapeHtml(current?.name || '')}" maxlength="150" autocomplete="off" required></label>
    <label class="form-field" for="distillery-status">${t("features.distilleries.operatingStatus")}
      <select id="distillery-status" name="status">
      ${[["active",t("map.status.active")],["closed",t("home.status.closed")],["reopened",t("map.status.reopened")],["unknown",t("features.distilleries.unknownStatus")]].map(([value,label]) => `<option value="${value}" ${(current?.status || "unknown") === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <div class="map-coordinates-fields">
    <label class="form-field" for="distillery-latitude">${t("features.map.latitudeLabel")}
      <input id="distillery-latitude" name="latitude" type="number" step="any" min="-90" max="90" placeholder="${t("features.map.latitudeExample")}" value="${current?.latitude ?? coordinates?.lat ?? ''}"></label>
    <label class="form-field" for="distillery-longitude">${t("features.map.longitudeLabel")}
      <input id="distillery-longitude" name="longitude" type="number" step="any" min="-180" max="180" placeholder="${t("features.map.longitudeExample")}" value="${current?.longitude ?? coordinates?.lon ?? ''}"></label>
    </div>
    <p class="hint">${t("features.map.optionalCoordinatesHint")}</p>
    <button type="button" class="btn small" data-act="find-distillery-location">${t("features.map.searchOpenStreetMap")}</button>
    <div id="distillery-location-results" class="map-location-results" aria-live="polite"></div>
    <div class="actions" style="justify-content:flex-end; margin-top:23px">
    <button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
    <button type="submit" class="btn primary">${id ? t("common.actions.save") : t("features.common.create")}</button>
    </div></form>`, false, nested);
        query('#distillery-name')?.focus();
    }
    async function saveDistillery(event) {
        event.preventDefault();
        const form = event.target;
        const name = form.querySelector('[name="name"]').value.trim();
        const id = form.dataset.id;
        const status = form.elements.namedItem('status').value;
        if (!name) return toast(t("features.validation.distilleryNameRequired"), true);
        const rawLat = form.elements.namedItem('latitude').value.trim().replace(',', '.');
        const rawLon = form.elements.namedItem('longitude').value.trim().replace(',', '.');
        if ((rawLat === '') !== (rawLon === '')) return toast(t("features.validation.coordinatesBothOrNone"), true);
        const latitude = rawLat === '' ? null : Number(rawLat);
        const longitude = rawLon === '' ? null : Number(rawLon);
        if ((rawLat && !Number.isFinite(latitude)) || (rawLon && !Number.isFinite(longitude)) ||
            (latitude !== null && Math.abs(latitude) > 90) || (longitude !== null && Math.abs(longitude) > 180)) {
            return toast(t("features.validation.invalidCoordinates"), true);
        }
        const submit = form.querySelector('[type="submit"]');
        if (submit.disabled) return;
        submit.disabled = true;
        const saved = await action(async () => request(id ? `/api/distilleries/${encodeURIComponent(id)}` : '/api/distilleries', {
            method: id ? 'PATCH' : 'POST',
            body: JSON.stringify({ name, status, latitude, longitude })
        }));
        if (!saved) { submit.disabled = false; return; }
        closeModal();
        // Creating a new distillery from an open bottling form must preserve all
        // unsaved fields and files and select the new distillery in that form.
        const parentForm = query('#bottling-form');
        if (!id && parentForm) {
            const options = parentForm.querySelector('.distillery-options');
            if (options && ![...options.querySelectorAll('input[name="distilleryIds"]')].some(input => input.value === saved.id)) {
                const label = document.createElement('label');
                label.className = 'distillery-option';
                label.innerHTML = `<input type="checkbox" name="distilleryIds" value="${escapeHtml(saved.id)}" checked><span>${escapeHtml(saved.name)}</span>`;
                const matching = [...options.querySelectorAll('.distillery-option')].find(option =>
                    option.querySelector('span').textContent.localeCompare(saved.name, 'de') > 0);
                options.insertBefore(label, matching || null);
            }
        }
        toast(id ? t("features.notifications.distillerySaved") : t("features.notifications.distilleryCreated"));
    }
    async function findDistilleryLocation() {
        const name = query('#distillery-name')?.value.trim();
        if (!name) return toast(t("features.validation.distilleryNameRequiredForSearch"), true);
        const output = query('#distillery-location-results');
        const button = query('[data-act="find-distillery-location"]');
        if (!output || !button) return;
        button.disabled = true;
        output.innerHTML = `<p class="hint">${t("features.map.searching")}</p>`;
        try {
            const matches = await request('/api/map/find-distillery', { method: 'POST', body: JSON.stringify({ name }) });
            output.innerHTML = matches.length ? `<p class="hint">${t("features.map.verifySelectedLocation")}</p>${matches.map((candidate, index) => `
            <button type="button" class="map-location-choice" data-act="apply-distillery-location" data-index="${index}">
            ${escapeHtml(candidate.name)}<small>${candidate.latitude.toFixed(5)}, ${candidate.longitude.toFixed(5)}</small></button>`).join('')}` : `<p class="hint">${t("features.map.noExactLocationMatch")}</p>`;
            output._candidates = matches;
        } catch (error) {
            output.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    }
    function applyDistilleryLocation(button) {
        const output = query('#distillery-location-results');
        const item = output?._candidates?.[Number(button.dataset.index)];
        if (!item) return;
        query('#distillery-latitude').value = String(item.latitude);
        query('#distillery-longitude').value = String(item.longitude);
        output.innerHTML = `<p class="hint">${t("features.map.coordinatesReadyToSave")}</p>`;
    }
    async function importJSON() {
        const file = query('#import-file')?.files?.[0];
        if (!file) return toast(t("features.validation.selectJsonFile"), true);
        try {
            JSON.parse(await file.text());
        } catch {
            return toast(t("features.validation.invalidJson"), true);
        }
        showModal(t("features.import.replaceWithJson"), `<p>${t("features.import.prefix")} <strong>${t("features.import.replacesCollection")}</strong>${t("features.import.jsonExcludesAttachmentsWarning")}</p>
    <div class="actions" style="justify-content:flex-end;margin-top:22px">
    <button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
    <button type="button" class="btn danger" data-act="confirm-import">${t("features.import.replaceCollection")}</button>
    </div>`);
    }
    async function confirmImport() {
        const file = query('#import-file')?.files?.[0];
        if (!file) return toast(t("features.validation.selectJsonFile"), true);
        const button = query('[data-act="confirm-import"]');
        if (button.disabled) return;
        button.disabled = true;
        const data = JSON.parse(await file.text());
        const result = await action(async () => request('/api/import/json', {
            method: 'POST', body: JSON.stringify(data)
        }));
        if (!result) { button.disabled = false; return; }
        closeModal(true);
        navigate('home', null, { replace: true });
        if (result.inventoryConflicts?.length) {
            toast(t("features.import.inventoryConflicts",{count:result.inventoryConflicts.length}), true);
        } else {
            toast(t("features.notifications.jsonImported"));
        }
    }
    async function saveCollectionSettings(event) {
        event.preventDefault();
        const field = event.target.elements.namedItem('establishedYear');
        const raw = String(field.value).trim();
        const year = raw === '' ? null : Number(raw);
        if (raw !== '' && (!/^\d{4}$/.test(raw) || !Number.isSafeInteger(year) || year < 1600 || year > new Date().getFullYear())) {
            return toast(t("features.validation.invalidFoundingYear"), true);
        }
        const button = event.target.querySelector('[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        const saved = await action(() => request('/api/settings', {
            method: 'PATCH', body: JSON.stringify({ establishedYear: year })
        }));
        if (!saved) { button.disabled = false; return; }
        toast(year === null ? t("features.notifications.foundingYearRemoved") : t("features.notifications.foundingYearSaved"));
    }
    return { promptDistillery, saveDistillery, findDistilleryLocation, applyDistilleryLocation, importJSON, confirmImport, saveCollectionSettings };
}
