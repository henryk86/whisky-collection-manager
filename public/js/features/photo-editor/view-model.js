import {EMPTY_PHOTO_ADJUSTMENTS, validatePhotoAdjustments} from './adjustments.js';
import {DEFAULT_MASK_BRUSH_SIZE} from './mask-brush.js';
import {basePhotoPath, editorPhotoSourceSettings} from '../../../../shared/photo-images.js';

/**
 * Creates isolated mutable state for a single editor, independent of the collection.
 * @return {!Object} The editor session, including preview and tool state.
 */
export function createPhotoEditorSession() {
  return {
    selection: null,
    image: null,
    sourceData: null,
    pendingCutout: null,
    maskBaseData: null,
    maskStrokes: [],
    brushMode: null,
    brushSize: DEFAULT_MASK_BRUSH_SIZE,
    activeBrush: null,
    values: {...EMPTY_PHOTO_ADJUSTMENTS},
    previewCutout: false,
    sourceValues: {
      original: {...EMPTY_PHOTO_ADJUSTMENTS},
      cutout: {...EMPTY_PHOTO_ADJUSTMENTS},
    },
    savedSourceValues: {
      original: {...EMPTY_PHOTO_ADJUSTMENTS},
      cutout: {...EMPTY_PHOTO_ADJUSTMENTS},
    },
    cutoutMaskStrokes: [],
    showingBefore: false,
    originalPreviewData: null,
    sourceImages: {
      original: null,
      cutout: null,
    },
    sourcePixels: {original: null, cutout: null},
    activeTab: 'adjustments',
    whitePicking: false,
    pickStart: null,
    busy: false,
    renderId: 0,
    generation: 0,
  };
}

/**
 * Prepares a new editing session for a saved photo without mutating the photo.
 * @param {!Object} photo Stored photo record.
 * @param {string} bottleId Owner bottle identifier.
 * @param {string} photoId Photo identifier.
 * @return {!Object} Fresh draft values and selected source.
 */
export function createPhotoDraft(photo, bottleId, photoId) {
  const previewCutout = Boolean(photo.cutout?.selected);
  const {original, cutout} = editorPhotoSourceSettings(photo);
  const sourceValues = {
    original: validatePhotoAdjustments(original || EMPTY_PHOTO_ADJUSTMENTS),
    cutout: validatePhotoAdjustments(cutout || EMPTY_PHOTO_ADJUSTMENTS),
  };
  return {
    selection: {bottleId, photoId, sourcePath: basePhotoPath(photo)},
    previewCutout,
    sourceValues,
    savedSourceValues: {original: {...sourceValues.original}, cutout: {...sourceValues.cutout}},
    values: {...sourceValues[previewCutout ? 'cutout' : 'original']},
  };
}

/**
 * Selects only control-related fields from the mutable editor session.
 * @param {!Object} session Current editing session.
 * @param {?Object} photo Persisted photo, if still present.
 * @return {!Object} Control state for the mounted editor.
 */
export function createPhotoControlsModel(session, photo) {
  const {activeTab, values, busy, sourceData, pendingCutout, previewCutout, whitePicking, maskBaseData, brushMode, maskStrokes, brushSize, showingBefore} = session;
  return {activeTab, values, busy, sourceData: Boolean(sourceData), pendingCutout: Boolean(pendingCutout), previewCutout, whitePicking, maskBaseData: Boolean(maskBaseData), brushMode, maskStrokes, brushSize, showingBefore, hasSavedCutout: Boolean(photo?.cutout)};
}
