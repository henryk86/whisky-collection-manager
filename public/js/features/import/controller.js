import {composeMarkup} from '../../ui/render-plan.js';
import {appendContent, replaceContent} from '../../ui/dom-renderer.js';
import {t} from '../../i18n/index.js';
import {escapeHtml, query, queryAll} from '../../ui/dom.js';
import {whiskyTypeLabels} from '../../domain/labels.js';
import {toast} from '../../ui/notifications.js';
import {request} from '../../api.js';
import {importChoice} from './choice-template.js';
import {matchImportedDistilleries} from './distillery-matching.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates(
  new URL('./templates/controller.html', import.meta.url));

/**
 * Source-independent import workflow. The provider validates and identifies
 * its own records.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createExternalImport({
  state, navigate, showModal, closeModal, action, createBottling, editBottling,
  validatePayload, findExistingBottling, sourceName, extraFieldLabels = {},
}) {
  if (typeof validatePayload !== 'function' ||
    typeof findExistingBottling !== 'function' ||
    typeof sourceName !== 'string' || !sourceName.trim()) {
    throw new TypeError(
      'An import source requires payload validation and duplicate matching');
  }
  const safeSourceName = escapeHtml(sourceName);
  const IMPORT_FIELD_LABELS = {
    whiskyType: t('forms.bottling.whiskyCategory'),
    brand: t('forms.bottling.brandOrProductLine'),
    name: t('imports.preview.name'),
    bottler: t('forms.bottling.bottler'),
    ageYears: t('imports.preview.ageYears'),
    distillationYear: t('forms.bottling.distillationYear'),
    bottlingYear: t('forms.bottling.bottlingYear'),
    distillationDate: t('forms.bottling.distillationDate'),
    bottlingDate: t('forms.bottling.bottlingDate'),
    abv: t('imports.preview.abv'),
    volumeMl: t('imports.preview.volumeMl'),
    caskNumber: t('forms.bottling.caskNumber'),
    caskType: t('forms.bottling.caskType'),
    limitedEditionCount: t('imports.preview.limitedEditionCount'),
    ...extraFieldLabels,
  };
  let importDetails = null;
  let pendingExtensionImport = null;
  /**
   * Updates the import message state for its caller.
   *
   * @param {*} message Message to display or use for diagnostics.
   */
  function importMessage(message) {
    const panel = query('#import-panel');
    if (panel) {
      const oldStatus = query('#import-status', panel);
      if (oldStatus) oldStatus.textContent = message;
      else appendContent(panel, renderTemplate('importStatus', {
        message: message,
      })
      );
    }
  }

  /**
 * The editor has no import UI until an external payload is received.
 *
 * @param {*} form Form used by this operation.
 * @return {*} Computed value, or null when the input has no match.
 */
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
    if (category && category.parentElement ===
      fields) fields.insertBefore(panel, category);
    else fields.prepend(panel);
    return panel;
  }

  /**
   * Selects and transforms the preview import records.
   *
   * @param {*} data Input data to process.
   */
  function previewImport(data) {
    importDetails = validatePayload(data);
    const form = query('#bottling-form');
    if (!form) return;
    const panel = ensurePreviewPanel(form);
    if (!panel) {
      return;
    }
    const distilleries = matchImportedDistilleries(
      importDetails.distilleryName,
      state.collection.distilleries
    );
    const selectedDistilleries =
      new Set(queryAll('input[name=distilleryIds]:checked', form)
        .map(input => input.value));
    const values = Object.entries(importDetails.fields).filter(([k, v]) =>
      v !== null && v !== undefined && v !== '');
    const distilleryChoice = composeMarkup(distilleries.map(distillery =>
      importChoice({
        label: t("imports.fields.distillery"),
        value: distillery.name,
        distillery: true,
        distilleryId: distillery.id,
        checked: Boolean(distillery.id &&
          !selectedDistilleries.has(distillery.id)),
        disabled: !distillery.id,
      })));
    const fieldChoices = composeMarkup(values.map(([key, value]) => {
      const old = form.elements[key]?.value;
      return importChoice({
        field: key, label: IMPORT_FIELD_LABELS[key] || key,
        value: key === 'whiskyType' ? (whiskyTypeLabels[value] ||
          value) : value,
        currentValue: old, checked: !old,
      });
    }));
    replaceContent(panel, renderTemplate('panel', {
      title: t("imports.preview.title", {
        id: escapeHtml(importDetails.referenceId),
      }),
      openPhoto: importDetails.imageToken ?
        renderTemplate('openPhoto', {
          openOverlay: t(
            "imports.images.openOverlay", {source: safeSourceName}
          ),
          imageToken: importDetails.imageToken,
          reference: t(
            "imp\
orts.images.reference",
            {source: safeSourceName}
          ),
          hint: form.dataset.id ?
            renderTemplate('hint') : renderTemplate('importImage'),
          referenceNotOwnership: t(
            "imports.images.referenceNotOwnership",
            {source: safeSourceName}
          ),
        }) : '',
      distilleryChoice: distilleryChoice,
      fieldChoices: fieldChoices,
    }));
  }

  /**
   * Builds the localized import from extension text for the current language.
   */
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
      showModal(
        t("imports.import.ready"),
        renderTemplate('importFromExtensionP', {
          unsavedDialogNotice: t(
            "imports.import.unsavedDialogNotice",
            {source: safeSourceName}
          ),
        }),
        false,
        true
      );
      return;
    }
    processExtensionImport(raw);
  }

  /**
   * Derives the confirm pending import result from the supplied values.
   */
  function confirmPendingImport() {
    if (pendingExtensionImport == null) return;
    const raw = pendingExtensionImport;
    pendingExtensionImport = null;
    closeModal(true);
    processExtensionImport(raw);
  }

  /**
   * Handles extension import for controller.
   *
   * @param {*} raw Raw used by this operation.
   */
  function processExtensionImport(raw) {
    try {
      if (raw.length > 12000) {
        throw Error(t('imports.errors.tooLarge'));
      }
      const data = validatePayload(JSON.parse(decodeURIComponent(raw)));
      const existing = findExistingBottling(state.collection, data);
      if (existing) {
        navigate('detail', existing.id, {
          replace: true,
        });
        showModal(t("imports.import.alreadyExists"), renderTemplate('panel2', {
          existingBottlingPrefix: t(
            "imports.import.existingBottlingPrefix",
            {source: safeSourceName}
          ),
          name: existing.name,
          importExistingPhoto: data
            .imageToken ? renderTemplate('importExistingPhoto', {
              preparedLocally: t(
                "imports.images.preparedLocally", {source: safeSourceName}
              ),
              formField: (
                existing.bottles || []).length ? renderTemplate('formField', {
                  bottles: composeMarkup(existing.bottles
                    .map(b => renderTemplate('processExtensionImportOption', {
                      id: b.id,
                      inventoryNumber: b.inventoryNumber ||
                        t("imports.bottles.noInventoryNumber"),
                      volumeType: b.volumeType === 'sample' ?
                        t("imports.bottles.sample") : t("imports.bottles.sta\
ndard"),
                    }))),
                }) : '',
            }) : '',
        }), true);
        importDetails = data;
      }
      else {
        navigate('home', null, {
          replace: true,
        });
        createBottling();
        previewImport(data);
      }
    }
    catch (err) {
      toast(t('imports.errors.importFailed', {error: err.message}), true);
    }
  }

  /**
   * Updates import in the current state.
   */
  function applyImport() {
    const form = query('#bottling-form');
    if (!form || !importDetails) {
      return;
    }
    for (const checkbox of queryAll('[data-import-field]:checked',
      query('#import-panel'))) {
      const k = checkbox.dataset.importField;
      if (form.elements[k] && importDetails.fields[k] != null) {
        form.elements[k].value = importDetails.fields[k];
      }
    }
    const selectedIds = new Set(queryAll('[name=import-distillery]:checked',
      query('#import-panel')).map(input => input.value));
    for (const choice of queryAll('input[name=distilleryIds]', form)) {
      if (selectedIds.has(choice.value)) choice.checked = true;
    }
    importMessage(t('imports.import.selectedApplied'));
    toast(t("imports.import.dataApplied"));
  }

  /**
   * Updates the edit existing state for its caller.
   */
  function editExisting() {
    const incoming = importDetails;
    editBottling();
    previewImport(incoming);
  }

  /**
   * Retrieves pending image token from the available state.
   * @return {*} Computed value, or null when the input has no match.
   */
  function getPendingImageToken() {
    if (!importDetails?.imageToken) return null;
    const choice = query('#import-image');
    return choice && !choice.checked ? null : importDetails.imageToken;
  }

  /**
   * Updates the mark image attached state for its caller.
   */
  function markImageAttached() {
    if (importDetails) importDetails.imageToken = null;
  }

  /**
   * Registers to existing bottle for controller.
   *
   * @return {!Promise<void>} Promise fulfilled when the operation completes.
   */
  async function attachToExistingBottle() {
    const id = query('#import-existing-photo-bottle')?.value;
    const token = getPendingImageToken();
    if (!id || !token) return toast(t("imports.validation.selectBottle"), true);
    const found = state.collection.bottlings.some(b => (b.bottles || [])
      .some(p => p.id === id));
    if (!found) return toast(t("features.errors.bottleNotFound"), true);
    const result = await action(async () => {
      await request(
        `/api/bottles/${encodeURIComponent(id)}/photos/from-stage`,
        {
          method: 'POST', body: JSON.stringify({token}),
        }
      );
      return true;
    });
    if (result.ok) {
      markImageAttached();
      closeModal();
      toast(t("imports.images.savedLocally", {source: sourceName}));
    }
  }
  return {
    previewImport,
    applyImport,
    importFromExtension,
    confirmPendingImport,
    editExisting,
    getPendingImageToken,
    markImageAttached,
    attachToExistingBottle,
  };
}
