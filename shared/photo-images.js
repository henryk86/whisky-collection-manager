/**
 * Every physical photo retains its original; a selected cutout can have
 * independent edits.
 *
 * @param {*} photo Photo used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
export const basePhotoPath = photo => photo?.cutout?.selected &&
  photo.cutout.path ? photo.cutout.path : photo?.path || '';

/**
 * Selects the photo's effective adjustment state for rendering.
 *
 * @param {*} photo Photo used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
export const activePhotoAdjustment = photo => {
  const base = basePhotoPath(photo);
  if (photo?.cutout?.selected && photo.cutout.adjustment?.sourcePath === base)
    return photo.cutout.adjustment;
  // Compatibility with previously saved v0.17.x photos.
  return photo?.adjustment?.sourcePath === base ? photo.adjustment : null;
};

/**
 * Renders photo path for photo images.
 *
 * @param {*} photo Photo used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
export const displayPhotoPath = photo =>
  activePhotoAdjustment(photo)?.path || basePhotoPath(photo);

/**
 * Keep edits visible when switching to a legacy cutout missing its own
 * derivative. The editor still renders from the transparent cutout, not from
 * the original.
 *
 * @param {*} photo Photo used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
export const initialPhotoAdjustmentSettings = photo =>
  activePhotoAdjustment(photo)?.settings ||
  (photo?.cutout?.selected && photo.adjustment?.sourcePath === photo.path ?
    photo.adjustment.settings : null);

/**
 * The photo editor must also accept freshly uploaded images: absent adjustment
 * and cutout objects are the normal initial state, not matching sources.
 *
 * @param {*} photo Photo used by this operation.
 * @return {!Object} Structured result for the caller.
 */
export const editorPhotoSourceSettings = photo => {
  const original = photo?.adjustment?.sourcePath && photo.adjustment
    .sourcePath === photo.path
    ? photo.adjustment.settings : null;
  const cutoutPath = photo?.cutout?.path;
  const cutout = cutoutPath
    ? (photo.cutout.adjustment?.sourcePath === cutoutPath
      ? photo.cutout.adjustment.settings
      : (photo.adjustment?.sourcePath === cutoutPath ? photo.adjustment
        .settings : null))
    : null;
  return {original, cutout: cutout || original};
};
