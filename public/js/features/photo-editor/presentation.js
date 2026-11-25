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
 * Builds the localized slider html text for the current language.
 *
 * @param {!Object} options Options controlling the operation.
 * @return {string} Resulting text.
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
