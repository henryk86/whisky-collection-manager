

/**
 * Builds the collection actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createCollectionActions({home, tastingsView}) {
  return {
    /**
     * Handles the collection view save interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-save': () => home.openSaveView(),

    /**
     * Handles the collection view save confirm interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-save-confirm': () => home.saveCurrentView(),

    /**
     * Handles the collection view update interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-update': () => home.updateCurrentView(),

    /**
     * Handles the collection view rename interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-rename': () => home.renameCurrentView(),

    /**
     * Handles the collection view rename confirm interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-rename-confirm': () => home.confirmRenameView(),

    /**
     * Handles the collection view delete interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-delete': () => home.deleteCurrentView(),

    /**
     * Handles the collection flavor open interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-open': () => home.openFlavorFilter(),

    /**
     * Handles the collection flavor close interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-close': () => home.closeFlavorFilter(),

    /**
     * Handles the collection flavor reset interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-reset': () => home.resetFlavorDraft(),

    /**
     * Handles the collection flavor apply interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-apply': () => home.applyFlavorDraft(),

    /**
     * Handles the collection view apply interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-apply': button => home.applySavedView(button.dataset.id),

    /**
     * Handles the collection flavor add interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-add': () => home.addFlavorCriterion(),

    /**
     * Handles the collection flavor remove interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
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
