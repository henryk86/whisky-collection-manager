import { t } from '../i18n/index.js';
import { query } from '../ui/dom.js';
import { request } from '../api.js';
import { toast } from '../ui/notifications.js';
import { formValues } from './forms/values.js';
import { uploadPhotos } from './photos.js';
import { uploadFiles } from './files.js';
import { bottlingChoiceDialog, bottlingChoiceOptions, matchingBottlings } from './forms/bottling-choice.js';
/** Coordinates forms and API calls; templates and persistence are separate modules. */
export function createEditors({ state, selectors, bottlingForm, bottleForm, showModal, closeModal, navigate, action, refresh, getPendingImageToken = () => null, markImageAttached = () => {} }) {
    const { findBottle } = selectors;
    /** The global New Bottle action can reuse an existing bottling. */
    function newBottling() {
        if (!(state.collection.bottlings || []).length) return createBottling();
        showModal(t("features.bottles.new"), bottlingChoiceDialog(state.collection), true);
    }
    function createBottling() {
        showModal(t("collection.actions.newBottling"), bottlingForm(), true);
    }
    function filterExistingBottlings(term) {
        const select = query('#bottling-choice-select');
        if (!select) return;
        const previous = select.value;
        const matches = matchingBottlings(state.collection, term);
        select.innerHTML = bottlingChoiceOptions(state.collection, term);
        if (matches.some(item => item.id === previous)) select.value = previous;
        const counter = query('#bottling-choice-count');
        if (counter) counter.textContent = t("features.bottlings.searchResults",{count:matches.length});
    }
    function chooseExistingBottling(id) {
        const bottling = state.collection.bottlings.find(item => item.id === id);
        if (!bottling) throw Error(t('features.bottlings.selectExisting'));
        showNewBottleEditor(bottling, { fromOverview: true });
    }
    function editBottling() {
        const b = state.collection.bottlings.find(x => x.id === state.selected);
        showModal(t("features.bottlings.edit"), bottlingForm(b), true);
    }
    function showNewBottleEditor(bottling, { fromImport = false, fromOverview = false } = {}) {
        const token = fromImport ? getPendingImageToken() : null;
        let form = bottleForm({}, bottling.id);
        if (fromOverview) form = form.replace('<form id="bottle-form"', '<form id="bottle-form" data-from-overview="1"');
        const photoOption = token ? `<label class="import-photo form-field full"><input type="checkbox" name="importReferencePhoto" checked> ${t("imports.images.copyReference")}</label>` : '';
        showModal(`Weitere Flasche · ${bottling.name}`, form.replace('</form>', `${photoOption}</form>`), true);
    }
    function newBottle(fromImport = false) {
        const bottling = state.collection.bottlings.find(item => item.id === state.selected);
        if (!bottling) throw Error(t('features.bottlings.selectFirst'));
        showNewBottleEditor(bottling, { fromImport });
    }
    function editBottle(id) {
        const found = findBottle(id);
        if (!found) {
            return toast(t("features.errors.bottleNotFound"), true);
        }
        const { bottle: b, bottling } = found;
        showModal(`Flasche ${b.inventoryNumber || ''} bearbeiten`, bottleForm(b, bottling.id), true);
        query('#bottle-form').dataset.id = id;
    }
    async function handleForm(ev) {
        if (ev.target.id === 'bottling-form') {
            ev.preventDefault();
            const form = ev.target;
            const data = formValues(form);
            const b = form.dataset.id ? state.collection.bottlings.find(x => x.id === form.dataset.id) : null;
            await action(async () => {
                let id, firstBottleId;
                let importPhotoError = null;
                if (b) {
                    await request(`/api/bottlings/${b.id}`, {
                        method: 'PATCH', body: JSON.stringify(data)
                    });
                    id = b.id;
                }
                else {
                    data.firstBottle = {
                        inventoryNumber: data.firstInventoryNumber || '', status: data.firstStatus || 'closed',
                        volumeType: data.firstVolumeType || 'standard', volumeMl: data.firstVolumeMl
                    };
                    const result = await request('/api/bottlings', {
                        method: 'POST', body: JSON.stringify(data)
                    });
                    id = result.bottling.id;
                    firstBottleId = result.bottle.id;
                    const files = [...(form.elements.firstPhotos?.files || [])];
                    if (files.length) {
                        try {
                            await uploadPhotos(firstBottleId, files);
                        }
                        catch (err) {
                            toast(t("features.bottlings.photoUploadFailed",{error:err.message}), true);
                        }
                    }
                    if (getPendingImageToken() && form.querySelector('#import-image:checked')) {
                        try {
                            await request(`/api/bottles/${encodeURIComponent(firstBottleId)}/photos/from-stage`, {
                                method: 'POST', body: JSON.stringify({ token: getPendingImageToken() })
                            });
                            markImageAttached();
                        } catch (error) {
                            importPhotoError = error.message;
                        }
                    }
                    const documents = [...(form.elements.firstFiles?.files || [])];
                    if (documents.length) {
                        try {
                            await uploadFiles(firstBottleId, documents);
                        }
                        catch (err) {
                            toast(t('errors.files.bottlingSavedUploadFailed', {error: err.message}), true);
                        }
                    }
                }
                await refresh();
                navigate('detail', id);
                toast(importPhotoError ? t("imports.errors.bottlingSavedImageFailed",{error:importPhotoError}) : t("features.bottlings.saved"), Boolean(importPhotoError));
            });
        }
        else if (ev.target.id === 'bottle-form') {
            ev.preventDefault();
            const form = ev.target;
            const data = formValues(form);
            data.tastingNotes = {
                nose: data.tastingNose || '', palate: data.tastingPalate || '', finish: data.tastingFinish || ''
            };
            delete data.tastingNose;
            delete data.tastingPalate;
            delete data.tastingFinish;
            const result = await action(async () => {
                let bottleId;
                let importPhotoError = null;
                if (form.dataset.id) {
                    await request(`/api/bottles/${form.dataset.id}`, {
                        method: 'PATCH', body: JSON.stringify(data)
                    });
                    bottleId = form.dataset.id;
                }
                else {
                    const created = await request('/api/bottles', {
                        method: 'POST', body: JSON.stringify({
                            ...data, bottlingId: form.dataset.bottlingId
                        })
                    });
                    bottleId = created.id;
                }
                const files = [...(form.elements.photos?.files || [])];
                if (files.length) {
                    try {
                        await uploadPhotos(bottleId, files);
                    }
                    catch (err) {
                        toast(t('errors.files.bottleSavedPhotoFailed', {error: err.message}), true);
                    }
                }
                if (form.elements.importReferencePhoto?.checked && getPendingImageToken()) {
                    try {
                        await request(`/api/bottles/${encodeURIComponent(bottleId)}/photos/from-stage`, {
                            method: 'POST', body: JSON.stringify({ token: getPendingImageToken() })
                        });
                        markImageAttached();
                    } catch (error) {
                        importPhotoError = error.message;
                    }
                }
                const documents = [...(form.elements.documents?.files || [])];
                if (documents.length) {
                    try {
                        await uploadFiles(bottleId, documents);
                    }
                    catch (err) {
                        toast(t('errors.files.bottleSavedUploadFailed', {error: err.message}), true);
                    }
                }
                closeModal();
                toast(importPhotoError ? t('imports.errors.bottleSavedImageFailed', {error: importPhotoError}) : t("features.notifications.bottleSaved"), Boolean(importPhotoError));
                return { bottleId };
            });
            if (result && !form.dataset.id && form.dataset.fromOverview === '1') {
                navigate('detail', form.dataset.bottlingId, { highlightBottleId: result.bottleId });
            }
        }
    }
    return {
        newBottling, createBottling, filterExistingBottlings, chooseExistingBottling,
        editBottling, newBottle, editBottle, handleForm
    };
}
