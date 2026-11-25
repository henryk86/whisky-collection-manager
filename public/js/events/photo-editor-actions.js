

/**
 * Builds the photo editor actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createPhotoEditorActions({photoEditor}) {
  return {
    /**
     * Handles the photo editor open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-open': button => photoEditor.open(button),

    /**
     * Handles the photo editor tab interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-tab': button => photoEditor.selectTab(button.dataset.photoEditorTab),

    /**
     * Handles the photo editor before interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-before': () => photoEditor.before(),

    /**
     * Handles the photo editor auto interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-auto': () => photoEditor.auto(),

    /**
     * Handles the photo editor reset interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-reset': () => photoEditor.reset(),

    /**
     * Handles the photo editor reset group interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-reset-group': button =>
      photoEditor.resetGroup(button.dataset.photoGroup),

    /**
     * Handles the photo editor pick white interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-pick-white': () => photoEditor.toggleWhitePicker(),

    /**
     * Handles the photo editor brush mode interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-brush-mode': button =>
      photoEditor.toggleBrush(button.dataset.photoBrushMode),

    /**
     * Handles the photo editor brush undo interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-brush-undo': () => photoEditor.undoBrush(),

    /**
     * Handles the photo editor zoom in interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-zoom-in': () => photoEditor.zoom(1.5),

    /**
     * Handles the photo editor zoom out interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-zoom-out': () => photoEditor.zoom(1 / 1.5),

    /**
     * Handles the photo editor zoom reset interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-zoom-reset': () => photoEditor.zoom(0),

    /**
     * Handles the photo editor save interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-save': () => photoEditor.save(),

    /**
     * Handles the photo editor cutout interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-cutout': () => photoEditor.cutout(),

    /**
     * Handles the photo editor toggle cutout interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-toggle-cutout': () => photoEditor.toggleCutout(),

    /**
     * Handles the photo editor remove cutout interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-remove-cutout': () => photoEditor.removeCutout(),
  };
}
