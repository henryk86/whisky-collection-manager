/** @typedef {import('./photo-adjustments.js').PhotoAdjustments} PhotoAdjustments */
/**
 * Generated image associated with a particular original or cutout path.
 * @typedef {Object} PhotoAdjustment
 * @property {string} sourcePath Relative path of the image actually edited.
 * @property {string} path Relative path of the adjusted derivative.
 * @property {PhotoAdjustments} settings Saved slider settings.
 */
/**
 * Selected transparent derivative, retained independently of the original.
 * @typedef {Object} PhotoCutout
 * @property {string} path Relative path of the generated cutout.
 * @property {boolean} selected Whether the cutout is the active base image.
 * @property {PhotoAdjustment} [adjustment] Settings specific to the cutout.
 */
/** @typedef {{path: string, adjustment?: PhotoAdjustment, cutout?: PhotoCutout}} EditablePhoto */
/**
 * Every physical photo retains its original; a selected cutout can have
 * independent edits.
 *
 * @param {EditablePhoto|null|undefined} photo Stored or newly uploaded photo.
 * @return {string} Selected cutout path, original path or empty text.
 */
export const basePhotoPath = photo => photo?.cutout?.selected && photo.cutout.path ? photo.cutout.path : photo?.path || '';

/**
 * Selects the photo's effective adjustment state for rendering.
 *
 * @param {EditablePhoto|null|undefined} photo Photo with optional derivatives.
 * @return {PhotoAdjustment|null} Adjustment belonging to the active source, if present.
 */
export const activePhotoAdjustment = photo => {
  const base = basePhotoPath(photo);
  if (photo?.cutout?.selected && photo.cutout.adjustment?.sourcePath === base)
    return photo.cutout.adjustment;
  // Compatibility with previously saved v0.17.x photos.
  return photo?.adjustment?.sourcePath === base ? photo.adjustment : null;
};

/**
 * Resolves the displayed image without changing the original photo.
 *
 * @param {EditablePhoto|null|undefined} photo Photo whose effective derivative is requested.
 * @return {string} Adjusted derivative path, base image path or empty text.
 */
export const displayPhotoPath = photo => activePhotoAdjustment(photo)?.path || basePhotoPath(photo);

/**
 * Keep edits visible when switching to a legacy cutout missing its own
 * derivative. The editor still renders from the transparent cutout, not from
 * the original.
 *
 * @param {EditablePhoto|null|undefined} photo Photo about to be edited.
 * @return {PhotoAdjustments|null|undefined} Active or compatible legacy settings, if available.
 */
export const initialPhotoAdjustmentSettings = photo =>
  activePhotoAdjustment(photo)?.settings ||
  (photo?.cutout?.selected && photo.adjustment?.sourcePath === photo.path ? photo.adjustment.settings : null);

/**
 * The photo editor must also accept freshly uploaded images: absent adjustment
 * and cutout objects are the normal initial state, not matching sources.
 *
 * @param {EditablePhoto|null|undefined} photo Photo with optional original and cutout edits.
 * @return {{original: PhotoAdjustments|null|undefined, cutout: PhotoAdjustments|null|undefined}} Settings for each source; cutout inherits the original when missing.
 */
export const editorPhotoSourceSettings = photo => {
  const original = photo?.adjustment?.sourcePath && photo.adjustment.sourcePath === photo.path ? photo.adjustment.settings : null;
  const cutoutPath = photo?.cutout?.path;
  const cutout = cutoutPath
    ? (photo.cutout.adjustment?.sourcePath === cutoutPath
      ? photo.cutout.adjustment.settings
      : (photo.adjustment?.sourcePath === cutoutPath ? photo.adjustment.settings : null))
    : null;
  return {original, cutout: cutout || original};
};
