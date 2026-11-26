

/**
 * Builds the import actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createImportActions({externalImport, editors}) {
  return {
    /**
     * Applies the parsed external bottling import.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'import-apply': () => externalImport.applyImport(),

    /**
     * Confirms the pending external import choice.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'import-continue': () => externalImport.confirmPendingImport(),

    /**
     * Opens a physical-bottle form using the pending import data.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'import-existing-bottle': () => editors.newBottle(true),

    /**
     * Attaches the imported photo to the chosen existing bottle.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'import-existing-photo': () => externalImport.attachToExistingBottle(),

    /**
     * Opens an existing record with the pending import data.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'import-existing-edit': () => externalImport.editExisting(),
  };
}
