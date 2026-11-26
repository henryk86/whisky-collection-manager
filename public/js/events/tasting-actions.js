import {t} from '../i18n/index.js';
import {request} from '../api.js';

/**
 * Builds the tasting actions for delegated application events.
 * @param {!Object} options Dependencies of the event group.
 * @return {!Object} Action handlers keyed by action name.
 */
export function createTastingActions({tastingsView, warehouseView, state, navigate, confirmInModal, action}) {
  return {
    /**
     * Clears the edited sensory profile.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flavor-clear': () => tastingsView.clearFlavor(),

    /**
     * Sets the selected numeric 100-point tasting rating.
     * @param {!HTMLElement} button Action element carrying data-rating-points.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-rating': button =>
      tastingsView.chooseRating(Number(button.dataset.ratingPoints)),

    /**
     * Clears the current tasting rating.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-rating-clear': () => tastingsView.chooseRating(null),

    /**
     * Selects the whisky-colour key supplied by the action.
     * @param {!HTMLElement} button Action element carrying data-color-key.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-color': button => tastingsView.chooseColor(button.dataset.colorKey),

    /**
     * Clears the tasting colour selection.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-color-clear': () => tastingsView.chooseColor(null),

    /**
     * Returns from a flight to the tasting overview.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tasting-flight-back': () => navigate('tastings-home'),

    /**
     * Returns to the associated flight if the current tasting has one.
     * @return {string|void|null} No navigation result; the existing falsy flight ID is returned if absent.
     */
    'tasting-back-flight': () => state.flightId && navigate('tasting-flight', state.flightId),

    /**
     * Opens the flight referenced by the action.
     * @param {!HTMLElement} button Action element carrying data-flight-id.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tasting-open-flight': button =>
      navigate('tasting-flight', button.dataset.flightId),

    /**
     * Opens the selected flight from the overview.
     * @param {!HTMLElement} button Action element carrying data-flight-id.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tasting-flight-open': button =>
      navigate('tasting-flight', button.dataset.flightId),

    /**
     * Opens the planner for a new future flight.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-new': () => tastingsView.startPlannedFlight(),

    /**
     * Opens the flight-planning explanation.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-help': () => tastingsView.showFlightPlanningHelp(),

    /**
     * Clears only the planner's cask preferences.
     */
    'flight-plan-cask-reset': () => {tastingsView.resetFlightCaskSelection();},

    /**
     * Reads planner criteria and generates a proposed flight.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-generate': () => tastingsView.generateFlightPlan(),

    /**
     * Persists the current proposed flight.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-create': () => tastingsView.createPlannedFlight(),

    /**
     * Adds a candidate to the planned member list.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-add': () => tastingsView.changePlannedMember(-1, 'add'),

    /**
     * Moves a planned member by the supplied relative step.
     * @param {!HTMLElement} button Action element carrying data-index, data-step.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-move': button => tastingsView.changePlannedMember(Number(button.dataset.index), 'move', Number(button.dataset.step)),

    /**
     * Removes the planned member at the supplied index.
     * @param {!HTMLElement} button Action element carrying data-index.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-remove': button => tastingsView.changePlannedMember(Number(button.dataset.index), 'remove'),

    /**
     * Replaces the planned member at the supplied index.
     * @param {!HTMLElement} button Action element carrying data-index.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-replace': button => tastingsView.changePlannedMember(Number(button.dataset.index), 'replace'),

    /**
     * Transitions the planned flight to in-progress status.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-start': () =>
      tastingsView.transitionPlannedFlight('inProgress'),

    /**
     * Transitions the flight to completed status.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-finish': () =>
      tastingsView.transitionPlannedFlight('completed'),

    /**
     * Opens a new tasting draft for the planned bottling within this flight.
     * @param {!HTMLElement} button Action element carrying data-bottling-id.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'flight-plan-record': button => navigate('tasting', button.dataset.bottlingId, {tastingId: 'new', flightId: state.selected}),

    /**
     * Opens the collection details for the planned member's bottling.
     * @param {!HTMLElement} button Action element carrying data-bottling-id.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'flight-plan-open-bottling': button => navigate('detail', button.dataset.bottlingId),

    /**
     * Shows the planned physical bottle's location and retains the flight return route.
     * @param {!HTMLElement} button Action element carrying data-bottle-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flight-plan-location': button => warehouseView.showBottleLocation(button.dataset.bottleId, {returnToFlightId: state.selected}),

    /**
     * Opens the form for a new tasting flight.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flight-new': () => tastingsView.startFlight(),

    /**
     * Persists the flight creation form.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flight-create-confirm': () => tastingsView.createFlight(),

    /**
     * Enables editing of the current flight.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flight-edit': () => tastingsView.toggleFlightEdit(true),

    /**
     * Exits flight editing.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flight-cancel-edit': () => tastingsView.toggleFlightEdit(false),

    /**
     * Persists edits to the current flight.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flight-save': () => tastingsView.saveFlight(),

    /**
     * Handles the tasting flight delete interaction.
          * @return {*} Result of this expression.
*/
    'tasting-flight-delete': () => confirmInModal(
      t('tastingFlights.plural'),
      t('tastingFlights.deleteConfirm'),
      () => tastingsView.deleteFlight(),
      t('common.actions.delete')
    ),

    /**
     * Toggles the control for adding existing tastings.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flight-toggle-add': () => tastingsView.toggleFlightAdd(),

    /**
     * Attaches the selected existing tasting to the flight.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flight-attach': () => tastingsView.attachFlightMember(),

    /**
     * Detaches the referenced tasting without deleting its record.
     * @param {!HTMLElement} button Action element carrying data-tasting-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flight-remove-note': button =>
      tastingsView.detachFlightMember(button.dataset.tastingId),

    /**
     * Moves a recorded flight member by the requested relative step.
     * @param {!HTMLElement} button Action element carrying data-index, data-direction.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-flight-move': button => tastingsView.moveFlightMember(Number(button.dataset.index), Number(button.dataset.direction)),

    /**
     * Opens the owned or standalone tasting identified by the flight member.
     * @param {!HTMLElement} button Action element carrying data-external, data-bottling-id, data-tasting-id.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tasting-flight-note-open': button => button.dataset.external === '1'
      ? navigate('external-tasting', button.dataset.bottlingId, {flightId: state.selected})
      : navigate('tasting', button.dataset.bottlingId, {tastingId: button.dataset.tastingId, flightId: state.selected}),

    /**
     * Handles the tasting flight new owned interaction.
     */
    'tasting-flight-new-owned': () => {
      const id = document.querySelector('[data-flight-owned-bottling]')?.value;
      if (id && state.collection.bottlings.some(b => b.id === id)) navigate('tasting', id, {tastingId: 'new', flightId: state.selected});
    },

    /**
     * Opens a new standalone tasting draft linked to the current flight.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tasting-flight-new-external': () =>
      navigate('external-tasting', 'new', {flightId: state.selected}),

    /**
     * Returns to the selected bottling's details.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tastings-back-detail': () => navigate('detail', state.selected),

    /**
     * Returns to the global tasting overview.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tastings-back-home': () => navigate('tastings-home'),

    /**
     * Returns to the selected bottling's tasting list.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tastings-back-list': () => navigate('tastings', state.selected),

    /**
     * Opens the specified tasting, or its bottling's list when no tasting ID is supplied.
     * @param {!HTMLElement} button Action element carrying data-tasting-id.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tastings-open': button => button.dataset.tastingId
      ? navigate('tasting', state.selected, {tastingId: button.dataset.tastingId})
      : navigate('tastings', state.selected),

    /**
     * Opens a new tasting draft for the selected owned bottling.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tastings-new': () =>
      navigate('tasting', state.selected, {tastingId: 'new'}),

    /**
     * Toggles the available tasting-creation choices.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tastings-start-choice': () => tastingsView.toggleCreateChoice(),

    /**
     * Handles the tastings start owned interaction.
     */
    'tastings-start-owned': () => {
      const id = document.querySelector('[data-owned-tasting-bottling]')?.value;
      if (id && state.collection.bottlings.some(b => b.id === id)) navigate('tasting', id, {tastingId: 'new'});
    },

    /**
     * Opens a new standalone tasting draft.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tastings-start-external': () => navigate('external-tasting', 'new'),

    /**
     * Opens the selected owned or standalone tasting from the overview.
     * @param {!HTMLElement} button Action element carrying data-external, data-bottling-id, data-tasting-id.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tastings-home-open': button => button.dataset.external === '1'
      ? navigate('external-tasting', button.dataset.bottlingId)
      : navigate('tasting', button.dataset.bottlingId, {tastingId: button.dataset.tastingId}),

    /**
     * Persists the current tasting draft.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-create': () => tastingsView.saveDraft(),

    /**
     * Enables editing of the current tasting.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-edit-start': () => tastingsView.startEditing(),

    /**
     * Finishes editing the current tasting.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-edit-done': () => tastingsView.finishEditing(),

    /**
     * Opens collection details for the current tasting's bottling.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'tasting-open-bottling': () => navigate('detail', state.selected),

    /**
     * Enables editing of standalone whisky metadata.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-external-edit': () => tastingsView.startExternalEdit(),

    /**
     * Cancels the standalone metadata edit.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-external-cancel': () => tastingsView.cancelExternalEdit(),

    /**
     * Persists standalone whisky metadata.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-external-save': () => tastingsView.persistExternalDetails(),

    /**
     * Opens the dialog for assigning a standalone tasting to an owned bottling.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-external-assign': () => tastingsView.showAssignDialog(),

    /**
     * Confirms assignment of the standalone tasting to the selected owned bottling.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'tasting-external-assign-confirm': () =>
      tastingsView.assignExternalToBottling(),

    /**
     * Handles the tasting delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
          * @return {*} Result of this expression.
*/
    'tasting-delete': button => confirmInModal(
      t('tastings.delete'),
      t('tastings.deleteConfirm'),
      async () => {
        const id = button.dataset.tastingId;
        const external = state.page === 'external-tasting';
        const result = await action(
          () => request(
            external ? `/api/external-tastings/${encodeURIComponent(id)}` :
              `/api/bottlings/${encodeURIComponent(state.selected)}/tastings/${encodeURIComponent(id)}`,
            {method: 'DELETE'}
          ),
          {scope: 'collection'}
        );
        if (!result.ok) return result;
        navigate(external ? 'tastings-home' : 'tastings', external ? null : state.selected, {replace: true});
        return result;
      },
      t('common.actions.delete')
    ),
  };
}
