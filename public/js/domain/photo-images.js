/** An optional derivative never replaces its original photo. */
export const displayPhotoPath = photo => photo?.cutout?.selected && photo.cutout.path ? photo.cutout.path : photo?.path || '';
