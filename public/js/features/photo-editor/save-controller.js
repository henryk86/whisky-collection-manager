import {t} from '../../i18n/index.js';
import {toast} from '../../ui/notifications.js';
import {request} from '../../api.js';
import {validatePhotoAdjustments} from './adjustments.js';
import {encodePhotoExport} from './export-image.js';

/**
 * Persists the current photo draft, preserving source-specific adjustment settings.
 * @param {!Object} options Session, API action and modal callbacks.
 * @return {() => Promise<void>} Save operation.
 */
export function createPhotoSave({session, root, findPhoto, endpoint, syncSliders, action, closeModal}) {
  /**
   * Updates the controller state.
   */
  async function save() {
    if (session.busy || !session.sourceData || !session.image || !session.selection || !root()) return;
    session.busy = true;
    const thisGeneration = session.generation;
    syncSliders();
    const host = root();
    const message = host.querySelector('[data-photo-editor-message]');
    message.textContent = t('photoEditor.saving');
    try {
      const storedSettings = validatePhotoAdjustments(session.values);
      const photo = findPhoto(session.selection.bottleId, session.selection.photoId);
      const sourceKey = session.previewCutout ? 'cutout' : 'original';
      const savedSettings = session.savedSourceValues[sourceKey];
      const settingsChanged = Object.keys(storedSettings).some(key => storedSettings[key] !== savedSettings[key]);
      const selectedChanged = Boolean(photo?.cutout) && session.previewCutout !== photo.cutout.selected;
      const cutoutEndpoint = endpoint().replace(/\/adjustments$/, '/cutout');
      /**
       * Selects for save matching the input.
       * @return {!Promise<*>} API response after selecting the intended original or cutout source.
       */
      const selectForSave = () => request(cutoutEndpoint, {
        method: 'PATCH', body: JSON.stringify({selected: session.previewCutout}),
      });

      /**
       * Commits source selection before running the optional image-save callback.
       *
       * @param {(() => *)=} callback Optional operation performed after saving the edited photo.
       * @return {*} Result of the guarded source-selection and save operation.
       */
      const commit = (callback = undefined) => action(async () => {
        // The API selects the image separately from its adjustments;
        // synchronize
        // the source before saving an edited derivative of that source.
        if (selectedChanged) await selectForSave();
        return callback ? await callback() : {ok: true};
      });

      /**
       * Handles save completion only for the still-active editor, displaying an error or closing it on success.
       *
       * @param {*} result Result from the preceding operation.
       */
      const finishSave = result => {
        if (session.generation !== thisGeneration || !root()) return;
        if (!result.ok) {
          message.textContent = result.error.message;
          return;
        }
        session.generation++;
        closeModal(true);
        toast(t('photoEditor.saved'));
      };
      const savingCutout = Boolean(session.pendingCutout || (session.previewCutout && session.maskStrokes.length));
      // Merely showing a different variant is a preview-only operation.
      // Save commits that selection; unchanged settings must never trigger a
      // regeneration or deletion of an existing edited derivative.
      if (!savingCutout && !settingsChanged) {
        const result = selectedChanged ? await commit() : {ok: true};
        finishSave(result);
        return;
      }
      if (!savingCutout && Object.values(storedSettings).every(value => value === 0)) {
        const result = await commit(() => request(endpoint(), {method: 'DELETE'}));
        finishSave(result);
        return;
      }
      const {hasEdits, cutoutDataUrl, imageDataUrl} = await encodePhotoExport(session, storedSettings);
      if (session.generation !== thisGeneration || !root()) return;
      const payload = savingCutout
        ? {
          image: cutoutDataUrl,
          ...(hasEdits ? {adjustment: {image: imageDataUrl, settings: storedSettings}} : {}),
        }
        : {image: imageDataUrl, settings: storedSettings};
      const target = savingCutout ? endpoint().replace(/\/adjustments$/, '/cutout') : endpoint();
      const result = await commit(() => request(target, {
        method: 'PUT', body: JSON.stringify(payload),
      }));
      finishSave(result);
    } catch (error) {
      if (session.generation === thisGeneration && root()) {
        toast(error.message, true);
        message.textContent = error.message;
      }
    } finally {
      if (session.generation === thisGeneration) {
        session.busy = false;
        if (root()) syncSliders();
      }
    }
  }
  return save;
}
