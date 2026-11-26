import {composeMarkup} from '../../ui/render-plan.js';
import {actionButton} from '../../ui/buttons.js';
import {t} from '../../i18n/index.js';
import {plusIcon, minusIcon} from '../../ui/action-icons.js';
import {PHOTO_ADJUSTMENT_GROUPS} from './adjustments.js';
import {DEFAULT_MASK_BRUSH_SIZE} from './mask-brush.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates('photo-editor/controller.html');
const resetIcon = renderTemplate('resetIconSvg');
const pipetteIcon = renderTemplate('pipetteIconSvg');

/**
 * Prepares localized adjustment slider with the supplied numeric bounds and increment.
 *
 * @param {!Object} options Options controlling the operation.
 * @return {!import('../../ui/render-plan.js').RenderPlan} Localized adjustment slider with the supplied numeric bounds and increment.
 */
const sliderHtml = ({key, min, max, step}) =>
  renderTemplate('photoEditorSlider', {
    t: t(`photoEditor.${key}`),
    key: key,
    photoSlider: key,
    min: min,
    max: max,
    step: step,
  });

/**
 * Builds the photo editor dialog for the selected photo and source variant.
 * @param {!Object} photo Photo record with optional cutout metadata.
 * @return {!import('../../ui/render-plan.js').RenderPlan} Dialog content.
 */
export function renderPhotoEditor(photo) {
  return renderTemplate('photoEditor', {
    preview: t('photoEditor.preview'),
    zoom: t('photoEditor.zoom'),
    zoomOut: t('photoEditor.zoomOut'),
    zoomOutTitle: t('photoEditor.zoomOut'),
    minusIcon: minusIcon,
    zoomReset: t('photoEditor.zoomReset'),
    zoomResetTitle: t('photoEditor.zoomReset'),
    zoomIn: t('photoEditor.zoomIn'),
    zoomInTitle: t('photoEditor.zoomIn'),
    plusIcon: plusIcon,
    before: t('photoEditor.before'),
    title: t('photoEditor.title'),
    adjustmentsTab: t('photoEditor.adjustmentsTab'),
    cutoutTab: t('photoEditor.cutoutTab'),
    adjustmentGroups: composeMarkup(
      PHOTO_ADJUSTMENT_GROUPS.map(group =>
        renderTemplate('photoEditorGroup', {
          t: t(`photoEditor.${group.key}`),
          groupHeading: t(`photoEditor.${group.key}`),
          photoEditorPickWhite: group.key === 'color' ?
            renderTemplate('photoEditorPickWhite', {
              pickWhite: t('photoEditor.pickWhite'),
              ariaLabel: t('photoEditor.pickWhite'),
              pipetteIcon: pipetteIcon,
            }) : '',
          key: group.key,
          resetGroup: t('photoEditor.resetGroup', {group: t(`photoEditor.${group.key}`)}),
          ariaLabel: t('photoEditor.resetGroup', {group: t(`photoEditor.${group.key}`)}),
          resetIcon: resetIcon,
          sliders: composeMarkup(group.sliders.map(sliderHtml)),
        }))),
    t: t(photo.cutout ? 'photoEditor.recutout' : 'cutout.title'),
    photoEditorToggleCutout: photo.cutout ?
      renderTemplate('photoEditorToggleCutout', {
        selected: photo.cutout.selected ? t('cutout.showOriginal') : t('cutout.showCutout'),
      }) : '',
    remove: t('cutout.remove'),
    maskTools: t('photoEditor.maskTools'),
    erase: t('photoEditor.erase'),
    restore: t('photoEditor.restore'),
    brushUndo: t('photoEditor.brushUndo'),
    brushSize: t('photoEditor.brushSize'),
    defaultBrushSize: DEFAULT_MASK_BRUSH_SIZE,
    loading: t('photoEditor.loading'),
    auto: t('photoEditor.auto'),
    reset: t('photoEditor.reset'),
    closeModalButton: actionButton({
      label: t('common.actions.cancel'),
      action: 'close-modal',
    }),
    save: t('common.actions.save'),
  });
}

/**
 * Formats an adjustment value for display using the German decimal convention.
 *
 * @param {*} value Value to process.
 * @return {string} German-formatted numeric field value with at most two fraction digits.
 */
const formValue = value => Number(value).toLocaleString('de-DE', {maximumFractionDigits: 2});


/**
 * Applies prepared control values and availability to the mounted dialog.
 * @param {?Element} host Editor dialog root.
 * @param {!Object} model Prepared editor control state.
 */
export function syncPhotoEditorControls(host, model) {
  if (!host) return;
  for (const tab of host.querySelectorAll('[data-photo-editor-tab]')) {
    const selected = tab.dataset.photoEditorTab === model.activeTab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of host.querySelectorAll('[data-photo-editor-panel]'))
    panel.hidden = panel.dataset.photoEditorPanel !== model.activeTab;
  for (const input of host.querySelectorAll('[data-photo-slider]')) {
    const value = model.values[input.dataset.photoSlider];
    input.value = String(value);
    host.querySelector(`[data-photo-output="${input.dataset.photoSlider}"]`).textContent = formValue(value);
    input.disabled = model.busy || !model.sourceData;
  }
  for (const button of host.querySelectorAll('[data-photo-editor-ready]'))
    button.disabled = model.busy || !model.sourceData;
  const generateButton = host.querySelector('[data-act="photo-editor-cutout"]');
  if (generateButton) generateButton.disabled = model.busy || !model.sourceData;
  for (const button of host.querySelectorAll('[data-photo-editor-existing-cutout]')) {
    button.disabled = model.busy || Boolean(model.pendingCutout) || !model.sourceData;
    button.textContent = model.previewCutout ? t('cutout.showOriginal') : t('cutout.showCutout');
  }
  host.dataset.photoPreviewSource = model.previewCutout ? 'cutout' : 'original';
  const undoCutout = host.querySelector('[data-act="photo-editor-remove-cutout"]');
  if (undoCutout) {
    undoCutout.hidden = !model.pendingCutout && !model.hasSavedCutout;
    undoCutout.disabled = model.busy;
  }
  const picker = host.querySelector('[data-act="photo-editor-pick-white"]');
  if (picker) picker.setAttribute('aria-pressed', String(model.whitePicking));
  const maskTools = host.querySelector('[data-photo-editor-mask-tools]');
  if (maskTools) {
    maskTools.hidden = !model.maskBaseData;
    for (const button of maskTools.querySelectorAll('[data-photo-brush-mode]')) {
      button.setAttribute('aria-pressed', String(model.brushMode === button.dataset.photoBrushMode));
      button.disabled = model.busy;
    }
    const undo = maskTools.querySelector('[data-act="photo-editor-brush-undo"]');
    if (undo) undo.disabled = model.busy || !model.maskStrokes.length;
    const size = maskTools.querySelector('[data-photo-brush-size]');
    if (size) {size.disabled = model.busy; size.value = String(model.brushSize);}
    maskTools.querySelector('[data-photo-brush-size-value]').textContent = `${model.brushSize} %`;
  }
  host.querySelector('.photo-editor-image')?.classList.toggle('is-brushing', Boolean(model.brushMode));
  host.querySelector('.photo-editor-image')?.classList.toggle('is-picking', model.whitePicking);
  const before = host.querySelector('[data-act="photo-editor-before"]');
  if (before) {
    before.setAttribute('aria-pressed', String(model.showingBefore));
    before.textContent = model.showingBefore ? t('photoEditor.after') : t('photoEditor.before');
  }
}
