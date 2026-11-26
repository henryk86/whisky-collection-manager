import {replaceContent} from '../ui/dom-renderer.js';
import {t} from '../i18n/index.js';
import {query} from '../ui/dom.js';
import {request} from '../api.js';
import {toast} from '../ui/notifications.js';
import {formValues} from './forms/values.js';
import {uploadPhotos} from './photos.js';
import {uploadFiles} from './files.js';
import {bottlingChoiceDialog, bottlingChoiceOptions, matchingBottlings}
  from './forms/bottling-choice.js';

/**
 * Coordinates forms and API calls; templates and persistence are separate
 * modules.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createEditors({
  state,
  selectors,
  bottlingForm,
  bottleForm,
  showModal,
  closeModal,
  navigate,
  action,
  getPendingImageToken = () => null,
  markImageAttached = () => {}
}) {
  const {findBottle} = selectors;
  /**
 * The global New Bottle action can reuse an existing bottling.
 *
 * @return {void} Value returned by the delegated operation.
 */
  function newBottling() {
    if (!(state.collection.bottlings || []).length) return createBottling();
    showModal(t("features.bottles.new"), bottlingChoiceDialog(state.collection), true);
  }

  /**
   * Constructs bottling from the supplied data.
   */
  function createBottling() {
    showModal(t("collection.actions.newBottling"), bottlingForm(), true);
  }

  /**
   * Selects existing bottlings matching the input.
   *
   * @param {string} term Search text for filtering existing bottlings in the selector.
   */
  function filterExistingBottlings(term) {
    const select = query('#bottling-choice-select');
    if (!select) return;
    const previous = select.value;
    const matches = matchingBottlings(state.collection, term);
    replaceContent(select, bottlingChoiceOptions(state.collection, term));
    if (matches.some(item => item.id === previous)) select.value = previous;
    const counter = query('#bottling-choice-count');
    if (counter) counter.textContent = t("features.bottlings.searchResults", {count: matches.length});
  }

  /**
   * Builds the localized choose existing bottling text for the current
   * language.
   *
   * @param {*} id Identifier of the affected record.
   */
  function chooseExistingBottling(id) {
    const bottling = state.collection.bottlings.find(item => item.id === id);
    if (!bottling) throw Error(t('features.bottlings.selectExisting'));
    showNewBottleEditor(bottling, {fromOverview: true});
  }

  /**
   * Builds the localized edit bottling text for the current language.
   */
  function editBottling() {
    const b = state.collection.bottlings.find(x => x.id === state.selected);
    showModal(t("features.bottlings.edit"), bottlingForm(b), true);
  }

  /**
   * Renders new bottle editor in the current view.
   *
   * @param {*} bottling Bottling record being inspected or updated.
   * @param {!Object=} options Options controlling the operation.
   */
  function showNewBottleEditor(bottling, {fromImport = false, fromOverview =
    false} = {}) {
    const token = fromImport ? getPendingImageToken() : null;
    showModal(
      `Weitere Flasche · ${bottling.name}`,
      bottleForm({}, bottling.id, {fromOverview, importPhoto: Boolean(token)}),
      true
    );
  }

  /**
   * Builds the localized new bottle text for the current language.
   *
   * @param {boolean=} fromImport Whether the new-bottle editor follows an import operation.
   */
  function newBottle(fromImport = false) {
    const bottling = state.collection.bottlings.find(item => item.id === state.selected);
    if (!bottling) throw Error(t('features.bottlings.selectFirst'));
    showNewBottleEditor(bottling, {fromImport});
  }

  /**
   * Builds the localized edit bottle text for the current language.
   *
   * @param {*} id Identifier of the affected record.
      * @return {*} Result of this expression.
*/
  function editBottle(id) {
    const found = findBottle(id);
    if (!found) {
      return toast(t("features.errors.bottleNotFound"), true);
    }
    const {bottle: b, bottling} = found;
    showModal(`Flasche ${b.inventoryNumber || ''} bearbeiten`, bottleForm(b, bottling.id), true);
    query('#bottle-form').dataset.id = id;
  }

  /**
   * Handles form for editor controller.
   *
   * @param {*} ev Submit event whose target is the bottling or physical-bottle form.
   * @return {!Promise<void>} Promise fulfilled when the operation completes.
   */
  async function handleForm(ev) {
    const form = ev.target;
    if (form.id !== 'bottling-form' && form.id !== 'bottle-form') return;
    ev.preventDefault();
    // Set the lock synchronously, before the first await. Duplicated clicks,
    // Enter presses and scripted submit events must all be ignored.
    if (form.dataset.saving === '1') return;
    form.dataset.saving = '1';
    form.setAttribute('aria-busy', 'true');
    const buttons = [...form.querySelectorAll('button[type="submit"],input[type="submit"]')];
    const previouslyDisabled = buttons.map(button => button.disabled);
    buttons.forEach(button => {button.disabled = true;});
    try {
      return await submitForm(ev);
    } finally {
      delete form.dataset.saving;
      form.removeAttribute('aria-busy');
      buttons.forEach((button, index) => {
        button.disabled = previouslyDisabled[index];
      });
    }
  }

  /**
   * Performs the submit form lifecycle action.
   *
   * @param {*} ev Submit event from the validated editor form.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function submitForm(ev) {
    if (ev.target.id === 'bottling-form') {
      ev.preventDefault();
      const form = ev.target;
      const data = formValues(form);
      const b = form.dataset.id ? state.collection.bottlings.find(x => x.id === form.dataset.id) : null;
      const result = await action(async () => {
        let id, firstBottleId;
        let importPhotoError = null;
        if (b) {
          await request(`/api/bottlings/${b.id}`, {
            method: 'PATCH', body: JSON.stringify(data),
          });
          id = b.id;
        }
        else {
          data.firstBottle = {
            inventoryNumber: data.firstInventoryNumber || '',
            status: data.firstStatus || 'closed',
            volumeType: data.firstVolumeType || 'standard',
            volumeMl: data.firstVolumeMl,
          };
          const result = await request('/api/bottlings', {
            method: 'POST', body: JSON.stringify(data),
          });
          id = result.bottling.id;
          firstBottleId = result.bottle.id;
          const files = [...(form.elements.firstPhotos?.files || [])];
          if (files.length) {
            try {
              await uploadPhotos(firstBottleId, files);
            }
            catch (err) {
              toast(t("features.bottlings.photoUploadFailed", {error: err.message}), true);
            }
          }
          if (getPendingImageToken() && form.querySelector('#import-image:checked')) {
            try {
              await request(
                `/api/bottles/${encodeURIComponent(firstBottleId)}/photos/from-stage`,
                {
                  method: 'POST',
                  body: JSON.stringify({token: getPendingImageToken()}),
                }
              );
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
        return {id, importPhotoError};
      });
      if (!result.ok) return;
      const {id, importPhotoError} = result.value;
      navigate('detail', id);
      toast(
        importPhotoError ? t("imports.errors.bottlingSavedImageFailed", {error: importPhotoError}) : t("features.bottlings.saved"),
        Boolean(importPhotoError)
      );
    }
    else if (ev.target.id === 'bottle-form') {
      ev.preventDefault();
      const form = ev.target;
      const data = formValues(form);
      const result = await action(async () => {
        let bottleId;
        let importPhotoError = null;
        if (form.dataset.id) {
          await request(`/api/bottles/${form.dataset.id}`, {
            method: 'PATCH', body: JSON.stringify(data),
          });
          bottleId = form.dataset.id;
        }
        else {
          const created = await request('/api/bottles', {
            method: 'POST', body: JSON.stringify({
              ...data, bottlingId: form.dataset.bottlingId,
            }),
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
            await request(
              `/api/bottles/${encodeURIComponent(bottleId)}/photos/from-stage`,
              {
                method: 'POST',
                body: JSON.stringify({token: getPendingImageToken()}),
              }
            );
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
        return {bottleId, importPhotoError};
      });
      if (!result.ok) return;
      closeModal();
      const {bottleId, importPhotoError} = result.value;
      toast(
        importPhotoError ?
          t('imports.errors.bottleSavedImageFailed', {error: importPhotoError}) : t("features.notifications.bottleSaved"),
        Boolean(importPhotoError)
      );
      if (!form.dataset.id && form.dataset.fromOverview === '1') {
        navigate('detail', form.dataset.bottlingId, {highlightBottleId: bottleId});
      }
    }
  }
  return {
    newBottling,
    createBottling,
    filterExistingBottlings,
    chooseExistingBottling,
    editBottling,
    newBottle,
    editBottle,
    handleForm,
  };
}
