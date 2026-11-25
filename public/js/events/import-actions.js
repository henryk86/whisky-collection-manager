

/**
 * Builds the import actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createImportActions({externalImport, editors}) {
  return {
    /**
     * Handles the import apply interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-apply': () => externalImport.applyImport(),

    /**
     * Handles the import continue interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-continue': () => externalImport.confirmPendingImport(),

    /**
     * Handles the import existing bottle interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-existing-bottle': () => editors.newBottle(true),

    /**
     * Handles the import existing photo interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-existing-photo': () => externalImport.attachToExistingBottle(),

    /**
     * Handles the import existing edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-existing-edit': () => externalImport.editExisting(),
  };
}
