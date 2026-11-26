

/**
 * Builds the collection actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createCollectionActions({home, tastingsView}) {
  return {
    /**
     * Opens the dialog for saving the current collection view.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-view-save': () => home.openSaveView(),

    /**
     * Persists the current collection view under its entered name.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-view-save-confirm': () => home.saveCurrentView(),

    /**
     * Updates the saved view with the current filter and sort configuration.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-view-update': () => home.updateCurrentView(),

    /**
     * Opens the saved-view rename dialog.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-view-rename': () => home.renameCurrentView(),

    /**
     * Confirms the entered saved-view name.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-view-rename-confirm': () => home.confirmRenameView(),

    /**
     * Starts removal of the active saved view.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-view-delete': () => home.deleteCurrentView(),

    /**
     * Opens the draft sensory filter editor.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-flavor-open': () => home.openFlavorFilter(),

    /**
     * Closes the sensory filter editor.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-flavor-close': () => home.closeFlavorFilter(),

    /**
     * Clears the criteria in the draft sensory filter.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-flavor-reset': () => home.resetFlavorDraft(),

    /**
     * Applies the draft sensory criteria to the collection.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-flavor-apply': () => home.applyFlavorDraft(),

    /**
     * Restores the saved view identified by the selected action.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-view-apply': button => home.applySavedView(button.dataset.id),

    /**
     * Adds another sensory filter criterion.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-flavor-add': () => home.addFlavorCriterion(),

    /**
     * Removes the draft criterion for the selected sensory axis.
     * @param {!HTMLElement} button Action element carrying data-axis.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'collection-flavor-remove': button =>
      home.removeFlavorCriterion(button.dataset.axis),

    /**
     * Handles the collection flight plan interaction.
     */
    'collection-flight-plan': () => {
      home.planFromSelection();
      tastingsView.startPlannedFlight();
    },
  };
}
