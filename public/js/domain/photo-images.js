/** Every physical photo retains its original; a selected cutout can have independent edits. */
export const basePhotoPath = photo => photo?.cutout?.selected && photo.cutout.path ? photo.cutout.path : photo?.path || '';
export const activePhotoAdjustment = photo => {
    const base = basePhotoPath(photo);
    if (photo?.cutout?.selected && photo.cutout.adjustment?.sourcePath === base)
        return photo.cutout.adjustment;
    // Compatibility with previously saved v0.17.x photos.
    return photo?.adjustment?.sourcePath === base ? photo.adjustment : null;
};
export const displayPhotoPath = photo => activePhotoAdjustment(photo)?.path || basePhotoPath(photo);

/** Keep edits visible when switching to a legacy cutout missing its own derivative.
 * The editor still renders from the transparent cutout, not from the original. */
export const initialPhotoAdjustmentSettings = photo => activePhotoAdjustment(photo)?.settings ||
    (photo?.cutout?.selected && photo.adjustment?.sourcePath === photo.path ? photo.adjustment.settings : null);

/** The photo editor must also accept freshly uploaded images: absent adjustment
 * and cutout objects are the normal initial state, not matching sources. */
export const editorPhotoSourceSettings = photo => {
    const original = photo?.adjustment?.sourcePath && photo.adjustment.sourcePath === photo.path
        ? photo.adjustment.settings : null;
    const cutoutPath = photo?.cutout?.path;
    const cutout = cutoutPath
        ? (photo.cutout.adjustment?.sourcePath === cutoutPath
            ? photo.cutout.adjustment.settings
            : (photo.adjustment?.sourcePath === cutoutPath ? photo.adjustment.settings : null))
        : null;
    return {original, cutout:cutout || original};
};
