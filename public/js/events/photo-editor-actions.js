

/**
 * Builds the photo editor actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createPhotoEditorActions({photoEditor}) {
  return {
    /**
     * Opens the photo editor for the action's image source.
     * @param {!HTMLElement} button Triggering action element passed to the controller.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-open': button => photoEditor.open(button),

    /**
     * Switches the photo editor to the requested tool tab.
     * @param {!HTMLElement} button Action element carrying data-photo-editor-tab.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-tab': button => photoEditor.selectTab(button.dataset.photoEditorTab),

    /**
     * Switches between the edited preview and the original image.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-before': () => photoEditor.before(),

    /**
     * Computes automatic image adjustments.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-auto': () => photoEditor.auto(),

    /**
     * Restores the editor's default adjustments.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-reset': () => photoEditor.reset(),

    /**
     * Resets only the selected adjustment group.
     * @param {!HTMLElement} button Action element carrying data-photo-group.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-reset-group': button =>
      photoEditor.resetGroup(button.dataset.photoGroup),

    /**
     * Toggles white-balance sample selection.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-pick-white': () => photoEditor.toggleWhitePicker(),

    /**
     * Activates or toggles the requested mask-brush mode.
     * @param {!HTMLElement} button Action element carrying data-photo-brush-mode.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-brush-mode': button =>
      photoEditor.toggleBrush(button.dataset.photoBrushMode),

    /**
     * Reverts the most recent mask-brush operation.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-brush-undo': () => photoEditor.undoBrush(),

    /**
     * Increases the editor preview zoom by a factor of 1.5.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-zoom-in': () => photoEditor.zoom(1.5),

    /**
     * Decreases the editor preview zoom by a factor of 1.5.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-zoom-out': () => photoEditor.zoom(1 / 1.5),

    /**
     * Resets editor preview magnification.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-zoom-reset': () => photoEditor.zoom(0),

    /**
     * Exports and saves the current edited image.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-save': () => photoEditor.save(),

    /**
     * Starts foreground extraction for the source image.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-cutout': () => photoEditor.cutout(),

    /**
     * Toggles application of the foreground mask.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-toggle-cutout': () => photoEditor.toggleCutout(),

    /**
     * Removes the current foreground mask.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-editor-remove-cutout': () => photoEditor.removeCutout(),
  };
}
