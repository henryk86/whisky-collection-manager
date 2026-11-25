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
     * Handles the tasting flavor clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flavor-clear': () => tastingsView.clearFlavor(),

    /**
     * Handles the tasting rating interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-rating': button =>
      tastingsView.chooseRating(Number(button.dataset.ratingPoints)),

    /**
     * Handles the tasting rating clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-rating-clear': () => tastingsView.chooseRating(null),

    /**
     * Handles the tasting color interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-color': button => tastingsView.chooseColor(button.dataset.colorKey),

    /**
     * Handles the tasting color clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-color-clear': () => tastingsView.chooseColor(null),

    /**
     * Handles the tasting flight back interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-back': () => navigate('tastings-home'),

    /**
     * Handles the tasting back flight interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-back-flight': () => state.flightId && navigate('tasting-flight', state.flightId),

    /**
     * Handles the tasting open flight interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-open-flight': button =>
      navigate('tasting-flight', button.dataset.flightId),

    /**
     * Handles the tasting flight open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-open': button =>
      navigate('tasting-flight', button.dataset.flightId),

    /**
     * Handles the flight plan new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-new': () => tastingsView.startPlannedFlight(),

    /**
     * Handles the flight plan help interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-help': () => tastingsView.showFlightPlanningHelp(),

    /**
     * Clears only the planner's cask preferences.
     */
    'flight-plan-cask-reset': () => {tastingsView.resetFlightCaskSelection();},

    /**
     * Handles the flight plan generate interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-generate': () => tastingsView.generateFlightPlan(),

    /**
     * Handles the flight plan create interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-create': () => tastingsView.createPlannedFlight(),

    /**
     * Handles the flight plan add interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-add': () => tastingsView.changePlannedMember(-1, 'add'),

    /**
     * Handles the flight plan move interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-move': button => tastingsView.changePlannedMember(Number(button.dataset.index), 'move', Number(button.dataset.step)),

    /**
     * Handles the flight plan remove interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-remove': button => tastingsView.changePlannedMember(Number(button.dataset.index), 'remove'),

    /**
     * Handles the flight plan replace interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-replace': button => tastingsView.changePlannedMember(Number(button.dataset.index), 'replace'),

    /**
     * Handles the flight plan start interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-start': () =>
      tastingsView.transitionPlannedFlight('inProgress'),

    /**
     * Handles the flight plan finish interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-finish': () =>
      tastingsView.transitionPlannedFlight('completed'),

    /**
     * Handles the flight plan record interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-record': button => navigate('tasting', button.dataset.bottlingId, {tastingId: 'new', flightId: state.selected}),

    /**
     * Handles the flight plan open bottling interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-open-bottling': button => navigate('detail', button.dataset.bottlingId),

    /**
     * Handles the flight plan location interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-location': button => warehouseView.showBottleLocation(button.dataset.bottleId, {returnToFlightId: state.selected}),

    /**
     * Handles the tasting flight new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-new': () => tastingsView.startFlight(),

    /**
     * Handles the tasting flight create confirm interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-create-confirm': () => tastingsView.createFlight(),

    /**
     * Handles the tasting flight edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-edit': () => tastingsView.toggleFlightEdit(true),

    /**
     * Handles the tasting flight cancel edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-cancel-edit': () => tastingsView.toggleFlightEdit(false),

    /**
     * Handles the tasting flight save interaction.
     * @return {*} Result computed from the supplied inputs.
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
     * Handles the tasting flight toggle add interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-toggle-add': () => tastingsView.toggleFlightAdd(),

    /**
     * Handles the tasting flight attach interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-attach': () => tastingsView.attachFlightMember(),

    /**
     * Handles the tasting flight remove note interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-remove-note': button =>
      tastingsView.detachFlightMember(button.dataset.tastingId),

    /**
     * Handles the tasting flight move interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-move': button => tastingsView.moveFlightMember(Number(button.dataset.index), Number(button.dataset.direction)),

    /**
     * Handles the tasting flight note open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
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
     * Handles the tasting flight new external interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-new-external': () =>
      navigate('external-tasting', 'new', {flightId: state.selected}),

    /**
     * Handles the tastings back detail interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-back-detail': () => navigate('detail', state.selected),

    /**
     * Handles the tastings back home interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-back-home': () => navigate('tastings-home'),

    /**
     * Handles the tastings back list interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-back-list': () => navigate('tastings', state.selected),

    /**
     * Handles the tastings open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-open': button => button.dataset.tastingId
      ? navigate('tasting', state.selected, {tastingId: button.dataset.tastingId})
      : navigate('tastings', state.selected),

    /**
     * Handles the tastings new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-new': () =>
      navigate('tasting', state.selected, {tastingId: 'new'}),

    /**
     * Handles the tastings start choice interaction.
     * @return {*} Result computed from the supplied inputs.
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
     * Handles the tastings start external interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-start-external': () => navigate('external-tasting', 'new'),

    /**
     * Handles the tastings home open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-home-open': button => button.dataset.external === '1'
      ? navigate('external-tasting', button.dataset.bottlingId)
      : navigate('tasting', button.dataset.bottlingId, {tastingId: button.dataset.tastingId}),

    /**
     * Handles the tasting create interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-create': () => tastingsView.saveDraft(),

    /**
     * Handles the tasting edit start interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-edit-start': () => tastingsView.startEditing(),

    /**
     * Handles the tasting edit done interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-edit-done': () => tastingsView.finishEditing(),

    /**
     * Handles the tasting open bottling interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-open-bottling': () => navigate('detail', state.selected),

    /**
     * Handles the tasting external edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-external-edit': () => tastingsView.startExternalEdit(),

    /**
     * Handles the tasting external cancel interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-external-cancel': () => tastingsView.cancelExternalEdit(),

    /**
     * Handles the tasting external save interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-external-save': () => tastingsView.persistExternalDetails(),

    /**
     * Handles the tasting external assign interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-external-assign': () => tastingsView.showAssignDialog(),

    /**
     * Handles the tasting external assign confirm interaction.
     * @return {*} Result computed from the supplied inputs.
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
